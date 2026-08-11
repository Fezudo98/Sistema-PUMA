import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const questionId = process.argv[2];
  if (!questionId) {
    console.log("Uso: npx tsx scripts/inspect_question.ts <questionId>");
    process.exit(1);
  }

  const question = await prisma.question.findUnique({
    where: { id: questionId },
    include: { simulado: true }
  });

  if (!question) {
    console.log("A questão", questionId, "NÃO EXISTE no banco. É por isso que a resposta nunca salva — a validação de existência falha sempre.");
    return;
  }

  console.log("=== Questão encontrada ===");
  console.log("ID:", question.id);
  console.log("simuladoId:", question.simuladoId);
  console.log("enunciado (primeiros 200 chars):", (question.enunciado || "").slice(0, 200));
  console.log("tempoLimite:", question.tempoLimite);
  console.log("correta (índice):", question.correta);
  console.log("hasAppeal:", question.hasAppeal, "| appealStatus:", question.appealStatus);

  let alternativas: any = null;
  let parseError: any = null;
  try {
    alternativas = JSON.parse(question.alternativas);
  } catch (e) {
    parseError = e;
  }

  if (parseError) {
    console.log("\n⚠️  ERRO: campo 'alternativas' não é um JSON válido!");
    console.log("Conteúdo bruto:", question.alternativas);
  } else {
    console.log("Alternativas (", Array.isArray(alternativas) ? alternativas.length : "não é array", "):", alternativas);
    if (!Array.isArray(alternativas) || alternativas.length === 0) {
      console.log("\n⚠️  ERRO: 'alternativas' não é um array válido/não-vazio.");
    }
    if (typeof question.correta !== "number" || question.correta < 0 || (Array.isArray(alternativas) && question.correta >= alternativas.length)) {
      console.log("\n⚠️  ERRO: índice 'correta' (", question.correta, ") está fora do range de alternativas (0 a", Array.isArray(alternativas) ? alternativas.length - 1 : "?", ").");
    }
  }

  console.log("\nSimulado pai:", question.simulado?.id, "| tipo:", question.simulado?.tipo, "| status:", question.simulado?.status);
}

main()
  .catch((e) => console.error(e))
  .finally(() => prisma.$disconnect());
