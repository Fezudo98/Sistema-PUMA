import { createHash } from "node:crypto";
import { SchemaType } from "@google/generative-ai";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCachedApostilaText } from "@/lib/apostilaCache";
import { cleanLatex, generateWithGeminiFallback } from "@/lib/gemini";
import { selectDailyBankItems } from "@/lib/dailyQuestionSelection";
import { getFortalezaDay, getIsoWeekKey } from "@/lib/fortalezaDate";

const DAILY_QUESTION_COUNT = 25;
const DAILY_NEW_QUESTION_LIMIT = 5;
const REUSE_GAP_DAYS = 7;
const MINIMUM_BANK_SIZE = 150;
const WEEKLY_BATCH_SIZE = 35;
const MAX_SOURCE_CHARS = 120_000;

type GeneratedQuestion = {
  enunciado: string;
  alternativas: string[];
  correta: number;
  justificativa: string;
  topico?: string | null;
};

const generatedQuestionsSchema = {
  type: SchemaType.ARRAY,
  items: {
    type: SchemaType.OBJECT,
    properties: {
      enunciado: { type: SchemaType.STRING },
      alternativas: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
      correta: { type: SchemaType.INTEGER },
      justificativa: { type: SchemaType.STRING },
      topico: { type: SchemaType.STRING },
    },
    required: ["enunciado", "alternativas", "correta", "justificativa"],
  },
};

function normalizeForHash(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[^a-z0-9 ]/g, "")
    .trim();
}

export function questionContentHash(enunciado: string): string {
  return createHash("sha256").update(normalizeForHash(enunciado)).digest("hex");
}

function parseTopics(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string" && item.trim().length > 0) : [];
  } catch {
    return [];
  }
}

function cleanGeneratedQuestion(question: GeneratedQuestion, topics: string[]) {
  const alternatives = Array.isArray(question.alternativas)
    ? question.alternativas.slice(0, 5).map((item) => cleanLatex(String(item)).trim())
    : [];
  if (!question.enunciado || !question.justificativa || alternatives.length !== 5) return null;

  const correctIndex = Number(question.correta);
  if (!Number.isInteger(correctIndex) || correctIndex < 0 || correctIndex >= alternatives.length) return null;

  const topico = topics.includes(question.topico || "") ? question.topico! : null;
  return {
    enunciado: cleanLatex(question.enunciado).trim(),
    alternativas: JSON.stringify(alternatives),
    correta: correctIndex,
    justificativa: cleanLatex(question.justificativa).trim(),
    tempoLimite: 60,
    topico,
  };
}

function sourceWindow(text: string, weeklyKey: string): string {
  if (text.length <= MAX_SOURCE_CHARS) return text;
  const windows = Math.ceil(text.length / MAX_SOURCE_CHARS);
  const seed = Number.parseInt(createHash("sha1").update(weeklyKey).digest("hex").slice(0, 8), 16);
  const start = (seed % windows) * MAX_SOURCE_CHARS;
  const end = start + MAX_SOURCE_CHARS;
  if (end <= text.length) return text.slice(start, end);
  return text.slice(start) + text.slice(0, end - text.length);
}

function errorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message.slice(0, 2_000);
}

async function setJobRunning(jobType: "ASSEMBLE" | "REPLENISH", apostilaId: string, scheduledFor: string) {
  return prisma.dailyGenerationJob.upsert({
    where: { jobType_apostilaId_scheduledFor: { jobType, apostilaId, scheduledFor } },
    create: { jobType, apostilaId, scheduledFor, status: "RUNNING", startedAt: new Date() },
    update: { status: "RUNNING", startedAt: new Date(), completedAt: null, lastError: null },
  });
}

async function setJobFinished(
  jobType: "ASSEMBLE" | "REPLENISH",
  apostilaId: string,
  scheduledFor: string,
  startedAt: number,
  generatedCount: number,
  error?: unknown,
) {
  await prisma.dailyGenerationJob.update({
    where: { jobType_apostilaId_scheduledFor: { jobType, apostilaId, scheduledFor } },
    data: {
      status: error ? "FAILED" : "COMPLETED",
      generatedCount,
      durationMs: Date.now() - startedAt,
      lastError: error ? errorMessage(error) : null,
      completedAt: new Date(),
    },
  });
}

export async function backfillQuestionBank(apostilaId?: string) {
  const apostilas = await prisma.apostila.findMany({
    where: apostilaId ? { id: apostilaId } : undefined,
    select: { id: true, title: true },
  });

  let insertedOrUpdated = 0;
  for (const apostila of apostilas) {
    const historical = await prisma.question.findMany({
      where: { simulado: { tipo: "DAILY", apostilaName: apostila.title } },
      select: {
        enunciado: true,
        alternativas: true,
        correta: true,
        justificativa: true,
        tempoLimite: true,
        topico: true,
        simulado: { select: { createdAt: true } },
      },
    });

    const grouped = new Map<string, {
      contentHash: string;
      enunciado: string;
      alternativas: string;
      correta: number;
      justificativa: string;
      tempoLimite: number;
      topico: string | null;
      firstUsedAt: Date;
      lastUsedAt: Date;
      useCount: number;
    }>();

    for (const question of historical) {
      const contentHash = questionContentHash(question.enunciado);
      const current = grouped.get(contentHash);
      if (current) {
        current.useCount += 1;
        if (question.simulado.createdAt < current.firstUsedAt) current.firstUsedAt = question.simulado.createdAt;
        if (question.simulado.createdAt > current.lastUsedAt) current.lastUsedAt = question.simulado.createdAt;
      } else {
        grouped.set(contentHash, {
          contentHash,
          enunciado: question.enunciado,
          alternativas: question.alternativas,
          correta: question.correta,
          justificativa: question.justificativa,
          tempoLimite: question.tempoLimite,
          topico: question.topico,
          firstUsedAt: question.simulado.createdAt,
          lastUsedAt: question.simulado.createdAt,
          useCount: 1,
        });
      }
    }

    const records = [...grouped.values()];
    for (let index = 0; index < records.length; index += 100) {
      const chunk = records.slice(index, index + 100);
      await prisma.$transaction(chunk.map((record) => prisma.questionBankItem.upsert({
        where: { apostilaId_contentHash: { apostilaId: apostila.id, contentHash: record.contentHash } },
        create: { apostilaId: apostila.id, origin: "HISTORICAL", status: "ACTIVE", ...record },
        update: {
          firstUsedAt: record.firstUsedAt,
          lastUsedAt: record.lastUsedAt,
          useCount: record.useCount,
        },
      })));
    }
    insertedOrUpdated += records.length;

    await prisma.simulado.updateMany({
      where: { tipo: "DAILY", apostilaName: apostila.title, apostilaId: null },
      data: { apostilaId: apostila.id },
    });
  }

  return { apostilas: apostilas.length, insertedOrUpdated };
}

export async function assembleDailySimuladoForApostila(apostilaId: string, force = false) {
  const dailyDate = getFortalezaDay();
  const startedAt = Date.now();
  await setJobRunning("ASSEMBLE", apostilaId, dailyDate);

  try {
    const apostila = await prisma.apostila.findUnique({ where: { id: apostilaId } });
    if (!apostila || !apostila.isActive) throw new Error("Apostila ativa não encontrada.");

    const existing = await prisma.simulado.findUnique({
      where: { tipo_apostilaId_dailyDate: { tipo: "DAILY", apostilaId, dailyDate } },
      select: { id: true },
    });
    if (existing) {
      await setJobFinished("ASSEMBLE", apostilaId, dailyDate, startedAt, 0);
      return { success: true, simuladoId: existing.id, existing: true, message: force ? "O diário de hoje já existe e foi preservado." : undefined };
    }

    let candidates = await prisma.questionBankItem.findMany({
      where: { apostilaId, status: "ACTIVE" },
      orderBy: [{ lastUsedAt: "asc" }, { createdAt: "asc" }],
    });

    if (candidates.length < DAILY_QUESTION_COUNT) {
      await backfillQuestionBank(apostilaId);
      candidates = await prisma.questionBankItem.findMany({
        where: { apostilaId, status: "ACTIVE" },
        orderBy: [{ lastUsedAt: "asc" }, { createdAt: "asc" }],
      });
    }

    const selected = selectDailyBankItems(candidates, {
      total: DAILY_QUESTION_COUNT,
      newLimit: DAILY_NEW_QUESTION_LIMIT,
      reuseGapDays: REUSE_GAP_DAYS,
    });
    if (selected.length < DAILY_QUESTION_COUNT) {
      throw new Error(`Banco insuficiente: ${selected.length}/${DAILY_QUESTION_COUNT} questões disponíveis.`);
    }

    const usedAt = new Date();
    const simulado = await prisma.$transaction(async (tx) => {
      const created = await tx.simulado.create({
        data: {
          tipo: "DAILY",
          status: "ACTIVE",
          instructorId: apostila.instructorId,
          apostilaId: apostila.id,
          apostilaName: apostila.title,
          dailyDate,
          difficulty: "AVANCADO",
          questions: {
            create: selected.map((item) => ({
              enunciado: item.enunciado,
              alternativas: item.alternativas,
              correta: item.correta,
              justificativa: item.justificativa,
              tempoLimite: item.tempoLimite,
              status: "PENDING",
              topico: item.topico,
              sourceBankItemId: item.id,
            })),
          },
        },
        select: { id: true },
      });

      for (const item of selected) {
        await tx.questionBankItem.update({
          where: { id: item.id },
          data: {
            firstUsedAt: item.firstUsedAt || usedAt,
            lastUsedAt: usedAt,
            useCount: { increment: 1 },
          },
        });
      }
      return created;
    });

    await setJobFinished("ASSEMBLE", apostilaId, dailyDate, startedAt, selected.length);
    return { success: true, simuladoId: simulado.id, generatedCount: selected.length };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const existing = await prisma.simulado.findFirst({ where: { tipo: "DAILY", apostilaId, dailyDate }, select: { id: true } });
      await setJobFinished("ASSEMBLE", apostilaId, dailyDate, startedAt, 0);
      return { success: true, simuladoId: existing?.id, existing: true };
    }
    await setJobFinished("ASSEMBLE", apostilaId, dailyDate, startedAt, 0, error);
    throw error;
  }
}

export async function assembleAllDailySimulados() {
  const apostilas = await prisma.apostila.findMany({ where: { isActive: true }, select: { id: true, title: true } });
  const results: Array<{ apostilaId: string; title: string; success: boolean; generatedCount?: number; error?: string }> = [];

  for (const apostila of apostilas) {
    try {
      const result = await assembleDailySimuladoForApostila(apostila.id);
      results.push({ apostilaId: apostila.id, title: apostila.title, success: true, generatedCount: result.generatedCount || 0 });
    } catch (error) {
      results.push({ apostilaId: apostila.id, title: apostila.title, success: false, error: errorMessage(error) });
    }
  }

  try {
    const { syncBlocosDeProva } = await import("@/app/actions/blocoProva");
    await syncBlocosDeProva();
  } catch (error) {
    console.error("[DAILY BANK] Falha ao sincronizar Blocos de Provas:", error);
  }

  return {
    success: results.every((result) => result.success),
    generatedCount: results.reduce((total, result) => total + (result.generatedCount || 0), 0),
    results,
  };
}

export async function replenishQuestionBankForApostila(apostilaId: string, force = false) {
  const scheduledFor = getIsoWeekKey();
  const startedAt = Date.now();
  const previousJob = await prisma.dailyGenerationJob.findUnique({
    where: { jobType_apostilaId_scheduledFor: { jobType: "REPLENISH", apostilaId, scheduledFor } },
  });
  if (!force && previousJob?.status === "COMPLETED") {
    return { success: true, generatedCount: 0, skipped: true };
  }
  await setJobRunning("REPLENISH", apostilaId, scheduledFor);

  try {
    const apostila = await prisma.apostila.findUnique({ where: { id: apostilaId } });
    if (!apostila || !apostila.isActive) throw new Error("Apostila ativa não encontrada.");

    const before = await prisma.questionBankItem.count({ where: { apostilaId, status: "ACTIVE" } });
    if (!force && before >= MINIMUM_BANK_SIZE) {
      await setJobFinished("REPLENISH", apostilaId, scheduledFor, startedAt, 0);
      return { success: true, generatedCount: 0, bankSize: before, skipped: true };
    }

    const topics = parseTopics(apostila.provaTopics);
    const fullText = await getCachedApostilaText(apostila);
    const material = sourceWindow(fullText, `${apostila.id}:${scheduledFor}`);
    const topicInstruction = topics.length
      ? `Classifique cada questão no campo topico usando exatamente um destes valores: ${topics.map((topic) => JSON.stringify(topic)).join(", ")}.`
      : "O campo topico pode ser omitido.";
    const prompt = `Você é instrutor especialista em concursos policiais. Crie exatamente ${WEEKLY_BATCH_SIZE} questões avançadas de múltipla escolha usando somente o material abaixo.

Regras: enunciado objetivo e completo; cinco alternativas plausíveis; somente uma resposta; pegadinhas sutis; justificativa sem mencionar letras; não cobre autores, índices ou metadados; não introduza teoria externa. Em questões que pedem a opção incorreta, o índice correta deve apontar para a opção que o aluno precisa marcar. ${topicInstruction}

MATERIAL DA APOSTILA:
${material}`;

    const result = await generateWithGeminiFallback(prompt, {
      responseMimeType: "application/json",
      responseSchema: generatedQuestionsSchema,
      maxOutputTokens: 16_384,
      temperature: 0.8,
    });
    const parsed = JSON.parse(result.response.text()) as GeneratedQuestion[];
    if (!Array.isArray(parsed)) throw new Error("A IA não retornou uma lista de questões.");

    const cleaned = parsed
      .map((question) => cleanGeneratedQuestion(question, topics))
      .filter((question): question is NonNullable<typeof question> => Boolean(question));
    for (const question of cleaned) {
      const contentHash = questionContentHash(question.enunciado);
      await prisma.questionBankItem.upsert({
        where: { apostilaId_contentHash: { apostilaId, contentHash } },
        create: { apostilaId, contentHash, origin: "AI", status: "ACTIVE", ...question },
        update: {},
      });
    }

    const after = await prisma.questionBankItem.count({ where: { apostilaId, status: "ACTIVE" } });
    const generatedCount = Math.max(0, after - before);
    await setJobFinished("REPLENISH", apostilaId, scheduledFor, startedAt, generatedCount);
    return { success: true, generatedCount, bankSize: after };
  } catch (error) {
    await setJobFinished("REPLENISH", apostilaId, scheduledFor, startedAt, 0, error);
    throw error;
  }
}

export async function replenishAllQuestionBanks() {
  const apostilas = await prisma.apostila.findMany({ where: { isActive: true }, select: { id: true, title: true } });
  const results = [];
  for (const apostila of apostilas) {
    try {
      results.push({ apostilaId: apostila.id, title: apostila.title, ...(await replenishQuestionBankForApostila(apostila.id)) });
    } catch (error) {
      results.push({ apostilaId: apostila.id, title: apostila.title, success: false, error: errorMessage(error) });
    }
  }
  return { success: results.every((result) => result.success), results };
}
