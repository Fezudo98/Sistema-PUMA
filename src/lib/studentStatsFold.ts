import { prisma } from "./prisma";
import { getFortalezaHour, isSyntheticBackfilledTimestamp } from "./badges";
import { getLocalDayString } from "./stats";
import { deriveEffectiveStats } from "./studentStatsRead";

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

  // Comparação lexicográfica funciona pra strings YYYY-MM-DD. Só avança a sequência
  // se `day` for realmente mais recente que o já registrado — sem essa checagem, um
  // fold processado fora de ordem cronológica (ex.: dois folds concorrentes pra
  // simulados diferentes do mesmo aluno) poderia "voltar no tempo" a sequência.
  const isNewer = current.lastCompletedDay === null || day > current.lastCompletedDay;
  if (isNewer) {
    const isConsecutive = current.lastCompletedDay !== null && isNextDayString(current.lastCompletedDay, day);
    updates.currentStreakLength = isConsecutive ? current.currentStreakLength + 1 : 1;
    updates.lastCompletedDay = day;
  }

  // Par de fim de semana é independente da continuidade da sequência — só depende
  // de sábado+domingo terem completado, mesmo que dias no meio tenham ficado sem
  // resposta, e mesmo que `day` seja anterior ao lastCompletedDay mais recente.
  const weekday = dayStringToWeekday(day);
  if (weekday === 6) {
    if (!current.pendingWeekendSaturday || day >= current.pendingWeekendSaturday) {
      updates.pendingWeekendSaturday = day;
    }
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

  // --- Metade "brevê": exige 100% de verdade (qCount === total bruto) ---
  // O sistema antigo aceitava qCount>=10 como "completo o bastante", mas ele
  // recalculava do zero toda vez, então sempre via o estado mais atual. Aqui o fold
  // só roda UMA vez (trava de idempotência) — se disparasse em qCount>=10 pra um
  // simulado com mais questões, travaria pra sempre a precisão/tempo médio de só
  // uma fração das respostas, mesmo que o aluno termine o resto depois. Exigir 100%
  // evita esse congelamento incorreto; o único efeito colateral é o brevê demorar
  // até o aluno terminar o simulado inteiro, nunca conceder com dado errado.
  const isBadgeCompleteEnough = qCount === totalQuestionsRaw;
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

  await applyStatsFold(studentId, simuladoId, {
    tipo: simuladoMeta.tipo,
    codigoSala: simuladoMeta.codigoSala,
    completionDate,
    totalQuestionsRaw,
    corrects,
    scoreSim,
    avgTimeSim,
    expectedQ
  });
}

// Metade "estatística" do fold (simuladosCount/accuracy/streak/histórico), extraída
// pra ser reaproveitada tanto por foldSimuladoCompletionIfNeeded (simulado individual,
// sem sorteio) quanto por foldLiveSimuladoFinish (sala Ao Vivo/Duelo, com o
// expectedQ já resolvido pelo sorteio da sala inteira). Idempotente via o mesmo
// guard optimistic-update em StudentSimuladoCompletion.statsFoldedAt.
async function applyStatsFold(
  studentId: string,
  simuladoId: string,
  info: {
    tipo: string;
    codigoSala: string | null;
    completionDate: Date;
    totalQuestionsRaw: number;
    corrects: number;
    scoreSim: number;
    avgTimeSim: number;
    expectedQ: number;
  }
): Promise<void> {
  await prisma.studentSimuladoCompletion.upsert({
    where: { studentId_simuladoId: { studentId, simuladoId } },
    create: { studentId, simuladoId },
    update: {}
  });

  const won = await prisma.studentSimuladoCompletion.updateMany({
    where: { studentId, simuladoId, statsFoldedAt: null },
    data: {
      statsFoldedAt: info.completionDate,
      totalQuestions: info.totalQuestionsRaw,
      correctAnswers: info.corrects,
      score: info.scoreSim,
      avgTime: info.avgTimeSim,
      simuladoTipo: info.tipo,
      codigoSala: info.codigoSala
    }
  });
  if (won.count !== 1) return;

  const day = getLocalDayString(info.completionDate);
  await prisma.$transaction(async (tx) => {
    const current = await tx.studentStats.upsert({ where: { studentId }, create: { studentId }, update: {} });
    const dayUpdates = computeNewCompletedDayUpdates(current, day);
    await tx.studentStats.update({
      where: { studentId },
      data: {
        simuladosCount: { increment: 1 },
        completedTotalQuestions: { increment: info.expectedQ },
        completedCorrectAnswers: { increment: info.corrects },
        ...dayUpdates
      }
    });
  });
}

// Chamada UMA vez, nas 3 transições de sala Ao Vivo/Duelo pra FINISHED (fim normal
// de partida, fim de Duelo, W.O. por desconexão) — nunca por resposta individual.
// Resolve o sorteio pra sala inteira de uma vez (só aqui dá pra saber quantas
// questões cada aluno realmente precisava responder), então aplica o fold de
// estatística pra cada participante. A metade de brevê já rodou por resposta
// (foldSimuladoCompletionIfNeeded com skipStatsFold), não repete aqui.
export async function foldLiveSimuladoFinish(simuladoId: string, participantIds: string[]): Promise<void> {
  if (participantIds.length === 0) return;

  const simulado = await prisma.simulado.findUnique({
    where: { id: simuladoId },
    select: { tipo: true, status: true, codigoSala: true, _count: { select: { questions: true } } }
  });
  if (!simulado) return;

  const totalQuestionsRaw = simulado._count.questions;
  if (totalQuestionsRaw <= 0) return;

  const isFinished = simulado.tipo === "LIVE" ? simulado.status === "FINISHED" : true;
  if (!isFinished) return;

  const raffleAnswers = await prisma.answer.findMany({
    where: { question: { simuladoId }, isRaffle: true },
    select: { studentId: true }
  });
  const raffleCountByStudent = new Map<string, number>();
  raffleAnswers.forEach(a => raffleCountByStudent.set(a.studentId, (raffleCountByStudent.get(a.studentId) || 0) + 1));
  const totalRaffleInSimulado = raffleAnswers.length;

  for (const studentId of participantIds) {
    const studentAnswers = await prisma.answer.findMany({
      where: { studentId, question: { simuladoId } },
      select: { isCorrect: true, tempoGasto: true, pontuacao: true, createdAt: true }
    });
    if (studentAnswers.length === 0) continue;

    const qCount = studentAnswers.length;
    const corrects = studentAnswers.filter(a => a.isCorrect).length;
    const avgTimeSim = Math.round(studentAnswers.reduce((s, a) => s + (a.tempoGasto || 0), 0) / qCount);
    const scoreSim = studentAnswers.reduce((s, a) => s + (a.pontuacao || 0), 0);
    const completionDate = studentAnswers.reduce(
      (max, a) => (a.createdAt > max ? a.createdAt : max),
      studentAnswers[0].createdAt
    );

    const studentOwnRaffle = raffleCountByStudent.get(studentId) || 0;
    const otherRaffle = totalRaffleInSimulado - studentOwnRaffle;
    const expectedQ = Math.max(0, totalQuestionsRaw - otherRaffle);
    if (qCount < expectedQ || expectedQ <= 0) continue;

    await applyStatsFold(studentId, simuladoId, {
      tipo: simulado.tipo,
      codigoSala: simulado.codigoSala,
      completionDate,
      totalQuestionsRaw,
      corrects,
      scoreSim,
      avgTimeSim,
      expectedQ
    });
  }
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

// --- Avaliação de brevês (Fase 5) --------------------------------------------

export interface BadgeDef {
  id: string;
  name: string;
  earned: boolean;
  exclusive: boolean;
}

// Substitui os dois blocos duplicados que existiam em server.ts:checkAndUnlockBadges
// e dailySimulado.ts:completeSelfPacedSimulado — ambos recarregavam o histórico
// completo do aluno pra reavaliar os 18 brevês toda vez. Aqui é uma leitura O(1) de
// StudentStats (via deriveEffectiveStats) + User.unlockedBadges, sem nenhum scan.
// Critérios de Caveira/Padrão PM: os do antigo dailySimulado.ts (decisão do usuário
// — os dois blocos discordavam entre si antes desta unificação).
export async function evaluateAndUnlockBadges(studentId: string): Promise<{ newlyUnlocked: BadgeDef[] }> {
  const [stats, user] = await Promise.all([
    prisma.studentStats.findUnique({ where: { studentId } }),
    prisma.user.findUnique({ where: { id: studentId }, select: { bonusStreakDays: true, unlockedBadges: true } })
  ]);
  if (!user || !stats) return { newlyUnlocked: [] };

  const perf = deriveEffectiveStats(stats, user.bonusStreakDays || 0);
  const { simuladosCount, accuracy, totalScore } = perf;

  const blocoAccuracy = stats.blocoTotalAnswers > 0
    ? Math.round((stats.blocoCorrectAnswers / stats.blocoTotalAnswers) * 100)
    : 0;

  const badges: BadgeDef[] = [
    { id: "recruta", name: "Recruta", earned: simuladosCount >= 3 && totalScore >= 3000, exclusive: false },
    { id: "guerreiro", name: "Guerreiro", earned: stats.hardSimuladosWith70Acc >= 10 && totalScore >= 25000, exclusive: false },
    { id: "veterano", name: "Veterano", earned: stats.hardSimuladosWith75Acc >= 25 && totalScore >= 60000, exclusive: false },
    { id: "sniper", name: "Atirador de Elite", earned: stats.hasSniper && totalScore >= 80000, exclusive: false },
    { id: "raio", name: "Pronto Resposta (Raio)", earned: stats.hasRaio && totalScore >= 50000, exclusive: false },
    { id: "caveira", name: "Caveira", earned: stats.advancedSimuladosCount >= 40 && accuracy >= 92 && totalScore >= 200000, exclusive: false },
    { id: "padrao", name: "Padrão PM", earned: totalScore >= 300000 && accuracy >= 92, exclusive: false },
    { id: "lenda", name: "Lenda PUMA", earned: totalScore >= 750000 && accuracy >= 95, exclusive: false },
    { id: "madrugador", name: "Madrugador", earned: stats.madrugadorCount >= 20, exclusive: false },
    { id: "coruja", name: "Coruja da Guarita", earned: stats.corujaCount >= 20, exclusive: false },
    { id: "fimdesemana", name: "Guerreiro de Fim de Semana", earned: stats.completeWeekendsCount >= 4, exclusive: false },
    { id: "historiador", name: "Historiador de Combate", earned: stats.blocoTotalAnswers >= 100 && blocoAccuracy >= 80, exclusive: false },
    { id: "lider_equipe", name: "Líder de Equipe", earned: stats.teamWinsCount >= 3, exclusive: false },
    { id: "sprint", name: "Sprint Tático", earned: stats.totalRaceWins >= 5, exclusive: false },
    { id: "bizonho", name: "Bizonho", earned: stats.maxConsecutiveErrors >= 3, exclusive: false },
    { id: "afoito", name: "Gatilho Afoito", earned: stats.hasAfoito, exclusive: false },
    { id: "dorminhoco", name: "Dormiu na Guarita", earned: stats.hasDorminhoco, exclusive: false },
    { id: "pepreto", name: "Pé Preto", earned: stats.hasPepreto, exclusive: false }
  ];

  const earnedBadgeIds = badges.filter((b) => b.earned).map((b) => b.id);
  const previouslyUnlocked = user.unlockedBadges ? user.unlockedBadges.split(",").filter(Boolean) : [];
  const newlyUnlockedIds = earnedBadgeIds.filter((id) => !previouslyUnlocked.includes(id));

  if (newlyUnlockedIds.length > 0) {
    const newUnlockedBadges = [...previouslyUnlocked, ...newlyUnlockedIds].join(",");
    await prisma.user.update({ where: { id: studentId }, data: { unlockedBadges: newUnlockedBadges } });
  }

  return { newlyUnlocked: badges.filter((b) => newlyUnlockedIds.includes(b.id)) };
}
