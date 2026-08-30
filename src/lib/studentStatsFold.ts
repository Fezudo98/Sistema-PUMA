import { prisma } from "./prisma";
import { getFortalezaHour, isSyntheticBackfilledTimestamp } from "./badges";

// Fase 0 da migração pra estatísticas pré-agregadas (ver plano em
// C:\Users\Sergio\.claude\plans\eager-pondering-puddle.md): mantém StudentStats
// atualizado por incrementos O(1) a cada resposta nova, em vez de recalculado do
// histórico completo. Por enquanto (Fase 0) só os contadores puros, que não
// dependem de saber se um simulado "completou" — isso vem nas fases seguintes
// (foldSimuladoCompletionIfNeeded, foldLiveSimuladoFinish, evaluateAndUnlockBadges).
// Nada ainda lê de StudentStats — é escrita em sombra, só pra validar paridade
// contra src/lib/stats.ts antes de trocar qualquer leitura.

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
    },
  });
}
