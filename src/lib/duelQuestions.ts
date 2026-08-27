import { prisma } from "./prisma";

/**
 * Sorteia N questões de uma apostila para um Duelo, a partir das questões DAILY
 * originais (nunca das cópias já feitas em Bloco de Provas, identificadas por
 * sourceQuestionId, para não sortear a "mesma" questão duas vezes sob ids diferentes).
 */
export async function pickRandomDuelQuestions(apostilaName: string, count: number) {
  const sourceQuestions = await prisma.question.findMany({
    where: {
      simulado: { tipo: "DAILY", apostilaName },
      sourceQuestionId: null
    },
    select: {
      id: true,
      enunciado: true,
      alternativas: true,
      correta: true,
      justificativa: true
    }
  });

  const shuffled = [...sourceQuestions];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  return shuffled.slice(0, count);
}

export async function countAvailableDuelQuestions(apostilaName: string) {
  return prisma.question.count({
    where: {
      simulado: { tipo: "DAILY", apostilaName },
      sourceQuestionId: null
    }
  });
}
