import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Iniciando atualização retroativa das datas das respostas (backfill)...");
  
  // Buscar todas as respostas que ainda têm data igual ao momento atual ou que precisam de ajuste
  const answers = await prisma.answer.findMany({
    include: {
      question: {
        include: {
          simulado: true
        }
      }
    }
  });

  let updatedCount = 0;
  for (const a of answers) {
    if (a.question && a.question.simulado && a.question.simulado.createdAt) {
      // Atualizar createdAt da resposta com o createdAt do simulado (mais o tempoGasto em segundos para precisão)
      const simuladoDate = new Date(a.question.simulado.createdAt);
      const answerDate = new Date(simuladoDate.getTime() + (a.tempoGasto || 0) * 1000);
      
      await prisma.answer.update({
        where: { id: a.id },
        data: { createdAt: answerDate }
      });
      updatedCount++;
    }
  }

  console.log(`Backfill concluído com sucesso! ${updatedCount} respostas sincronizadas com as datas dos seus respectivos simulados.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
