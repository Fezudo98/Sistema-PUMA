import { prisma } from "./prisma";
import { getLocalDayString } from "./stats";
import type { StudentStats } from "@prisma/client";

// Fase 4 da migração pra estatísticas pré-agregadas (ver plano em
// C:\Users\Sergio\.claude\plans\eager-pondering-puddle.md): deriva as mesmas
// estatísticas que src/lib/stats.ts:computeStudentPerformanceStats calculava
// recarregando o histórico completo, só que a partir da linha já agregada em
// StudentStats — O(1) por leitura, não O(histórico total). Ainda existem duas
// coisas que não podem ser guardadas prontas (dependem do relógio no momento da
// leitura, não só do que foi escrito): se a sequência ainda está "viva" (o último
// dia completo foi hoje ou ontem) e se o acumulador de pontos de hoje ainda é de
// hoje mesmo (o dia pode ter virado desde a última resposta).

export interface EffectiveStudentStats {
  simuladosCount: number;
  totalAnswers: number;
  accuracy: number;
  avgTime: number;
  totalScore: number;
  streakDays: number;
  todayPoints: number;
}

const EMPTY_STATS: EffectiveStudentStats = {
  simuladosCount: 0,
  totalAnswers: 0,
  accuracy: 0,
  avgTime: 0,
  totalScore: 0,
  streakDays: 0,
  todayPoints: 0
};

// Núcleo puro (sem I/O) — recebe a linha de StudentStats já lida e devolve os
// valores "efetivos", igual ao retorno de computeStudentPerformanceStats.
export function deriveEffectiveStats(stats: StudentStats | null, bonusStreakDays: number): EffectiveStudentStats {
  if (!stats) {
    return bonusStreakDays > 0 ? { ...EMPTY_STATS, streakDays: bonusStreakDays, totalScore: bonusStreakDays * 100 } : EMPTY_STATS;
  }

  const accuracy = stats.completedTotalQuestions > 0
    ? Math.round((stats.completedCorrectAnswers / stats.completedTotalQuestions) * 100)
    : 0;

  const avgTime = stats.totalAnswers > 0
    ? Math.round(stats.sumTempoGasto / stats.totalAnswers)
    : 0;

  const todayStr = getLocalDayString(new Date());
  const yesterdayStr = getLocalDayString(new Date(Date.now() - 24 * 60 * 60 * 1000));

  // A sequência guardada (currentStreakLength) só continua valendo se o último dia
  // completo foi hoje ou ontem (folga de 1 dia, igual ao sistema antigo) — se passou
  // mais tempo que isso sem nenhuma resposta nova, a sequência "morreu" só com o
  // tempo passando, sem precisar de nenhuma escrita pra isso acontecer.
  const streakAlive = stats.lastCompletedDay === todayStr || stats.lastCompletedDay === yesterdayStr;
  const rawStreak = streakAlive ? stats.currentStreakLength : 0;
  const streakDays = bonusStreakDays > 0 ? rawStreak + bonusStreakDays : rawStreak;

  const totalScore = stats.sumPontuacao + streakDays * 100;

  const isTodayAccumStale = stats.todayAccumDay !== todayStr;
  const todayQuestionPoints = isTodayAccumStale ? 0 : stats.todayAccumPoints;
  const todayPoints = todayQuestionPoints + (stats.lastCompletedDay === todayStr ? 100 : 0);

  return {
    simuladosCount: stats.simuladosCount,
    totalAnswers: stats.totalAnswers,
    accuracy,
    avgTime,
    totalScore,
    streakDays,
    todayPoints
  };
}

// Busca + deriva pra um único aluno (chat, painel).
export async function getStudentEffectiveStats(studentId: string): Promise<EffectiveStudentStats> {
  const [stats, user] = await Promise.all([
    prisma.studentStats.findUnique({ where: { studentId } }),
    prisma.user.findUnique({ where: { id: studentId }, select: { bonusStreakDays: true } })
  ]);
  return deriveEffectiveStats(stats, user?.bonusStreakDays || 0);
}
