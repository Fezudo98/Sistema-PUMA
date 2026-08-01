import { GoogleGenerativeAI } from "@google/generative-ai";

const MODEL_VERSIONS = ["gemini-3.6-flash", "gemini-3.5-flash", "gemini-3.1-flash"];
const COOLDOWN_MS = 45_000;

const keyModelCooldowns = new Map<string, number>();
const roundRobinState = { index: 0 };

function isRateLimitError(errorMsg: string): boolean {
  if (!errorMsg) return false;
  const lower = errorMsg.toLowerCase();
  return (
    lower.includes("429") ||
    lower.includes("too many requests") ||
    lower.includes("quota") ||
    lower.includes("exhausted") ||
    lower.includes("503") ||
    lower.includes("service unavailable") ||
    lower.includes("high demand") ||
    lower.includes("overloaded")
  );
}

function getGeminiApiKeys() {
  return [
    { label: "principal", key: process.env.GEMINI_API_KEY || "" },
    { label: "fallback_1", key: process.env.GEMINI_API_KEY_FALLBACK || "" },
    { label: "fallback_2", key: process.env.GEMINI_API_KEY_FALLBACK_2 || "" },
    { label: "fallback_3", key: process.env.GEMINI_API_KEY_FALLBACK_3 || "" },
    { label: "fallback_4", key: process.env.GEMINI_API_KEY_FALLBACK_4 || "" },
  ].filter((k) => Boolean(k.key));
}

async function tryAnthropicFallback(content: string | any[]): Promise<{ response: { text: () => string } } | null> {
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  if (!anthropicKey) return null;

  try {
    console.warn("[FALLBACK EXCEPCIONAL] Todas as chaves Gemini falharam. Acionando Claude Sonnet 5 de forma excepcional...");
    const Anthropic = require("@anthropic-ai/sdk");
    const anthropic = new Anthropic({ apiKey: anthropicKey });

    let promptText = "";
    let base64Pdf = "";

    const parts = Array.isArray(content) ? content : [content];
    for (const item of parts) {
      if (typeof item === "string") {
        promptText += item;
      } else if (item?.inlineData?.data) {
        base64Pdf = item.inlineData.data;
      }
    }

    const fullPrompt =
      promptText +
      "\n\nIMPORTANTE: Sua resposta DEVE ser ÚNICA E EXCLUSIVAMENTE o conteúdo pedido, sem marcações markdown ```json ou ```markdown, sem texto antes ou depois.";

    const userContent: any[] = [];
    if (base64Pdf) {
      userContent.push({
        type: "document",
        source: { type: "base64", media_type: "application/pdf", data: base64Pdf },
      });
    }
    userContent.push({ type: "text", text: fullPrompt });

    const response = await anthropic.messages.create({
      model: "claude-sonnet-5",
      max_tokens: 8192,
      messages: [{ role: "user", content: userContent }],
    });

    const textBlock = response.content.find((b: any) => b.type === "text");
    const rawText = textBlock?.text || "";
    if (!rawText) return null;

    console.log("✅ [CLAUDE AI EXCEPCIONAL (claude-sonnet-5)] Conteúdo gerado com sucesso!");
    return { response: { text: () => rawText } };
  } catch (err: any) {
    console.warn("[CLAUDE AI EXCEPCIONAL] Falha ao acionar Claude Sonnet 5 de forma excepcional:", err.message || err);
    return null;
  }
}

/**
 * Gera conteúdo com o Gemini, alternando entre as chaves de API disponíveis e os
 * modelos suportados. Se todas as combinações falharem (ou estiverem em cooldown
 * por rate limit), tenta uma última vez com o Claude Sonnet 5 como fallback excepcional.
 */
export async function generateWithGeminiFallback(
  content: string | any[],
  generationConfig?: Record<string, any>
): Promise<{ response: { text: () => string } }> {
  const apiKeys = getGeminiApiKeys();
  if (apiKeys.length === 0) {
    throw new Error("Nenhuma chave do Gemini disponível no servidor.");
  }

  const startIndex = roundRobinState.index % apiKeys.length;
  roundRobinState.index = (startIndex + 1) % apiKeys.length;

  for (const modelVersion of MODEL_VERSIONS) {
    const now = Date.now();

    for (let i = 0; i < apiKeys.length; i++) {
      const { label, key } = apiKeys[(startIndex + i) % apiKeys.length];
      const cooldownKey = `${label}_${modelVersion}`;

      if (keyModelCooldowns.has(cooldownKey) && now < keyModelCooldowns.get(cooldownKey)!) {
        console.log(`[Cooldown] Chave ${label} em repouso no modelo ${modelVersion}. Pulando...`);
        continue;
      }

      try {
        console.log(`[GERADOR IA] Tentando chave ${label} com modelo ${modelVersion}...`);
        const genAI = new GoogleGenerativeAI(key);
        const model = genAI.getGenerativeModel({ model: modelVersion, generationConfig } as any);
        return await model.generateContent(content as any);
      } catch (error: any) {
        console.warn(`[GERADOR IA] Chave ${label} falhou com modelo ${modelVersion}:`, error.message);
        if (isRateLimitError(error.message)) {
          console.warn(`[Cooldown] Chave ${label} em repouso por 45s no modelo ${modelVersion}.`);
          keyModelCooldowns.set(cooldownKey, Date.now() + COOLDOWN_MS);
        }
      }
    }
  }

  const anthropicResult = await tryAnthropicFallback(content);
  if (anthropicResult) return anthropicResult;

  throw new Error("Todas as chaves do Gemini e o fallback excepcional do Claude Sonnet 5 atingiram limite ou falharam.");
}

export function cleanLatex(str: string): string {
  if (!str) return "";
  return str
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
