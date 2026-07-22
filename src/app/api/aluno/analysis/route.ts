import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/app/actions/auth";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Initialize Gemini SDK is done locally in the handler to allow fallback

export async function POST(req: NextRequest) {
  try {
    const user = await getUser();
    if (!user || user.role !== "STUDENT") {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const { stats } = await req.json();

    const userDb = await prisma.user.findUnique({ where: { id: user.userId } });
    
    // Verificação de uso diário único (1x ao dia) ou cache de respostas
    const now = new Date();
    const isSameDay = userDb && userDb.aiAnalysisDate && 
      userDb.aiAnalysisDate.getFullYear() === now.getFullYear() &&
      userDb.aiAnalysisDate.getMonth() === now.getMonth() &&
      userDb.aiAnalysisDate.getDate() === now.getDate();

    if (userDb && userDb.aiAnalysis && (isSameDay || userDb.aiAnalysisSimuladoCount === stats.totalAnswers)) {
      return NextResponse.json({ 
        analysis: userDb.aiAnalysis,
        alreadyDaily: isSameDay 
      });
    }

    // Buscar as últimas respostas do aluno para dar contexto real para a IA
    const allAnswers = await prisma.answer.findMany({
      where: { studentId: user.userId },
      include: {
        question: true
      }
    });
    
    // Como o id é UUID e não temos createdAt na tabela Answer, 
    // buscamos todas as respostas (que vêm na ordem de inserção do banco) 
    // e pegamos as 10 últimas.
    const recentAnswers = allAnswers.slice(-10);

    const recentPerformance = recentAnswers.map(a => `
      - Questão: ${a.question.enunciado}
      - Acertou: ${a.isCorrect ? "Sim" : "Não"}
    `).join("\n");

    const prompt = `
      Atue como um Mentor Policial Analítico e Encorajador. 
      Você está orientando um aluno (QRA: ${user.name}) com base no seu desempenho em simulados de academia policial.
      
      Estatísticas Atuais do Combatente:
      - Missões Realizadas (Simulados): ${stats.simuladosCount}
      - Precisão de Disparo (Taxa de Acerto): ${stats.accuracy}%
      - Tempo de Reação (Média por Questão): ${stats.avgTime}s
      - Pontuação Operacional: ${stats.totalScore}
      
      Desempenho Recente (Últimos Alvos):
      ${recentPerformance}
      
      Escreva um feedback de Análise de Desempenho (máximo 1 parágrafo curto, de 3 a 4 frases).
      
      DIRETRIZES OBRIGATÓRIAS:
      1. TOM IMPARCIAL E CONSTRUTIVO: Não seja humilhante, excessivamente rígido ou agressivo. Aja como um instrutor superior que quer ver o recruta prosperar.
      2. JARGÃO MILITAR (O DIFERENCIAL): Recheie o texto com jargões táticos e policiais (Ex: QAP, TKS, progressão tática, pane no armamento, alvo abatido, retaguarda, zona de confronto, patrulha, front, recruta, padrão ouro, pronto emprego, incursão).
      3. Seja analítico: Olhe para os erros recentes e aponte o rumo do treinamento. Se o acerto for alto, parabenize a precisão de tiro. Se for baixo, oriente a calibrar a mira na teoria.
      
      Formate como texto simples, sem marcações markdown pesadas. Apenas texto limpo.
    `;

    const generateWithFallback = async (promptText: string) => {
      const apiKeys = [
        { label: "principal", key: process.env.GEMINI_API_KEY || "" },
        { label: "fallback_1", key: process.env.GEMINI_API_KEY_FALLBACK || "" },
        { label: "fallback_2", key: process.env.GEMINI_API_KEY_FALLBACK_2 || "" },
        { label: "fallback_3", key: process.env.GEMINI_API_KEY_FALLBACK_3 || "" },
        { label: "fallback_4", key: process.env.GEMINI_API_KEY_FALLBACK_4 || "" }
      ].filter(k => Boolean(k.key));

      if (apiKeys.length === 0) {
        throw new Error("Nenhuma chave do Gemini disponível no servidor.");
      }

      const modelVersions = [
        "gemini-3.6-flash",
        "gemini-3.5-flash",
        "gemini-3.1-flash"
      ];

      for (const modelVersion of modelVersions) {
        for (const keyObj of apiKeys) {
          try {
            console.log(`[ANALYSIS GENERATION] Tentando chave [${keyObj.label}] com modelo [${modelVersion}]...`);
            const genAI = new GoogleGenerativeAI(keyObj.key);
            const model = genAI.getGenerativeModel({ model: modelVersion });
            return await model.generateContent(promptText);
          } catch (error: any) {
            console.warn(`[ANALYSIS GENERATION] Chave [${keyObj.label}] falhou com modelo ${modelVersion}:`, error.message);
          }
        }
      }

      // 2°: Na hipótese de todas as chaves geminis falharem ao chegar no limite do 3.1 flash, usaremos a api da claude no modelo sonnet 5 de forma excepcional
      const anthropicKey = process.env.ANTHROPIC_API_KEY;
      if (anthropicKey) {
        try {
          console.warn("[ANALYSIS GENERATION - FALLBACK EXCEPCIONAL] Todas as chaves Gemini falharam até o piso 3.1 flash. Acionando Claude Sonnet 5 de forma excepcional...");
          const Anthropic = require("@anthropic-ai/sdk");
          const anthropic = new Anthropic({ apiKey: anthropicKey });

          const response = await anthropic.messages.create({
            model: "claude-sonnet-5",
            max_tokens: 8192,
            messages: [{ role: "user", content: promptText.trim() }]
          });

          const rawText = response.content[0]?.type === "text" ? response.content[0].text : "";
          if (rawText) {
            console.log("✅ [ANALYSIS AI - EXCEPCIONAL] Análise gerada com sucesso pelo Claude Sonnet 5!");
            return { response: { text: () => rawText } };
          }
        } catch (claudeErr: any) {
          console.warn("[ANALYSIS AI - EXCEPCIONAL] Falha com Claude Sonnet 5:", claudeErr.message || claudeErr);
        }
      }
      
      throw new Error("Todas as chaves do Gemini (até piso 3.1 flash) e o fallback excepcional do Claude falharam.");
    };

    const result = await generateWithFallback(prompt);
    const text = result.response.text();

    // Salva a nova análise no banco de dados vinculada à quantidade de respostas atual e data
    await prisma.user.update({
      where: { id: user.userId },
      data: {
        aiAnalysis: text,
        aiAnalysisSimuladoCount: stats.totalAnswers,
        aiAnalysisDate: new Date()
      }
    });

    return NextResponse.json({ analysis: text });

  } catch (error: any) {
    console.error("Erro na análise IA:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
