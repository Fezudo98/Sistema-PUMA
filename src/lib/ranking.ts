import { prisma } from "./prisma";
import { computeStudentPerformanceStats } from "./stats";
import { unstable_cache } from "next/cache";
import { MAX_DISPLAYED_BADGES } from "./badges";

// In-memory lock to prevent Cache Stampede (múltiplas requisições batendo juntas antes do cache ser populado)
let rankingPromise: Promise<any> | null = null;

const calculateRankingData = async () => {
  console.log("[CACHE MISS] Recalculando ranking geral da turma...");

  // 1. Fetch all raffle answers across all students to deduct exclusive questions accurately
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

  // 2. Fetch all students and their answers with minimal fields
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

  // 3. Compute stats
  const generalRanking = dbStudents.map(student => {
    const sPerf = computeStudentPerformanceStats(
      student.answers,
      student.id,
      totalRaffleInSimulado,
      studentRaffleInSimulado,
      (student as any).bonusStreakDays || 0
    );

    const unlockedBadges = (student as any).unlockedBadges
      ? (student as any).unlockedBadges.split(',').filter(Boolean)
      : [];
    // Só mostra brevês escolhidos pelo aluno (e ainda desbloqueados), até o limite.
    // Sem escolha salva ainda, cai de volta pros brevês desbloqueados mais recentemente
    // (unlockedBadges é preenchido em ordem de conquista, do mais antigo pro mais novo).
    const chosenBadges = (student as any).displayedBadges
      ? (student as any).displayedBadges.split(',').filter(Boolean).filter((id: string) => unlockedBadges.includes(id))
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
      suspendedUntil: student.suspendedUntil ? student.suspendedUntil.toISOString() : null
    };
  }).sort((a, b) => b.totalScore - a.totalScore);

  return generalRanking;
};

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
    revalidate: 60, // Cache válido por 60 segundos. Isso previne pico de CPU se muitos alunos abrirem ao mesmo tempo.
    tags: ['ranking']
  }
);
