import { PrismaClient } from "@prisma/client";
import { createSimulado } from "../src/app/actions/simulado";

const prisma = new PrismaClient();

async function run() {
  try {
    const res = await createSimulado({
      tempoPorQuestao: 60,
      apostilaName: "Test",
      isTeamCompetition: true,
      teamNames: ["Eq1", "Eq2"],
      questions: [
        {
          enunciado: "Test?",
          alternativas: ["A", "B", "C", "D", "E"],
          correta: 0,
          justificativa: "Because"
        }
      ]
    });
    console.log(res);
  } catch (e) {
    console.error(e);
  }
}
run();
