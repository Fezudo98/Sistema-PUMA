import { getUser } from "@/app/actions/auth";
import StudentDashboardClient from "./DashboardClient";
import { redirect } from "next/navigation";
import { PrismaClient } from "@prisma/client";
import { computeStudentPerformanceStats } from "@/lib/stats";


const prisma = new PrismaClient();

export default async function AlunoPainel() {
  const user = await getUser();
  
  if (!user || user.role !== "STUDENT") {
    redirect("/aluno");
  }

  const dbUser = await prisma.user.findUnique({ where: { id: user.userId } });
  
  if (!dbUser) {
    redirect("/api/auth/force-logout");
  }

  const clientUser = {
    ...user,
    name: dbUser?.name || user.name,
    avatarUrl: dbUser?.avatarUrl || null,
    unlockedBadges: (dbUser as any)?.unlockedBadges ? (dbUser as any).unlockedBadges.split(',').filter(Boolean) : [],
    numero: (dbUser as any)?.numero || null,
    aiAnalysis: dbUser?.aiAnalysis || null,
    aiAnalysisSimuladoCount: dbUser?.aiAnalysisSimuladoCount || null,
    aiAnalysisDate: dbUser?.aiAnalysisDate ? dbUser.aiAnalysisDate.toISOString() : null
  };

  const answers = await prisma.answer.findMany({
    where: { studentId: user.userId },
    include: {
      question: {
        include: {
          simulado: {
            include: {
              _count: {
                select: { questions: true }
              }
            }
          }
        }
      }
    },
    orderBy: { id: "desc" }
  });

  const totalAnswers = answers.length;
  const correctAnswers = answers.filter(a => a.isCorrect).length;

  // Buscar todas as respostas de sorteio vencidas por outros alunos nesses simulados
  const simuladoIds = Array.from(new Set(answers.map(a => a.question.simuladoId)));
  const otherRaffleAnswers = await prisma.answer.findMany({
    where: {
      question: { simuladoId: { in: simuladoIds } },
      isRaffle: true,
      studentId: { not: user.userId }
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

  const participatedSimulados = new Map<string, number>();
  answers.forEach(a => {
    const simuladoId = a.question.simuladoId;
    const totalQ = (a.question.simulado as any)._count?.questions || 0;
    const otherRaffleCount = otherRaffleCounts.get(simuladoId) || 0;
    const expectedQ = Math.max(0, totalQ - otherRaffleCount);
    participatedSimulados.set(simuladoId, expectedQ);
  });

  const totalScore = answers.reduce((acc, curr) => acc + curr.pontuacao, 0);
  const avgTime = totalAnswers > 0 ? Math.round(answers.reduce((acc, curr) => acc + curr.tempoGasto, 0) / totalAnswers) : 0;

  // History grouped by simulado
  const historyMap = new Map();
  for (const a of answers) {
    const sId = a.question.simuladoId;
    if (!historyMap.has(sId)) {
      const totalQ = (a.question.simulado as any)._count?.questions || 0;
      const otherRaffleCount = otherRaffleCounts.get(sId) || 0;
      const expectedQ = Math.max(0, totalQ - otherRaffleCount);
      historyMap.set(sId, {
        id: sId,
        codigoSala: a.question.simulado.codigoSala,
        tipo: a.question.simulado.tipo,
        status: a.question.simulado.status,
        totalQuestions: expectedQ,
        correctAnswers: 0,
        score: 0,
        answeredCount: 0
      });
    }
    const sStats = historyMap.get(sId);
    if (a.isCorrect) sStats.correctAnswers++;
    sStats.score += a.pontuacao;
    sStats.answeredCount++;
  }
  
  const history = Array.from(historyMap.values())
    .filter(h => {
      const isFinished = h.tipo === "LIVE" ? h.status === "FINISHED" : true;
      return isFinished && h.answeredCount >= h.totalQuestions && h.totalQuestions > 0;
    })
    .map(h => ({
      id: h.id,
      codigoSala: h.codigoSala,
      totalQuestions: h.totalQuestions,
      correctAnswers: h.correctAnswers,
      score: h.score,
      accuracy: h.totalQuestions > 0 ? Math.round((h.correctAnswers / h.totalQuestions) * 100) : 0
    }));

  // Fetch all raffle answers across all students to deduct exclusive questions accurately
  const allRaffleAnswers = await prisma.answer.findMany({
    where: { isRaffle: true },
    select: {
      studentId: true,
      question: { select: { simuladoId: true } }
    }
  });
  const totalRaffleInSimulado = new Map<string, number>();
  const studentRaffleInSimulado = new Map<string, number>();
  allRaffleAnswers.forEach(ra => {
    const sId = ra.question.simuladoId;
    const uId = ra.studentId;
    totalRaffleInSimulado.set(sId, (totalRaffleInSimulado.get(sId) || 0) + 1);
    studentRaffleInSimulado.set(`${uId}_${sId}`, (studentRaffleInSimulado.get(`${uId}_${sId}`) || 0) + 1);
  });

  const perfStats = computeStudentPerformanceStats(answers, user.userId, totalRaffleInSimulado, studentRaffleInSimulado);

  const stats = {
    simuladosCount: history.length,
    totalAnswers: perfStats.totalAnswers,
    accuracy: perfStats.accuracy,
    avgTime: perfStats.avgTime,
    totalScore: perfStats.totalScore,
    streakDays: perfStats.streakDays,
    todayPoints: perfStats.todayPoints,
    history
  };

  // Buscar ranking geral da sala (todos os alunos com suas sequências, pontos de hoje e totais)
  const dbStudents = await prisma.user.findMany({
    where: { role: "STUDENT" },
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

  const generalRanking = dbStudents.map(student => {
    const sPerf = computeStudentPerformanceStats(student.answers, student.id, totalRaffleInSimulado, studentRaffleInSimulado);
    return {
      id: student.id,
      name: student.name,
      numero: (student as any).numero || null,
      avatarUrl: student.avatarUrl,
      totalScore: sPerf.totalScore,
      streakDays: sPerf.streakDays,
      todayPoints: sPerf.todayPoints
    };
  }).sort((a, b) => b.totalScore - a.totalScore);

  // 2. Fetch daily simulados for today
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date();
  todayEnd.setHours(23, 59, 59, 999);

  const dailySimulados = await prisma.simulado.findMany({
    where: {
      tipo: "DAILY",
      createdAt: {
        gte: todayStart,
        lte: todayEnd
      }
    },
    include: {
      questions: {
        select: { id: true }
      }
    },
    orderBy: { createdAt: "desc" }
  });

  // 3. Primeiro login do dia: se houver apostilas ativas sem simulado gerado hoje, dispara em background
  const activeApostilasCount = await prisma.apostila.count({
    where: { isActive: true }
  });
  const isGeneratingDaily = activeApostilasCount > 0 && dailySimulados.length < activeApostilasCount;

  if (isGeneratingDaily) {
    const { checkAndGenerateDailySimulados } = await import("@/app/actions/dailySimulado");
    checkAndGenerateDailySimulados().catch((err) => {
      console.error("[BACKGROUND GENERATION] Geração paralela em background falhou:", err);
    });
  }

  const dailySimuladosWithStatus = await Promise.all(
    dailySimulados.map(async (sim) => {
      const questionIds = sim.questions.map((q: { id: string }) => q.id);
      const studentAnswersCount = await prisma.answer.count({
        where: {
          studentId: user.userId,
          questionId: { in: questionIds }
        }
      });
      
      const isCompleted = questionIds.length > 0 && studentAnswersCount >= questionIds.length;
      
      return {
        id: sim.id,
        apostilaName: sim.apostilaName || "Simulado de Estudo",
        questionsCount: questionIds.length,
        isCompleted
      };
    })
  );

  // 3. Fetch past daily simulados (before today)
  const pastDailySimulados = await prisma.simulado.findMany({
    where: {
      tipo: "DAILY",
      createdAt: {
        lt: todayStart
      }
    },
    include: {
      questions: {
        select: { id: true }
      }
    },
    orderBy: { createdAt: "desc" }
  });

  const pastDailySimuladosWithStatus = await Promise.all(
    pastDailySimulados.map(async (sim) => {
      const questionIds = sim.questions.map((q: { id: string }) => q.id);
      const studentAnswersCount = await prisma.answer.count({
        where: {
          studentId: user.userId,
          questionId: { in: questionIds }
        }
      });
      
      const isCompleted = questionIds.length > 0 && studentAnswersCount >= questionIds.length;
      
      return {
        id: sim.id,
        apostilaName: sim.apostilaName || "Simulado de Estudo",
        questionsCount: questionIds.length,
        isCompleted,
        createdAt: sim.createdAt.toISOString()
      };
    })
  );

  // Buscar simulados ativos (WAITING ou ACTIVE) e apenas do tipo LIVE
  const activeRooms = await prisma.simulado.findMany({
    where: {
      status: {
        in: ["WAITING", "ACTIVE"]
      },
      tipo: "LIVE"
    },
    select: {
      id: true,
      codigoSala: true,
      status: true,
      createdAt: true,
      apostilaName: true,
      difficulty: true
    },
    orderBy: {
      createdAt: "desc"
    }
  });

  // Trigger missing Vade Mecum generation in the background
  const { checkAndGenerateMissingVadeMecums } = await import("@/app/actions/vadeMecum");
  checkAndGenerateMissingVadeMecums().catch((err) => {
    console.error("[STUDENT DASHBOARD] Geração de Vade Mecum em background falhou:", err);
  });

  return (
    <StudentDashboardClient 
      user={clientUser} 
      stats={stats} 
      generalRanking={generalRanking} 
      activeRooms={activeRooms} 
      dailySimulados={dailySimuladosWithStatus}
      pastDailySimulados={pastDailySimuladosWithStatus}
      isGeneratingDaily={isGeneratingDaily}
    />
  );
}
