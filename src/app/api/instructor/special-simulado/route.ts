import { NextRequest, NextResponse } from "next/server";
import { SchemaType } from "@google/generative-ai";
import { getUser } from "@/app/actions/auth";
import { prisma } from "@/lib/prisma";
import { generateWithGeminiFallback, cleanLatex } from "@/lib/gemini";

export async function POST(req: NextRequest) {
  try {
    const user = await getUser();
    if (!user || user.role !== "INSTRUCTOR") {
      return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
    }

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

    const generationConfig = {
      responseMimeType: "application/json",
      responseSchema: responseSchema,
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

    const result = await generateWithGeminiFallback(contentParts, generationConfig);
    const responseText = result.response.text();
    let questions = JSON.parse(responseText);

    // Formata o JSON gerado
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
