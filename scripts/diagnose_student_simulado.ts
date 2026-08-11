import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const studentQuery = process.argv[2];
  const apostilaQuery = process.argv[3];

  if (!studentQuery || !apostilaQuery) {
    console.log("Uso: npx tsx scripts/diagnose_student_simulado.ts \"<nome ou parte do nome do aluno>\" \"<nome ou parte do nome da apostila>\"");
    process.exit(1);
  }

  const students = await prisma.user.findMany({
    where: { name: { contains: studentQuery } }
  });
  console.log("Alunos encontrados:", students.map((s) => `${s.id} - ${s.name}`));

  if (students.length === 0) {
    console.log("Nenhum aluno encontrado com esse nome.");
    return;
  }
  if (students.length > 1) {
    console.log("Mais de um aluno encontrado — usando o primeiro da lista. Rode de novo com um nome mais específico se não for o certo.");
  }
  const student = students[0];

  const simulados = await prisma.simulado.findMany({
    where: { tipo: "DAILY" },
    orderBy: { createdAt: "desc" },
    take: 20,
    include: { questions: true }
  });

  const simulado = simulados.find((s) =>
    (s.apostilaName || "").toLowerCase().includes(apostilaQuery.toLowerCase())
  );

  if (!simulado) {
    console.log("Nenhum simulado diário recente bateu com esse nome de apostila.");
    console.log("Simulados diários recentes:", simulados.map((s) => `${s.id} | ${s.apostilaName} | ${s.createdAt.toISOString()}`));
    return;
  }

  console.log("\n=== Simulado ===");
  console.log("ID:", simulado.id);
  console.log("Apostila:", simulado.apostilaName);
  console.log("Criado em:", simulado.createdAt.toISOString());
  console.log("Total de questões:", simulado.questions.length);

  const answers = await prisma.answer.findMany({
    where: { studentId: student.id, question: { simuladoId: simulado.id } }
  });

  console.log("\n=== Respostas do aluno", student.name, "===");
  console.log("Total de respostas:", answers.length);

  const questionIds = simulado.questions.map((q) => q.id);
  const answeredIds = answers.map((a) => a.questionId);
  const missing = questionIds.filter((id) => !answeredIds.includes(id));
  const dupeIds = answeredIds.filter((id, i) => answeredIds.indexOf(id) !== i);

  console.log("Questões NÃO respondidas:", missing.length, missing);
  console.log("Respostas duplicadas (mesma questão respondida 2x):", [...new Set(dupeIds)]);

  const otherRaffle = await prisma.answer.count({
    where: {
      question: { simuladoId: simulado.id },
      isRaffle: true,
      studentId: { not: student.id }
    }
  });
  console.log("Respostas de sorteio (raffle) de OUTROS alunos nesse simulado:", otherRaffle);

  const totalQuestionsAfterRaffleDeduction = Math.max(0, simulado.questions.length - otherRaffle);
  console.log("\n=== Diagnóstico ===");
  console.log("Total de questões (bruto):", simulado.questions.length);
  console.log("Total de questões (descontando raffle de outros, usado na tela de revisão):", totalQuestionsAfterRaffleDeduction);
  console.log("Respostas do aluno:", answers.length);
  console.log("Está completo (usado na tela de revisão)?", answers.length >= totalQuestionsAfterRaffleDeduction);
}

main()
  .catch((e) => console.error(e))
  .finally(() => prisma.$disconnect());
