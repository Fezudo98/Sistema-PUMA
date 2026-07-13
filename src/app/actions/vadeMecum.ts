"use server";

import { PrismaClient } from "@prisma/client";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { revalidatePath } from "next/cache";
import { getUser } from "./auth";
import { getCachedApostilaText } from "./chat";

const prisma = new PrismaClient();

const modelVersions = [
  "gemini-3.5-flash",
  "gemini-3.1-flash-lite",
  "gemini-2.5-flash",
  "gemini-2.0-flash",
  "gemini-flash-latest",
  "gemini-3-flash-preview",
  "gemini-pro-latest"
];

// Helper to generate content with fallback keys and models
async function generateWithFallback(content: any[]) {
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
      console.warn(`[VADE MECUM AI] Chave principal falhou com modelo ${modelVersion}:`, error.message);

      const isQuotaError =
        error.status === 429 ||
        error.status === 503 ||
        error.message?.includes("429") ||
        error.message?.includes("503") ||
        error.message?.includes("quota") ||
        error.message?.includes("exhausted");
      const isNotFoundError = error.status === 404 || error.message?.includes("404") || error.message?.includes("not found");

      if (isQuotaError && fallbackKey) {
        console.log(`[VADE MECUM AI] Tentando chave fallback com modelo ${modelVersion}...`);
        try {
          const fallbackGenAI = new GoogleGenerativeAI(fallbackKey);
          const fallbackModel = fallbackGenAI.getGenerativeModel({ model: modelVersion });
          return await fallbackModel.generateContent(content);
        } catch (fallbackError: any) {
          console.warn(`[VADE MECUM AI] Chave fallback falhou com modelo ${modelVersion}:`, fallbackError.message);
        }
      }

      if (!isQuotaError && !isNotFoundError && !error.message?.includes("403")) {
        throw error;
      }
    }
  }

  throw new Error("Todas as chaves e modelos do Gemini falharam ou atingiram limite de cota.");
}

// Generate the Vade Mecum summary using Gemini
export async function generateVadeMecumAction(apostilaId: string) {
  try {
    const user = await getUser();
    if (!user || user.role !== "INSTRUCTOR") {
      throw new Error("Não autorizado. Apenas instrutores podem gerar resumos.");
    }

    const apostila = await prisma.apostila.findUnique({
      where: { id: apostilaId }
    });

    if (!apostila) {
      throw new Error("Apostila não encontrada.");
    }

    // 1. Extract raw booklet PDF text (safely using cache and node canvas polyfills)
    const rawText = await getCachedApostilaText(apostila);

    if (!rawText || rawText.startsWith("Conteúdo textual indisponível")) {
      throw new Error("Não foi possível extrair o texto desta apostila.");
    }

    // 2. Prepare the prompt
    const systemPrompt = `Você é um Professor e Instrutor Policial especialista, encarregado de criar um VADE MECUM didático, prático e completo (resumo estruturado de estudo) baseado EXCLUSIVAMENTE no texto da apostila fornecida.

Seu objetivo é condensar a matéria em um formato Markdown de alta utilidade para memorização e revisão dos alunos.
Rigorosamente inclua as seguintes seções estruturadas utilizando markdown limpo e elegante (títulos h2/h3, negritos, tabelas e marcadores):

## 📘 Resumo Geral e Análise Temática
(Uma introdução didática explicando do que se trata esta apostila e a importância do tema para a atividade policial militar.)

## ⚖️ Legislação e Artigos Críticos
(Extraia e liste todos os artigos de leis, incisos, regulamentos ou regras descritas na apostila. Explique brevemente e de forma clara a aplicação prática de cada artigo listado.)

## 💡 Conceitos e Definições de Pronto Emprego
(Uma listagem direta dos principais conceitos teóricos, termos técnicos, infrações, punições ou deveres explicados no texto. Defina-os de forma clara.)

## 🧠 Mnemônicos e Técnicas de Memorização
(Crie ou cite técnicas de memorização, palavras-chaves ou mnemônicos táticos para ajudar o recruta a decorar e reter os tópicos mais complexos desta matéria.)

Foque exclusivamente nas informações fornecidas no documento abaixo:`;

    const response = await generateWithFallback([
      { text: systemPrompt },
      { text: `--- TEXTO DA APOSTILA: "${apostila.title}" ---\n${rawText}` }
    ]);

    const resultText = response.response.text();

    if (!resultText) {
      throw new Error("Falha ao receber resposta do modelo de IA.");
    }

    // 3. Save to database
    const updated = await prisma.apostila.update({
      where: { id: apostilaId },
      data: { vadeMecum: resultText }
    });

    revalidatePath("/aluno/vademecum");
    revalidatePath("/instructor");

    return { success: true, vadeMecum: updated.vadeMecum };
  } catch (error: any) {
    console.error(`[VADE MECUM ERROR] Erro ao gerar Vade Mecum da apostila ${apostilaId}:`, error);
    return { success: false, error: error.message };
  }
}

// Retrieve the generated Vade Mecum summary
export async function getVadeMecumAction(apostilaId: string) {
  try {
    const user = await getUser();
    if (!user) {
      throw new Error("Não autorizado");
    }

    const apostila = await prisma.apostila.findUnique({
      where: { id: apostilaId },
      select: { title: true, vadeMecum: true, isActive: true }
    });

    return { success: true, databaseRecord: apostila };
  } catch (error: any) {
    console.error(`[VADE MECUM ERROR] Erro ao buscar Vade Mecum da apostila ${apostilaId}:`, error);
    return { success: false, error: error.message };
  }
}
