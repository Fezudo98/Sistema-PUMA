import { GoogleGenerativeAI } from "@google/generative-ai";

// Quatro tentativas totais, da melhor relação qualidade/custo para a mais leve.
// Cada tentativa usa a próxima chave ativa do round-robin; não fazemos o produto
// cartesiano modelos × chaves, que multiplicava latência e chamadas em falhas.
const MODEL_VERSIONS = [
  "gemini-3.7-flash",
  "gemini-3.5-flash",
  "gemini-3.5-flash-lite",
  "gemini-3.1-flash-lite",
];
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

/**
 * Gera conteúdo com o Gemini, alternando entre as chaves de API disponíveis e os
 * modelos suportados. Há no máximo quatro chamadas por operação.
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

  for (let attempt = 0; attempt < MODEL_VERSIONS.length; attempt++) {
    const modelVersion = MODEL_VERSIONS[attempt];
    const now = Date.now();
    const { label, key } = apiKeys[(startIndex + attempt) % apiKeys.length];
    const cooldownKey = `${label}_${modelVersion}`;

    if (keyModelCooldowns.has(cooldownKey) && now < keyModelCooldowns.get(cooldownKey)!) {
      console.log(`[Cooldown] Chave ${label} em repouso no modelo ${modelVersion}. Pulando tentativa.`);
      continue;
    }

    try {
      console.log(`[GERADOR IA] Tentativa ${attempt + 1}/${MODEL_VERSIONS.length}: chave ${label}, modelo ${modelVersion}.`);
      const genAI = new GoogleGenerativeAI(key);
      const model = genAI.getGenerativeModel({ model: modelVersion, generationConfig } as any);
      return await model.generateContent(content as any);
    } catch (error: any) {
      console.warn(`[GERADOR IA] Tentativa ${attempt + 1} falhou (${label}/${modelVersion}):`, error.message);
      if (isRateLimitError(error.message)) {
        keyModelCooldowns.set(cooldownKey, Date.now() + COOLDOWN_MS);
      }
    }
  }

  throw new Error("As quatro tentativas otimizadas do Gemini falharam ou estavam em cooldown.");
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
