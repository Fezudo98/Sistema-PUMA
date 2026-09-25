import { backfillQuestionBank } from "../src/lib/questionBank";
import { prisma } from "../src/lib/prisma";

async function main() {
  const result = await backfillQuestionBank();
  console.log(`[QUESTION BANK BACKFILL] ${result.apostilas} apostilas; ${result.insertedOrUpdated} questões deduplicadas.`);
}

main()
  .catch((error) => {
    console.error("[QUESTION BANK BACKFILL] Falha:", error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
