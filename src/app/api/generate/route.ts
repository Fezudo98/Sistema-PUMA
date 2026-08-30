import { NextRequest, NextResponse } from "next/server";
import { SchemaType } from "@google/generative-ai";
import { createHash } from "crypto";
import { prisma } from "@/lib/prisma";
import { getUser } from "@/app/actions/auth";
import { generateWithGeminiFallback, cleanLatex } from "@/lib/gemini";

// Cache L1 de Curto Prazo (10 minutos) para evitar requisições idênticas ou cliques duplos
const generationCache = new Map<string, { timestamp: number; questions: any[] }>();

export async function POST(req: NextRequest) {
  try {
    const user = await getUser();
    if (!user || user.role !== "INSTRUCTOR") {
      return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get("pdf") as File | null;
    const apostilaId = formData.get("apostilaId") as string | null;
    const qtdStr = formData.get("qtd") as string;
    const dificuldade = "AVANCADO"; // Apenas questões avançadas
    const topics = formData.get("topics") as string | null;

    let studentNames: string[] = [];
    try {
      const students = await prisma.user.findMany({
        where: { role: "STUDENT", isTestUser: false },
        select: { name: true }
      });
      studentNames = Array.from(new Set(students.map((s: any) => s.name.trim()).filter(Boolean)));
    } catch (dbErr) {
      console.error("Erro ao buscar alunos para o prompt:", dbErr);
    }

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
            description: "O índice (0 a 4) da alternativa que resolve o enunciado. ATENÇÃO: se a questão pedir a alternativa INCORRETA/FALSA, este índice DEVE apontar para a alternativa incorreta."
          },
          justificativa: {
            type: SchemaType.STRING,
            description: "A explicação do porquê a alternativa selecionada resolve a questão. ATENÇÃO: NUNCA mencione letras (ex: 'A alternativa A', 'Letra C'), pois as opções serão embaralhadas. Refira-se como 'A alternativa correta' ou cite o texto da opção."
          }
        },
        required: ["enunciado", "alternativas", "correta", "justificativa"]
      }
    };

    const generationConfig = {
      responseMimeType: "application/json",
      responseSchema: responseSchema,
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
    4. EXEMPLOS EXTERNOS PERMITIDOS, TEORIA NÃO: você pode criar cenários, casos práticos ou exemplos hipotéticos que não estejam literalmente no PDF para contextualizar o enunciado (ex.: uma situação de patrulhamento, um caso fictício envolvendo os conceitos da apostila). Isso é diferente de usar conhecimento externo: a teoria, definição, regra ou conceito necessário para resolver a questão deve vir SEMPRE e SOMENTE do conteúdo da apostila — o exemplo externo serve só como veículo para testar se o aluno sabe aplicar essa teoria, nunca para introduzir informação nova. Se resolver a questão exigir saber algo que não está explicado no PDF, não crie a questão.
    5. SEM AMBIGUIDADES: É proibido haver ambiguidades ou múltiplas interpretações plausíveis. O aluno deve ser testado através da troca inteligente de conceitos, mas a alternativa correta precisa estar clara e fielmente ancorada na apostila, de forma incontestável.
    6. ENUNCIADO COMPLETO: Ainda que objetivo, o enunciado não pode ser omisso. Deve apresentar todos os elementos e contextos necessários para a elucidação da questão de forma independente.
    7. ATENÇÃO À ALTERNATIVA CORRETA: Se o enunciado pedir para o aluno assinalar a alternativa INCORRETA/FALSA, a chave "correta" no seu JSON DEVE apontar para o índice dessa alternativa falsa que o aluno deverá marcar para acertar a questão. O campo "justificativa" deve explicar exatamente o porquê da alternativa selecionada estar incorreta no mundo real (o que a torna a resposta certa do exercício).
    8. JUSTIFICATIVA SEM LETRAS: Como as alternativas serão embaralhadas no momento da prova, é ESTRITAMENTE PROIBIDO usar referências a letras (ex: "A alternativa B", "A letra C") na sua justificativa. Utilize expressões como "A alternativa correta" ou "A opção que afirma...".
    9. DESTAQUE DE TERMO (quando aplicável): Se o enunciado pedir para o aluno identificar o emprego (correto ou incorreto) de um termo/palavra específica dentro de cada alternativa (ex.: parônimos, homônimos, conotação/denotação, regência, crase, ambiguidade lexical), marque esse termo em CADA alternativa envolvendo-o em dois asteriscos, assim: "O comandante irá **deferir** o pedido de licença." Use esse destaque apenas quando a questão realmente girar em torno de uma palavra específica — não use em questões comuns.`;

    if (studentNames.length > 0) {
      // Misturar e selecionar até 10 nomes aleatórios de alunos para não sobrecarregar
      const shuffledNames = [...studentNames].sort(() => 0.5 - Math.random()).slice(0, 10);
      prompt += `\n    8. CONTEXTUALIZAÇÃO COM ALUNOS (CASOS PRÁTICOS): Raramente (no máximo em 1 questão deste simulado de ${qtd} questões) e apenas quando for oportuno, elabore um caso prático fictício no enunciado utilizando alguns dos seguintes QRAs de alunos reais: ${shuffledNames.join(", ")} (exemplo: "William viu Marcelino fazendo tal coisa com Roberto..."). Nas demais questões, NÃO utilize nomes de alunos. Seja discreto e evite qualquer exagero na frequência desta regra.`;
    }

    prompt += `\n
    O nível de dificuldade deve ser: avançado (questões extremamente desafiadoras, no nível de concursos públicos exigentes, com enunciados bem elaborados e alternativas plausíveis e difíceis, exigindo raciocínio e atenção a detalhes sutis).
    Cada questão deve ter 5 alternativas. A alternativa correta deve ser distribuída aleatoriamente (não deixe sempre na A).`;

    const cacheKeyString = `${apostilaId || "upload"}_${qtd}_${dificuldade}_${topics || ""}_${base64Data.slice(0, 200)}_${base64Data.length}`;
    const cacheKey = createHash("sha256").update(cacheKeyString).digest("hex");

    if (generationCache.has(cacheKey)) {
      const cached = generationCache.get(cacheKey)!;
      if (Date.now() - cached.timestamp < 10 * 60 * 1000) {
        console.log("Retornando simulado direto do Cache L1 (0 RPM gasta)...");
        return NextResponse.json({ questions: cached.questions });
      } else {
        generationCache.delete(cacheKey);
      }
    }

    // Envia o prompt de texto JUNTO com o arquivo PDF em base64 nativamente!
    const result = await generateWithGeminiFallback([prompt, pdfPart], generationConfig);
    const responseText = result.response.text();
    const questions = JSON.parse(responseText);

    const cleanedQuestions = questions.map((q: any) => ({
      enunciado: cleanLatex(q.enunciado),
      alternativas: (q.alternativas || []).map((alt: string) => cleanLatex(alt)),
      correta: q.correta,
      justificativa: cleanLatex(q.justificativa)
    }));

    generationCache.set(cacheKey, { timestamp: Date.now(), questions: cleanedQuestions });

    return NextResponse.json({ questions: cleanedQuestions });

  } catch (error: any) {
    console.error("Erro na rota /api/generate:", error);
    return NextResponse.json({ error: error.message || "Erro interno no servidor." }, { status: 500 });
  }
}
