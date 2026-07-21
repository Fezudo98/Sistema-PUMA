"use server";

import { PrismaClient } from "@prisma/client";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { revalidatePath } from "next/cache";
import { getUser } from "./auth";
import { getCachedApostilaText } from "./chat";

const prisma = new PrismaClient();

const modelVersions = [
  "gemini-3.6-flash",
  "gemini-3.5-flash",
  "gemini-2.5-flash",
  "gemini-2.0-flash",
  "gemini-1.5-pro",
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

      if (fallbackKey) {
        console.log(`[VADE MECUM AI] Tentando chave fallback com modelo ${modelVersion}...`);
        try {
          const fallbackGenAI = new GoogleGenerativeAI(fallbackKey);
          const fallbackModel = fallbackGenAI.getGenerativeModel({ model: modelVersion });
          return await fallbackModel.generateContent(content);
        } catch (fallbackError: any) {
          console.warn(`[VADE MECUM AI] Chave fallback falhou com modelo ${modelVersion}:`, fallbackError.message);
        }
      }
    }
  }

  throw new Error("Todas as chaves e modelos do Gemini falharam ou atingiram limite de cota.");
}

// Generate the Vade Mecum summary using Gemini
export async function generateVadeMecumAction(apostilaId: string, bypassAuth = false) {
  try {
    if (!bypassAuth) {
      const user = await getUser();
      if (!user || user.role !== "INSTRUCTOR") {
        throw new Error("Não autorizado. Apenas instrutores podem gerar resumos.");
      }
    }

    const apostila = await prisma.apostila.findUnique({
      where: { id: apostilaId }
    });

    if (!apostila) {
      throw new Error("Apostila não encontrada.");
    }

    // Prevents duplicate processes running in parallel for the same booklet
    if (apostila.vadeMecum === "GERANDO...") {
      console.log(`[VADE MECUM AI] Geração já em andamento para "${apostila.title}". Ignorando chamada.`);
      return { success: true, message: "Geração já está em andamento" };
    }

    // Set lock value to prevent parallel runs
    await prisma.apostila.update({
      where: { id: apostilaId },
      data: { vadeMecum: "GERANDO..." }
    });

    try {
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
      const cleanedVadeMecum = cleanLatexSyntax(resultText);
      const updated = await prisma.apostila.update({
        where: { id: apostilaId },
        data: { vadeMecum: cleanedVadeMecum }
      });

      if (!bypassAuth) {
        revalidatePath("/aluno/vademecum");
        revalidatePath("/instructor");
      }

      return { success: true, vadeMecum: updated.vadeMecum };
    } catch (innerError: any) {
      // Revert lock back to null on failure so it can be retried later
      await prisma.apostila.update({
        where: { id: apostilaId },
        data: { vadeMecum: null }
      });
      throw innerError;
    }
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

// Background checker that detects active booklets without a generated Vade Mecum
export async function checkAndGenerateMissingVadeMecums() {
  try {
    const missingVades = await prisma.apostila.findMany({
      where: {
        isActive: true,
        OR: [
          { vadeMecum: null },
          { vadeMecum: "" }
        ]
      }
    });

    if (missingVades.length === 0) {
      return;
    }

    console.log(`[VADE MECUM CHECK] Encontradas ${missingVades.length} apostilas ativas sem Vade Mecum. Gerando em background...`);

    for (const apostila of missingVades) {
      // Run each generation sequentially in the background
      generateVadeMecumAction(apostila.id, true)
        .then((res) => {
          console.log(`[VADE MECUM CHECK] Geração automática para "${apostila.title}" concluída:`, res.success);
        })
        .catch((err) => {
          console.error(`[VADE MECUM CHECK] Falha ao gerar Vade Mecum automático para "${apostila.title}":`, err.message);
        });
    }
  } catch (error: any) {
    console.error("[VADE MECUM CHECK] Erro na rotina de verificação:", error.message);
  }
}

function cleanLatexSyntax(text: string): string {
  if (!text) return "";
  return text
    .replace(/\\\$/g, "$")
    .replace(/\$\$/g, "")
    .replace(/\$/g, "")
    .replace(/\\rightarrow/g, "→")
    .replace(/\\left/g, " ")
    .replace(/\\right/g, " ")
    .replace(/\\leftarrow/g, "←")
    .replace(/\\leftrightarrow/g, "↔")
    .replace(/\\to/g, "→")
    .replace(/\\mathbf\{([^}]+)\}/g, "**$1**")
    .replace(/\\text\{([^}]+)\}/g, "$1")
    .replace(/\\mathrm\{([^}]+)\}/g, "$1")
    .replace(/\\vec\{([^}]+)\}/g, "$1")
    .replace(/\\([a-zA-Z]+)/g, " ");
}
