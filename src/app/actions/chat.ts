"use server";

import { PrismaClient } from "@prisma/client";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { revalidatePath } from "next/cache";
import fs from "fs/promises";
import path from "path";
import { queueGenerationTask } from "./dailySimulado";

const prisma = new PrismaClient();

const modelVersions = [
  "gemini-1.5-flash",
  "gemini-2.0-flash",
  "gemini-pro-latest",
  "gemini-1.5-pro"
];

// Helper to polyfill DOMMatrix, ImageData, Path2D required by pdfjs-dist in Node environment
function ensureNodeCanvasPolyfills() {
  if (typeof globalThis.DOMMatrix === "undefined") {
    (globalThis as any).DOMMatrix = class DOMMatrix {
      a = 1; b = 0; c = 0; d = 1; e = 0; f = 0;
      m11 = 1; m12 = 0; m21 = 0; m22 = 1; m41 = 0; m42 = 0;
      constructor(args?: any[]) {
        if (Array.isArray(args) && args.length >= 6) {
          this.a = this.m11 = args[0];
          this.b = this.m12 = args[1];
          this.c = this.m21 = args[2];
          this.d = this.m22 = args[3];
          this.e = this.m41 = args[4];
          this.f = this.m42 = args[5];
        }
      }
      multiply() { return new (globalThis as any).DOMMatrix(); }
      translate() { return new (globalThis as any).DOMMatrix(); }
      scale() { return new (globalThis as any).DOMMatrix(); }
      transformPoint(pt: any) { return pt; }
    };
  }
  if (typeof globalThis.ImageData === "undefined") {
    (globalThis as any).ImageData = class ImageData {
      width = 0;
      height = 0;
      data = new Uint8ClampedArray(0);
    };
  }
  if (typeof globalThis.Path2D === "undefined") {
    (globalThis as any).Path2D = class Path2D {};
  }

  // Pre-load pdfjs worker statically to bypass any dynamic require/import issue inside Next.js/Turbopack
  try {
    (globalThis as any).pdfjsWorker = require("pdfjs-dist/legacy/build/pdf.worker.mjs");
  } catch (err) {
    console.warn("[ensureNodeCanvasPolyfills] Could not statically pre-load pdfjs worker:", err);
  }
}

// Helper to cache booklet PDF texts on disk
export async function getCachedApostilaText(apostila: { id: string; title: string; filePath: string }) {
  const cacheDir = path.join(process.cwd(), "public", "uploads", "cache");
  await fs.mkdir(cacheDir, { recursive: true });
  const cachePath = path.join(cacheDir, `${apostila.id}.txt`);

  try {
    return await fs.readFile(cachePath, "utf-8");
  } catch (e) {
    console.log(`[PDF PARSE] Cache miss para "${apostila.title}". Extraindo texto...`);
    ensureNodeCanvasPolyfills();
    try {
      const { PDFParse } = require("pdf-parse");
      const filePath = path.join(process.cwd(), "public", apostila.filePath);
      const buffer = await fs.readFile(filePath);
      const parser = new PDFParse({ data: new Uint8Array(buffer) });
      const parsed = await parser.getText();
      
      // Save to cache
      await fs.writeFile(cachePath, parsed.text, "utf-8");
      return parsed.text;
    } catch (parseError: any) {
      console.error(`[PDF PARSE ERROR] Falha ao extrair texto do PDF "${apostila.title}":`, parseError.message);
      return `Conteúdo textual indisponível para leitura da apostila: ${apostila.title}`;
    }
  }
}

// Generate chat response with fallback key and models
async function chatWithFallback(content: any[]) {
  const primaryKey = process.env.GEMINI_API_KEY || "";
  const fallbackKey = process.env.GEMINI_API_KEY_FALLBACK || "";

  if (!primaryKey) {
    throw new Error("Chave do Gemini não configurada no servidor.");
  }

  for (const modelVersion of modelVersions) {
    try {
      const genAI = new GoogleGenerativeAI(primaryKey);
      const model = genAI.getGenerativeModel({ model: modelVersion });
      return await model.generateContent(content);
    } catch (error: any) {
      console.warn(`[CHAT GENERATION] Chave principal falhou com modelo ${modelVersion}:`, error.message);

      if (fallbackKey) {
        console.log(`[CHAT GENERATION] Tentando chave fallback com modelo ${modelVersion}...`);
        try {
          const fallbackGenAI = new GoogleGenerativeAI(fallbackKey);
          const fallbackModel = fallbackGenAI.getGenerativeModel({ model: modelVersion });
          return await fallbackModel.generateContent(content);
        } catch (fallbackError: any) {
          console.warn(`[CHAT GENERATION] Chave fallback falhou com modelo ${modelVersion}:`, fallbackError.message);
        }
      }
    }
  }
  throw new Error("Todas as versões do modelo Gemini falharam na conversa com o mentor.");
}

// Get message history for the student for a specific booklet
export async function getChatHistoryAction(apostilaId: string) {
  const { getUser } = await import("./auth");
  const user = await getUser();
  if (!user || user.role !== "STUDENT") {
    return { error: "Não autorizado." };
  }

  if (!apostilaId) {
    return { error: "Apostila não informada." };
  }

  try {
    // Check if suspended
    const dbUser = await prisma.user.findUnique({
      where: { id: user.userId },
      select: { suspendedUntil: true }
    });
    const isSuspended = dbUser?.suspendedUntil && dbUser.suspendedUntil > new Date();
    const suspendedUntilStr = isSuspended ? dbUser.suspendedUntil!.toISOString() : null;

    if (isSuspended) {
      return { success: true, messages: [], isSuspended: true, suspendedUntil: suspendedUntilStr, isApostilaActive: false };
    }

    // Check if the booklet exists and is active
    const activeApostila = await prisma.apostila.findFirst({
      where: { id: apostilaId, isActive: true }
    });
    const isApostilaActive = !!activeApostila;

    const messages = await prisma.chatMessage.findMany({
      where: { studentId: user.userId, apostilaId },
      orderBy: { createdAt: "asc" }
    });

    return { success: true, messages, isSuspended: false, isApostilaActive };
  } catch (error: any) {
    return { error: error.message || "Falha ao buscar histórico." };
  }
}

// Send a chat message atrelado a uma apostila
export async function sendChatMessageAction(content: string, apostilaId: string) {
  const { getUser } = await import("./auth");
  const user = await getUser();
  if (!user || user.role !== "STUDENT") {
    return { error: "Não autorizado." };
  }

  // Verificar se o chat geral está desabilitado
  const chatSetting = await prisma.systemSetting.findUnique({
    where: { key: "chatEnabled" }
  });
  if (chatSetting?.value === "false") {
    return { error: "O chat com o mentor de IA está temporariamente desativado pelo instrutor." };
  }

  if (!content.trim()) {
    return { error: "A pergunta não pode estar vazia." };
  }

  if (!apostilaId) {
    return { error: "É obrigatório selecionar uma apostila para enviar mensagens." };
  }

  try {
    // Check if suspended
    const dbUser = await prisma.user.findUnique({
      where: { id: user.userId },
      select: { suspendedUntil: true }
    });
    if (dbUser?.suspendedUntil && dbUser.suspendedUntil > new Date()) {
      return { error: `Você está suspenso do chat do mentor até ${dbUser.suspendedUntil.toLocaleString("pt-BR")}.` };
    }

    // Buscar a apostila base para garantir que existe e está ativa
    const apostila = await prisma.apostila.findUnique({
      where: { id: apostilaId }
    });

    if (!apostila || !apostila.isActive) {
      return { error: "Esta apostila está desativada ou removida. O envio de novas mensagens está bloqueado." };
    }

    // 1. Salvar a pergunta do usuário no banco de dados com apostilaId e apostilaTitle
    const userMsg = await prisma.chatMessage.create({
      data: {
        studentId: user.userId,
        role: "user",
        content: content.trim(),
        apostilaId,
        apostilaTitle: apostila.title
      }
    });

    // Enfileiramos a chamada ao Gemini para evitar concorrência e cota estourada
    const assistantMsg = await queueGenerationTask(async () => {
      // 2. Carregar estatísticas do aluno
      const stats = await prisma.answer.findMany({
        where: { studentId: user.userId },
        include: { question: true }
      });
      const totalAnswers = stats.length;
      const correctAnswers = stats.filter(a => a.isCorrect).length;
      const accuracy = totalAnswers > 0 ? Math.round((correctAnswers / totalAnswers) * 100) : 0;
      
      // Assuntos com erros
      const wrongQuestions = stats.filter(a => !a.isCorrect);
      const wrongSummary = wrongQuestions.slice(-5).map(a => `- Questão: ${a.question.enunciado} (Sua resposta incorreta: alternativa ${a.alternativa}, justificativa da questão: ${a.question.justificativa})`).join("\n");

      // 3. Carregar contexto integral da apostila em foco (sem corte de caracteres, enviando 100% do PDF)
      const rawText = await getCachedApostilaText(apostila);
      const apostilaContext = `--- CONTEÚDO INTEGRAL EXCLUSIVO DA APOSTILA EM FOCO: "${apostila.title}" ---\n${rawText}`;

      // 4. Carregar histórico do chat exclusivo desta apostila
      const lastMessages = await prisma.chatMessage.findMany({
        where: { studentId: user.userId, apostilaId },
        orderBy: { createdAt: "desc" },
        take: 12
      });
      const chatHistoryText = lastMessages
        .reverse()
        .map((m: any) => `${m.role === "user" ? "Recruta" : "Mentor"}: ${m.content}`)
        .join("\n");

      // 5. Montar prompt do sistema
      const systemPrompt = `Você é o MENTOR PUMA, um assistente virtual e tutor didático inteligente encarregado de ajudar o aluno ("Recruta") na preparação para o concurso da Polícia Militar do Ceará (PMCE).

Suas diretrizes fundamentais:
1. TOM NATURAL E PRESTATIVO: Fale de forma fluida, amigável e natural (como o ChatGPT ou o Gemini). Não seja grosseiro nem excessivamente rígido.
2. ATENDIMENTO SOB DEMANDA: Foque 100% no que o aluno pediu. Responda dúvidas, formule questões de prova/teste ou crie materiais de estudo (flashcards, resumos) baseando-se no material fornecido abaixo.
3. CONTEXTO DE DESEMPENHO SILENCIOSO: Você sabe que o Recruta resolveu ${totalAnswers} questões com aproveitamento de ${accuracy}% (Erros recentes: ${wrongSummary || "nenhum"}). NÃO mencione esses números ou estatísticas a menos que seja questionado diretamente.
4. LIMITE DE CONHECIMENTO CRÍTICO E EXCLUSIVO (ATENÇÃO EXTREMA):
   - Você deve se pautar EXCLUSIVAMENTE nas apostilas ativas fornecidas abaixo.
   - NÃO utilize conhecimento prévio seu ou da internet sobre leis, regimentos, portarias, códigos ou matérias de concursos que não estejam explicitamente detalhadas no texto fornecido abaixo.
   - NUNCA invente ou traga teorias externas (como "Instrução Geral" ou outros conteúdos que não constem no texto abaixo). Se o assunto ou a resposta exata para a pergunta não constar no material abaixo, diga de forma educada: "Combatente, esta informação não consta nas apostilas de estudos ativas. Por favor, consulte o material fornecido para esta matéria."
5. REDIRECIONAMENTO DE ASSUNTO: Se o aluno iniciar conversas paralelas ou perguntas não pertinentes aos estudos, tente redirecionar a conversa de forma gentil para as apostilas.
6. PROTOCOLO DE SUSPENSÃO DE 24 HORAS: Se o aluno INSISTIR em assuntos aleatórios ou desconexos e ignorar sua tentativa de redirecionamento, sua resposta deve começar EXATAMENTE com a tag "[SUSPEND]" (em maiúsculas e com colchetes), seguida por uma explicação clara de que ele está sendo suspenso do chat por 24 horas por desviar do foco dos estudos.

Aqui está o conteúdo textual real das apostilas ativas no sistema:
"""
${apostilaContext}
"""

Aqui está o histórico recente da nossa conversa:
${chatHistoryText}

Responda à última mensagem do aluno de acordo com estas diretrizes e baseando-se APENAS nas informações contidas nas apostilas fornecidas.`;

      // 6. Chamar o Gemini
      const result = await chatWithFallback([systemPrompt]);
      let reply = result.response.text().trim();

      let isSuspendedTriggered = false;
      if (reply.includes("[SUSPEND]")) {
        isSuspendedTriggered = true;
        reply = reply.replace(/\[SUSPEND\]/gi, "").trim();
      }

      // 7. Salvar resposta no banco associando com a apostilaId e apostilaTitle
      const msg = await prisma.chatMessage.create({
        data: {
          studentId: user.userId,
          role: "assistant",
          content: reply,
          apostilaId,
          apostilaTitle: apostila.title
        }
      });

      if (isSuspendedTriggered) {
        const suspendedUntil = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
        await prisma.user.update({
          where: { id: user.userId },
          data: { suspendedUntil }
        });
      }
      return msg;
    });

    revalidatePath("/aluno/chat");
    return { success: true, userMessage: userMsg, assistantMessage: assistantMsg };
  } catch (error: any) {
    console.error("[CHAT ERROR] Erro no envio da mensagem:", error);
    return { error: error.message || "Falha ao processar resposta do mentor." };
  }
}

// Clear chat history for a specific booklet
export async function clearChatHistoryAction(apostilaId: string) {
  const { getUser } = await import("./auth");
  const user = await getUser();
  if (!user || user.role !== "STUDENT") {
    return { error: "Não autorizado." };
  }

  if (!apostilaId) {
    return { error: "Apostila não informada." };
  }

  try {
    await prisma.chatMessage.deleteMany({
      where: { studentId: user.userId, apostilaId }
    });

    revalidatePath("/aluno/chat");
    return { success: true };
  } catch (error: any) {
    return { error: error.message || "Falha ao limpar histórico." };
  }
}

export async function toggleChatEnabledAction(enabled: boolean) {
  const { getUser } = await import("./auth");
  const user = await getUser();
  if (!user || user.role !== "INSTRUCTOR") {
    return { error: "Não autorizado." };
  }

  try {
    await prisma.systemSetting.upsert({
      where: { key: "chatEnabled" },
      update: { value: enabled ? "true" : "false" },
      create: { key: "chatEnabled", value: enabled ? "true" : "false" }
    });
    revalidatePath("/aluno/chat");
    revalidatePath("/instructor");
    return { success: true, enabled };
  } catch (error: any) {
    return { error: error.message || "Erro ao atualizar configuração." };
  }
}

export async function getChatEnabledAction() {
  try {
    const setting = await prisma.systemSetting.findUnique({
      where: { key: "chatEnabled" }
    });
    return setting?.value !== "false";
  } catch {
    return true;
  }
}


