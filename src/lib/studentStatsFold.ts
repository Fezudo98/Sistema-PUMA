import { prisma } from "./prisma";
import { getFortalezaHour, isSyntheticBackfilledTimestamp } from "./badges";
import { getLocalDayString } from "./stats";

// Migração pra estatísticas pré-agregadas (ver plano em
// C:\Users\Sergio\.claude\plans\eager-pondering-puddle.md): mantém StudentStats
// atualizado por incrementos O(1) a cada resposta nova, em vez de recalculado do
// histórico completo. Nada ainda lê de StudentStats — é escrita em sombra, só pra
// validar paridade contra src/lib/stats.ts antes de trocar qualquer leitura (Fase 4).

export interface AnswerDeltaInput {
  studentId: string;
  isCorrect: boolean;
  pontuacao: number;
  tempoGasto: number;
  alternativa: number;
  createdAt: Date;
  simuladoTipo: string;
  simuladoCreatedAt: Date;
}

export async function recordAnswerDelta(input: AnswerDeltaInput): Promise<void> {
  const { studentId, isCorrect, pontuacao, tempoGasto, alternativa, createdAt, simuladoTipo, simuladoCreatedAt } = input;

  // upsert garante a linha e devolve o estado atual num único round-trip — os
  // dois contadores de sequência de erros abaixo precisam do valor anterior pra
  // decidir o novo (não são incrementos puros).
  const current = await prisma.studentStats.upsert({
    where: { studentId },
    create: { studentId },
    update: {},
  });

  // Respostas com timestamp sintético (do backfill histórico) nunca devem contar
  // pra madrugador/coruja — ver comentário em isSyntheticBackfilledTimestamp.
  const isSynthetic = isSyntheticBackfilledTimestamp(createdAt, simuladoCreatedAt, tempoGasto);
  const hour = isSynthetic ? -1 : getFortalezaHour(createdAt);
  const isMadrugada = hour >= 5 && hour < 7;
  const isCoruja = hour >= 23 || (hour >= 0 && hour < 3);

  const isBloco = simuladoTipo === "BLOCO_PROVA";
  const newConsecutiveErrors = isCorrect ? 0 : current.currentConsecutiveErrors + 1;

  const today = getLocalDayString(createdAt);
  const isSameAccumDay = current.todayAccumDay === today;

  await prisma.studentStats.update({
    where: { studentId },
    data: {
      totalAnswers: { increment: 1 },
      sumPontuacao: { increment: pontuacao },
      sumTempoGasto: { increment: tempoGasto },
      madrugadorCount: isMadrugada ? { increment: 1 } : undefined,
      corujaCount: isCoruja ? { increment: 1 } : undefined,
      blocoTotalAnswers: isBloco ? { increment: 1 } : undefined,
      blocoCorrectAnswers: isBloco && isCorrect ? { increment: 1 } : undefined,
      currentConsecutiveErrors: newConsecutiveErrors,
      maxConsecutiveErrors: Math.max(current.maxConsecutiveErrors, newConsecutiveErrors),
      // Flags "ligadas uma vez, nunca desligadas" — só grava quando esta resposta
      // dispara a condição; caso contrário undefined preserva o valor atual.
      hasAfoito: !isCorrect && tempoGasto > 0 && tempoGasto < 3 ? true : undefined,
      hasDorminhoco: alternativa === -1 ? true : undefined,
      // Acumulador "pontos de hoje": zera sozinho quando o dia muda (comparado no
      // momento da escrita, não por cron) — se algum dia ninguém responder nada
      // nesse dia novo, a leitura em Fase 4 também precisa checar todayAccumDay
      // contra o dia atual antes de exibir, não só confiar neste campo.
      todayAccumDay: today,
      todayAccumPoints: isSameAccumDay ? { increment: pontuacao } : pontuacao,
    },
  });
}

// --- Fold de conclusão de simulado (Fase 2/3) -------------------------------

function dayStringToWeekday(dayStr: string): number {
  const [y, m, d] = dayStr.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d, 12)).getUTCDay();
}

function addDaysToDayString(dayStr: string, delta: number): string {
  const [y, m, d] = dayStr.split('-').map(Number);
  const next = new Date(Date.UTC(y, m - 1, d, 12) + delta * 24 * 60 * 60 * 1000);
  return next.toISOString().split('T')[0];
}

function isNextDayString(prevDay: string, day: string): boolean {
  return addDaysToDayString(prevDay, 1) === day;
}

// Quando `day` passa a contar como "dia completo" pela primeira vez pra esse
// aluno, decide como sequência e par de fim de semana mudam — puramente a partir
// do estado já armazenado (sem escanear completedDaysSet nenhum). Devolve só os
// campos que precisam mudar (uso direto em StudentStats.update).
function computeNewCompletedDayUpdates(
  current: { lastCompletedDay: string | null; currentStreakLength: number; pendingWeekendSaturday: string | null; completeWeekendsCount: number },
  day: string
): Record<string, any> {
  if (current.lastCompletedDay === day) return {}; // já processado (outro simulado completou no mesmo dia)

  const updates: Record<string, any> = {};

  const isConsecutive = current.lastCompletedDay !== null && isNextDayString(current.lastCompletedDay, day);
  updates.currentStreakLength = isConsecutive ? current.currentStreakLength + 1 : 1;
  updates.lastCompletedDay = day;

  // Par de fim de semana é independente da continuidade da sequência — só
  // depende de sábado+domingo terem completado, mesmo que dias no meio tenham
  // ficado sem resposta.
  const weekday = dayStringToWeekday(day);
  if (weekday === 6) {
    updates.pendingWeekendSaturday = day;
  } else if (weekday === 0) {
    const saturdayStr = addDaysToDayString(day, -1);
    if (current.pendingWeekendSaturday === saturdayStr) {
      updates.completeWeekendsCount = current.completeWeekendsCount + 1;
      updates.pendingWeekendSaturday = null;
    }
  }

  return updates;
}

export interface SimuladoMeta {
  tipo: string;
  status: string;
  difficulty: string;
  createdAt: Date;
  codigoSala: string | null;
  totalQuestions: number;
}

// Restrita a UM simulado (no máximo ~25 questões) — nunca escaneia o histórico
// completo do aluno. Chamada depois de cada resposta em simulado individual
// (Fase 2) e, pela metade de brevê, também em sala Ao Vivo/Duelo (Fase 3) — a
// metade de estatística em sala Ao Vivo/Duelo é adiada pro fim da partida
// (foldLiveSimuladoFinish), porque só ali o sorteio termina de decidir quantas
// questões cada aluno realmente precisava responder.
export async function foldSimuladoCompletionIfNeeded(
  studentId: string,
  simuladoId: string,
  simuladoMeta: SimuladoMeta,
  opts: { skipStatsFold?: boolean } = {}
): Promise<void> {
  if (simuladoMeta.totalQuestions <= 0) return;

  const studentAnswers = await prisma.answer.findMany({
    where: { studentId, question: { simuladoId } },
    select: { isCorrect: true, tempoGasto: true, pontuacao: true, createdAt: true }
  });
  if (studentAnswers.length === 0) return;

  const qCount = studentAnswers.length;
  const totalQuestionsRaw = simuladoMeta.totalQuestions;
  const corrects = studentAnswers.filter(a => a.isCorrect).length;
  const acc = totalQuestionsRaw > 0 ? Math.round((corrects / totalQuestionsRaw) * 100) : 0;
  const avgTimeSim = Math.round(studentAnswers.reduce((s, a) => s + (a.tempoGasto || 0), 0) / qCount);
  const scoreSim = studentAnswers.reduce((s, a) => s + (a.pontuacao || 0), 0);
  const completionDate = studentAnswers.reduce(
    (max, a) => (a.createdAt > max ? a.createdAt : max),
    studentAnswers[0].createdAt
  );

  await prisma.studentSimuladoCompletion.upsert({
    where: { studentId_simuladoId: { studentId, simuladoId } },
    create: { studentId, simuladoId },
    update: {}
  });

  // --- Metade "brevê": qCount === total(bruto) || qCount >= 10 ---
  const isBadgeCompleteEnough = qCount === totalQuestionsRaw || qCount >= 10;
  if (isBadgeCompleteEnough) {
    const won = await prisma.studentSimuladoCompletion.updateMany({
      where: { studentId, simuladoId, badgeFoldedAt: null },
      data: {
        badgeFoldedAt: completionDate,
        totalQuestions: totalQuestionsRaw,
        correctAnswers: corrects,
        score: scoreSim,
        avgTime: avgTimeSim,
        simuladoTipo: simuladoMeta.tipo,
        codigoSala: simuladoMeta.codigoSala
      }
    });

    if (won.count === 1) {
      const isAvancado = simuladoMeta.difficulty === "AVANCADO";
      const sniperNow = isAvancado && qCount >= 20 && acc === 100;
      const raioNow = isAvancado && acc >= 85 && avgTimeSim <= 15;
      const pepretoNow = totalQuestionsRaw >= 5 && qCount === totalQuestionsRaw && acc < 10;

      await prisma.studentStats.upsert({
        where: { studentId },
        create: {
          studentId,
          advancedSimuladosCount: isAvancado ? 1 : 0,
          hardSimuladosWith70Acc: isAvancado && acc >= 70 ? 1 : 0,
          hardSimuladosWith75Acc: isAvancado && acc >= 75 ? 1 : 0,
          hasSniper: sniperNow,
          hasRaio: raioNow,
          hasPepreto: pepretoNow
        },
        update: {
          advancedSimuladosCount: isAvancado ? { increment: 1 } : undefined,
          hardSimuladosWith70Acc: isAvancado && acc >= 70 ? { increment: 1 } : undefined,
          hardSimuladosWith75Acc: isAvancado && acc >= 75 ? { increment: 1 } : undefined,
          hasSniper: sniperNow ? true : undefined,
          hasRaio: raioNow ? true : undefined,
          hasPepreto: pepretoNow ? true : undefined
        }
      });
    }
  }

  if (opts.skipStatsFold) return;

  // --- Metade "estatística": expectedQ (ajustado por sorteio) + LIVE exige FINISHED ---
  // BLOCO_PROVA nunca atinge este fold (regra existente — só contribui pro streak
  // via o limiar de 25/dia, ver foldBlocoProvaDailyProgress).
  if (simuladoMeta.tipo === "BLOCO_PROVA") return;

  // Sem sorteio fora de sala Ao Vivo — expectedQ é sempre o total bruto aqui.
  const expectedQ = totalQuestionsRaw;
  const isFinished = simuladoMeta.tipo === "LIVE" ? simuladoMeta.status === "FINISHED" : true;
  const isStatsCompleted = isFinished && qCount >= expectedQ && expectedQ > 0;
  if (!isStatsCompleted) return;

  const won = await prisma.studentSimuladoCompletion.updateMany({
    where: { studentId, simuladoId, statsFoldedAt: null },
    data: {
      statsFoldedAt: completionDate,
      totalQuestions: totalQuestionsRaw,
      correctAnswers: corrects,
      score: scoreSim,
      avgTime: avgTimeSim,
      simuladoTipo: simuladoMeta.tipo,
      codigoSala: simuladoMeta.codigoSala
    }
  });
  if (won.count !== 1) return;

  const day = getLocalDayString(completionDate);
  await prisma.$transaction(async (tx) => {
    const current = await tx.studentStats.upsert({ where: { studentId }, create: { studentId }, update: {} });
    const dayUpdates = computeNewCompletedDayUpdates(current, day);
    await tx.studentStats.update({
      where: { studentId },
      data: {
        simuladosCount: { increment: 1 },
        completedTotalQuestions: { increment: expectedQ },
        completedCorrectAnswers: { increment: corrects },
        ...dayUpdates
      }
    });
  });
}

const BLOCO_PROVA_DAILY_THRESHOLD = 25;

// Bloco de Provas nunca "completa" (só cresce) — em vez disso, responder >=25
// questões de Bloco num mesmo dia local já garante aquele dia na sequência,
// igual a terminar um simulado diário normal (mesma regra de src/lib/stats.ts).
export async function foldBlocoProvaDailyProgress(studentId: string, answerCreatedAt: Date): Promise<void> {
  const day = getLocalDayString(answerCreatedAt);

  await prisma.$transaction(async (tx) => {
    const current = await tx.studentStats.upsert({ where: { studentId }, create: { studentId }, update: {} });

    const isSameDay = current.blocoAnswersTodayDay === day;
    const previousCount = isSameDay ? current.blocoAnswersToday : 0;
    const newCount = previousCount + 1;
    const justCrossed = newCount >= BLOCO_PROVA_DAILY_THRESHOLD && previousCount < BLOCO_PROVA_DAILY_THRESHOLD;

    const dayUpdates = justCrossed ? computeNewCompletedDayUpdates(current, day) : {};

    await tx.studentStats.update({
      where: { studentId },
      data: {
        blocoAnswersToday: newCount,
        blocoAnswersTodayDay: day,
        ...dayUpdates
      }
    });
  });
}
