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
      const primaryKey = process.env.GEMINI_API_KEY || "";
      const fallbackKey = process.env.GEMINI_API_KEY_FALLBACK || "";
      const modelVersions = [
        "gemini-3.5-flash",
        "gemini-pro-latest",
        "gemini-3.1-flash-lite",
        "gemini-2.5-flash",
        "gemini-2.0-flash",
        "gemini-flash-latest"
      ];

      for (const modelVersion of modelVersions) {
        try {
          const genAI = new GoogleGenerativeAI(primaryKey);
          const model = genAI.getGenerativeModel({ model: modelVersion });
          return await model.generateContent(promptText);
        } catch (error: any) {
          console.warn(`Chave principal falhou com modelo ${modelVersion}:`, error.message);
          
          if (fallbackKey) {
            console.log(`Tentando chave fallback com modelo ${modelVersion}...`);
            try {
              const fallbackGenAI = new GoogleGenerativeAI(fallbackKey);
              const fallbackModel = fallbackGenAI.getGenerativeModel({ model: modelVersion });
              return await fallbackModel.generateContent(promptText);
            } catch (fallbackError: any) {
              console.warn(`Chave fallback falhou com modelo ${modelVersion}:`, fallbackError.message);
            }
          }
        }
      }
      
      throw new Error("Todas as versões do modelo Gemini falharam.");
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
