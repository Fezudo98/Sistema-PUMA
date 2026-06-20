import { createServer } from 'http';
import { parse } from 'url';
import next from 'next';
import { Server } from 'socket.io';
import { PrismaClient } from '@prisma/client';

const dev = process.env.NODE_ENV !== 'production';
const hostname = '0.0.0.0';
const port = 3000;

const prisma = new PrismaClient();
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
  studentScores: Record<string, { id: string; name: string; score: number; avatarUrl?: string | null }>;
  answersReceived: number;
  raffleWinnerId: string | null;
  questionEndedData: { correta: number, justificativa: string } | null;
}
const rooms = new Map<string, RoomState>();

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
    cors: { origin: '*', methods: ['GET', 'POST'] }
  });

  io.on('connection', (socket) => {
    console.log(`[Socket] User connected: ${socket.id}`);

    // Join Room
    socket.on('join_room', async ({ roomCode, user }) => {
      socket.join(roomCode);
      
      socketInfo.set(socket.id, { roomCode, userId: user.userId || user.id, role: user.role, name: user.name });

      if (!rooms.has(roomCode)) {
        rooms.set(roomCode, {
          simuladoId: '',
          status: 'WAITING',
          currentQuestion: null,
          timeLeft: 0,
          timerInterval: null,
          isPaused: false,
          students: [],
          studentScores: {},
          answersReceived: 0,
          raffleWinnerId: null,
          questionEndedData: null
        });
      }

      const room = rooms.get(roomCode)!;
      if (user.role === 'STUDENT') {
        const uid = user.userId || user.id;
        const existingStudent = room.students.find(s => s.id === uid);
        if (!existingStudent) {
          room.students.push({ id: uid, name: user.name, avatarUrl: user.avatarUrl });
        } else {
          existingStudent.avatarUrl = user.avatarUrl;
        }
        
        if (!room.studentScores[uid]) {
          room.studentScores[uid] = { id: uid, name: user.name, score: 0, avatarUrl: user.avatarUrl };
        } else {
          room.studentScores[uid].avatarUrl = user.avatarUrl;
        }
      } else {
        if (user.simuladoId) room.simuladoId = user.simuladoId;
      }

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
    socket.on('next_question', async ({ roomCode, question }) => {
      const room = rooms.get(roomCode);
      if (!room) return;

      if (room.timerInterval) clearInterval(room.timerInterval);

      room.currentQuestion = question;
      room.timeLeft = question.tempoLimite;
      room.answersReceived = 0;
      room.isPaused = false;
      room.raffleWinnerId = null;
      room.questionEndedData = null;

      await prisma.question.update({ where: { id: question.id }, data: { status: 'ACTIVE' } });

      const questionPayload = {
        id: question.id,
        enunciado: question.enunciado,
        alternativas: question.alternativas,
        tempoLimite: question.tempoLimite
      };

      io.to(roomCode).emit('new_question', questionPayload);

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
    socket.on('next_question_raffle', async ({ roomCode, question }) => {
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

        await prisma.question.update({ where: { id: question.id }, data: { status: 'ACTIVE' } });

        const questionPayload = {
          id: question.id,
          enunciado: question.enunciado,
          alternativas: question.alternativas,
          tempoLimite: question.tempoLimite,
          raffleWinnerId: winner.id
        };

        io.to(roomCode).emit('new_question', questionPayload);

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
        room.questionEndedData = { correta: question.correta, justificativa: question.justificativa };
        
        await prisma.question.update({ where: { id: question.id }, data: { status: 'FINISHED' } });
        
        io.to(roomCode).emit('question_ended', {
          questionId: question.id,
          correta: question.correta,
          justificativa: question.justificativa
        });
        
        const ranking = Object.values(room.studentScores).sort((a, b) => b.score - a.score);
        io.to(roomCode).emit('ranking_update', { ranking });
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
        
        io.to(roomCode).emit('question_cancelled');
      }
    });

    // Student submits answer
    socket.on('submit_answer', async ({ roomCode, questionId, studentId, alternativa, tempoGasto }) => {
      const room = rooms.get(roomCode);
      if (!room || !room.currentQuestion) return;
      if (room.currentQuestion.id !== questionId) return;

      if (room.raffleWinnerId && room.raffleWinnerId !== studentId) return;

      const isCorrect = Number(room.currentQuestion.correta) === Number(alternativa);
      
      let pontuacao = 0;
      if (isCorrect) {
        // Velocidade importa: quanto menor o tempo gasto, maior o bônus
        const tempoRestante = Math.max(0, room.currentQuestion.tempoLimite - tempoGasto);
        const bonus = Math.max(0, Math.floor((tempoRestante / room.currentQuestion.tempoLimite) * 50));
        pontuacao = 100 + bonus;
      }

      // Atualiza o Ranking Acumulado
      if (room.studentScores[studentId]) {
        room.studentScores[studentId].score += pontuacao;
      }

      await prisma.answer.create({
        data: {
          questionId,
          studentId,
          alternativa,
          tempoGasto,
          isCorrect,
          pontuacao
        }
      });

      room.answersReceived += 1;
      io.to(roomCode).emit('instructor_student_answered', { count: room.answersReceived });

      const targetAnswers = room.raffleWinnerId ? 1 : room.students.length;
      if (room.answersReceived >= targetAnswers && room.timerInterval) {
        room.timeLeft = 0;
        io.to(roomCode).emit('time_tick', { timeLeft: room.timeLeft });
        clearInterval(room.timerInterval);
        room.timerInterval = null;
        room.isPaused = false;
        io.to(roomCode).emit('time_up');
      }
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
          // Remove da lista de online
          room.students = room.students.filter(s => s.id !== info.userId);
          io.to(info.roomCode).emit('room_update', { 
            status: room.status, 
            studentCount: room.students.length,
            students: room.students,
            currentQuestion: room.currentQuestion 
          });
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
