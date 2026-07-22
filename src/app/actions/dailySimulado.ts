"use server";

import { PrismaClient } from "@prisma/client";
import { computeStudentPerformanceStats } from "@/lib/stats";
import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";
import { promises as fs } from "fs";
import path from "path";
import { revalidatePath } from "next/cache";

const prisma = new PrismaClient();

function shuffleAlternatives(alternativas: string[], corretaIdx: number) {
  if (!alternativas || !Array.isArray(alternativas) || alternativas.length === 0) {
    return { alternativas: ["A) Alternativa indisponível", "B) Alternativa indisponível", "C) Alternativa indisponível", "D) Alternativa indisponível", "E) Alternativa indisponível"], correta: 0 };
  }

  const idx = Math.max(0, Math.min(corretaIdx, alternativas.length - 1));
  const correctText = alternativas[idx] || "";
  
  const prefixRegex = /^[A-Z][\s\)\-\.\:]+\s*/i;
  const cleanedAlts = alternativas.map(alt => (typeof alt === 'string' ? alt.replace(prefixRegex, "").trim() : String(alt)));
  const cleanedCorrectText = (typeof correctText === 'string' ? correctText.replace(prefixRegex, "").trim() : String(correctText));

  // Filtra itens vazios e garante que a alternativa correta esteja presente
  let validAlts = cleanedAlts.filter(alt => alt.length > 0);
  if (!validAlts.includes(cleanedCorrectText)) {
    validAlts.unshift(cleanedCorrectText);
  }

  // Se a IA gerou mais que 5 alternativas (ou comentários extras), corta para exatamente 5 preservando a correta
  if (validAlts.length > 5) {
    const wrongAlts = validAlts.filter(alt => alt !== cleanedCorrectText);
    validAlts = [cleanedCorrectText, ...wrongAlts.slice(0, 4)];
  }

  // Se tiver menos de 5 alternativas, preenche com opções neutras para manter padrão de 5
  while (validAlts.length < 5) {
    validAlts.push(`Alternativa ${validAlts.length + 1}`);
  }

  const shuffled = [...validAlts];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  let newCorreta = shuffled.indexOf(cleanedCorrectText);
  if (newCorreta === -1) {
    newCorreta = 0;
  }

  // Usa letra dinâmica (String.fromCharCode(65 + index)) para nunca dar "undefined"
  const finalAlts = shuffled.map((alt, index) => {
    const letter = String.fromCharCode(65 + index);
    return `${letter}) ${alt}`;
  });

  return {
    alternativas: finalAlts,
    correta: newCorreta
  };
}

function cleanLatexSyntax(text: string): string {
  if (!text) return "";
  return text
    .replace(/\\\$/g, "$")
    .replace(/\$\$/g, "")
    .replace(/\$/g, "")
    .replace(/\\rightarrow/g, "→")
    .replace(/\\leftarrow/g, "←")
    .replace(/\\leftrightarrow/g, "↔")
    .replace(/\\to/g, "→")
    .replace(/\\mathbf\{([^}]+)\}/g, "**$1**")
    .replace(/\\text\{([^}]+)\}/g, "$1")
    .replace(/\\mathrm\{([^}]+)\}/g, "$1")
    .replace(/\\vec\{([^}]+)\}/g, "$1")
    .replace(/\\([a-zA-Z]+)/g, " ");
}

// Configuração do esquema JSON rigoroso para o Gemini
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
  model: "gemini-1.5-flash",
  generationConfig: {
    responseMimeType: "application/json",
    responseSchema: responseSchema,
  }
};

const modelVersions = [
  "gemini-3.6-flash",
  "gemini-3.5-flash",
  "gemini-2.5-flash",
  "gemini-2.0-flash",
  "gemini-1.5-pro",
  "gemini-pro-latest"
];

const getDailyKeyIndex = () => {
  if (typeof (global as any).dailyKeyRoundRobinIndex !== "number") {
    (global as any).dailyKeyRoundRobinIndex = 0;
  }
  return (global as any).dailyKeyRoundRobinIndex as number;
};

const setDailyKeyIndex = (idx: number) => {
  (global as any).dailyKeyRoundRobinIndex = idx;
};

const dailyKeyModelCooldowns = (() => {
  if (!(global as any).dailyKeyModelCooldownsMap) {
    (global as any).dailyKeyModelCooldownsMap = new Map<string, number>();
  }
  return (global as any).dailyKeyModelCooldownsMap as Map<string, number>;
})();

function isRateLimitError(msg?: string): boolean {
  if (!msg) return false;
  return msg.includes("429") || msg.includes("Quota") || msg.includes("503") || msg.includes("high demand") || msg.includes("RESOURCE_EXHAUSTED");
}

async function generateWithFallback(content: any[]) {
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

  // 1°: Definir como piso o modelo 3.1 flash para todas as chaves Geminis
  const modelVersions = [
    "gemini-3.6-flash",
    "gemini-3.5-flash",
    "gemini-3.1-flash"
  ];

  // Round-robin: distribui as requisições de apostilas entre todas as chaves disponíveis para não sobrecarregar
  const startIndex = getDailyKeyIndex() % apiKeys.length;
  setDailyKeyIndex((startIndex + 1) % apiKeys.length);

  for (const modelVersion of modelVersions) {
    const dynamicGenConfig = {
      model: modelVersion,
      generationConfig: genConfig.generationConfig
    };

    const now = Date.now();

    for (let i = 0; i < apiKeys.length; i++) {
      const keyObj = apiKeys[(startIndex + i) % apiKeys.length];
      const cooldownKey = `${keyObj.label}_${modelVersion}`;

      if (!dailyKeyModelCooldowns.has(cooldownKey) || now > dailyKeyModelCooldowns.get(cooldownKey)!) {
        console.log(`[DAILY GENERATION] Tentando chave [${keyObj.label}] com modelo [${modelVersion}]...`);
        try {
          const genAI = new GoogleGenerativeAI(keyObj.key);
          const model = genAI.getGenerativeModel(dynamicGenConfig as any);
          return await model.generateContent(content);
        } catch (error: any) {
          console.warn(`[DAILY GENERATION] Chave [${keyObj.label}] falhou com modelo [${modelVersion}]:`, error.message);
          if (isRateLimitError(error.message)) {
            console.warn(`[DAILY GENERATION Cooldown] Chave [${keyObj.label}] em repouso por 45s no modelo [${modelVersion}].`);
            dailyKeyModelCooldowns.set(cooldownKey, Date.now() + 45_000);
          }
        }
      } else {
        console.log(`[DAILY GENERATION Cooldown] Chave [${keyObj.label}] em repouso no modelo [${modelVersion}]. Pulando...`);
      }
    }
  }

  // 2°: Na hipótese de todas as chaves geminis falharem ao chegar no limite do 3.1 flash, usaremos a api da claude no modelo sonnet 5 de forma excepcional
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  if (anthropicKey) {
    try {
      console.warn("[DAILY GENERATION - FALLBACK EXCEPCIONAL] Todas as chaves Gemini falharam até o piso 3.1 flash. Acionando Claude Sonnet 5 de forma excepcional...");
      const Anthropic = require("@anthropic-ai/sdk");
      const anthropic = new Anthropic({ apiKey: anthropicKey });

      let promptText = "";
      let base64Pdf = "";

      for (const item of content) {
        if (typeof item === "string") {
          promptText += item;
        } else if (item?.inlineData?.data) {
          base64Pdf = item.inlineData.data;
        }
      }

      const fullPrompt = promptText + "\n\nIMPORTANTE: Sua resposta DEVE ser ÚNICA E EXCLUSIVAMENTE um array JSON válido sem marcações markdown ```json, sem texto antes ou depois, começando direto no colchete [ e terminando no fechar colchete ].";

      const userContent: any[] = [];
      if (base64Pdf) {
        userContent.push({
          type: "document",
          source: {
            type: "base64",
            media_type: "application/pdf",
            data: base64Pdf
          }
        });
      }
      userContent.push({
        type: "text",
        text: fullPrompt
      });

      const response = await anthropic.messages.create({
        model: "claude-sonnet-5",
        max_tokens: 8192,
        messages: [{ role: "user", content: userContent }]
      });

      let rawText = response.content[0]?.type === 'text' ? response.content[0].text : '';
      let jsonText = rawText.trim();
      if (jsonText.startsWith("```json")) {
        jsonText = jsonText.replace(/^```json\s*/, "").replace(/\s*```$/, "");
      } else if (jsonText.startsWith("```")) {
        jsonText = jsonText.replace(/^```\s*/, "").replace(/\s*```$/, "");
      }

      // Valida JSON antes de retornar
      JSON.parse(jsonText);
      console.log(`✅ [CLAUDE AI - DAILY EXCEPCIONAL (claude-sonnet-5)] Questões geradas e validadas com sucesso!`);
      return { response: { text: () => jsonText } };
    } catch (err: any) {
      console.warn(`[CLAUDE AI - DAILY EXCEPCIONAL] Falha ao acionar Claude Sonnet 5 de forma excepcional:`, err.message || err);
    }
  }

  throw new Error("Todas as chaves e modelos do Gemini (até piso 3.1 flash) e o fallback excepcional do Claude falharam na geração diária.");
}

// Global locks to persist across Next.js reloads
const activeGenerations = (() => {
  if (!(global as any).activeGenerationsSet) {
    (global as any).activeGenerationsSet = new Set<string>();
  }
  return (global as any).activeGenerationsSet as Set<string>;
})();

function getIsDailyCheckingRunning(): boolean {
  return !!(global as any).isDailyCheckingRunning;
}

function setIsDailyCheckingRunning(val: boolean) {
  (global as any).isDailyCheckingRunning = val;
}

const getGenerationQueue = () => {
  if (!(global as any).generationQueuePromise) {
    (global as any).generationQueuePromise = Promise.resolve<any>(null);
  }
  return (global as any).generationQueuePromise as Promise<any>;
};

const setGenerationQueue = (promise: Promise<any>) => {
  (global as any).generationQueuePromise = promise;
};

export async function queueGenerationTask<T>(task: () => Promise<T>): Promise<T> {
  const nextPromise = getGenerationQueue().then(task);
  setGenerationQueue(nextPromise.catch(() => {}));
  return nextPromise;
}

export async function checkAndGenerateDailySimulados() {
  if (getIsDailyCheckingRunning()) {
    console.log("[DAILY CHECK] Geração global diária já está ativa. Ignorando chamada concorrente.");
    return { success: true, message: "Geração em andamento." };
  }

  setIsDailyCheckingRunning(true);

  try {
    return await queueGenerationTask(async () => {
      try {
        // 1. Buscar todas as apostilas ativas
        const activeApostilas = await prisma.apostila.findMany({
          where: { isActive: true }
        });

        if (activeApostilas.length === 0) {
          return { success: true, message: "Nenhuma apostila ativa cadastrada." };
        }

        // Buscar nomes reais dos alunos para contextualização no prompt
        let studentNames: string[] = [];
        try {
          const students = await prisma.user.findMany({
            where: { role: "STUDENT" },
            select: { name: true }
          });
          studentNames = Array.from(new Set(students.map((s: any) => s.name.trim()).filter(Boolean)));
        } catch (dbErr) {
          console.error("[DAILY CHECK] Erro ao buscar alunos para o prompt:", dbErr);
        }

        // 2. Definir o início e fim do dia atual (UTC-3 ou fuso local do servidor)
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        const todayEnd = new Date();
        todayEnd.setHours(23, 59, 59, 999);

        let generatedCount = 0;

        for (const apostila of activeApostilas) {
          // Evitar chamadas simultâneas duplicadas (lock de memória por processo)
          if (activeGenerations.has(apostila.title)) {
            console.log(`[DAILY CHECK] Geração para "${apostila.title}" já está em andamento em outra requisição. Ignorando concorrência.`);
            continue;
          }

          // 3. Verificar se já existe um simulado diário para esta apostila criado hoje
          const existingDaily = await prisma.simulado.findFirst({
            where: {
              tipo: "DAILY",
              apostilaName: apostila.title,
              createdAt: {
                gte: todayStart,
                lte: todayEnd
              }
            }
          });

          if (existingDaily) {
            console.log(`[DAILY CHECK] Simulado diário para "${apostila.title}" já existe hoje.`);
            continue;
          }

          // Ativa o lock para esta apostila
          activeGenerations.add(apostila.title);

          try {
            console.log(`[DAILY CHECK] Gerando simulado diário para "${apostila.title}"...`);

            // 4. Ler o arquivo PDF físico
            const filePath = path.join(process.cwd(), "public", apostila.filePath);
            let base64Data = "";
            try {
              const buffer = await fs.readFile(filePath);
              base64Data = buffer.toString("base64");
            } catch (err: any) {
              console.error(`[DAILY ERROR] Falha ao ler arquivo físico da apostila em ${filePath}:`, err.message);
              continue; // Pula para a próxima se o arquivo estiver corrompido ou ausente
            }

            const pdfPart = {
              inlineData: {
                data: base64Data,
                mimeType: "application/pdf"
              }
            };

            // 5. Montar prompt com as regras avançadas e contextualização de alunos
            let prompt = `Você é um instrutor especialista elaborando um simulado.
Analise o documento PDF em anexo rigorosamente.

Crie exatamente 25 questões de múltipla escolha utilizando EXCLUSIVAMENTE o conteúdo DIDÁTICO e TÉCNICO contido no PDF (os assuntos centrais que serão cobrados em prova).

REGRAS CRÍTICAS DE ELABORAÇÃO:
1. OBJETIVIDADE EXTREMA (Estilo Quiz): O tempo do aluno é curto. Crie enunciados diretos, ágeis e sem enrolação. As alternativas também devem ser o mais curtas e objetivas possíveis.
2. PEGADINHAS INTELIGENTES: As alternativas erradas JAMAIS devem ser "absurdas" ou óbvias. Use a tática da confusão: troque uma palavra-chave, misture dois conceitos reais do texto, ou crie "pegadinhas" sutis. Faça o recruta suar.
3. FOCO TÉCNICO: NUNCA elabore questões sobre metadados do documento (ignore nomes de autores, diretores, reitores, ficha catalográfica, histórico de edições ou índices). Foque apenas na matéria/teoria militar e policial.
4. Não use NENHUM conhecimento prévio ou externo. Se a resposta não estiver no texto, não crie a questão.
5. SEM AMBIGUIDADES: É proibido haver ambiguidades ou múltiplas interpretações plausíveis. O aluno deve ser testado através da troca inteligente de conceitos, mas a alternativa correta precisa estar clara e fielmente ancorada na apostila, de forma incontestável.
6. ENUNCIADO COMPLETO: Ainda que objetivo, o enunciado não pode ser omisso. Deve apresentar todos os elementos e contextos necessários para a elucidação da questão de forma independente.`;

            if (studentNames.length > 0) {
              const shuffledNames = [...studentNames].sort(() => 0.5 - Math.random()).slice(0, 10);
              prompt += `\n7. CONTEXTUALIZAÇÃO COM ALUNOS (CASOS PRÁTICOS): Raramente (no máximo em 1 ou 2 questões deste simulado de 25 questões) e apenas quando for oportuno, elabore um caso prático fictício no enunciado utilizando alguns dos seguintes QRAs de alunos reais do pelotão: ${shuffledNames.join(", ")} (exemplo: "William viu Marcelino fazendo tal coisa com Roberto..."). Nas demais questões, NÃO utilize nomes de alunos. Seja discreto e evite qualquer exagero na frequência desta regra.`;
            }

            prompt += `\n\nO nível de dificuldade deve ser: avançado (questões extremamente desafiadoras, no nível de concursos públicos exigentes, com enunciados bem elaborados e alternativas plausíveis e difíceis, exigindo raciocínio e atenção a detalhes sutis).
Cada questão deve ter 5 alternativas. A alternativa correta deve ser distribuída aleatoriamente (não deixe sempre na A).`;

            const result = await generateWithFallback([prompt, pdfPart]);
            const responseText = result.response.text();
            const questions = JSON.parse(responseText);

            // 6. Salvar o simulado e questões no banco
            await prisma.simulado.create({
              data: {
                tipo: "DAILY",
                status: "ACTIVE", // Simulados diários entram ativos para os alunos responderem
                instructorId: apostila.instructorId,
                apostilaName: apostila.title,
                difficulty: "AVANCADO",
                questions: {
                  create: questions.map((q: any) => {
                    const cleanEnunciado = cleanLatexSyntax(q.enunciado);
                    const cleanJustificativa = cleanLatexSyntax(q.justificativa);
                    const cleanAlts = (q.alternativas || []).map((alt: string) => cleanLatexSyntax(alt));
                    const shuffled = shuffleAlternatives(cleanAlts, q.correta);
                    return {
                      enunciado: cleanEnunciado,
                      alternativas: JSON.stringify(shuffled.alternativas),
                      correta: shuffled.correta,
                      justificativa: cleanJustificativa,
                      tempoLimite: 60, // Padrão de 60 segundos por questão nos simulados diários
                      status: "PENDING"
                    };
                  })
                }
              }
            });

            generatedCount++;
            console.log(`[DAILY SUCCESS] Simulado diário para "${apostila.title}" criado com sucesso!`);
          } catch (err: any) {
            console.error(`[DAILY ERROR] Falha ao gerar simulado via IA para "${apostila.title}":`, err.message);
          } finally {
            // Libera o lock
            activeGenerations.delete(apostila.title);
          }
        }

        return { success: true, generatedCount };
      } catch (error: any) {
        console.error("[DAILY CRITICAL] Erro no processo de simulados diários:", error);
        return { error: error.message };
      }
    });
  } finally {
    setIsDailyCheckingRunning(false);
  }
}

export async function saveSelfPacedAnswer(data: {
  questionId: string;
  studentId: string;
  alternativa: number;
  tempoGasto: number;
}) {
  const { questionId, studentId, alternativa, tempoGasto } = data;

  try {
    // 1. Evitar respostas duplicadas
    const existingAnswer = await prisma.answer.findFirst({
      where: {
        questionId,
        studentId
      }
    });

    if (existingAnswer) {
      return { error: "Questão já respondida." };
    }

    // 2. Buscar a questão para validar
    const question = await prisma.question.findUnique({
      where: { id: questionId }
    });

    if (!question) {
      return { error: "Questão não encontrada." };
    }

    const isCorrect = Number(question.correta) === Number(alternativa);
    
    let pontuacao = 0;
    if (isCorrect) {
      pontuacao = 100; // Sem pontos de bônus por velocidade em simulados individuais
    }

    let safeTempoGasto = Number(tempoGasto) || 0;
    if (safeTempoGasto < 0) safeTempoGasto = 0;
    if (safeTempoGasto > question.tempoLimite * 2) {
      safeTempoGasto = question.tempoLimite;
    }

    // 3. Salvar no banco
    await prisma.answer.create({
      data: {
        questionId,
        studentId,
        alternativa,
        tempoGasto: safeTempoGasto,
        isCorrect,
        pontuacao,
        isRaffle: false
      }
    });

    return {
      success: true,
      isCorrect,
      correta: question.correta,
      justificativa: question.justificativa,
      pontuacao
    };
  } catch (error: any) {
    console.error("Erro ao salvar resposta individual:", error);
    return { error: "Erro ao salvar a resposta." };
  }
}

export async function completeSelfPacedSimulado(studentId: string, currentSimuladoId: string) {
  try {
    const student = await prisma.user.findUnique({
      where: { id: studentId },
      include: {
        answers: {
          include: { 
            question: {
              include: { 
                simulado: {
                  include: {
                    _count: { select: { questions: true } }
                  }
                } 
              }
            } 
          }
        }
      }
    });

    if (!student) return { error: "Estudante não encontrado." };

    const correctAnswers = student.answers.filter(a => a.isCorrect);

    // Get other students' raffle answers in the participated simulados
    const simuladoIds = Array.from(new Set(student.answers.map(a => a.question.simuladoId)));
    const otherRaffleAnswers = await prisma.answer.findMany({
      where: {
        question: { simuladoId: { in: simuladoIds } },
        isRaffle: true,
        studentId: { not: studentId }
      },
      select: {
        question: { select: { simuladoId: true } }
      }
    });

    const otherRaffleCounts = new Map<string, number>();
    otherRaffleAnswers.forEach(ora => {
      const sId = ora.question.simuladoId;
      otherRaffleCounts.set(sId, (otherRaffleCounts.get(sId) || 0) + 1);
    });

    // Group answers by simulado to verify complete completion
    const simuladoStatsMap = new Map<string, { expectedQ: number; answeredCount: number; correctAnswers: number; tipo: string; status: string; answers: typeof student.answers }>();
    student.answers.forEach(a => {
      const simuladoId = a.question.simuladoId;
      if (!simuladoStatsMap.has(simuladoId)) {
        const totalQ = a.question.simulado._count.questions || 0;
        const otherRaffleCount = otherRaffleCounts.get(simuladoId) || 0;
        const expectedQ = Math.max(0, totalQ - otherRaffleCount);
        simuladoStatsMap.set(simuladoId, {
          expectedQ,
          answeredCount: 0,
          correctAnswers: 0,
          tipo: (a.question.simulado as any).tipo || "STUDY",
          status: (a.question.simulado as any).status || "FINISHED",
          answers: []
        });
      }
      const s = simuladoStatsMap.get(simuladoId)!;
      s.answeredCount++;
      s.answers.push(a);
      if (a.isCorrect) s.correctAnswers++;
    });

    const simuladoGroups: Record<string, typeof student.answers> = {};
    simuladoStatsMap.forEach((s, sId) => {
      simuladoGroups[sId] = s.answers;
    });

    const sPerf = computeStudentPerformanceStats(student.answers, student.id, otherRaffleCounts);
    const simuladosCount = sPerf.simuladosCount;
    const accuracy = sPerf.accuracy;
    const totalScore = sPerf.totalScore;
    
    let advancedSimuladosCount = 0;
    let hardSimuladosWith70Acc = 0;
    let hardSimuladosWith75Acc = 0;
    let hasSniper = false;
    let hasRaio = false;

    Object.values(simuladoGroups).forEach(simAnswers => {
      if (simAnswers.length === 0) return;
      const qCount = simAnswers.length;
      const totalQuestionsInSimulado = simAnswers[0].question.simulado._count.questions;
      const corrects = simAnswers.filter(a => a.isCorrect).length;
      
      const acc = Math.round((corrects / totalQuestionsInSimulado) * 100);
      const avgTime = Math.round(simAnswers.reduce((acc, curr) => acc + (curr.tempoGasto || 0), 0) / qCount);
      const difficulty = simAnswers[0].question.simulado.difficulty;

      const isCompleteEnough = qCount === totalQuestionsInSimulado || qCount >= 10;

      if (difficulty === "AVANCADO" && isCompleteEnough) {
        advancedSimuladosCount++;
        if (acc >= 70) hardSimuladosWith70Acc++;
        if (acc >= 75) hardSimuladosWith75Acc++;
        
        if (qCount >= 20 && acc === 100) hasSniper = true;
        if (acc >= 85 && avgTime <= 15) hasRaio = true;
      }
    });

    const hasRecruta = simuladosCount >= 3 && totalScore >= 3000;

    let maxConsecutiveErrors = 0;
    let currentConsecutiveErrors = 0;
    student.answers.forEach(a => {
      if (!a.isCorrect) {
        currentConsecutiveErrors++;
        if (currentConsecutiveErrors > maxConsecutiveErrors) {
          maxConsecutiveErrors = currentConsecutiveErrors;
        }
      } else {
        currentConsecutiveErrors = 0;
      }
    });
    const hasBizonho = maxConsecutiveErrors >= 3;

    const hasAfoito = student.answers.some(a => !a.isCorrect && a.tempoGasto > 0 && a.tempoGasto < 3);
    const hasDorminhoco = student.answers.some(a => a.alternativa === -1);

    let hasPepreto = false;
    Object.values(simuladoGroups).forEach(simAnswers => {
      if (simAnswers.length === 0) return;
      const totalQuestionsInSimulado = simAnswers[0].question.simulado._count.questions;
      const corrects = simAnswers.filter(a => a.isCorrect).length;
      const acc = Math.round((corrects / totalQuestionsInSimulado) * 100);
      
      if (totalQuestionsInSimulado >= 5 && simAnswers.length === totalQuestionsInSimulado) {
        if (acc < 10) {
          hasPepreto = true;
        }
      }
    });

    let badges = [
      { id: 'recruta', name: 'Recruta', earned: hasRecruta, exclusive: false },
      { id: 'guerreiro', name: 'Guerreiro', earned: hardSimuladosWith70Acc >= 10 && totalScore >= 25000, exclusive: false },
      { id: 'veterano', name: 'Veterano', earned: hardSimuladosWith75Acc >= 25 && totalScore >= 60000, exclusive: false },
      { id: 'sniper', name: 'Atirador de Elite', earned: hasSniper && totalScore >= 80000, exclusive: false },
      { id: 'raio', name: 'Pronto Resposta (Raio)', earned: hasRaio && totalScore >= 50000, exclusive: false },
      { id: 'caveira', name: 'Caveira', earned: advancedSimuladosCount >= 40 && accuracy >= 97 && totalScore >= 100000, exclusive: false },
      { id: 'padrao', name: 'Padrão PM', earned: totalScore >= 150000 && accuracy >= 92, exclusive: false },
      { id: 'bizonho', name: 'Bizonho', earned: hasBizonho, exclusive: false },
      { id: 'afoito', name: 'Gatilho Afoito', earned: hasAfoito, exclusive: false },
      { id: 'dorminhoco', name: 'Dormiu na Guarita', earned: hasDorminhoco, exclusive: false },
      { id: 'pepreto', name: 'Pé Preto', earned: hasPepreto, exclusive: false }
    ];

    const earnedBadgeIds = badges.filter(b => b.earned).map(b => b.id);
    const previouslyUnlocked = student.unlockedBadges ? student.unlockedBadges.split(',').filter(Boolean) : [];

    const newlyUnlocked = earnedBadgeIds.filter(id => !previouslyUnlocked.includes(id));

    if (newlyUnlocked.length > 0) {
      const newUnlockedBadges = [...previouslyUnlocked, ...newlyUnlocked].join(',');
      await prisma.user.update({
        where: { id: studentId },
        data: { unlockedBadges: newUnlockedBadges }
      });
    }

    return { success: true, newlyUnlockedCount: newlyUnlocked.length };
  } catch (err: any) {
    console.error("Erro ao finalizar simulado individual:", err);
    return { error: err.message || "Erro desconhecido ao computar brevês." };
  }
}

export async function resetSimuladoAttempt(studentId: string, simuladoId: string) {
  try {
    const questions = await prisma.question.findMany({
      where: { simuladoId },
      select: { id: true }
    });
    
    const questionIds = questions.map(q => q.id);

    if (questionIds.length > 0) {
      await prisma.answer.deleteMany({
        where: {
          studentId,
          questionId: { in: questionIds }
        }
      });
    }

    revalidatePath(`/aluno/simulado/${simuladoId}`);
    revalidatePath("/aluno/painel");

    return { success: true };
  } catch (error: any) {
    console.error("Erro ao resetar tentativa de simulado:", error);
    return { error: error.message || "Erro desconhecido ao resetar tentativa." };
  }
}

export async function generateDailySimuladoForSingleApostila(apostila: any) {
  // Evitar chamadas simultâneas duplicadas (lock de memória por processo)
  if (activeGenerations.has(apostila.title)) {
    throw new Error(`A geração para "${apostila.title}" já está em andamento.`);
  }

  activeGenerations.add(apostila.title);

  try {
    console.log(`[SINGLE GENERATION] Gerando simulado diário para "${apostila.title}"...`);

    // 1. Ler o arquivo PDF físico
    const filePath = path.join(process.cwd(), "public", apostila.filePath);
    const buffer = await fs.readFile(filePath);
    const base64Data = buffer.toString("base64");

    const pdfPart = {
      inlineData: {
        data: base64Data,
        mimeType: "application/pdf"
      }
    };

    // 2. Montar prompt com as regras avançadas
    const prompt = `Você é um instrutor especialista elaborando um simulado.
Analise o documento PDF em anexo rigorosamente.

Crie exatamente 25 questões de múltipla escolha utilizando EXCLUSIVAMENTE o conteúdo DIDÁTICO e TÉCNICO contido no PDF (os assuntos centrais que serão cobrados em prova).

REGRAS CRÍTICAS DE ELABORAÇÃO:
1. OBJETIVIDADE EXTREMA (Estilo Quiz): O tempo do aluno é curto. Crie enunciados diretos, ágeis e sem enrolação. As alternativas também devem ser o mais curtas e objetivas possíveis.
2. PEGADINHAS INTELIGENTES: As alternativas erradas JAMAIS devem ser "absurdas" ou óbvias. Use a tática da confusão: troque uma palavra-chave, misture dois conceitos reais do texto, ou crie "pegadinhas" sutis. Faça o recruta suar.
3. FOCO TÉCNICO: NUNCA elabore questões sobre metadados do documento (ignore nomes de autores, diretores, reitores, ficha catalográfica, histórico de edições ou índices). Foque apenas na matéria/teoria militar e policial.
4. Não use NENHUM conhecimento prévio ou externo. Se a resposta não estiver no texto, não crie a questão.
5. SEM AMBIGUIDADES: É proibido haver ambiguidades ou múltiplas interpretações plausíveis. O aluno deve ser testado através da troca inteligente de conceitos, mas a alternativa correta precisa estar clara e fielmente ancorada na apostila, de forma incontestável.
6. ENUNCIADO COMPLETO: Ainda que objetivo, o enunciado não pode ser omisso. Deve apresentar todos os elementos e contextos necessários para a elucidação da questão de forma independente.

O nível de dificuldade deve ser: avançado (questões extremamente desafiadoras, no nível de concursos públicos exigentes, com enunciados bem elaborados e alternativas plausíveis e difíceis, exigindo raciocínio e atenção a detalhes sutis).
Cada questão deve ter 5 alternativas. A alternativa correta deve ser distribuída aleatoriamente (não deixe sempre na A).`;

    const result = await generateWithFallback([prompt, pdfPart]);
    const responseText = result.response.text();
    const questions = JSON.parse(responseText);

    // 3. Salvar o simulado e questões no banco
    const simulado = await prisma.simulado.create({
      data: {
        tipo: "DAILY",
        status: "ACTIVE",
        instructorId: apostila.instructorId,
        apostilaName: apostila.title,
        difficulty: "AVANCADO",
        questions: {
          create: questions.map((q: any) => {
            const cleanEnunciado = cleanLatexSyntax(q.enunciado);
            const cleanJustificativa = cleanLatexSyntax(q.justificativa);
            const cleanAlts = (q.alternativas || []).map((alt: string) => cleanLatexSyntax(alt));
            const shuffled = shuffleAlternatives(cleanAlts, q.correta);
            return {
              enunciado: cleanEnunciado,
              alternativas: JSON.stringify(shuffled.alternativas),
              correta: shuffled.correta,
              justificativa: cleanJustificativa,
              tempoLimite: 60,
              status: "PENDING"
            };
          })
        }
      }
    });

    console.log(`[SINGLE SUCCESS] Simulado diário para "${apostila.title}" criado com sucesso!`);
    return { success: true, simuladoId: simulado.id };
  } finally {
    activeGenerations.delete(apostila.title);
  }
}

export async function forceGenerateDailySimuladoForApostila(apostilaId: string) {
  return queueGenerationTask(async () => {
    const { getUser } = await import("./auth");
    const user = await getUser();
    if (!user || user.role !== "INSTRUCTOR") {
      return { error: "Não autorizado." };
    }

    try {
      const apostila = await prisma.apostila.findUnique({
        where: { id: apostilaId }
      });

      if (!apostila) {
        return { error: "Apostila não encontrada." };
      }

      // 1. Apagar simulado diário de hoje desta apostila se existir
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const todayEnd = new Date();
      todayEnd.setHours(23, 59, 59, 999);

      const existingDaily = await prisma.simulado.findFirst({
        where: {
          tipo: "DAILY",
          apostilaName: apostila.title,
          createdAt: {
            gte: todayStart,
            lte: todayEnd
          }
        },
        select: { id: true }
      });

      if (existingDaily) {
        await prisma.answer.deleteMany({
          where: { question: { simuladoId: existingDaily.id } }
        });
        await prisma.question.deleteMany({
          where: { simuladoId: existingDaily.id }
        });
        await prisma.simulado.delete({
          where: { id: existingDaily.id }
        });
      }

      // 2. Gerar novo simulado
      const res = await generateDailySimuladoForSingleApostila(apostila);
      
      revalidatePath("/instructor");
      revalidatePath("/aluno/painel");
      return res;
    } catch (error: any) {
      console.error("[FORCE SINGLE DAILY] Erro ao forçar geração:", error);
      return { error: error.message || "Erro na geração do simulado." };
    }
  });
}

export async function forceGenerateAllDailySimuladosAction() {
  return queueGenerationTask(async () => {
    const { getUser } = await import("./auth");
    const user = await getUser();
    if (!user || user.role !== "INSTRUCTOR") {
      return { error: "Não autorizado." };
    }

    try {
      // 1. Buscar todas as apostilas ativas
      const activeApostilas = await prisma.apostila.findMany({
        where: { isActive: true }
      });

      if (activeApostilas.length === 0) {
        return { error: "Nenhuma apostila ativa cadastrada." };
      }

      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const todayEnd = new Date();
      todayEnd.setHours(23, 59, 59, 999);

      // 2. Apagar todos os simulados diários gerados hoje
      const activeTitles = activeApostilas.map(a => a.title);
      const existingDailies = await prisma.simulado.findMany({
        where: {
          tipo: "DAILY",
          apostilaName: { in: activeTitles },
          createdAt: {
            gte: todayStart,
            lte: todayEnd
          }
        },
        select: { id: true }
      });

      const dailyIds = existingDailies.map(s => s.id);

      if (dailyIds.length > 0) {
        await prisma.answer.deleteMany({
          where: { question: { simuladoId: { in: dailyIds } } }
        });
        await prisma.question.deleteMany({
          where: { simuladoId: { in: dailyIds } }
        });
        await prisma.simulado.deleteMany({
          where: { id: { in: dailyIds } }
        });
      }

      // 3. Gerar tudo novamente
      const res = await checkAndGenerateDailySimulados();
      
      revalidatePath("/instructor");
      revalidatePath("/aluno/painel");
      return res;
    } catch (error: any) {
      console.error("[FORCE ALL DAILY] Erro ao forçar todos:", error);
      return { error: error.message || "Erro na geração dos simulados." };
    }
  });
}

