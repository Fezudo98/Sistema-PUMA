"use server";

import { prisma } from "@/lib/prisma";
import { getStudentEffectiveStats } from "@/lib/studentStatsRead";
import { getCachedGeneralRanking } from "@/lib/ranking";
import { generateWithGeminiFallback } from "@/lib/gemini";
import { revalidatePath } from "next/cache";
import { queueGenerationTask } from "./dailySimulado";
import { getCachedApostilaText } from "@/lib/apostilaCache";

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

    // Carrega só as últimas 200 mensagens dessa conversa (mais que suficiente pra
    // exibir e dar contexto), em vez do histórico inteiro acumulado sem limite.
    const recentMessages = await prisma.chatMessage.findMany({
      where: { studentId: user.userId, apostilaId },
      orderBy: { createdAt: "desc" },
      take: 200
    });
    const messages = recentMessages.reverse();

    return { success: true, messages, isSuspended: false, isApostilaActive };
  } catch (error: any) {
    console.error("[CHAT HISTORY ERROR]:", error);
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

  if (content.length > 2000) {
    return { error: "A pergunta é muito longa (máximo 2000 caracteres)." };
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
      // 2. Carregar estatísticas do aluno. Reaproveita o ranking geral (com cache de 60s)
      // em vez de rebuscar e reprocessar o histórico de respostas inteiro a cada mensagem.
      const generalRanking = await getCachedGeneralRanking();
      const cachedPerf = generalRanking.find((r: any) => r.id === user.userId);

      let totalAnswers: number;
      let accuracy: number;
      let streakDays: number;
      let todayPoints: number;

      if (cachedPerf) {
        totalAnswers = cachedPerf.totalAnswers;
        accuracy = cachedPerf.accuracy;
        streakDays = cachedPerf.streakDays;
        todayPoints = cachedPerf.todayPoints;
      } else {
        // Fallback (ex.: contas de teste que não entram no ranking geral)
        const perf = await getStudentEffectiveStats(user.userId);
        totalAnswers = perf.totalAnswers;
        accuracy = perf.accuracy;
        streakDays = perf.streakDays;
        todayPoints = perf.todayPoints;
      }

      // Assuntos com erros: busca só as últimas respostas erradas (bem mais leve que
      // carregar o histórico inteiro), aproveitando o índice [studentId, isCorrect].
      const wrongQuestions = await prisma.answer.findMany({
        where: { studentId: user.userId, isCorrect: false },
        orderBy: { id: "desc" },
        take: 5,
        select: {
          alternativa: true,
          question: { select: { enunciado: true, justificativa: true } }
        }
      });
      const wrongSummary = wrongQuestions.reverse().map(a => `- Questão: ${a.question.enunciado} (Sua resposta incorreta: alternativa ${a.alternativa}, justificativa da questão: ${a.question.justificativa})`).join("\n");

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
3. CONTEXTO DE DESEMPENHO SILENCIOSO: Você sabe que o Recruta resolveu ${totalAnswers} questões com aproveitamento de ${accuracy}%, está com sequência diária de ${streakDays} dia(s) e fez +${todayPoints} pontos hoje (Erros recentes: ${wrongSummary || "nenhum"}). NÃO mencione esses números ou estatísticas a menos que seja questionado diretamente ou para elogiar a sequência no início.
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
      const result = await generateWithGeminiFallback([systemPrompt]);
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
    console.error("[CHAT CLEAR HISTORY ERROR]:", error);
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
    console.error("[CHAT TOGGLE ERROR]:", error);
    return { error: error.message || "Erro ao atualizar configuração." };
  }
}

export async function getChatEnabledAction() {
  try {
    const setting = await prisma.systemSetting.findUnique({
      where: { key: "chatEnabled" }
    });
    return setting?.value !== "false";
  } catch (error) {
    // Falha ao ler a configuração: assume chat habilitado (fail-open) pra não
    // derrubar o recurso pra todo mundo por causa de uma falha pontual do banco —
    // mas registra, porque uma falha persistente aqui fica invisível sem isso.
    console.error("[CHAT ENABLED CHECK ERROR]:", error);
    return true;
  }
}
