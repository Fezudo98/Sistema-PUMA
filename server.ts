import * as fs from 'fs';
import * as path from 'path';

function setupLogger() {
  try {
    const logDir = path.join(process.cwd(), 'logs');
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }

    const logFile = path.join(logDir, 'puma.log');
    const logStream = fs.createWriteStream(logFile, { flags: 'a', encoding: 'utf8' });

    const formatMessage = (level: string, args: any[]) => {
      const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);
      const message = args.map(arg => {
        if (arg instanceof Error) {
          return arg.stack || arg.message;
        }
        if (typeof arg === 'object') {
          try {
            return JSON.stringify(arg, null, 2);
          } catch {
            return String(arg);
          }
        }
        return String(arg);
      }).join(' ');
      return `[${timestamp}] [${level}] ${message}\n`;
    };

    const originalLog = console.log;
    const originalError = console.error;
    const originalWarn = console.warn;

    console.log = (...args: any[]) => {
      logStream.write(formatMessage('INFO', args));
      originalLog.apply(console, args);
    };

    console.error = (...args: any[]) => {
      logStream.write(formatMessage('ERROR', args));
      originalError.apply(console, args);
    };

    console.warn = (...args: any[]) => {
      logStream.write(formatMessage('WARN', args));
      originalWarn.apply(console, args);
    };

    console.log("==================================================");
    console.log("PUMA: Registrador de logs ativado em /logs/puma.log");
    console.log("==================================================");
  } catch (error) {
    console.error("Falha ao inicializar o gravador de logs:", error);
  }
}

setupLogger();

import { createServer } from 'http';
import { parse } from 'url';
import next from 'next';
import { Server } from 'socket.io';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function getSimuladoRanking(simuladoId: string) {
  try {
    const answers = await prisma.answer.findMany({
      where: {
        question: { simuladoId }
      },
      select: {
        studentId: true,
        pontuacao: true,
        student: {
          select: {
            name: true,
            avatarUrl: true
          }
        }
      }
    });

    const scoresMap = new Map<string, { id: string; name: string; score: number; avatarUrl?: string | null; streak: number }>();
    
    answers.forEach(a => {
      if (!scoresMap.has(a.studentId)) {
        scoresMap.set(a.studentId, {
          id: a.studentId,
          name: a.student.name,
          score: 0,
          avatarUrl: a.student.avatarUrl,
          streak: 0
        });
      }
      scoresMap.get(a.studentId)!.score += a.pontuacao || 0;
    });

    return Array.from(scoresMap.values()).sort((a, b) => b.score - a.score);
  } catch (err) {
    console.error("Error calculating ranking from DB:", err);
    return [];
  }
}

async function checkAndUnlockBadges(studentId: string, ioServer: any, currentSimuladoId: string) {
  try {
    const student = await prisma.user.findUnique({
      where: { id: studentId },
      include: {
        answers: {
          include: { 
            question: {
              include: { 
                simulado: {
                  include: {
                    _count: { select: { questions: true } }
                  }
                } 
              }
            } 
          }
        }
      }
    });

    if (!student) return;

    const correctAnswers = student.answers.filter(a => a.isCorrect);

    // Get other students' raffle answers in the participated simulados
    const simuladoIds = Array.from(new Set(student.answers.map(a => a.question.simuladoId)));
    const otherRaffleAnswers = await prisma.answer.findMany({
      where: {
        question: { simuladoId: { in: simuladoIds } },
        isRaffle: true,
        studentId: { not: studentId }
      },
      select: {
        question: { select: { simuladoId: true } }
      }
    });

    const otherRaffleCounts = new Map<string, number>();
    otherRaffleAnswers.forEach(ora => {
      const sId = ora.question.simuladoId;
      otherRaffleCounts.set(sId, (otherRaffleCounts.get(sId) || 0) + 1);
    });

    // Calculate total questions across all unique simulados the student participated in
    const participatedSimulados = new Map<string, number>();
    student.answers.forEach(a => {
      const simuladoId = a.question.simuladoId;
      const totalQ = a.question.simulado._count.questions;
      const otherRaffleCount = otherRaffleCounts.get(simuladoId) || 0;
      const expectedQ = Math.max(0, totalQ - otherRaffleCount);
      participatedSimulados.set(simuladoId, expectedQ);
    });

    const totalQuestions = Array.from(participatedSimulados.values()).reduce((sum, count) => sum + count, 0);
    const accuracy = totalQuestions > 0 ? Math.round((correctAnswers.length / totalQuestions) * 100) : 0;
    const totalScore = student.answers.reduce((acc, curr) => acc + (curr.pontuacao || 0), 0);
    
    const simuladoGroups: Record<string, typeof student.answers> = {};
    student.answers.forEach(a => {
      if (!simuladoGroups[a.question.simuladoId]) simuladoGroups[a.question.simuladoId] = [];
      simuladoGroups[a.question.simuladoId].push(a);
    });

    const simuladosCount = Object.keys(simuladoGroups).length;
    
    let advancedSimuladosCount = 0;
    let hardSimuladosWith70Acc = 0;
    let hardSimuladosWith75Acc = 0;
    let hasSniper = false;
    let hasRaio = false;

    Object.values(simuladoGroups).forEach(simAnswers => {
      if (simAnswers.length === 0) return;
      const qCount = simAnswers.length;
      const totalQuestionsInSimulado = simAnswers[0].question.simulado._count.questions;
      const corrects = simAnswers.filter(a => a.isCorrect).length;
      
      const acc = Math.round((corrects / totalQuestionsInSimulado) * 100);
      const avgTime = Math.round(simAnswers.reduce((acc, curr) => acc + (curr.tempoGasto || 0), 0) / qCount);
      const difficulty = simAnswers[0].question.simulado.difficulty;

      // Only evaluate if the student has answered a significant portion of the simulado
      // Either all questions, or at least 10 questions to prevent 1-question exploits
      const isCompleteEnough = qCount === totalQuestionsInSimulado || qCount >= 10;

      if (difficulty === "AVANCADO" && isCompleteEnough) {
        advancedSimuladosCount++;
        if (acc >= 70) hardSimuladosWith70Acc++;
        if (acc >= 75) hardSimuladosWith75Acc++;
        
        if (qCount >= 15 && acc === 100) hasSniper = true;
        if (acc >= 80 && avgTime <= 20) hasRaio = true;
      }
    });

    // Recruta is given if they answered at least 3 questions or finished their first small simulado
    const hasRecruta = Object.values(simuladoGroups).some(simAnswers => {
      return simAnswers.length >= 3 || simAnswers.length === simAnswers[0].question.simulado._count.questions;
    });

    // Evaluation of Negative/Humorous Badges
    let maxConsecutiveErrors = 0;
    let currentConsecutiveErrors = 0;
    student.answers.forEach(a => {
      if (!a.isCorrect) {
        currentConsecutiveErrors++;
        if (currentConsecutiveErrors > maxConsecutiveErrors) {
          maxConsecutiveErrors = currentConsecutiveErrors;
        }
      } else {
        currentConsecutiveErrors = 0;
      }
    });
    const hasBizonho = maxConsecutiveErrors >= 3;

    const hasAfoito = student.answers.some(a => !a.isCorrect && a.tempoGasto > 0 && a.tempoGasto < 3);
    const hasDorminhoco = student.answers.some(a => a.alternativa === -1);

    let hasPepreto = false;
    Object.values(simuladoGroups).forEach(simAnswers => {
      if (simAnswers.length === 0) return;
      const totalQuestionsInSimulado = simAnswers[0].question.simulado._count.questions;
      const corrects = simAnswers.filter(a => a.isCorrect).length;
      const acc = Math.round((corrects / totalQuestionsInSimulado) * 100);
      
      if (totalQuestionsInSimulado >= 5 && simAnswers.length === totalQuestionsInSimulado) {
        if (acc < 10) {
          hasPepreto = true;
        }
      }
    });

    let badges = [
      { id: 'recruta', name: 'Recruta', earned: hasRecruta, exclusive: false },
      { id: 'guerreiro', name: 'Guerreiro', earned: hardSimuladosWith70Acc >= 5, exclusive: false },
      { id: 'veterano', name: 'Veterano', earned: hardSimuladosWith75Acc >= 10, exclusive: false },
      { id: 'sniper', name: 'Atirador de Elite', earned: hasSniper, exclusive: true },
      { id: 'raio', name: 'Pronto Resposta (Raio)', earned: hasRaio, exclusive: true },
      { id: 'caveira', name: 'Caveira', earned: advancedSimuladosCount >= 15 && accuracy >= 95, exclusive: true },
      { id: 'padrao', name: 'Padrão PM', earned: totalScore >= 15000 && accuracy >= 90, exclusive: true },
      { id: 'bizonho', name: 'Bizonho', earned: hasBizonho, exclusive: false },
      { id: 'afoito', name: 'Gatilho Afoito', earned: hasAfoito, exclusive: false },
      { id: 'dorminhoco', name: 'Dormiu na Guarita', earned: hasDorminhoco, exclusive: false },
      { id: 'pepreto', name: 'Pé Preto', earned: hasPepreto, exclusive: false }
    ];

    // Check exclusivity
    for (let i = 0; i < badges.length; i++) {
      if (badges[i].exclusive && badges[i].earned) {
        const existingExclusive = await prisma.exclusiveBadge.findFirst({
          where: { badgeId: badges[i].id }
        });

        if (existingExclusive) {
          // If already claimed by someone else in a different simulado
          if (existingExclusive.simuladoId !== currentSimuladoId) {
            badges[i].earned = false;
          }
        } else {
          // Claim it now for this simulado
          await prisma.exclusiveBadge.create({
            data: { badgeId: badges[i].id, userId: studentId, simuladoId: currentSimuladoId }
          });
        }
      }
    }

    const earnedBadgeIds = badges.filter(b => b.earned).map(b => b.id);
    const previouslyUnlocked = (student as any).unlockedBadges ? (student as any).unlockedBadges.split(',').filter(Boolean) : [];

    const newlyUnlocked = earnedBadgeIds.filter(id => !previouslyUnlocked.includes(id));

    if (newlyUnlocked.length > 0) {
      const newUnlockedBadges = [...previouslyUnlocked, ...newlyUnlocked].join(',');
      await prisma.user.update({
        where: { id: studentId },
        data: { unlockedBadges: newUnlockedBadges }
      });

      const unlockedDetails = badges.filter(b => newlyUnlocked.includes(b.id));
      ioServer.emit('badges_unlocked', { studentId, newBadges: unlockedDetails });
    }
  } catch (error) {
    console.error("Error checking badges:", error);
  }
}

const dev = process.env.NODE_ENV !== 'production';
const hostname = '0.0.0.0';
const port = 3000;

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

// Room State In-Memory
interface RoomState {
  simuladoId: string;
  status: 'WAITING' | 'ACTIVE' | 'FINISHED';
  currentQuestion: any | null;
  timeLeft: number;
  timerInterval: NodeJS.Timeout | null;
  isPaused: boolean;
  students: { id: string; name: string; avatarUrl?: string | null }[];
  studentScores: Record<string, { id: string; name: string; score: number; avatarUrl?: string | null; streak: number }>;
  answersReceived: number;
  raffleWinnerId: string | null;
  questionEndedData: { 
    correta: number; 
    justificativa: string;
    percentages?: number[];
    unansweredPercentage?: number;
  } | null;
  pendingNotifications: string[];
  answeredStudentIds: string[];
  maxConnectedCount: number;
}
const rooms = new Map<string, RoomState>();
const disconnectTimeouts = new Map<string, NodeJS.Timeout>();

// Track socket connection info to handle disconnects
const socketInfo = new Map<string, { roomCode: string; userId: string; role: string; name: string }>();

app.prepare().then(() => {
  const server = createServer(async (req, res) => {
    try {
      const parsedUrl = parse(req.url!, true);
      await handle(req, res, parsedUrl);
    } catch (err) {
      console.error('Error occurred handling', req.url, err);
      res.statusCode = 500;
      res.end('internal server error');
    }
  });

  const io = new Server(server, {
    cors: { origin: '*', methods: ['GET', 'POST'] },
    pingTimeout: 30000,
    pingInterval: 10000
  });

  io.on('connection', (socket) => {
    console.log(`[Socket] User connected: ${socket.id}`);

    // Join Room
    socket.on('join_room', async ({ roomCode, user }) => {
      socket.join(roomCode);
      
      socketInfo.set(socket.id, { roomCode, userId: user.userId || user.id, role: user.role, name: user.name });

      if (!rooms.has(roomCode)) {
        const dbSimulado = await prisma.simulado.findUnique({
          where: { codigoSala: roomCode }
        });

        rooms.set(roomCode, {
          simuladoId: dbSimulado ? dbSimulado.id : '',
          status: dbSimulado ? (dbSimulado.status as any) : 'WAITING',
          currentQuestion: null,
          timeLeft: 0,
          timerInterval: null,
          isPaused: false,
          students: [],
          studentScores: {},
          answersReceived: 0,
          raffleWinnerId: null,
          questionEndedData: null,
          pendingNotifications: [],
          answeredStudentIds: [],
          maxConnectedCount: 0
        });

        if (dbSimulado) {
          // Restaurar o ranking diretamente do banco de dados para evitar perdas
          const ranking = await getSimuladoRanking(dbSimulado.id);
          const room = rooms.get(roomCode)!;
          ranking.forEach(r => {
            room.studentScores[r.id] = r;
          });
        }
      }

      const room = rooms.get(roomCode)!;
      let studentAnswer = null;

      if (user.role === 'STUDENT') {
        const uid = user.userId || user.id;
        
        // Cancel pending disconnect timeout if any
        if (disconnectTimeouts.has(uid)) {
          clearTimeout(disconnectTimeouts.get(uid)!);
          disconnectTimeouts.delete(uid);
          console.log(`[Socket] Reconnection detected. Cancelled disconnect timeout for user ${uid}`);
        }

        const existingStudent = room.students.find(s => s.id === uid);
        if (!existingStudent) {
          room.students.push({ id: uid, name: user.name, avatarUrl: user.avatarUrl });
        } else {
          existingStudent.avatarUrl = user.avatarUrl;
        }

        // Atualizar pico de conexões ativas na sala
        room.maxConnectedCount = Math.max(room.maxConnectedCount || 0, room.students.length);
        
        if (!room.studentScores[uid]) {
          room.studentScores[uid] = { id: uid, name: user.name, score: 0, avatarUrl: user.avatarUrl, streak: 0 };
        } else {
          room.studentScores[uid].avatarUrl = user.avatarUrl;
        }

        // Se a questão atual está rodando, verifica se o aluno reconectando já tem resposta gravada no DB
        if (room.currentQuestion) {
          studentAnswer = await prisma.answer.findFirst({
            where: {
              questionId: room.currentQuestion.id,
              studentId: uid
            }
          });
        }
      } else {
        if (user.simuladoId) room.simuladoId = user.simuladoId;
      }

      // Envia room_update privado para o aluno que acabou de entrar, contendo a resposta restaurada
      socket.emit('room_update', { 
        status: room.status, 
        studentCount: room.students.length,
        students: room.students,
        currentQuestion: room.currentQuestion,
        timeLeft: room.timeLeft,
        isPaused: room.isPaused,
        raffleWinnerId: room.raffleWinnerId,
        questionEndedData: room.questionEndedData,
        answeredStudentIds: room.answeredStudentIds || [],
        restoredAnswer: studentAnswer ? { alternativa: studentAnswer.alternativa, isCorrect: studentAnswer.isCorrect } : null
      });

      // Broadcast padrão para os outros membros da sala
      socket.to(roomCode).emit('room_update', { 
        status: room.status, 
        studentCount: room.students.length,
        students: room.students,
        currentQuestion: room.currentQuestion,
        timeLeft: room.timeLeft,
        isPaused: room.isPaused,
        raffleWinnerId: room.raffleWinnerId,
        questionEndedData: room.questionEndedData,
        answeredStudentIds: room.answeredStudentIds || []
      });
      
      // Envia o ranking atual para quem acabou de entrar
      const currentRanking = Object.values(room.studentScores).sort((a, b) => b.score - a.score);
      io.to(roomCode).emit('ranking_update', { ranking: currentRanking });
    });

    // Instructor starts simulado
    socket.on('start_simulado', async ({ roomCode, simuladoId }) => {
      const room = rooms.get(roomCode);
      if (room && room.status === 'WAITING') {
        room.status = 'ACTIVE';
        await prisma.simulado.update({ where: { id: simuladoId }, data: { status: 'ACTIVE' } });
        io.to(roomCode).emit('simulado_started');
        io.to(roomCode).emit('room_update', { 
          status: room.status, 
          studentCount: room.students.length,
          students: room.students,
          currentQuestion: room.currentQuestion,
          timeLeft: room.timeLeft,
          isPaused: room.isPaused,
          raffleWinnerId: room.raffleWinnerId,
          questionEndedData: room.questionEndedData
        });
      }
    });

    // Instructor ends simulado
    socket.on('end_simulado', async ({ roomCode, simuladoId }) => {
      const room = rooms.get(roomCode);
      if (room) {
        room.status = 'FINISHED';
        // Note: DB update is handled by the server action endSimulado, but we could do it here too
        io.to(roomCode).emit('room_update', { 
          status: room.status, 
          studentCount: room.students.length,
          students: room.students,
          currentQuestion: room.currentQuestion,
          timeLeft: room.timeLeft,
          isPaused: room.isPaused,
          raffleWinnerId: room.raffleWinnerId,
          questionEndedData: room.questionEndedData
        });
      }
    });

    // Instructor launches next question
    socket.on('next_question', async ({ roomCode, question, isLast }) => {
      const room = rooms.get(roomCode);
      if (!room) return;

      if (room.timerInterval) clearInterval(room.timerInterval);

      room.currentQuestion = question;
      room.timeLeft = question.tempoLimite;
      room.answersReceived = 0;
      room.isPaused = false;
      room.raffleWinnerId = null;
      room.questionEndedData = null;
      room.answeredStudentIds = [];

      await prisma.question.update({ where: { id: question.id }, data: { status: 'ACTIVE' } });

      const questionPayload = {
        id: question.id,
        enunciado: question.enunciado,
        alternativas: question.alternativas,
        tempoLimite: question.tempoLimite
      };

      io.to(roomCode).emit('new_question', questionPayload);

      if (isLast) {
        const ranking = Object.values(room.studentScores).sort((a: any, b: any) => b.score - a.score);
        if (ranking.length >= 2) {
          const leader = ranking[0].name.split(' ')[0];
          const runnerUp = ranking[1].name.split(' ')[0];
          if (!room.pendingNotifications) room.pendingNotifications = [];
          room.pendingNotifications.push(`⚔️ COMBATE NO TOPO: A última questão decidirá o combate direto entre ${leader} e ${runnerUp}!`);
          io.to(roomCode).emit('streak_notifications', { notifications: room.pendingNotifications });
          room.pendingNotifications = [];
        }
      }

      room.timerInterval = setInterval(async () => {
        room.timeLeft -= 1;
        io.to(roomCode).emit('time_tick', { timeLeft: room.timeLeft });

        if (room.timeLeft <= 0) {
          clearInterval(room.timerInterval!);
          room.timerInterval = null;
          room.isPaused = false;
          io.to(roomCode).emit('time_up');
        }
      }, 1000);
    });

    // Instructor launches next question in raffle mode
    socket.on('next_question_raffle', async ({ roomCode, question, isLast }) => {
      const room = rooms.get(roomCode);
      if (!room || room.students.length === 0) return;

      if (room.timerInterval) clearInterval(room.timerInterval);

      // Sorteia um aluno
      const randomIndex = Math.floor(Math.random() * room.students.length);
      const winner = room.students[randomIndex];
      room.raffleWinnerId = winner.id;

      // Emite o início do sorteio
      io.to(roomCode).emit('raffle_started', { winner });

      // Aguarda 4s e dispara a questão
      setTimeout(async () => {
        const currentRoom = rooms.get(roomCode);
        if (!currentRoom) return;

        currentRoom.currentQuestion = question;
        currentRoom.timeLeft = question.tempoLimite;
        currentRoom.answersReceived = 0;
        currentRoom.isPaused = false;
        currentRoom.questionEndedData = null;
        currentRoom.answeredStudentIds = [];

        await prisma.question.update({ where: { id: question.id }, data: { status: 'ACTIVE' } });

        const questionPayload = {
          id: question.id,
          enunciado: question.enunciado,
          alternativas: question.alternativas,
          tempoLimite: question.tempoLimite,
          raffleWinnerId: winner.id
        };

        io.to(roomCode).emit('new_question', questionPayload);

        if (isLast) {
          const ranking = Object.values(currentRoom.studentScores).sort((a: any, b: any) => b.score - a.score);
          if (ranking.length >= 2) {
            const leader = ranking[0].name.split(' ')[0];
            const runnerUp = ranking[1].name.split(' ')[0];
            if (!currentRoom.pendingNotifications) currentRoom.pendingNotifications = [];
            currentRoom.pendingNotifications.push(`⚔️ COMBATE NO TOPO: A última questão decidirá o combate direto entre ${leader} e ${runnerUp}!`);
            io.to(roomCode).emit('streak_notifications', { notifications: currentRoom.pendingNotifications });
            currentRoom.pendingNotifications = [];
          }
        }

        currentRoom.timerInterval = setInterval(async () => {
          currentRoom.timeLeft -= 1;
          io.to(roomCode).emit('time_tick', { timeLeft: currentRoom.timeLeft });

          if (currentRoom.timeLeft <= 0) {
            clearInterval(currentRoom.timerInterval!);
            currentRoom.timerInterval = null;
            currentRoom.isPaused = false;
            io.to(roomCode).emit('time_up');
          }
        }, 1000);

      }, 4000);
    });

    // Instructor forcefully ends time
    socket.on('end_time', async ({ roomCode }) => {
      const room = rooms.get(roomCode);
      if (room && room.currentQuestion) {
        if (room.timerInterval) {
           clearInterval(room.timerInterval);
           room.timerInterval = null;
        }
        room.timeLeft = 0;
        room.isPaused = false;
        io.to(roomCode).emit('time_tick', { timeLeft: room.timeLeft });
        io.to(roomCode).emit('time_up');
      }
    });

    // Instructor reveals result
    socket.on('reveal_result', async ({ roomCode }) => {
      const room = rooms.get(roomCode);
      if (room && room.currentQuestion) {
        const question = room.currentQuestion;
        room.isPaused = false;
        
        await prisma.question.update({ where: { id: question.id }, data: { status: 'FINISHED' } });

        // Registra respostas em branco para os alunos na sala que não responderam
        const answeredIds = room.answeredStudentIds || [];
        let unansweredStudents = room.students.filter(st => !answeredIds.includes(st.id));
        
        // Se for modo de sorteio, apenas o aluno sorteado pode ter resposta em branco registrada (caso não tenha respondido)
        if (room.raffleWinnerId) {
          unansweredStudents = unansweredStudents.filter(st => st.id === room.raffleWinnerId);
        }
        
        for (const st of unansweredStudents) {
          try {
            await prisma.answer.create({
              data: {
                questionId: question.id,
                studentId: st.id,
                alternativa: -1, // -1 indica timeout / sem resposta
                tempoGasto: question.tempoLimite,
                isCorrect: false,
                pontuacao: 0,
                isRaffle: !!room.raffleWinnerId
              }
            });

            // Atualiza o streak de erro para quem não respondeu
            if (room.studentScores[st.id]) {
              const currentStreak = room.studentScores[st.id].streak;
              const newStreak = currentStreak < 0 ? currentStreak - 1 : -1;
              room.studentScores[st.id].streak = newStreak;

              const studentName = room.studentScores[st.id].name.split(' ')[0];
              if (!room.pendingNotifications) room.pendingNotifications = [];

              if (currentStreak >= 3) {
                room.pendingNotifications.push(`💦 ${studentName} vacilou e perdeu uma sequência de ${currentStreak} acertos.`);
              } else if (newStreak <= -3 && Math.abs(newStreak) % 3 === 0) {
                room.pendingNotifications.push(`🥶 ${studentName} congelou e chegou a ${Math.abs(newStreak)} erros seguidos... Ta devendo 10 pro Instrutor.`);
              }
            }
          } catch (e) {
            console.error("Error saving unanswered record:", e);
          }
        }

        // Buscar todas as respostas da questão para calcular as estatísticas de marcação
        const questionAnswers = await prisma.answer.findMany({
          where: { questionId: question.id }
        });

        const totalAnswers = questionAnswers.length;
        const distribution = [0, 0, 0, 0, 0];
        let unansweredCount = 0;

        questionAnswers.forEach(ans => {
          if (ans.alternativa >= 0 && ans.alternativa < 5) {
            distribution[ans.alternativa]++;
          } else {
            unansweredCount++;
          }
        });

        const percentages = distribution.map(count => 
          totalAnswers > 0 ? Math.round((count / totalAnswers) * 100) : 0
        );
        const unansweredPercentage = totalAnswers > 0 ? Math.round((unansweredCount / totalAnswers) * 100) : 0;

        // Armazena no estado em memória para reconectados
        room.questionEndedData = { 
          correta: question.correta, 
          justificativa: question.justificativa,
          percentages,
          unansweredPercentage
        };
        
        io.to(roomCode).emit('question_ended', {
          questionId: question.id,
          correta: question.correta,
          justificativa: question.justificativa,
          percentages,
          unansweredPercentage
        });
        
        const ranking = Object.values(room.studentScores).sort((a, b) => b.score - a.score);
        io.to(roomCode).emit('ranking_update', { ranking });
        
        if (room.pendingNotifications && room.pendingNotifications.length > 0) {
          io.to(roomCode).emit('streak_notifications', { notifications: room.pendingNotifications });
          room.pendingNotifications = []; // Clear for next round
        }
      }
    });

    // Instructor pauses time
    socket.on('pause_time', async ({ roomCode }) => {
      const room = rooms.get(roomCode);
      if (room && room.timerInterval && !room.isPaused) {
        clearInterval(room.timerInterval);
        room.timerInterval = null;
        room.isPaused = true;
        io.to(roomCode).emit('time_paused');
      }
    });

    // Instructor resumes time
    socket.on('resume_time', async ({ roomCode }) => {
      const room = rooms.get(roomCode);
      if (room && room.isPaused && room.currentQuestion) {
        room.isPaused = false;
        io.to(roomCode).emit('time_resumed');

        const question = room.currentQuestion;

        room.timerInterval = setInterval(async () => {
          room.timeLeft -= 1;
          io.to(roomCode).emit('time_tick', { timeLeft: room.timeLeft });

          if (room.timeLeft <= 0) {
            clearInterval(room.timerInterval!);
            room.timerInterval = null;
            room.isPaused = false;
            io.to(roomCode).emit('time_up');
          }
        }, 1000);
      }
    });

    // Instructor cancels question
    socket.on('cancel_question', async ({ roomCode }) => {
      const room = rooms.get(roomCode);
      if (room && room.currentQuestion) {
        // Se cancelado, emitir para o cliente voltar pra espera
        room.currentQuestion = null;
        room.answeredStudentIds = [];
        
        io.to(roomCode).emit('question_cancelled');
      }
    });

    // Student submits answer
    socket.on('submit_answer', async ({ roomCode, questionId, studentId, alternativa, tempoGasto }) => {
      const room = rooms.get(roomCode);
      if (!room || !room.currentQuestion) return;
      if (room.currentQuestion.id !== questionId) return;

      if (room.raffleWinnerId && room.raffleWinnerId !== studentId) return;

      // Prevent duplicate answers
      const existingAnswer = await prisma.answer.findFirst({
        where: {
          questionId,
          studentId
        }
      });
      if (existingAnswer) {
        console.log(`[Socket] Answer already exists for student ${studentId} on question ${questionId}. Ignoring duplicate.`);
        return;
      }

      const isCorrect = Number(room.currentQuestion.correta) === Number(alternativa);
      
      let pontuacao = 0;
      if (isCorrect) {
        // Velocidade importa: quanto menor o tempo gasto, maior o bônus
        const tempoRestante = Math.max(0, room.currentQuestion.tempoLimite - tempoGasto);
        const bonus = Math.max(0, Math.floor((tempoRestante / room.currentQuestion.tempoLimite) * 50));
        pontuacao = 100 + bonus;
      }

      // Atualiza o Ranking Acumulado e a Sequência (Streak)
      if (room.studentScores[studentId]) {
        room.studentScores[studentId].score += pontuacao;
        
        const currentStreak = room.studentScores[studentId].streak;
        const studentName = room.studentScores[studentId].name.split(' ')[0]; // Pega só o primeiro nome
        let newStreak = 0;
        
        if (!room.pendingNotifications) {
          room.pendingNotifications = [];
        }

        if (isCorrect) {
          newStreak = currentStreak > 0 ? currentStreak + 1 : 1;
          
          if (currentStreak <= -3) {
            room.pendingNotifications.push(`🧊 ${studentName} quebrou o gelo e se recuperou de uma sequência de ${Math.abs(currentStreak)} erros!`);
          } else if (newStreak === 3) {
            room.pendingNotifications.push(`🔥 ${studentName} está aquecendo com 3 acertos seguidos!`);
          } else if (newStreak === 5) {
            room.pendingNotifications.push(`⚡ IMPARÁVEL! ${studentName} atingiu uma sequência implacável de 5 acertos!`);
          } else if (newStreak > 5 && newStreak % 3 === 0) {
            room.pendingNotifications.push(`💀 OPERACIONAL HABILITADO! ${studentName} alcançou ${newStreak} acertos seguidos!`);
          }
        } else {
          newStreak = currentStreak < 0 ? currentStreak - 1 : -1;
          
          if (currentStreak >= 3) {
            room.pendingNotifications.push(`💦 ${studentName} vacilou e perdeu uma sequência de ${currentStreak} acertos.`);
          } else if (newStreak <= -3 && Math.abs(newStreak) % 3 === 0) {
            room.pendingNotifications.push(`🥶 ${studentName} congelou e chegou a ${Math.abs(newStreak)} erros seguidos... Ta devendo 10 pro Instrutor.`);
          }
        }
        
        room.studentScores[studentId].streak = newStreak;
      }

      let safeTempoGasto = Number(tempoGasto) || 0;
      if (safeTempoGasto < 0) safeTempoGasto = 0;
      // Clamp to a reasonable max (twice the time limit just in case of lag/pause bugs)
      if (safeTempoGasto > room.currentQuestion.tempoLimite * 2) {
        safeTempoGasto = room.currentQuestion.tempoLimite;
      }

      await prisma.answer.create({
        data: {
          questionId,
          studentId,
          alternativa,
          tempoGasto: safeTempoGasto,
          isCorrect,
          pontuacao,
          isRaffle: !!room.raffleWinnerId
        }
      });

      if (!room.answeredStudentIds) room.answeredStudentIds = [];
      if (!room.answeredStudentIds.includes(studentId)) {
        room.answeredStudentIds.push(studentId);
      }

      room.answersReceived += 1;
      io.to(roomCode).emit('instructor_student_answered', { 
        count: room.answersReceived,
        answeredStudentIds: room.answeredStudentIds
      });

      const targetAnswers = room.raffleWinnerId ? 1 : (room.maxConnectedCount || room.students.length);
      if (room.answersReceived >= targetAnswers && room.timerInterval) {
        room.timeLeft = 0;
        io.to(roomCode).emit('time_tick', { timeLeft: room.timeLeft });
        clearInterval(room.timerInterval);
        room.timerInterval = null;
        room.isPaused = false;
        io.to(roomCode).emit('time_up');
      }

      // Checagem silenciosa de brevês conquistados e envio global caso haja novo
      const currentSimuladoId = room.currentQuestion.simuladoId;
      checkAndUnlockBadges(studentId, io, currentSimuladoId);

      // Envia o ranking atualizado em tempo real para todos os alunos
      const currentRanking = Object.values(room.studentScores).sort((a: any, b: any) => b.score - a.score);
      io.to(roomCode).emit('ranking_update', { ranking: currentRanking });
    });

    // Instructor ends simulado
    socket.on('end_simulado', async ({ roomCode, simuladoId }) => {
      const room = rooms.get(roomCode);
      if (room) {
        room.status = 'FINISHED';
        if (room.timerInterval) clearInterval(room.timerInterval);
        await prisma.simulado.update({ where: { id: simuladoId }, data: { status: 'FINISHED' } });
        
        // Garante que o último estado do ranking seja enviado antes de deletar a sala
        const ranking = Object.values(room.studentScores).sort((a: any, b: any) => b.score - a.score);
        io.to(roomCode).emit('ranking_update', { ranking });
        
        io.to(roomCode).emit('simulado_ended');
        rooms.delete(roomCode); // Limpa da memória
      }
    });

    socket.on('disconnect', () => {
      console.log(`[Socket] User disconnected: ${socket.id}`);
      const info = socketInfo.get(socket.id);
      if (info) {
        socketInfo.delete(socket.id);
        const room = rooms.get(info.roomCode);
        if (room && info.role === 'STUDENT') {
          const uid = info.userId;
          
          if (disconnectTimeouts.has(uid)) {
            clearTimeout(disconnectTimeouts.get(uid)!);
          }
          
          // Wait 15 seconds before removing from online students to handle transient disconnects
          const timeout = setTimeout(() => {
            disconnectTimeouts.delete(uid);
            const currentRoom = rooms.get(info.roomCode);
            if (currentRoom) {
              currentRoom.students = currentRoom.students.filter(s => s.id !== uid);
              io.to(info.roomCode).emit('room_update', { 
                status: currentRoom.status, 
                studentCount: currentRoom.students.length,
                students: currentRoom.students,
                currentQuestion: currentRoom.currentQuestion 
              });
              console.log(`[Socket] Removed user ${uid} from room ${info.roomCode} after grace period`);
            }
          }, 15000);
          
          disconnectTimeouts.set(uid, timeout);
          console.log(`[Socket] User ${uid} disconnected. Started 15s grace period.`);
        }
      }
    });
  });

  server.once('error', (err) => {
    console.error(err);
    process.exit(1);
  });

  server.listen(port, hostname, () => {
    console.log(`> Ready on Rede Local (0.0.0.0) na porta ${port}`);
  });
});
