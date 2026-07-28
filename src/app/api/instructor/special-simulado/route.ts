import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";

function isRateLimitError(errorMsg: string): boolean {
  if (!errorMsg) return false;
  const lower = errorMsg.toLowerCase();
  return lower.includes("429") || lower.includes("too many requests") || lower.includes("quota") || lower.includes("exhausted") || lower.includes("503") || lower.includes("service unavailable") || lower.includes("high demand") || lower.includes("overloaded");
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const questionsFile = formData.get("pdf") as File | null;
    const apostilaId = formData.get("apostilaId") as string | null;

    if (!questionsFile) {
      return NextResponse.json({ error: "Nenhum arquivo de questões fornecido." }, { status: 400 });
    }

    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json({ error: "Chave do Gemini não configurada no servidor." }, { status: 500 });
    }

    // Read the questions file
    const questionsBytes = await questionsFile.arrayBuffer();
    const questionsBase64 = Buffer.from(questionsBytes).toString("base64");
    const questionsPdfPart = {
      inlineData: {
        data: questionsBase64,
        mimeType: questionsFile.type || "application/pdf"
      }
    };

    let referencePdfPart = null;
    let baseApostilaName = "Questões Avulsas (Especial)";

    // If an apostila is provided for reference, fetch it
    if (apostilaId && apostilaId !== "nenhuma") {
      const fs = require("fs").promises;
      const path = require("path");
      const { PrismaClient } = require("@prisma/client");
      const prisma = new PrismaClient();
      const apostila = await prisma.apostila.findUnique({ where: { id: apostilaId } });
      
      if (apostila) {
        baseApostilaName = apostila.title;
        const filePath = path.join(process.cwd(), "public", apostila.filePath);
        try {
          const buffer = await fs.readFile(filePath);
          referencePdfPart = {
            inlineData: {
              data: buffer.toString("base64"),
              mimeType: "application/pdf"
            }
          };
        } catch (e) {
          console.warn("Não foi possível carregar o arquivo da apostila para referência.");
        }
      }
    }

    const responseSchema = {
      type: SchemaType.ARRAY,
      description: "Lista de questões extraídas.",
      items: {
        type: SchemaType.OBJECT,
        properties: {
          enunciado: {
            type: SchemaType.STRING,
            description: "O enunciado da questão extraído do arquivo."
          },
          alternativas: {
            type: SchemaType.ARRAY,
            description: "Exatamente 5 alternativas, ex: ['A) ...', 'B) ...', 'C) ...', 'D) ...', 'E) ...']. Caso haja menos, crie alternativas plausíveis até inteirar 5.",
            items: { type: SchemaType.STRING }
          },
          correta: {
            type: SchemaType.INTEGER,
            description: "O índice (0 a 4) da alternativa correta."
          },
          justificativa: {
            type: SchemaType.STRING,
            description: "A justificativa correta extraída ou formulada pela IA."
          }
        },
        required: ["enunciado", "alternativas", "correta", "justificativa"]
      }
    };

    const genConfig = { 
      model: "gemini-1.5-flash",
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: responseSchema,
      }
    };

    let prompt = `Você é um extrator de questões especialista. 
    Seu trabalho é ler o material enviado (arquivo de questões) e extrair TODAS as questões de múltipla escolha para o formato JSON.
    
    REGRA CRÍTICA: Não invente novas questões! Apenas extraia as questões que estão no arquivo enviado pelo instrutor.
    
    INSTRUÇÕES:
    1. Organize cada questão com seu enunciado e suas alternativas.
    2. Se a questão não tiver 5 alternativas, crie ou adapte alternativas até totalizar 5, mantendo o nível e a coerência técnica.
    3. Identifique o gabarito. Se o gabarito não estiver presente no arquivo de questões, você DEVE resolvê-la usando SEU CONHECIMENTO TÉCNICO.
    4. Gere uma justificativa clara e objetiva para a alternativa correta.
    5. A justificativa NÃO PODE mencionar letras (ex: "A letra C está correta"), porque a ordem será embaralhada. Use frases como "A alternativa correta..."
    `;

    if (referencePdfPart) {
      prompt += `\n\nATENÇÃO: Você receberá um SEGUNDO arquivo PDF, que é a Apostila Oficial (Referência Teórica). Caso o arquivo de questões não possua o gabarito ou justificativa, UTILIZE A APOSTILA OFICIAL para encontrar a resposta correta e basear a sua justificativa técnica nela.`;
    }

    const contentParts: any[] = [prompt, questionsPdfPart];
    if (referencePdfPart) {
      contentParts.push("\n--- APOSTILA OFICIAL (REFERÊNCIA TEÓRICA) ABAIXO ---\n");
      contentParts.push(referencePdfPart);
    }

    const generateWithFallback = async (content: any[]) => {
      const apiKeys = [
        { label: "principal", key: process.env.GEMINI_API_KEY || "" },
        { label: "fallback_1", key: process.env.GEMINI_API_KEY_FALLBACK || "" },
        { label: "fallback_2", key: process.env.GEMINI_API_KEY_FALLBACK_2 || "" },
        { label: "fallback_3", key: process.env.GEMINI_API_KEY_FALLBACK_3 || "" },
        { label: "fallback_4", key: process.env.GEMINI_API_KEY_FALLBACK_4 || "" }
      ].filter(k => Boolean(k.key));

      if (apiKeys.length === 0) throw new Error("Sem chaves do Gemini.");

      const modelVersions = ["gemini-3.6-flash", "gemini-3.5-flash", "gemini-3.1-flash"];

      for (const modelVersion of modelVersions) {
        for (let i = 0; i < apiKeys.length; i++) {
          const { key } = apiKeys[i];
          try {
            const genAI = new GoogleGenerativeAI(key);
            const model = genAI.getGenerativeModel({ model: modelVersion, generationConfig: genConfig.generationConfig } as any);
            return await model.generateContent(content);
          } catch (error: any) {
            console.warn(`Fallback falhou no modelo ${modelVersion}:`, error.message);
          }
        }
      }
      throw new Error("Todas as tentativas falharam.");
    };

    const result = await generateWithFallback(contentParts);
    const responseText = result.response.text();
    let questions = JSON.parse(responseText);

    // Formata o JSON gerado
    const cleanLatex = (str: string) => {
      if (!str) return "";
      return str.replace(/\\\$/g, "$").replace(/\$\$/g, "").replace(/\$/g, "");
    };

    questions = questions.map((q: any) => {
      if (Array.isArray(q.alternativas)) {
        q.alternativas = q.alternativas.map((alt: string) => {
          let c = cleanLatex(alt).trim();
          c = c.replace(/^[a-eA-E][).]\s*/, "");
          if (c.toLowerCase().startsWith("letra")) {
            c = c.replace(/^letra\s+[a-eA-E][).:\s]*/i, "");
          }
          return c;
        });
      }
      return {
        enunciado: cleanLatex(q.enunciado || ""),
        alternativas: q.alternativas || [],
        correta: typeof q.correta === 'number' ? q.correta : 0,
        justificativa: cleanLatex(q.justificativa || ""),
        tempoLimite: 3600 // 1 HORA DE TEMPO LIMITE PADRÃO PARA SIMULADO ESPECIAL (Ritmo Livre)
      };
    });

    return NextResponse.json({ questions, apostilaName: baseApostilaName });
  } catch (error: any) {
    console.error("Erro interno na geração especial:", error);
    return NextResponse.json({ error: error.message || "Erro desconhecido" }, { status: 500 });
  }
}
