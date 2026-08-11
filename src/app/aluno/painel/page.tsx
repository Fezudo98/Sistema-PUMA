import { getUser } from "@/app/actions/auth";
import StudentDashboardClient from "./DashboardClient";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { computeStudentPerformanceStats } from "@/lib/stats";
import { getCachedGeneralRanking } from "@/lib/ranking";

const PAST_DAILY_SIMULADOS_LIMIT = 30;
const SPECIAL_SIMULADOS_LIMIT = 50;

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
    aiAnalysisDate: dbUser?.aiAnalysisDate ? dbUser.aiAnalysisDate.toISOString() : null,
    isTestUser: dbUser?.isTestUser || false
  };

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date();
  todayEnd.setHours(23, 59, 59, 999);

  // Consultas independentes entre si rodam em paralelo em vez de uma atrás da outra.
  const [
    answers,
    generalRanking,
    dailySimulados,
    activeApostilasCount,
    apostilasAtivas,
    pastDailySimulados,
    activeRooms,
    specialSimulados
  ] = await Promise.all([
    prisma.answer.findMany({
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
    }),
    getCachedGeneralRanking(),
    prisma.simulado.findMany({
      where: {
        tipo: "DAILY",
        createdAt: { gte: todayStart, lte: todayEnd }
      },
      include: {
        questions: { select: { id: true } }
      },
      orderBy: { createdAt: "desc" }
    }),
    prisma.apostila.count({ where: { isActive: true } }),
    prisma.apostila.findMany({ where: { isActive: true } }),
    prisma.simulado.findMany({
      where: {
        tipo: "DAILY",
        createdAt: { lt: todayStart }
      },
      include: {
        questions: { select: { id: true } }
      },
      orderBy: { createdAt: "desc" },
      take: PAST_DAILY_SIMULADOS_LIMIT + 1
    }),
    prisma.simulado.findMany({
      where: {
        status: { in: ["WAITING", "ACTIVE"] },
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
      orderBy: { createdAt: "desc" }
    }),
    prisma.simulado.findMany({
      where: { tipo: "SPECIAL" },
      include: {
        questions: { select: { id: true } }
      },
      orderBy: { createdAt: "desc" },
      take: SPECIAL_SIMULADOS_LIMIT
    })
  ]);

  const totalAnswers = answers.length;

  // Buscar apenas as respostas de sorteio vencidas por OUTROS alunos nos simulados
  // que este aluno participou (nunca a tabela inteira do sistema).
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

  const perfStats = computeStudentPerformanceStats(answers, user.userId, otherRaffleCounts);

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

  // Primeiro login do dia: se houver apostilas ativas sem simulado gerado hoje, dispara em background
  const isGeneratingDaily = activeApostilasCount > 0 && dailySimulados.length < activeApostilasCount;

  if (isGeneratingDaily) {
    const { checkAndGenerateDailySimulados } = await import("@/app/actions/dailySimulado");
    checkAndGenerateDailySimulados().catch((err) => {
      console.error("[BACKGROUND GENERATION] Geração paralela em background falhou:", err);
    });
  }

  // Set com as questões já respondidas pelo aluno, calculado uma única vez para
  // evitar varrer o array de respostas inteiro para cada simulado abaixo.
  const answeredQuestionIds = new Set(answers.map(a => a.questionId));

  const dailySimuladosWithStatus = dailySimulados.map((sim) => {
    const questionIds = sim.questions.map((q: { id: string }) => q.id);
    const studentAnswersCount = questionIds.filter(id => answeredQuestionIds.has(id)).length;

    const isCompleted = questionIds.length > 0 && studentAnswersCount >= questionIds.length;

    const linkedApostila = apostilasAtivas.find(a => a.title === sim.apostilaName);

    return {
      id: sim.id,
      apostilaName: sim.apostilaName || "Simulado de Estudo",
      apostilaCreatedAt: linkedApostila ? linkedApostila.createdAt.toISOString() : null,
      questionsCount: questionIds.length,
      isCompleted
    };
  });

  const hasMorePastDaily = pastDailySimulados.length > PAST_DAILY_SIMULADOS_LIMIT;
  const pastDailySimuladosPage = hasMorePastDaily
    ? pastDailySimulados.slice(0, PAST_DAILY_SIMULADOS_LIMIT)
    : pastDailySimulados;

  const pastDailySimuladosWithStatus = pastDailySimuladosPage.map((sim) => {
    const questionIds = sim.questions.map((q: { id: string }) => q.id);
    const studentAnswersCount = questionIds.filter(id => answeredQuestionIds.has(id)).length;

    const isCompleted = questionIds.length > 0 && studentAnswersCount >= questionIds.length;

    const linkedApostila = apostilasAtivas.find(a => a.title === sim.apostilaName);

    return {
      id: sim.id,
      apostilaName: sim.apostilaName || "Simulado de Estudo",
      apostilaCreatedAt: linkedApostila ? linkedApostila.createdAt.toISOString() : null,
      questionsCount: questionIds.length,
      isCompleted,
      createdAt: sim.createdAt.toISOString()
    };
  });

  const specialSimuladosWithStatus = specialSimulados.map((sim) => {
    const questionIds = sim.questions.map((q: { id: string }) => q.id);
    const studentAnswersCount = questionIds.filter(id => answeredQuestionIds.has(id)).length;
    const isCompleted = questionIds.length > 0 && studentAnswersCount >= questionIds.length;
    const isExpired = sim.expiresAt ? new Date(sim.expiresAt) < new Date() : false;

    return {
      id: sim.id,
      apostilaName: sim.apostilaName || "Missão Especial",
      questionsCount: questionIds.length,
      isCompleted,
      isExpired,
      expiresAt: sim.expiresAt ? sim.expiresAt.toISOString() : null
    };
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
      hasMorePastDailySimulados={hasMorePastDaily}
      specialSimulados={specialSimuladosWithStatus}
      isGeneratingDaily={isGeneratingDaily}
    />
  );
}
