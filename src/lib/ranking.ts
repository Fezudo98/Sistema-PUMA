import { prisma } from "./prisma";
import { computeStudentPerformanceStats } from "./stats";
import { unstable_cache } from "next/cache";

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
      studentRaffleInSimulado
    );
    
    return {
      id: student.id,
      name: student.name,
      numero: (student as any).numero || null,
      avatarUrl: student.avatarUrl,
      totalAnswers: sPerf.totalAnswers,
      accuracy: sPerf.accuracy,
      totalScore: sPerf.totalScore,
      avgTime: sPerf.avgTime,
      streakDays: sPerf.streakDays,
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
