import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const lastAnswer = await prisma.answer.findFirst({
    orderBy: { id: "desc" },
    include: { question: true, student: true }
  });

  console.log("Last Answer:", lastAnswer);
  
  if (lastAnswer) {
    const isCorrect = lastAnswer.question.correta === lastAnswer.alternativa;
    console.log("Evaluation check: correta:", lastAnswer.question.correta, "alternativa:", lastAnswer.alternativa, "isCorrect evaluated as:", isCorrect);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
