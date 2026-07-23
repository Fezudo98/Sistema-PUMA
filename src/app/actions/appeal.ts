"use server";

import { PrismaClient } from "@prisma/client";
import { getUser } from "@/app/actions/auth";

const prisma = new PrismaClient();

export async function requestAppeal(questionId: string, reason: string) {
  try {
    const user = await getUser();
    if (!user || user.role !== "STUDENT") {
      return { error: "Não autorizado." };
    }

    const question = await prisma.question.findUnique({
      where: { id: questionId },
      include: { simulado: true }
    });

    if (!question) {
      return { error: "Questão não encontrada." };
    }

    // Apenas simulados diários permitem recurso conforme regra de negócio
    if (question.simulado.tipo !== "DAILY") {
      return { error: "Recursos só podem ser abertos em simulados diários." };
    }

    if (question.simulado.hasAppealed) {
      return { error: "Este simulado já possui um recurso aberto em outra questão. Apenas um recurso por simulado é permitido." };
    }

    if (question.hasAppeal) {
      return { error: "Esta questão já está em análise." };
    }

    // 1. Marcar simulado e questão
    await prisma.$transaction([
      prisma.simulado.update({
        where: { id: question.simuladoId },
        data: { hasAppealed: true }
      }),
      prisma.question.update({
        where: { id: questionId },
        data: {
          hasAppeal: true,
          appealStatus: "PENDING",
          appealReason: reason,
          appealedBy: user.name
        }
      })
    ]);

    // 2. Disparar processamento em background via fetch interno para não prender o request
    // Em Next.js App Router, actions de background podem ser complexas, mas podemos simplesmente não aguardar o processamento da IA
    processAppealInBackground(questionId).catch(console.error);

    return { success: true };
  } catch (error: any) {
    console.error("Erro ao solicitar recurso:", error);
    return { error: error.message || "Erro interno." };
  }
}

async function processAppealInBackground(questionId: string) {
  try {
    const question = await prisma.question.findUnique({
      where: { id: questionId }
    });
    if (!question) return;

    const anthropicKey = process.env.ANTHROPIC_API_KEY;
    if (!anthropicKey) {
      throw new Error("Chave do Anthropic não configurada.");
    }

    const Anthropic = require("@anthropic-ai/sdk");
    const anthropic = new Anthropic({ apiKey: anthropicKey });

    const prompt = `Você é um avaliador mestre de concursos policiais.
Uma questão de múltipla escolha de um simulado foi alvo de recurso por um aluno. Sua missão é julgar o recurso com rigor, justiça e precisão técnica.

DADOS DA QUESTÃO:
Enunciado: ${question.enunciado}
Alternativas:
${JSON.parse(question.alternativas).map((a: string, i: number) => `${i}) ${a}`).join("\n")}
Gabarito Original: Alternativa ${question.correta}
Justificativa Original: ${question.justificativa}

RECURSO DO ALUNO:
"${question.appealReason}"

INSTRUÇÕES DE JULGAMENTO:
Analise a queixa do aluno. Você deve decidir entre 3 cenários:
1. "ANNULLED": A questão possui um erro gravíssimo (ex: nenhuma alternativa correta, mais de uma correta, ou enunciado absurdamente mal formulado que impede a resolução).
2. "CORRECTED": A questão está bem escrita, porém o gabarito original (índice da alternativa correta) estava errado. O aluno tem razão ao apontar outra alternativa como a correta.
3. "REJECTED": A questão está perfeita e o gabarito original está correto. O aluno apenas se confundiu ou errou a teoria.

IMPORTANTE: Responda ÚNICA e EXCLUSIVAMENTE com um objeto JSON no seguinte formato, sem marcadores markdown (\`\`\`json):
{
  "action": "ANNULLED" | "CORRECTED" | "REJECTED",
  "newCorreta": number | null,
  "explanation": "Sua justificativa técnica, direta e didática explicando o motivo da sua decisão para o aluno ler."
}
`;

    const response = await anthropic.messages.create({
      model: "claude-3-5-sonnet-20240620", // The model they have
      max_tokens: 1500,
      messages: [{ role: "user", content: prompt }]
    });

    let rawText = response.content[0]?.type === 'text' ? response.content[0].text : '';
    let jsonText = rawText.trim();
    if (jsonText.startsWith("```json")) {
      jsonText = jsonText.replace(/^```json\s*/, "").replace(/\s*```$/, "");
    } else if (jsonText.startsWith("```")) {
      jsonText = jsonText.replace(/^```\s*/, "").replace(/\s*```$/, "");
    }

    const result = JSON.parse(jsonText);

    // Atualiza o banco com a decisão final
    await prisma.question.update({
      where: { id: questionId },
      data: {
        appealStatus: result.action,
        appealResponse: result.explanation,
        correta: result.action === "CORRECTED" && result.newCorreta !== null ? result.newCorreta : question.correta
      }
    });

    // Redistribuir pontos se necessário
    if (result.action === "ANNULLED") {
      // Dá pontos para todos os alunos que responderam esta questão
      await prisma.answer.updateMany({
        where: { questionId },
        data: { isCorrect: true, pontuacao: 100 }
      });
    } else if (result.action === "CORRECTED" && result.newCorreta !== null) {
      // Quem marcou o novo gabarito ganha os pontos
      await prisma.answer.updateMany({
        where: { questionId, alternativa: result.newCorreta },
        data: { isCorrect: true, pontuacao: 100 }
      });
      // Importante: A regra "sem prejuízo" implica que não removeremos os pontos de quem marcou a alternativa anterior que era o gabarito velho.
      // Ou seja, quem estava com isCorrect = true e pontuacao = 100 continuará assim.
    }

    console.log(`[RECURSO] Questão ${questionId} processada. Ação: ${result.action}`);

  } catch (err: any) {
    console.error(`[RECURSO ERROR] Falha ao processar recurso da questão ${questionId}:`, err);
    await prisma.question.update({
      where: { id: questionId },
      data: {
        appealStatus: "REJECTED",
        appealResponse: "Ocorreu uma falha sistêmica ao processar seu recurso com a Inteligência Artificial. Por favor, comunique ao instrutor."
      }
    });
  }
}
