import { prisma } from "./prisma";
import { computeStudentPerformanceStats } from "./stats";
import { deriveEffectiveStats } from "./studentStatsRead";
import { unstable_cache } from "next/cache";
import { MAX_DISPLAYED_BADGES } from "./badges";

// In-memory lock to prevent Cache Stampede (múltiplas requisições batendo juntas antes do cache ser populado)
let rankingPromise: Promise<any> | null = null;

// Fase 4 da migração pra estatísticas pré-agregadas (ver plano em
// C:\Users\Sergio\.claude\plans\eager-pondering-puddle.md): lê StudentStats
// (O(1) por aluno) em vez de recarregar o histórico completo de respostas de
// TODOS os alunos a cada recálculo — era o ponto de maior tráfego desse padrão.
const calculateRankingDataFromStats = async () => {
  console.log("[CACHE MISS] Recalculando ranking geral da turma (via StudentStats)...");

  const dbStudents = await prisma.user.findMany({
    where: { role: "STUDENT", isTestUser: false },
    select: {
      id: true,
      name: true,
      numero: true,
      avatarUrl: true,
      suspendedUntil: true,
      bonusStreakDays: true,
      unlockedBadges: true,
      displayedBadges: true,
      pelotao: true
    }
  });

  const statsRows = await prisma.studentStats.findMany({
    where: { studentId: { in: dbStudents.map((s) => s.id) } }
  });
  const statsByStudent = new Map(statsRows.map((s) => [s.studentId, s]));

  const generalRanking = dbStudents
    .map((student) => {
      const sPerf = deriveEffectiveStats(statsByStudent.get(student.id) || null, student.bonusStreakDays || 0);

      const unlockedBadges = student.unlockedBadges ? student.unlockedBadges.split(",").filter(Boolean) : [];
      // Só mostra brevês escolhidos pelo aluno (e ainda desbloqueados), até o limite.
      // Sem escolha salva ainda, cai de volta pros brevês desbloqueados mais recentemente
      // (unlockedBadges é preenchido em ordem de conquista, do mais antigo pro mais novo).
      const chosenBadges = student.displayedBadges
        ? student.displayedBadges.split(",").filter(Boolean).filter((id: string) => unlockedBadges.includes(id))
        : [];
      const displayedBadges = chosenBadges.length > 0
        ? chosenBadges.slice(0, MAX_DISPLAYED_BADGES)
        : unlockedBadges.slice(-MAX_DISPLAYED_BADGES).reverse();

      return {
        id: student.id,
        name: student.name,
        numero: student.numero || null,
        avatarUrl: student.avatarUrl,
        displayedBadges,
        totalAnswers: sPerf.totalAnswers,
        accuracy: sPerf.accuracy,
        totalScore: sPerf.totalScore,
        avgTime: sPerf.avgTime,
        streakDays: sPerf.streakDays,
        bonusStreakDays: student.bonusStreakDays || 0,
        todayPoints: sPerf.todayPoints,
        suspendedUntil: student.suspendedUntil ? student.suspendedUntil.toISOString() : null,
        pelotao: student.pelotao || null
      };
    })
    .sort((a, b) => b.totalScore - a.totalScore);

  return generalRanking;
};

// Caminho antigo, mantido só como rollback instantâneo (RANKING_USE_LEGACY_CALC=true
// no .env) enquanto a Fase 4 é observada em produção pela primeira vez — recarrega o
// histórico completo de respostas de todos os alunos, exatamente como sempre fez.
// Remover esta função e a bifurcação abaixo na Fase 6, depois que StudentStats
// estiver validado em produção.
const calculateRankingDataLegacy = async () => {
  console.log("[CACHE MISS] Recalculando ranking geral da turma (legado, RANKING_USE_LEGACY_CALC=true)...");

  const allRaffleAnswers = await prisma.answer.findMany({
    where: { isRaffle: true },
    select: {
      studentId: true,
      question: { select: { simuladoId: true } }
    }
  });

  const totalRaffleInSimulado = new Map<string, number>();
  const studentRaffleInSimulado = new Map<string, number>();

  allRaffleAnswers.forEach((ra) => {
    const sId = ra.question.simuladoId;
    const uId = ra.studentId;
    totalRaffleInSimulado.set(sId, (totalRaffleInSimulado.get(sId) || 0) + 1);
    studentRaffleInSimulado.set(`${uId}_${sId}`, (studentRaffleInSimulado.get(`${uId}_${sId}`) || 0) + 1);
  });

  const dbStudents = await prisma.user.findMany({
    where: { role: "STUDENT", isTestUser: false },
    select: {
      id: true,
      name: true,
      numero: true,
      avatarUrl: true,
      suspendedUntil: true,
      bonusStreakDays: true,
      unlockedBadges: true,
      displayedBadges: true,
      pelotao: true,
      answers: {
        select: {
          createdAt: true,
          pontuacao: true,
          tempoGasto: true,
          isCorrect: true,
          question: {
            select: {
              simuladoId: true,
              simulado: {
                select: {
                  tipo: true,
                  status: true,
                  createdAt: true,
                  _count: { select: { questions: true } }
                }
              }
            }
          }
        }
      }
    }
  });

  const generalRanking = dbStudents
    .map((student) => {
      const sPerf = computeStudentPerformanceStats(
        student.answers,
        student.id,
        totalRaffleInSimulado,
        studentRaffleInSimulado,
        (student as any).bonusStreakDays || 0
      );

      const unlockedBadges = (student as any).unlockedBadges
        ? (student as any).unlockedBadges.split(",").filter(Boolean)
        : [];
      const chosenBadges = (student as any).displayedBadges
        ? (student as any).displayedBadges.split(",").filter(Boolean).filter((id: string) => unlockedBadges.includes(id))
        : [];
      const displayedBadges = chosenBadges.length > 0
        ? chosenBadges.slice(0, MAX_DISPLAYED_BADGES)
        : unlockedBadges.slice(-MAX_DISPLAYED_BADGES).reverse();

      return {
        id: student.id,
        name: student.name,
        numero: (student as any).numero || null,
        avatarUrl: student.avatarUrl,
        displayedBadges,
        totalAnswers: sPerf.totalAnswers,
        accuracy: sPerf.accuracy,
        totalScore: sPerf.totalScore,
        avgTime: sPerf.avgTime,
        streakDays: sPerf.streakDays,
        bonusStreakDays: (student as any).bonusStreakDays || 0,
        todayPoints: sPerf.todayPoints,
        suspendedUntil: student.suspendedUntil ? student.suspendedUntil.toISOString() : null,
        pelotao: (student as any).pelotao || null
      };
    })
    .sort((a, b) => b.totalScore - a.totalScore);

  return generalRanking;
};

const calculateRankingData = () =>
  process.env.RANKING_USE_LEGACY_CALC === "true" ? calculateRankingDataLegacy() : calculateRankingDataFromStats();

export const getCachedGeneralRanking = unstable_cache(
  async () => {
    // Se já tiver uma requisição calculando o ranking, aproveita a mesma Promise!
    if (rankingPromise) {
      console.log("[STAMPEDE LOCK] Aguardando processamento simultâneo do ranking...");
      return rankingPromise;
    }

    rankingPromise = calculateRankingData();

    try {
      const result = await rankingPromise;
      return result;
    } finally {
      rankingPromise = null;
    }
  },
  ['general-ranking'],
  {
    // Com StudentStats o recálculo é O(nº de alunos), não mais O(histórico total de
    // respostas) — mas o cache continua valendo: evita bater no banco a cada mensagem
    // de chat/carregamento de painel dentro da mesma janela de 5 min.
    revalidate: 300,
    tags: ['ranking']
  }
);
