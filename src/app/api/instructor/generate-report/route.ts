import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

export async function POST(req: NextRequest) {
  try {
    const { startDate, endDate, metrics } = await req.json();

    if (!metrics) {
      return NextResponse.json({ error: "Faltam métricas para análise." }, { status: 400 });
    }

    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json({ error: "Chave do Gemini não configurada." }, { status: 500 });
    }

    const formatShortDate = (dStr: string) => {
      const parts = dStr.split('-');
      if(parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
      return dStr;
    };

    const prompt = `Você é um Analista de Inteligência e Desempenho (Oficial da Polícia Militar).
O objetivo é redigir um "Relatório Técnico Mensal" detalhado provando o alto engajamento, a utilização e o impacto do Sistema PUMA no preparo do pelotão.
    
DADOS FORNECIDOS PELO SISTEMA:
- Período Analisado: ${formatShortDate(startDate)} a ${formatShortDate(endDate)}
- Total de Questões Resolvidas Pela Tropa: ${metrics.totalAnswers} questões
- Taxa de Acerto Global (Aproveitamento Médio): ${metrics.accuracy}%
- Soldados em Combate Ativo (Engajados): ${metrics.uniqueStudents} alunos
- Destaques (Top 3): ${metrics.topStudents.map((s: any, i: number) => `${i+1}º ${s.name} (${s.count} qts)`).join(", ")}
- Desempenho por Módulo (Apostilas):
${metrics.apostilaData.map((m: any) => `   * ${m.name}: ${m.respostas} resolvidas | Acerto: ${m.acerto}%`).join("\n")}

INSTRUÇÕES DE ESCRITA:
1. Comece com um cabeçalho oficial, usando a formatação Markdown (ex: # RELATÓRIO TÉCNICO DE DESEMPENHO TÁTICO).
2. Faça uma introdução enaltecendo a dedicação da tropa e a importância da plataforma (Sistema PUMA) para a fixação do conhecimento e repetição espaçada.
3. Crie seções (##) detalhando os números de forma gerencial. Não jogue apenas os números; elabore frases que mostrem como "${metrics.totalAnswers}" resoluções representam um esforço monumental.
4. Faça uma análise crítica sobre os "Desempenhos por Módulo", sugerindo onde a tropa precisa focar mais se a taxa for baixa.
5. Crie uma seção de "Honra ao Mérito" exaltando nominalmente os 3 melhores alunos que se destacaram no volume de treinamento.
6. A conclusão deve encorajar a continuidade do projeto e demonstrar que a plataforma é indispensável.
7. O tom deve ser sério, militarizado (termos como tropa, pelotão, combate, linha de frente, preparo), motivacional e altamente profissional.
8. Retorne APENAS o documento Markdown gerado. Sem textos extras, sem \`\`\`markdown. O texto já será renderizado direto em HTML no PDF.`;

    const generateWithFallback = async (content: string) => {
      const apiKeys = [
        { label: "principal", key: process.env.GEMINI_API_KEY || "" },
        { label: "fallback_1", key: process.env.GEMINI_API_KEY_FALLBACK || "" },
        { label: "fallback_2", key: process.env.GEMINI_API_KEY_FALLBACK_2 || "" }
      ].filter(k => Boolean(k.key));

      if (apiKeys.length === 0) throw new Error("Sem chaves do Gemini.");

      const modelVersions = ["gemini-3.6-flash", "gemini-3.5-flash", "gemini-3.1-flash"];

      for (const modelVersion of modelVersions) {
        for (let i = 0; i < apiKeys.length; i++) {
          const { key } = apiKeys[i];
          try {
            const genAI = new GoogleGenerativeAI(key);
            const model = genAI.getGenerativeModel({ model: modelVersion });
            return await model.generateContent(content);
          } catch (error: any) {
            console.warn(`Fallback falhou no modelo ${modelVersion}:`, error.message);
          }
        }
      }
      throw new Error("Todas as tentativas falharam.");
    };

    const result = await generateWithFallback(prompt);
    let responseText = result.response.text();
    
    // Clean up possible markdown code blocks if the AI still adds them
    if (responseText.startsWith("```markdown")) {
      responseText = responseText.replace(/^```markdown\n*/, "").replace(/\n*```$/, "");
    } else if (responseText.startsWith("```")) {
      responseText = responseText.replace(/^```\n*/, "").replace(/\n*```$/, "");
    }

    return NextResponse.json({ report: responseText });
  } catch (error: any) {
    console.error("Erro ao gerar relatório com IA:", error);
    return NextResponse.json({ error: error.message || "Erro desconhecido" }, { status: 500 });
  }
}
