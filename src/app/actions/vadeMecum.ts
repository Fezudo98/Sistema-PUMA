"use server";

import { PrismaClient } from "@prisma/client";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { revalidatePath } from "next/cache";
import { getUser } from "./auth";
import { getCachedApostilaText } from "./chat";
import { queueGenerationTask } from "./dailySimulado";

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
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  if (anthropicKey) {
    try {
      console.log("[VADE MECUM AI] Tentando gerar com Claude Sonnet 5...");
      const Anthropic = require("@anthropic-ai/sdk");
      const anthropic = new Anthropic({ apiKey: anthropicKey });

      let promptText = "";
      for (const item of content) {
        if (typeof item === "string") {
          promptText += item + "\n\n";
        } else if (item?.text) {
          promptText += item.text + "\n\n";
        }
      }

      const response = await anthropic.messages.create({
        model: "claude-sonnet-5",
        max_tokens: 8192,
        messages: [{ role: "user", content: promptText.trim() }]
      });

      const rawText = response.content[0]?.type === "text" ? response.content[0].text : "";
      if (rawText) {
        console.log("✅ [VADE MECUM AI] Resumo gerado com sucesso pelo Claude Sonnet 5!");
        return { response: { text: () => rawText } };
      }
    } catch (claudeErr: any) {
      console.warn("[VADE MECUM AI] Falha ao gerar com Claude Sonnet 5. Recorrendo ao Gemini...", claudeErr.message || claudeErr);
    }
  }

  const primaryKey = process.env.GEMINI_API_KEY || "";
  const fallbackKey = process.env.GEMINI_API_KEY_FALLBACK || "";

  if (!primaryKey) {
    throw new Error("Chave do Gemini e do Claude não configuradas no servidor.");
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

  throw new Error("Todas as chaves e modelos do Claude e Gemini falharam ou atingiram limite de cota.");
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
      const systemPrompt = `Você é um Professor e Instrutor Policial de elite da PMCE, encarregado de criar um VADE MECUM TÁTICO DIDÁTICO, prático e completo (resumo estruturado de estudo de alta definição) baseado EXCLUSIVAMENTE no texto da apostila fornecida.

Seu objetivo é condensar a matéria com perfeição em formato Markdown elegante, focado em decoreba rápida, revisão pré-simulado e aplicação operacional na atividade policial militar.
Utilize todos os recursos de formatação (títulos h2/h3, negritos intensos, tabelas comparativas '| Coluna | Coluna |' e blocos de citação '> 💡 / > ⚠️') para criar o resumo mais incrível que o combatente já viu.

Rigorosamente estruture o documento nas seguintes seções:

## 📘 Resumo Geral e Relevância Operacional
(Uma introdução didática explicando claramente do que se trata a apostila e a sua importância prática para a atuação diária na rotina do policial militar.)

## 📋 Quadro Resumo de Decoreba Rápida
(Crie uma TABELA MARKDOWN obrigatória e bem estruturada sintetizando os principais pontos, prazos, penalidades, classificações ou conceitos centrais do documento para revisão visual rápida:
| Tópico / Conceito | Regra / Definição Principal | Aplicação no Serviço Policial |)

## ⚖️ Legislação, Normas e Artigos Críticos
(Extraia, organize por ordem de relevância e explique todos os artigos de leis, incisos, parágrafos, estatutos ou regulamentos contidos na apostila. Explique de forma simples e direta a aplicação prática e jurídica de cada artigo listado, grifando em negrito os termos-chave.)

## 💡 Conceitos e Definições de Pronto Emprego
(Listagem clara dos principais conceitos teóricos, termos técnicos, infrações, punições, procedimentos táticos ou deveres explicados no texto.)

## 🚨 Pegadinhas de Concurso e Pontos de Atenção
(Utilize blocos de citação '> ⚠️ **Atenção:** ...' para apontar exatamente onde as bancas examinadoras costumam tentar confundir o candidato em simulados e provas sobre este tema. Exemplo: prazos, exceções às regras e confusões semânticas.)

## 🧠 Mnemônicos e Esquemas Mentais
(Crie ou cite técnicas de memorização, siglas táticas criativas, macetes de associação rápida e palavras-chave para ajudar o combatente a reter a matéria em tempo recorde.)

Foque exclusivamente nas informações presentes no documento abaixo e entregue um resumo completo sem economizar nos detalhes essenciais:`;

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
      // Enfileira cada geração sequencialmente no background para evitar concorrência e sobrecarga de API (Claude Sonnet 5)
      queueGenerationTask(async () => {
        return generateVadeMecumAction(apostila.id, true);
      })
        .then((res) => {
          console.log(`[VADE MECUM CHECK] Geração automática sequencial para "${apostila.title}" concluída:`, res.success);
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
