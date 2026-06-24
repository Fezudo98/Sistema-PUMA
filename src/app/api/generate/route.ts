import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";

// O SDK do Gemini será instanciado dentro da rota para suportar a chave de fallback

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("pdf") as File | null;
    const apostilaId = formData.get("apostilaId") as string | null;
    const qtdStr = formData.get("qtd") as string;
    const dificuldade = formData.get("dificuldade") as string;
    const topics = formData.get("topics") as string | null;

    if (!file && !apostilaId) {
      return NextResponse.json({ error: "Nenhum arquivo ou apostila fornecida." }, { status: 400 });
    }

    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json({ error: "Chave do Gemini não configurada no servidor." }, { status: 500 });
    }

    const qtd = parseInt(qtdStr || "5", 10);

    let base64Data = "";

    if (apostilaId) {
      // Read from saved Apostila
      const fs = require("fs").promises;
      const path = require("path");
      const { PrismaClient } = require("@prisma/client");
      const prisma = new PrismaClient();
      
      const apostila = await prisma.apostila.findUnique({ where: { id: apostilaId } });
      if (!apostila) {
         return NextResponse.json({ error: "Apostila não encontrada." }, { status: 404 });
      }
      const filePath = path.join(process.cwd(), "public", apostila.filePath);
      const buffer = await fs.readFile(filePath);
      base64Data = buffer.toString("base64");
    } else if (file) {
      // Read from uploaded file
      const bytes = await file.arrayBuffer();
      base64Data = Buffer.from(bytes).toString("base64");
    }

    const pdfPart = {
      inlineData: {
        data: base64Data,
        mimeType: "application/pdf"
      }
    };

    // Configuração do esquema JSON rigoroso
    const responseSchema = {
      type: SchemaType.ARRAY,
      description: "Lista de questões de múltipla escolha.",
      items: {
        type: SchemaType.OBJECT,
        properties: {
          enunciado: {
            type: SchemaType.STRING,
            description: "A pergunta da questão detalhada."
          },
          alternativas: {
            type: SchemaType.ARRAY,
            description: "Exatamente 5 alternativas, ex: ['A) ...', 'B) ...', 'C) ...', 'D) ...', 'E) ...']",
            items: { type: SchemaType.STRING }
          },
          correta: {
            type: SchemaType.INTEGER,
            description: "O índice da alternativa correta (de 0 a 4)"
          },
          justificativa: {
            type: SchemaType.STRING,
            description: "A explicação do porquê a alternativa está correta baseada no texto base"
          }
        },
        required: ["enunciado", "alternativas", "correta", "justificativa"]
      }
    };

    const genConfig = { 
      model: "gemini-1.5-flash", // Utilizando a versão 1.5 Flash (A API do Gemini não possui versão 3.5)
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: responseSchema,
      }
    };

    let prompt = `Você é um instrutor especialista elaborando um simulado.
    Analise o documento PDF em anexo rigorosamente.`;

    if (topics && topics.trim()) {
      prompt += `\n    Foque o simulado EXCLUSIVAMENTE nos seguintes tópicos do material PDF: "${topics}". Ignore conteúdos que não façam parte de tais tópicos.`;
    }

    prompt += `\n    Crie exatamente ${qtd} questões de múltipla escolha utilizando EXCLUSIVAMENTE o conteúdo DIDÁTICO e TÉCNICO contido no PDF (os assuntos centrais que serão cobrados em prova).
    
    REGRAS CRÍTICAS DE ELABORAÇÃO:
    1. OBJETIVIDADE EXTREMA (Estilo Quiz): O tempo do aluno é curto. Crie enunciados diretos, ágeis e sem enrolação. As alternativas também devem ser o mais curtas e objetivas possíveis.
    2. PEGADINHAS INTELIGENTES: As alternativas erradas JAMAIS devem ser "absurdas" ou óbvias. Use a tática da confusão: troque uma palavra-chave, misture dois conceitos reais do texto, ou crie "pegadinhas" sutis. Faça o recruta suar.
    3. FOCO TÉCNICO: NUNCA elabore questões sobre metadados do documento (ignore nomes de autores, diretores, reitores, ficha catalográfica, histórico de edições ou índices). Foque apenas na matéria/teoria militar e policial.
    4. Não use NENHUM conhecimento prévio ou externo. Se a resposta não estiver no texto, não crie a questão.
    5. SEM AMBIGUIDADES: É proibido haver ambiguidades ou múltiplas interpretações plausíveis. O aluno deve ser testado através da troca inteligente de conceitos, mas a alternativa correta precisa estar clara e fielmente ancorada na apostila, de forma incontestável.
    6. ENUNCIADO COMPLETO: Ainda que objetivo, o enunciado não pode ser omisso. Deve apresentar todos os elementos e contextos necessários para a elucidação da questão de forma independente.
    
    O nível de dificuldade deve ser: ${dificuldade || 'intermediário'}.
    Cada questão deve ter 5 alternativas. A alternativa correta deve ser distribuída aleatoriamente (não deixe sempre na A).`;

    const generateWithFallback = async (content: any[]) => {
      const primaryKey = process.env.GEMINI_API_KEY || "";
      const fallbackKey = process.env.GEMINI_API_KEY_FALLBACK || "";
      const modelVersions = ["gemini-3.5-flash", "gemini-3.1-flash-lite", "gemini-3-flash-preview", "gemini-2.5-flash", "gemini-2.0-flash", "gemini-flash-latest"];

      for (const modelVersion of modelVersions) {
        const dynamicGenConfig = {
          model: modelVersion,
          generationConfig: genConfig.generationConfig
        };
        
        try {
          const genAI = new GoogleGenerativeAI(primaryKey);
          const model = genAI.getGenerativeModel(dynamicGenConfig as any);
          return await model.generateContent(content);
        } catch (error: any) {
          console.warn(`Chave principal falhou com modelo ${modelVersion}:`, error.message);
          
          const isQuotaError = error.status === 429 || error.status === 503 || error.message?.includes("429") || error.message?.includes("503") || error.message?.includes("quota") || error.message?.includes("exhausted");
          const isNotFoundError = error.status === 404 || error.message?.includes("404") || error.message?.includes("not found");
          
          if (isQuotaError && fallbackKey) {
            console.log(`Tentando chave fallback com modelo ${modelVersion}...`);
            try {
              const fallbackGenAI = new GoogleGenerativeAI(fallbackKey);
              const fallbackModel = fallbackGenAI.getGenerativeModel(dynamicGenConfig as any);
              return await fallbackModel.generateContent(content);
            } catch (fallbackError: any) {
              console.warn(`Chave fallback falhou com modelo ${modelVersion}:`, fallbackError.message);
            }
          }
          
          if (!isQuotaError && !isNotFoundError && !error.message?.includes("403")) {
             throw error;
          }
        }
      }
      throw new Error("Todas as versões do modelo Gemini falharam.");
    };

    // Envia o prompt de texto JUNTO com o arquivo PDF em base64 nativamente!
    const result = await generateWithFallback([prompt, pdfPart]);
    const responseText = result.response.text();
    const questions = JSON.parse(responseText);

    return NextResponse.json({ questions });

  } catch (error: any) {
    console.error("Erro na rota /api/generate:", error);
    return NextResponse.json({ error: error.message || "Erro interno no servidor." }, { status: 500 });
  }
}
