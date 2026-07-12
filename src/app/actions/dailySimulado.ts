"use server";

import { PrismaClient } from "@prisma/client";
import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";
import { promises as fs } from "fs";
import path from "path";
import { revalidatePath } from "next/cache";

const prisma = new PrismaClient();

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
  "gemini-pro-latest",
  "gemini-3.5-flash",
  "gemini-3.1-flash-lite",
  "gemini-3-flash-preview",
  "gemini-2.5-flash",
  "gemini-2.0-flash",
  "gemini-flash-latest"
];

async function generateWithFallback(content: any[]) {
  const primaryKey = process.env.GEMINI_API_KEY || "";
  const fallbackKey = process.env.GEMINI_API_KEY_FALLBACK || "";

  if (!primaryKey) {
    throw new Error("Chave do Gemini não configurada no servidor.");
  }

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
      console.warn(`[DAILY GENERATION] Chave principal falhou com modelo ${modelVersion}:`, error.message);

      const isQuotaError =
        error.status === 429 ||
        error.status === 503 ||
        error.message?.includes("429") ||
        error.message?.includes("503") ||
        error.message?.includes("quota") ||
        error.message?.includes("exhausted");
      const isNotFoundError = error.status === 404 || error.message?.includes("404") || error.message?.includes("not found");

      if (isQuotaError && fallbackKey) {
        console.log(`[DAILY GENERATION] Tentando chave fallback com modelo ${modelVersion}...`);
        try {
          const fallbackGenAI = new GoogleGenerativeAI(fallbackKey);
          const fallbackModel = fallbackGenAI.getGenerativeModel(dynamicGenConfig as any);
          return await fallbackModel.generateContent(content);
        } catch (fallbackError: any) {
          console.warn(`[DAILY GENERATION] Chave fallback falhou com modelo ${modelVersion}:`, fallbackError.message);
        }
      }

      if (!isQuotaError && !isNotFoundError && !error.message?.includes("403")) {
        throw error;
      }
    }
  }
  throw new Error("Todas as versões do modelo Gemini falharam na geração diária.");
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

            // 5. Montar prompt com as regras avançadas
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

            // 6. Salvar o simulado e questões no banco
            await prisma.simulado.create({
              data: {
                tipo: "DAILY",
                status: "ACTIVE", // Simulados diários entram ativos para os alunos responderem
                instructorId: apostila.instructorId,
                apostilaName: apostila.title,
                difficulty: "AVANCADO",
                questions: {
                  create: questions.map((q: any) => ({
                    enunciado: q.enunciado,
                    alternativas: JSON.stringify(q.alternativas),
                    correta: q.correta,
                    justificativa: q.justificativa,
                    tempoLimite: 60, // Padrão de 60 segundos por questão nos simulados diários
                    status: "PENDING"
                  }))
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

    // Calculate total questions across all unique simulados the student participated in
    const participatedSimulados = new Map<string, number>();
    student.answers.forEach(a => {
      const simuladoId = a.question.simuladoId;
      const totalQ = a.question.simulado._count.questions;
      const otherRaffleCount = otherRaffleCounts.get(simuladoId) || 0;
      const expectedQ = Math.max(0, totalQ - otherRaffleCount);
      participatedSimulados.set(simuladoId, expectedQ);
    });

    const totalQuestions = Array.from(participatedSimulados.values()).reduce((sum, count) => sum + count, 0);
    const accuracy = totalQuestions > 0 ? Math.round((correctAnswers.length / totalQuestions) * 100) : 0;
    const totalScore = student.answers.reduce((acc, curr) => acc + (curr.pontuacao || 0), 0);
    
    const simuladoGroups: Record<string, typeof student.answers> = {};
    student.answers.forEach(a => {
      if (!simuladoGroups[a.question.simuladoId]) simuladoGroups[a.question.simuladoId] = [];
      simuladoGroups[a.question.simuladoId].push(a);
    });

    const simuladosCount = Object.keys(simuladoGroups).length;
    
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
        
        if (qCount >= 15 && acc === 100) hasSniper = true;
        if (acc >= 80 && avgTime <= 20) hasRaio = true;
      }
    });

    const hasRecruta = Object.values(simuladoGroups).some(simAnswers => {
      return simAnswers.length >= 3 || simAnswers.length === simAnswers[0].question.simulado._count.questions;
    });

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
      { id: 'guerreiro', name: 'Guerreiro', earned: hardSimuladosWith70Acc >= 5, exclusive: false },
      { id: 'veterano', name: 'Veterano', earned: hardSimuladosWith75Acc >= 10, exclusive: false },
      { id: 'sniper', name: 'Atirador de Elite', earned: hasSniper, exclusive: true },
      { id: 'raio', name: 'Pronto Resposta (Raio)', earned: hasRaio, exclusive: true },
      { id: 'caveira', name: 'Caveira', earned: advancedSimuladosCount >= 15 && accuracy >= 95, exclusive: true },
      { id: 'padrao', name: 'Padrão PM', earned: totalScore >= 45000 && accuracy >= 90, exclusive: true },
      { id: 'bizonho', name: 'Bizonho', earned: hasBizonho, exclusive: false },
      { id: 'afoito', name: 'Gatilho Afoito', earned: hasAfoito, exclusive: false },
      { id: 'dorminhoco', name: 'Dormiu na Guarita', earned: hasDorminhoco, exclusive: false },
      { id: 'pepreto', name: 'Pé Preto', earned: hasPepreto, exclusive: false }
    ];

    // Check exclusivity
    for (let i = 0; i < badges.length; i++) {
      if (badges[i].exclusive && badges[i].earned) {
        const existingExclusive = await prisma.exclusiveBadge.findFirst({
          where: { badgeId: badges[i].id }
        });

        if (existingExclusive) {
          if (existingExclusive.simuladoId !== currentSimuladoId) {
            badges[i].earned = false;
          }
        } else {
          await prisma.exclusiveBadge.create({
            data: { badgeId: badges[i].id, userId: studentId, simuladoId: currentSimuladoId }
          });
        }
      }
    }

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
          create: questions.map((q: any) => ({
            enunciado: q.enunciado,
            alternativas: JSON.stringify(q.alternativas),
            correta: q.correta,
            justificativa: q.justificativa,
            tempoLimite: 60,
            status: "PENDING"
          }))
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

