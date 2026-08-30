// Fase 1 da migração pra estatísticas pré-agregadas (ver plano em
// C:\Users\Sergio\.claude\plans\eager-pondering-puddle.md): popula StudentStats e
// StudentSimuladoCompletion a partir do histórico completo de respostas, usando a
// MESMA lógica que já roda em produção hoje (server.ts:checkAndUnlockBadges +
// src/lib/stats.ts:computeStudentPerformanceStats), só que rodada uma vez em vez de
// a cada resposta. Depois disso, src/lib/studentStatsFold.ts assume o trabalho de
// manter tudo incrementalmente.
//
// Seguro de rodar de novo a qualquer momento — usa upsert (chave estável em
// StudentStats.studentId e StudentSimuladoCompletion.[studentId,simuladoId]),
// recalculando os mesmos valores determinísticos a partir das mesmas respostas.
//
// Uso: npx tsx scripts/backfill_student_stats.ts

import { PrismaClient } from '@prisma/client';
import { computeStudentPerformanceStats, getLocalDayString } from '../src/lib/stats';
import { getFortalezaHour, isSyntheticBackfilledTimestamp, countCompleteWeekends } from '../src/lib/badges';

const prisma = new PrismaClient();

function dayStringToWeekday(dayStr: string): number {
  const [y, m, d] = dayStr.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d, 12)).getUTCDay();
}

// Sábado completado mais recente cujo domingo seguinte AINDA não foi completado —
// é o estado que a checagem incremental de fim de semana precisa pra saber se um
// domingo que completar em seguida deve fechar o par (ver foldSimuladoCompletionIfNeeded
// na Fase 2/3). Sábados cujo domingo já completou já foram contados por
// countCompleteWeekends, não precisam de marcador.
function findPendingWeekendSaturday(completedDaysSet: string[]): string | null {
  const daySet = new Set(completedDaysSet);
  const saturdays = completedDaysSet.filter(d => dayStringToWeekday(d) === 6).sort();
  let pending: string | null = null;
  for (const sat of saturdays) {
    const [y, m, d] = sat.split('-').map(Number);
    const nextDay = new Date(Date.UTC(y, m - 1, d, 12) + 24 * 60 * 60 * 1000);
    const sunStr = nextDay.toISOString().split('T')[0];
    if (!daySet.has(sunStr)) pending = sat;
  }
  return pending;
}

async function main() {
  console.log("=========================================================");
  console.log("📊 BACKFILL DE ESTATÍSTICAS PRÉ-AGREGADAS (StudentStats)  ");
  console.log("=========================================================\n");

  const students = await prisma.user.findMany({
    where: { role: 'STUDENT' },
    include: {
      answers: {
        include: {
          question: {
            include: {
              simulado: {
                include: { _count: { select: { questions: true } } }
              }
            }
          }
        }
      }
    }
  });

  console.log(`Processando ${students.length} alunos...\n`);

  // Igual ao backfill_badges.ts: busca todas as respostas de sorteio uma vez só,
  // filtra por aluno dentro do loop.
  const allRaffleAnswers = await prisma.answer.findMany({
    where: { isRaffle: true },
    select: { studentId: true, question: { select: { simuladoId: true } } }
  });

  let processedCount = 0;
  let mismatchCount = 0;

  for (const student of students) {
    const answers = student.answers as any[];
    if (answers.length === 0) continue;

    const studentRaffleMap = new Map<string, number>();
    allRaffleAnswers
      .filter(ra => ra.studentId !== student.id)
      .forEach(ra => {
        const sId = ra.question.simuladoId;
        studentRaffleMap.set(sId, (studentRaffleMap.get(sId) || 0) + 1);
      });

    const bonusStreakDays = (student as any).bonusStreakDays || 0;
    const sPerf = computeStudentPerformanceStats(answers, student.id, studentRaffleMap, undefined, bonusStreakDays);

    // --- Agrupa por simulado (mesma lógica de server.ts:checkAndUnlockBadges) ---
    const simuladoGroups: Record<string, any[]> = {};
    answers.forEach(a => {
      if (!simuladoGroups[a.question.simuladoId]) simuladoGroups[a.question.simuladoId] = [];
      simuladoGroups[a.question.simuladoId].push(a);
    });

    let advancedSimuladosCount = 0;
    let hardSimuladosWith70Acc = 0;
    let hardSimuladosWith75Acc = 0;
    let hasSniper = false;
    let hasRaio = false;
    let hasPepreto = false;

    let completedTotalQuestions = 0;
    let completedCorrectAnswers = 0;
    let simuladosCount = 0;

    const completionRows: {
      simuladoId: string;
      badgeFoldedAt: Date | null;
      statsFoldedAt: Date | null;
      totalQuestions: number | null;
      correctAnswers: number | null;
      score: number | null;
      avgTime: number | null;
      simuladoTipo: string | null;
      codigoSala: string | null;
    }[] = [];

    Object.entries(simuladoGroups).forEach(([simId, simAnswers]) => {
      if (simAnswers.length === 0) return;
      const simulado = simAnswers[0].question.simulado;
      const qCount = simAnswers.length;
      const totalQuestionsRaw = simulado._count.questions;
      const corrects = simAnswers.filter((a: any) => a.isCorrect).length;
      const acc = totalQuestionsRaw > 0 ? Math.round((corrects / totalQuestionsRaw) * 100) : 0;
      const avgTimeSim = Math.round(simAnswers.reduce((s: number, a: any) => s + (a.tempoGasto || 0), 0) / qCount);
      const scoreSim = simAnswers.reduce((s: number, a: any) => s + (a.pontuacao || 0), 0);
      const difficulty = simulado.difficulty;

      // --- fold de brevê: qCount === total(bruto) || qCount >= 10 ---
      const isBadgeCompleteEnough = qCount === totalQuestionsRaw || qCount >= 10;
      let badgeFoldedAt: Date | null = null;
      const completionDate: Date = simAnswers.reduce(
        (max: Date, a: any) => (a.createdAt > max ? a.createdAt : max),
        simAnswers[0].createdAt || simulado.createdAt
      );

      if (isBadgeCompleteEnough) {
        badgeFoldedAt = completionDate;
        if (difficulty === "AVANCADO") {
          advancedSimuladosCount++;
          if (acc >= 70) hardSimuladosWith70Acc++;
          if (acc >= 75) hardSimuladosWith75Acc++;
          if (qCount >= 20 && acc === 100) hasSniper = true;
          if (acc >= 85 && avgTimeSim <= 15) hasRaio = true;
        }
        if (totalQuestionsRaw >= 5 && qCount === totalQuestionsRaw && acc < 10) {
          hasPepreto = true;
        }
      }

      // --- fold de estatística: expectedQ (ajustado por sorteio) + LIVE exige FINISHED ---
      // BLOCO_PROVA nunca atinge este fold (contribui só via limiar de 25/dia, tratado
      // dentro de computeStudentPerformanceStats/sPerf.completedDaysSet).
      let statsFoldedAt: Date | null = null;
      if (simulado.tipo !== 'BLOCO_PROVA') {
        const totalRaffle = 0; // já filtrado: studentRaffleMap só tem respostas de OUTROS alunos
        const otherRaffle = studentRaffleMap.get(simId) || totalRaffle;
        const expectedQ = Math.max(0, totalQuestionsRaw - otherRaffle);
        const isFinished = simulado.tipo === "LIVE" ? simulado.status === "FINISHED" : true;
        const isStatsCompleted = isFinished && qCount >= expectedQ && expectedQ > 0;
        if (isStatsCompleted) {
          statsFoldedAt = completionDate;
          simuladosCount++;
          completedTotalQuestions += expectedQ;
          completedCorrectAnswers += corrects;
        }
      }

      if (badgeFoldedAt || statsFoldedAt) {
        completionRows.push({
          simuladoId: simId,
          badgeFoldedAt,
          statsFoldedAt,
          totalQuestions: totalQuestionsRaw,
          correctAnswers: corrects,
          score: scoreSim,
          avgTime: avgTimeSim,
          simuladoTipo: simulado.tipo,
          codigoSala: simulado.codigoSala
        });
      }
    });

    // --- Contadores puros (mesma lógica de src/lib/studentStatsFold.ts, aplicada
    // de uma vez sobre o histórico completo em vez de por resposta) ---
    let madrugadorCount = 0;
    let corujaCount = 0;
    let blocoTotalAnswers = 0;
    let blocoCorrectAnswers = 0;
    let hasAfoito = false;
    let hasDorminhoco = false;
    let sumPontuacao = 0;
    let sumTempoGasto = 0;

    // Ordena por createdAt asc pra sequência de erros ficar em ordem cronológica de
    // verdade — mais correto que a ordem "natural" (não-determinística) que o
    // recálculo em produção usa hoje; é exatamente a ordem que a atualização
    // incremental (uma resposta de cada vez, em tempo real) sempre vai produzir daqui
    // pra frente.
    const sortedAnswers = [...answers].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    let maxConsecutiveErrors = 0;
    let currentConsecutiveErrors = 0;

    for (const a of sortedAnswers) {
      sumPontuacao += a.pontuacao || 0;
      sumTempoGasto += a.tempoGasto || 0;

      if (!a.isCorrect) {
        currentConsecutiveErrors++;
        if (currentConsecutiveErrors > maxConsecutiveErrors) maxConsecutiveErrors = currentConsecutiveErrors;
      } else {
        currentConsecutiveErrors = 0;
      }

      if (!isSyntheticBackfilledTimestamp(a.createdAt, a.question.simulado.createdAt, a.tempoGasto)) {
        const h = getFortalezaHour(a.createdAt);
        if (h >= 5 && h < 7) madrugadorCount++;
        if (h >= 23 || h < 3) corujaCount++;
      }

      if (a.question.simulado.tipo === 'BLOCO_PROVA') {
        blocoTotalAnswers++;
        if (a.isCorrect) blocoCorrectAnswers++;
      }

      if (!a.isCorrect && a.tempoGasto > 0 && a.tempoGasto < 3) hasAfoito = true;
      if (a.alternativa === -1) hasDorminhoco = true;
    }

    const liveMatchResults = await prisma.liveMatchResult.findMany({ where: { studentId: student.id } });
    const teamWinsCount = liveMatchResults.filter(r => r.wonTeam).length;
    const totalRaceWins = liveMatchResults.reduce((s, r) => s + r.raceWins, 0);

    const currentStreakLength = Math.max(0, sPerf.streakDays - bonusStreakDays);
    const lastCompletedDay = sPerf.completedDaysSet.length > 0
      ? [...sPerf.completedDaysSet].sort().slice(-1)[0]
      : null;
    const completeWeekendsCount = countCompleteWeekends(sPerf.completedDaysSet);
    const pendingWeekendSaturday = findPendingWeekendSaturday(sPerf.completedDaysSet);

    const todayStr = getLocalDayString(new Date());
    const todayAccumPoints = answers.reduce((s, a) => {
      const day = getLocalDayString(a.createdAt || a.question.simulado.createdAt);
      return day === todayStr ? s + (a.pontuacao || 0) : s;
    }, 0);

    // --- Verificação de paridade: os agregados manuais acima devem bater com o
    // que computeStudentPerformanceStats (fonte da verdade atual) calcula ---
    const derivedAccuracy = completedTotalQuestions > 0
      ? Math.round((completedCorrectAnswers / completedTotalQuestions) * 100)
      : 0;
    const derivedTotalScore = sumPontuacao + (currentStreakLength + bonusStreakDays) * 100;

    const mismatches: string[] = [];
    if (simuladosCount !== sPerf.simuladosCount) mismatches.push(`simuladosCount: ${simuladosCount} vs ${sPerf.simuladosCount}`);
    if (derivedAccuracy !== sPerf.accuracy) mismatches.push(`accuracy: ${derivedAccuracy} vs ${sPerf.accuracy}`);
    if (derivedTotalScore !== sPerf.totalScore) mismatches.push(`totalScore: ${derivedTotalScore} vs ${sPerf.totalScore}`);

    if (mismatches.length > 0) {
      mismatchCount++;
      console.warn(`⚠️  Divergência em ${student.name} (${student.id}): ${mismatches.join(' | ')}`);
    }

    // --- Grava ---
    await prisma.studentStats.upsert({
      where: { studentId: student.id },
      create: {
        studentId: student.id,
        totalAnswers: answers.length,
        sumPontuacao,
        sumTempoGasto,
        simuladosCount,
        completedTotalQuestions,
        completedCorrectAnswers,
        todayAccumDay: todayStr,
        todayAccumPoints,
        lastCompletedDay,
        currentStreakLength,
        blocoTotalAnswers,
        blocoCorrectAnswers,
        pendingWeekendSaturday,
        completeWeekendsCount,
        advancedSimuladosCount,
        hardSimuladosWith70Acc,
        hardSimuladosWith75Acc,
        hasSniper,
        hasRaio,
        hasPepreto,
        madrugadorCount,
        corujaCount,
        currentConsecutiveErrors,
        maxConsecutiveErrors,
        hasAfoito,
        hasDorminhoco,
        teamWinsCount,
        totalRaceWins
      },
      update: {
        totalAnswers: answers.length,
        sumPontuacao,
        sumTempoGasto,
        simuladosCount,
        completedTotalQuestions,
        completedCorrectAnswers,
        todayAccumDay: todayStr,
        todayAccumPoints,
        lastCompletedDay,
        currentStreakLength,
        blocoTotalAnswers,
        blocoCorrectAnswers,
        pendingWeekendSaturday,
        completeWeekendsCount,
        advancedSimuladosCount,
        hardSimuladosWith70Acc,
        hardSimuladosWith75Acc,
        hasSniper,
        hasRaio,
        hasPepreto,
        madrugadorCount,
        corujaCount,
        currentConsecutiveErrors,
        maxConsecutiveErrors,
        hasAfoito,
        hasDorminhoco,
        teamWinsCount,
        totalRaceWins
      }
    });

    for (const row of completionRows) {
      await prisma.studentSimuladoCompletion.upsert({
        where: { studentId_simuladoId: { studentId: student.id, simuladoId: row.simuladoId } },
        create: { studentId: student.id, ...row },
        update: row
      });
    }

    processedCount++;
    if (processedCount % 10 === 0) console.log(`  ...${processedCount}/${students.length} processados`);
  }

  console.log("\n=========================================================");
  console.log(`✅ Backfill concluído: ${processedCount} alunos processados.`);
  if (mismatchCount > 0) {
    console.log(`⚠️  ${mismatchCount} aluno(s) com divergência entre o cálculo manual e computeStudentPerformanceStats — revisar antes de avançar de fase.`);
  } else {
    console.log(`✅ Nenhuma divergência de paridade encontrada.`);
  }
  console.log("=========================================================\n");
}

main()
  .catch((err) => { console.error("❌ Erro no backfill:", err); process.exit(1); })
  .finally(() => prisma.$disconnect());
