"use server";

import { prisma } from "@/lib/prisma";
import { recordAnswerDelta, foldSimuladoCompletionIfNeeded, foldBlocoProvaDailyProgress, evaluateAndUnlockBadges } from "@/lib/studentStatsFold";
import { revalidatePath } from "next/cache";
import { getUser } from "@/app/actions/auth";
import { assembleAllDailySimulados, assembleDailySimuladoForApostila } from "@/lib/questionBank";

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

export async function checkAndGenerateDailySimulados(_force: boolean = false) {
  return queueGenerationTask(() => assembleAllDailySimulados());
}

const PAST_DAILY_SIMULADOS_PAGE_SIZE = 30;

export async function getMorePastDailySimulados(offset: number) {
  const currentUser = await getUser();
  if (!currentUser || currentUser.role !== "STUDENT") {
    return { error: "Não autorizado." };
  }

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const pastDailySimulados = await prisma.simulado.findMany({
    where: {
      tipo: "DAILY",
      createdAt: { lt: todayStart }
    },
    include: {
      questions: { select: { id: true } }
    },
    orderBy: { createdAt: "desc" },
    skip: offset,
    take: PAST_DAILY_SIMULADOS_PAGE_SIZE + 1
  });

  const hasMore = pastDailySimulados.length > PAST_DAILY_SIMULADOS_PAGE_SIZE;
  const pageItems = pastDailySimulados.slice(0, PAST_DAILY_SIMULADOS_PAGE_SIZE);

  const questionIds = pageItems.flatMap((sim) => sim.questions.map((q) => q.id));
  const studentAnswers = questionIds.length > 0
    ? await prisma.answer.findMany({
        where: { studentId: currentUser.userId, questionId: { in: questionIds } },
        select: { questionId: true }
      })
    : [];
  const answeredQuestionIds = new Set(studentAnswers.map((a) => a.questionId));

  const apostilaNames = Array.from(new Set(pageItems.map((sim) => sim.apostilaName).filter(Boolean))) as string[];
  const linkedApostilas = apostilaNames.length > 0
    ? await prisma.apostila.findMany({
        where: { title: { in: apostilaNames } },
        select: { title: true, createdAt: true }
      })
    : [];

  const items = pageItems.map((sim) => {
    const simQuestionIds = sim.questions.map((q) => q.id);
    const studentAnswersCount = simQuestionIds.filter((id) => answeredQuestionIds.has(id)).length;
    const isCompleted = simQuestionIds.length > 0 && studentAnswersCount >= simQuestionIds.length;
    const linkedApostila = linkedApostilas.find((a) => a.title === sim.apostilaName);

    return {
      id: sim.id,
      apostilaName: sim.apostilaName || "Simulado de Estudo",
      apostilaCreatedAt: linkedApostila ? linkedApostila.createdAt.toISOString() : null,
      questionsCount: simQuestionIds.length,
      isCompleted,
      createdAt: sim.createdAt.toISOString()
    };
  });

  return { items, hasMore };
}

export async function saveSelfPacedAnswer(data: {
  questionId: string;
  studentId: string;
  alternativa: number;
  tempoGasto: number;
}) {
  const { questionId, alternativa, tempoGasto } = data;

  try {
    const currentUser = await getUser();
    if (!currentUser || currentUser.role !== "STUDENT") {
      return { error: "Não autorizado." };
    }
    const studentId = currentUser.userId;

    // 1. Evitar respostas duplicadas. Isso pode acontecer legitimamente quando uma
    // resposta anterior falhou temporariamente no cliente (fila offline) e depois
    // sincronizou em segundo plano antes de uma nova tentativa manual — nesse caso,
    // devolve a resposta já salva como sucesso (idempotente), em vez de erro. Um erro
    // aqui faria o cliente tratar como falha de rede e reenfileirar, travando o aluno
    // em loop na última questão sem nunca conseguir finalizar o simulado.
    const existingAnswer = await prisma.answer.findFirst({
      where: {
        questionId,
        studentId
      },
      include: { question: true }
    });

    if (existingAnswer) {
      return {
        success: true,
        isCorrect: existingAnswer.isCorrect,
        correta: existingAnswer.question.correta,
        justificativa: existingAnswer.question.justificativa,
        pontuacao: existingAnswer.pontuacao
      };
    }

    // 2. Buscar a questão para validar
    const question = await prisma.question.findUnique({
      where: { id: questionId },
      include: { simulado: { include: { _count: { select: { questions: true } } } } }
    });

    if (!question) {
      return { error: "Questão não encontrada." };
    }

    // Este fluxo é exclusivo de simulados DAILY/SPECIAL (estudo autoguiado). Sem
    // essa checagem, um aluno poderia responder (e pontuar em) questões de um
    // simulado LIVE ou PRESENTATION que nem chegou a acontecer pra ele.
    if (question.simulado.tipo !== "DAILY" && question.simulado.tipo !== "SPECIAL" && question.simulado.tipo !== "BLOCO_PROVA") {
      return { error: "Este simulado não pode ser respondido neste modo." };
    }
    if (question.simulado.tipo === "SPECIAL" && question.simulado.expiresAt && new Date(question.simulado.expiresAt) < new Date()) {
      return { error: "Esta missão especial já expirou." };
    }

    const isCorrect = Number(question.correta) === Number(alternativa);
    
    let pontuacao = 0;
    if (isCorrect) {
      const now = new Date();
      const simuladoDate = question.simulado?.createdAt || new Date(0);
      
      const diffInHours = (now.getTime() - simuladoDate.getTime()) / (1000 * 60 * 60);
      const isWithin72Hours = diffInHours <= 72;

      // Prazo de 72hrs ganha 100, após isso ganha 50
      pontuacao = isWithin72Hours ? 100 : 50; 
    }

    let safeTempoGasto = Number(tempoGasto) || 0;
    if (safeTempoGasto < 0) safeTempoGasto = 0;
    if (safeTempoGasto > question.tempoLimite * 2) {
      safeTempoGasto = question.tempoLimite;
    }

    // 3. Salvar no banco. A constraint única (questionId, studentId) é a garantia
    // final contra respostas duplicadas chegando quase ao mesmo tempo (ex.: retry
    // de rede duplicando a chamada antes que o check de "existingAnswer" acima
    // enxergasse a primeira gravação). Nesse caso, devolve a resposta já salva como
    // sucesso (idempotente) em vez de erro — igual ao tratamento acima — para não
    // travar o aluno em loop de reenvio.
    let savedAnswer: { createdAt: Date };
    try {
      savedAnswer = await prisma.answer.create({
        data: {
          questionId,
          studentId,
          alternativa,
          tempoGasto: safeTempoGasto,
          isCorrect,
          pontuacao,
          isRaffle: false
        },
        select: { createdAt: true }
      });
    } catch (err: any) {
      if (err?.code === 'P2002') {
        const alreadySaved = await prisma.answer.findFirst({
          where: { questionId, studentId },
          include: { question: true }
        });
        if (alreadySaved) {
          return {
            success: true,
            isCorrect: alreadySaved.isCorrect,
            correta: alreadySaved.question.correta,
            justificativa: alreadySaved.question.justificativa,
            pontuacao: alreadySaved.pontuacao
          };
        }
      }
      throw err;
    }

    // Só chega aqui numa gravação nova de verdade (o branch de duplicata acima
    // sempre retorna antes) — seguro incrementar as estatísticas pré-agregadas.
    // Aguarda a atualização antes de liberar a próxima questão. A versão anterior
    // disparava uma Promise solta e devolvia imediatamente; respostas sucessivas do
    // mesmo aluno podiam então disputar a mesma linha de StudentStats no SQLite.
    // Uma falha dos agregados não invalida a resposta (que já foi persistida), mas
    // fica registrada e o fold idempotente será tentado novamente na conclusão.
    const answerCreatedAt = savedAnswer.createdAt;
    try {
      await recordAnswerDelta({
        studentId,
        isCorrect,
        pontuacao,
        tempoGasto: safeTempoGasto,
        alternativa,
        createdAt: answerCreatedAt,
        simuladoTipo: question.simulado.tipo,
        simuladoCreatedAt: question.simulado.createdAt
      });
    } catch (statsError) {
      console.error("Erro ao atualizar contadores de StudentStats:", statsError);
    }

    // A sequência é independente dos demais contadores. Mesmo que o delta acima
    // encontre contenção no SQLite, ainda tentamos fechar/recontar o dia.
    try {
      await foldSimuladoCompletionIfNeeded(studentId, question.simuladoId, {
        tipo: question.simulado.tipo,
        status: question.simulado.status,
        difficulty: question.simulado.difficulty,
        createdAt: question.simulado.createdAt,
        codigoSala: question.simulado.codigoSala,
        totalQuestions: question.simulado._count.questions
      });
      if (question.simulado.tipo === "BLOCO_PROVA") {
        await foldBlocoProvaDailyProgress(studentId, answerCreatedAt);
      }
    } catch (streakError) {
      console.error("Erro ao atualizar sequência diária:", streakError);
    }

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

export async function completeSelfPacedSimulado(_studentId: string, currentSimuladoId: string) {
  try {
    const currentUser = await getUser();
    if (!currentUser || currentUser.role !== "STUDENT") {
      return { error: "Não autorizado." };
    }
    const studentId = currentUser.userId;

    // O fold da última resposta roda em segundo plano (sem await, ver
    // saveSelfPacedAnswer) — refazer aqui garante que ele já terminou antes de
    // avaliar brevês, mesmo que o cliente chame completeSelfPacedSimulado antes
    // desse trabalho em segundo plano concluir. Idempotente, seguro de repetir.
    const simulado = await prisma.simulado.findUnique({
      where: { id: currentSimuladoId },
      select: { tipo: true, status: true, difficulty: true, createdAt: true, codigoSala: true, _count: { select: { questions: true } } }
    });
    if (simulado) {
      await foldSimuladoCompletionIfNeeded(studentId, currentSimuladoId, {
        tipo: simulado.tipo,
        status: simulado.status,
        difficulty: simulado.difficulty,
        createdAt: simulado.createdAt,
        codigoSala: simulado.codigoSala,
        totalQuestions: simulado._count.questions
      });
    }

    const { newlyUnlocked } = await evaluateAndUnlockBadges(studentId);

    return { success: true, newlyUnlockedCount: newlyUnlocked.length };
  } catch (err: any) {
    console.error("Erro ao finalizar simulado individual:", err);
    return { error: err.message || "Erro desconhecido ao computar brevês." };
  }
}


export async function generateDailySimuladoForSingleApostila(apostilaId: string, force: boolean = false) {
  return assembleDailySimuladoForApostila(apostilaId, force);
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

      // Gera um novo simulado diário SEM apagar o de hoje que já existir — ele
      // permanece intacto (com as respostas dos alunos preservadas) e passa a
      // aparecer no Histórico assim que o dia virar, como qualquer outro diário.
      const res = await generateDailySimuladoForSingleApostila(apostila.id, true);

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

      // Gera um novo simulado diário pra cada apostila ativa SEM apagar os de hoje
      // que já existirem — eles permanecem intactos (com as respostas dos alunos
      // preservadas) e passam a aparecer no Histórico assim que o dia virar.
      // Já estamos dentro da fila; chamar a action enfileirada novamente causaria
      // espera circular. A montagem local é segura e idempotente.
      const res = await assembleAllDailySimulados();

      revalidatePath("/instructor");
      revalidatePath("/aluno/painel");
      return res;
    } catch (error: any) {
      console.error("[FORCE ALL DAILY] Erro ao forçar todos:", error);
      return { error: error.message || "Erro na geração dos simulados." };
    }
  });
}
