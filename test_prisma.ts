import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function run() {
  try {
    const instructor = await prisma.user.findFirst({ where: { role: "INSTRUCTOR" } });
    if (!instructor) {
      console.log("No instructor");
      return;
    }

    const simulado = await prisma.simulado.create({
      data: {
        codigoSala: "TEST99",
        instructorId: instructor.id,
        status: "WAITING",
        apostilaName: "Test",
        topics: "Test",
        difficulty: "AVANCADO",
        isTeamCompetition: true,
        teamNames: JSON.stringify(["Equipe 1", "Equipe 2"]),
        questions: {
          create: [
            {
              enunciado: "Test?",
              alternativas: JSON.stringify(["A", "B", "C", "D", "E"]),
              correta: 0,
              justificativa: "Because",
              tempoLimite: 60,
              status: "PENDING"
            }
          ]
        }
      }
    });

    console.log("Success:", simulado.id);

    // Cleanup
    await prisma.question.deleteMany({ where: { simuladoId: simulado.id } });
    await prisma.simulado.delete({ where: { id: simulado.id } });
  } catch (e: any) {
    console.error("Prisma Error:", e.message);
  }
}
run();
