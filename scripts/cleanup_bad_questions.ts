import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function cleanupBadQuestions() {
  console.log("=========================================================");
  console.log("🧹  INICIANDO SANEAMENTO E CORREÇÃO DE QUESTÕES NO BANCO  🧹");
  console.log("=========================================================\n");

  try {
    const questions = await prisma.question.findMany();
    console.log(`Analisando ${questions.length} questões no banco de dados...\n`);

    let fixedCount = 0;

    for (const q of questions) {
      if (!q.alternativas) continue;

      let alts: string[] = [];
      try {
        const parsed = JSON.parse(q.alternativas);
        if (Array.isArray(parsed)) {
          alts = parsed.map(String);
        }
      } catch {
        continue;
      }

      // Verifica se a questão está corrompida (tem "undefined", ou não tem exatamente 5 alternativas)
      const hasUndefined = alts.some(a => a.includes("undefined"));
      const hasWrongCount = alts.length !== 5;

      if (hasUndefined || hasWrongCount) {
        console.log(`⚠️  Corrigindo questão corrompida [ID: ${q.id}]: "${q.enunciado.slice(0, 60)}..."`);
        console.log(`    Antes: ${JSON.stringify(alts)}`);

        // Tenta identificar e salvar o texto da resposta correta
        const corretaIdx = Math.max(0, Math.min(q.correta || 0, alts.length - 1));
        const correctTextRaw = alts[corretaIdx] || "Alternativa correta";

        const prefixRegex = /^[A-Z][\s\)\-\.\:]+\s*/i;
        const cleanedAlts = alts.map(alt => alt.replace(/undefined/g, "").replace(prefixRegex, "").trim());
        const cleanedCorrectText = correctTextRaw.replace(/undefined/g, "").replace(prefixRegex, "").trim();

        let validAlts = cleanedAlts.filter(alt => alt.length > 0 && alt !== "correta");
        if (!validAlts.includes(cleanedCorrectText) && cleanedCorrectText !== "correta") {
          validAlts.unshift(cleanedCorrectText);
        }

        if (validAlts.length > 5) {
          const wrongAlts = validAlts.filter(alt => alt !== cleanedCorrectText);
          validAlts = [cleanedCorrectText, ...wrongAlts.slice(0, 4)];
        }

        while (validAlts.length < 5) {
          validAlts.push(`Alternativa ${validAlts.length + 1}`);
        }

        const newCorreta = validAlts.indexOf(cleanedCorrectText) !== -1 ? validAlts.indexOf(cleanedCorrectText) : 0;

        const finalAlts = validAlts.map((alt, index) => {
          const letter = String.fromCharCode(65 + index);
          return `${letter}) ${alt}`;
        });

        console.log(`    Depois: ${JSON.stringify(finalAlts)} (Correta: ${newCorreta})\n`);

        await prisma.question.update({
          where: { id: q.id },
          data: {
            alternativas: JSON.stringify(finalAlts),
            correta: newCorreta
          }
        });

        fixedCount++;
      }
    }

    console.log("=========================================================");
    console.log(`✅ Saneamento concluído! Total de questões corrigidas no banco: ${fixedCount}`);
    console.log("=========================================================\n");

  } catch (err) {
    console.error("❌ Erro ao rodar saneamento:", err);
  } finally {
    await prisma.$disconnect();
  }
}

cleanupBadQuestions();
