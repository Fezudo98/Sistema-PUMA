import { getUser } from "@/app/actions/auth";
import StudentDashboardClient from "./DashboardClient";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getStudentEffectiveStats } from "@/lib/studentStatsRead";
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
    displayedBadges: (dbUser as any)?.displayedBadges ? (dbUser as any).displayedBadges.split(',').filter(Boolean) : [],
    numero: (dbUser as any)?.numero || null,
    aiAnalysis: dbUser?.aiAnalysis || null,
    aiAnalysisSimuladoCount: dbUser?.aiAnalysisSimuladoCount || null,
    aiAnalysisDate: dbUser?.aiAnalysisDate ? dbUser.aiAnalysisDate.toISOString() : null,
    isTestUser: dbUser?.isTestUser || false,
    hasSeenDueloIntro: (dbUser as any)?.hasSeenDueloIntro || false
  };

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date();
  todayEnd.setHours(23, 59, 59, 999);

  // Consultas independentes entre si rodam em paralelo em vez de uma atrás da outra.
  const [
    generalRanking,
    dailySimulados,
    activeApostilasCount,
    apostilasAtivas,
    pastDailySimulados,
    activeRooms,
    specialSimulados,
    provaApostilas
  ] = await Promise.all([
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
    }),
    prisma.apostila.findMany({ where: { isProvaSubject: true } })
  ]);

  const blocosDeProva = provaApostilas.length > 0
    ? await prisma.simulado.findMany({
        where: {
          tipo: "BLOCO_PROVA",
          apostilaName: { in: provaApostilas.map((a) => a.title) }
        },
        include: {
          questions: { select: { id: true } }
        },
        orderBy: { createdAt: "desc" }
      })
    : [];

  // Estatísticas pré-agregadas (StudentStats) — O(1), não recarrega o histórico
  // completo de respostas do aluno.
  const perfStats = await getStudentEffectiveStats(user.userId);

  // Histórico de simulados completos: cada linha já foi calculada uma vez no
  // momento da conclusão (ver src/lib/studentStatsFold.ts) — não precisa
  // reagrupar nada aqui.
  const completions = await prisma.studentSimuladoCompletion.findMany({
    where: { studentId: user.userId, statsFoldedAt: { not: null } },
    orderBy: { statsFoldedAt: "desc" }
  });
  const history = completions.map((c) => {
    const totalQuestions = c.totalQuestions || 0;
    const correctAnswers = c.correctAnswers || 0;
    return {
      id: c.simuladoId,
      codigoSala: c.codigoSala,
      totalQuestions,
      correctAnswers,
      score: c.score || 0,
      accuracy: totalQuestions > 0 ? Math.round((correctAnswers / totalQuestions) * 100) : 0
    };
  });

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

  // Set com as questões já respondidas pelo aluno, restrito só às questões dos
  // simulados exibidos nesta página (não o histórico completo do aluno) — dá pra
  // marcar "concluído"/"quantas já respondeu" pra cada card sem depender do
  // tamanho total do histórico.
  const candidateQuestionIds = [
    ...dailySimulados.flatMap((sim) => sim.questions.map((q) => q.id)),
    ...pastDailySimulados.flatMap((sim) => sim.questions.map((q) => q.id)),
    ...specialSimulados.flatMap((sim) => sim.questions.map((q) => q.id)),
    ...blocosDeProva.flatMap((bloco) => bloco.questions.map((q) => q.id))
  ];
  const answeredCandidateAnswers = candidateQuestionIds.length > 0
    ? await prisma.answer.findMany({
        where: { studentId: user.userId, questionId: { in: candidateQuestionIds } },
        select: { questionId: true }
      })
    : [];
  const answeredQuestionIds = new Set(answeredCandidateAnswers.map((a) => a.questionId));

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

  const blocosDeProvaWithStatus = blocosDeProva.map((bloco) => {
    const questionIds = bloco.questions.map((q: { id: string }) => q.id);
    const studentAnswersCount = questionIds.filter((id) => answeredQuestionIds.has(id)).length;
    const isCompleted = questionIds.length > 0 && studentAnswersCount >= questionIds.length;

    return {
      id: bloco.id,
      apostilaName: bloco.apostilaName || "Bloco de Provas",
      questionsCount: questionIds.length,
      answeredCount: studentAnswersCount,
      isCompleted
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
      blocosDeProva={blocosDeProvaWithStatus}
      isGeneratingDaily={isGeneratingDaily}
    />
  );
}
