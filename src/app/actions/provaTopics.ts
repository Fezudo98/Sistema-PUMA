"use server";

import { SchemaType } from "@google/generative-ai";
import { prisma } from "@/lib/prisma";
import { getUser } from "@/app/actions/auth";
import { generateWithGeminiFallback } from "@/lib/gemini";
import { getCachedApostilaText } from "@/lib/apostilaCache";
import { revalidatePath } from "next/cache";

const MAX_TOPICS = 30;

// Sugere uma lista de tópicos/capítulos da apostila, extraída pela IA a partir do
// texto do PDF. NÃO salva nada — o instrutor revisa/edita antes de confirmar via
// saveApostilaProvaTopicsAction.
export async function extractApostilaTopicsAction(apostilaId: string) {
  const user = await getUser();
  if (!user || user.role !== "INSTRUCTOR") {
    return { error: "Não autorizado." };
  }

  try {
    const apostila = await prisma.apostila.findUnique({ where: { id: apostilaId } });
    if (!apostila) {
      return { error: "Apostila não encontrada." };
    }

    const rawText = await getCachedApostilaText(apostila);
    if (!rawText || rawText.startsWith("Conteúdo textual indisponível")) {
      return { error: "Não foi possível extrair o texto desta apostila." };
    }

    const prompt = `Você é um especialista em organizar material didático de concursos policiais.
Leia o texto da apostila abaixo e extraia uma lista limpa dos principais TÓPICOS/CAPÍTULOS que ela aborda (baseie-se no sumário, se houver, ou na estrutura real do conteúdo).

REGRAS:
1. Cada tópico deve ser um rótulo curto e claro (ex: "Uso da Força", "Prisão em Flagrante"), sem numeração nem prefixos tipo "Capítulo 1".
2. Não repita tópicos nem crie variações do mesmo assunto.
3. Ignore elementos que não são conteúdo didático (capa, sumário em si, ficha catalográfica, referências bibliográficas).
4. Gere entre 5 e ${MAX_TOPICS} tópicos, cobrindo o material de forma equilibrada — nem genérico demais, nem granular demais.
5. Responda ÚNICA e EXCLUSIVAMENTE com um array JSON de strings, sem marcadores markdown.

--- TEXTO DA APOSTILA: "${apostila.title}" ---
${rawText}`;

    const responseSchema = {
      type: SchemaType.ARRAY,
      description: "Lista de tópicos/capítulos da apostila.",
      items: { type: SchemaType.STRING }
    };

    const result = await generateWithGeminiFallback(prompt, {
      responseMimeType: "application/json",
      responseSchema
    });

    const rawJson = result.response.text() || "";
    let jsonText = rawJson.trim();
    const match = jsonText.match(/\[[\s\S]*\]/);
    if (match) jsonText = match[0];

    const parsed = JSON.parse(jsonText);
    if (!Array.isArray(parsed)) {
      return { error: "A IA não retornou uma lista válida de tópicos." };
    }

    const topics = Array.from(
      new Set(
        parsed
          .map((t: any) => (typeof t === "string" ? t.trim() : ""))
          .filter((t: string) => t.length > 0)
      )
    ).slice(0, MAX_TOPICS);

    if (topics.length === 0) {
      return { error: "Nenhum tópico foi identificado nesta apostila." };
    }

    return { success: true, topics };
  } catch (error: any) {
    console.error("Erro ao extrair tópicos da apostila:", error);
    return { error: error.message || "Erro interno ao extrair os tópicos." };
  }
}

// Salva a lista de tópicos (já revisada pelo instrutor) como a lista fixa oficial
// da apostila. A partir daqui, a geração de questões diárias passa a classificar
// cada questão dentro desta lista.
export async function saveApostilaProvaTopicsAction(apostilaId: string, topics: string[]) {
  const user = await getUser();
  if (!user || user.role !== "INSTRUCTOR") {
    return { error: "Não autorizado." };
  }

  if (!Array.isArray(topics)) {
    return { error: "Lista de tópicos inválida." };
  }

  const cleanTopics = Array.from(
    new Set(
      topics
        .map((t) => (typeof t === "string" ? t.trim() : ""))
        .filter((t) => t.length > 0 && t.length <= 120)
    )
  ).slice(0, MAX_TOPICS);

  if (cleanTopics.length === 0) {
    return { error: "Informe pelo menos um tópico." };
  }

  try {
    const apostila = await prisma.apostila.findUnique({ where: { id: apostilaId } });
    if (!apostila) {
      return { error: "Apostila não encontrada." };
    }

    await prisma.apostila.update({
      where: { id: apostilaId },
      data: { provaTopics: JSON.stringify(cleanTopics) }
    });

    revalidatePath("/instructor");
    return { success: true, topics: cleanTopics };
  } catch (error: any) {
    console.error("Erro ao salvar tópicos da apostila:", error);
    return { error: "Erro ao salvar os tópicos." };
  }
}
