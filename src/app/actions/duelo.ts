"use server";

import { prisma } from "@/lib/prisma";
import { getUser } from "./auth";
import { generateUniqueRoomCode } from "@/lib/roomCode";
import { pickRandomDuelQuestions, countAvailableDuelQuestions } from "@/lib/duelQuestions";
import { emitToUser } from "@/lib/socketBridge";
import { revalidatePath } from "next/cache";

const MIN_FLEXOES = 1;
const MAX_FLEXOES = 100;
const MIN_QUESTIONS = 5;
const MAX_QUESTIONS = 20;
const QUEUE_EXPIRY_MS = 30 * 60 * 1000;
const ACTIVE_DUEL_STATUSES = ["PENDING_INVITE", "QUEUED", "MATCHED", "ACTIVE"];

function validateWagerParams(flexoesAposta: number, questionCount: number) {
  if (!Number.isInteger(flexoesAposta) || flexoesAposta < MIN_FLEXOES || flexoesAposta > MAX_FLEXOES) {
    return `A aposta deve ser um número inteiro entre ${MIN_FLEXOES} e ${MAX_FLEXOES} flexões.`;
  }
  if (!Number.isInteger(questionCount) || questionCount < MIN_QUESTIONS || questionCount > MAX_QUESTIONS) {
    return `O número de questões deve ser entre ${MIN_QUESTIONS} e ${MAX_QUESTIONS}.`;
  }
  return null;
}

// Expira (silenciosamente) entradas de fila abandonadas há muito tempo, evitando
// fila "fantasma" sem precisar de um cron dedicado.
async function expireStaleQueueEntries() {
  await prisma.duelo.updateMany({
    where: {
      status: "QUEUED",
      createdAt: { lt: new Date(Date.now() - QUEUE_EXPIRY_MS) }
    },
    data: { status: "EXPIRED" }
  });
}

async function hasUnresolvedDuelBetween(userIdA: string, userIdB: string) {
  const existing = await prisma.duelo.findFirst({
    where: {
      status: { in: ACTIVE_DUEL_STATUSES },
      OR: [
        { challengerId: userIdA, challengedId: userIdB },
        { challengerId: userIdB, challengedId: userIdA }
      ]
    }
  });
  return !!existing;
}

// Impede que um aluno fique preso em dois duelos simultâneos (ex.: desafiar dois
// colegas ao mesmo tempo e os dois aceitarem) — mesma checagem que já existe pra
// quem entra na fila de pareamento, agora também no fluxo de desafio direto.
async function hasAnyActiveDuel(userId: string, excludeDuelId?: string) {
  const existing = await prisma.duelo.findFirst({
    where: {
      id: excludeDuelId ? { not: excludeDuelId } : undefined,
      status: { in: ACTIVE_DUEL_STATUSES },
      OR: [{ challengerId: userId }, { challengedId: userId }]
    }
  });
  return !!existing;
}

/** Cria a sala/Simulado da partida e copia as questões sorteadas para dentro dela. */
async function matchAndStartDuel(tx: any, duelo: { id: string; challengerId: string; apostilaName: string; questionCount: number }) {
  const codigoSala = await generateUniqueRoomCode();
  const picked = await pickRandomDuelQuestions(duelo.apostilaName, duelo.questionCount);

  const simulado = await tx.simulado.create({
    data: {
      tipo: "DUELO",
      status: "WAITING",
      instructorId: duelo.challengerId,
      apostilaName: duelo.apostilaName,
      difficulty: "AVANCADO",
      codigoSala
    }
  });

  if (picked.length > 0) {
    await tx.question.createMany({
      data: picked.map((q) => ({
        simuladoId: simulado.id,
        enunciado: q.enunciado,
        alternativas: q.alternativas,
        correta: q.correta,
        justificativa: q.justificativa,
        tempoLimite: 30,
        sourceQuestionId: q.id
      }))
    });
  }

  const updated = await tx.duelo.update({
    where: { id: duelo.id },
    data: { simuladoId: simulado.id, status: "ACTIVE", respondedAt: new Date() }
  });

  return { simulado, duelo: updated };
}

export async function createDuelChallengeAction(challengedId: string, apostilaId: string, flexoesAposta: number, questionCount: number = 10) {
  const user = await getUser();
  if (!user || user.role !== "STUDENT") {
    return { error: "Não autenticado." };
  }
  if (challengedId === user.userId) {
    return { error: "Você não pode desafiar a si mesmo." };
  }

  const wagerError = validateWagerParams(flexoesAposta, questionCount);
  if (wagerError) return { error: wagerError };

  try {
    const [challenged, apostila] = await Promise.all([
      prisma.user.findUnique({ where: { id: challengedId } }),
      prisma.apostila.findUnique({ where: { id: apostilaId } })
    ]);

    if (!challenged || challenged.role !== "STUDENT") {
      return { error: "Combatente não encontrado." };
    }
    if (!apostila || !apostila.isActive) {
      return { error: "Apostila inválida ou inativa." };
    }

    if (await hasAnyActiveDuel(user.userId)) {
      return { error: "Você já tem um desafio ou duelo em aberto." };
    }
    if (await hasAnyActiveDuel(challengedId)) {
      return { error: "Esse combatente já tem um desafio ou duelo em aberto." };
    }

    const available = await countAvailableDuelQuestions(apostila.title);
    if (available < questionCount) {
      return { error: `Esta apostila ainda não tem questões suficientes geradas (${available}/${questionCount}).` };
    }

    if (await hasUnresolvedDuelBetween(user.userId, challengedId)) {
      return { error: "Já existe um duelo em aberto entre vocês dois." };
    }

    const duelo = await prisma.duelo.create({
      data: {
        challengerId: user.userId,
        challengedId,
        apostilaId,
        apostilaName: apostila.title,
        flexoesAposta,
        questionCount,
        status: "PENDING_INVITE",
        origin: "CHALLENGE"
      }
    });

    emitToUser(challengedId, "duel_invite_received", { duelId: duelo.id });
    revalidatePath("/aluno/duelo");

    return { success: true, duelId: duelo.id };
  } catch (error) {
    console.error("Error creating duel challenge:", error);
    return { error: "Erro ao criar o desafio." };
  }
}

export async function respondToDuelChallengeAction(duelId: string, accept: boolean) {
  const user = await getUser();
  if (!user || user.role !== "STUDENT") {
    return { error: "Não autenticado." };
  }

  try {
    const duelo = await prisma.duelo.findUnique({ where: { id: duelId } });
    if (!duelo || duelo.challengedId !== user.userId || duelo.status !== "PENDING_INVITE") {
      return { error: "Convite não encontrado ou já resolvido." };
    }

    if (!accept) {
      await prisma.duelo.update({
        where: { id: duelId },
        data: { status: "DECLINED", respondedAt: new Date() }
      });
      emitToUser(duelo.challengerId, "duel_declined", { duelId });
      revalidatePath("/aluno/duelo");
      return { success: true };
    }

    if (await hasAnyActiveDuel(user.userId, duelId) || await hasAnyActiveDuel(duelo.challengerId, duelId)) {
      return { error: "Um dos dois já está em outro duelo em aberto. Recuse ou aguarde ele terminar." };
    }

    const available = await countAvailableDuelQuestions(duelo.apostilaName);
    if (available < duelo.questionCount) {
      await prisma.duelo.update({
        where: { id: duelId },
        data: { status: "CANCELLED", respondedAt: new Date() }
      });
      return { error: "A apostila não tem mais questões suficientes para este duelo. Desafio cancelado." };
    }

    const { simulado } = await prisma.$transaction(async (tx) => {
      // Limpa qualquer outro convite pendente entre os dois (corrida de desafio mútuo).
      await (tx as any).duelo.updateMany({
        where: {
          id: { not: duelId },
          status: "PENDING_INVITE",
          OR: [
            { challengerId: duelo.challengerId, challengedId: duelo.challengedId },
            { challengerId: duelo.challengedId, challengedId: duelo.challengerId }
          ]
        },
        data: { status: "CANCELLED" }
      });
      return matchAndStartDuel(tx as any, duelo);
    });

    emitToUser(duelo.challengerId, "duel_matched", { duelId, codigoSala: simulado.codigoSala });
    emitToUser(duelo.challengedId!, "duel_matched", { duelId, codigoSala: simulado.codigoSala });
    revalidatePath("/aluno/duelo");

    return { success: true, codigoSala: simulado.codigoSala };
  } catch (error) {
    console.error("Error responding to duel challenge:", error);
    return { error: "Erro ao responder ao desafio." };
  }
}

export async function cancelDuelInviteAction(duelId: string) {
  const user = await getUser();
  if (!user || user.role !== "STUDENT") {
    return { error: "Não autenticado." };
  }

  try {
    const duelo = await prisma.duelo.findUnique({ where: { id: duelId } });
    if (!duelo || duelo.challengerId !== user.userId || duelo.status !== "PENDING_INVITE") {
      return { error: "Convite não encontrado ou já resolvido." };
    }

    await prisma.duelo.update({ where: { id: duelId }, data: { status: "CANCELLED" } });
    if (duelo.challengedId) {
      emitToUser(duelo.challengedId, "duel_cancelled", { duelId });
    }
    revalidatePath("/aluno/duelo");
    return { success: true };
  } catch (error) {
    console.error("Error cancelling duel invite:", error);
    return { error: "Erro ao cancelar o desafio." };
  }
}

export async function joinDuelQueueAction(apostilaId: string, flexoesAposta: number, questionCount: number = 10) {
  const user = await getUser();
  if (!user || user.role !== "STUDENT") {
    return { error: "Não autenticado." };
  }

  const wagerError = validateWagerParams(flexoesAposta, questionCount);
  if (wagerError) return { error: wagerError };

  try {
    const apostila = await prisma.apostila.findUnique({ where: { id: apostilaId } });
    if (!apostila || !apostila.isActive) {
      return { error: "Apostila inválida ou inativa." };
    }

    const available = await countAvailableDuelQuestions(apostila.title);
    if (available < questionCount) {
      return { error: `Esta apostila ainda não tem questões suficientes geradas (${available}/${questionCount}).` };
    }

    const existingActive = await prisma.duelo.findFirst({
      where: {
        status: { in: ACTIVE_DUEL_STATUSES },
        OR: [{ challengerId: user.userId }, { challengedId: user.userId }]
      }
    });
    if (existingActive) {
      return { error: "Você já tem um desafio ou duelo em aberto." };
    }

    await expireStaleQueueEntries();

    const result = await prisma.$transaction(async (tx) => {
      const waiting = await (tx as any).duelo.findFirst({
        where: {
          status: "QUEUED",
          origin: "QUEUE",
          apostilaId,
          questionCount,
          challengedId: null,
          challengerId: { not: user.userId }
        },
        orderBy: { createdAt: "asc" }
      });

      if (waiting) {
        const claim = await (tx as any).duelo.updateMany({
          where: { id: waiting.id, status: "QUEUED" },
          data: {
            challengedId: user.userId,
            status: "MATCHED",
            flexoesAposta: Math.min(waiting.flexoesAposta, flexoesAposta)
          }
        });

        if (claim.count === 1) {
          const matchedDuelo = await (tx as any).duelo.findUnique({ where: { id: waiting.id } });
          const { simulado } = await matchAndStartDuel(tx as any, matchedDuelo);
          return { matched: true, duelId: matchedDuelo.id, codigoSala: simulado.codigoSala, opponentId: matchedDuelo.challengerId };
        }
      }

      const created = await (tx as any).duelo.create({
        data: {
          challengerId: user.userId,
          apostilaId,
          apostilaName: apostila.title,
          flexoesAposta,
          questionCount,
          status: "QUEUED",
          origin: "QUEUE"
        }
      });
      return { matched: false, duelId: created.id, codigoSala: null, opponentId: null };
    });

    if (result.matched && result.opponentId) {
      emitToUser(result.opponentId, "duel_matched", { duelId: result.duelId, codigoSala: result.codigoSala });
      emitToUser(user.userId, "duel_matched", { duelId: result.duelId, codigoSala: result.codigoSala });
    }

    revalidatePath("/aluno/duelo");
    return { success: true, matched: result.matched, duelId: result.duelId, codigoSala: result.codigoSala };
  } catch (error) {
    console.error("Error joining duel queue:", error);
    return { error: "Erro ao entrar na fila de duelo." };
  }
}

export async function leaveDuelQueueAction(duelId: string) {
  const user = await getUser();
  if (!user || user.role !== "STUDENT") {
    return { error: "Não autenticado." };
  }

  try {
    const duelo = await prisma.duelo.findUnique({ where: { id: duelId } });
    if (!duelo || duelo.challengerId !== user.userId || duelo.status !== "QUEUED" || duelo.challengedId) {
      return { error: "Você não está nessa fila." };
    }

    await prisma.duelo.update({ where: { id: duelId }, data: { status: "CANCELLED" } });
    revalidatePath("/aluno/duelo");
    return { success: true };
  } catch (error) {
    console.error("Error leaving duel queue:", error);
    return { error: "Erro ao sair da fila." };
  }
}

export async function getMyDuelStatusAction() {
  const user = await getUser();
  if (!user || user.role !== "STUDENT") {
    return { error: "Não autenticado." };
  }

  try {
    await expireStaleQueueEntries();

    const [incoming, outgoing, queued, active, recentFinished] = await Promise.all([
      prisma.duelo.findMany({ where: { challengedId: user.userId, status: "PENDING_INVITE" }, orderBy: { createdAt: "desc" } }),
      prisma.duelo.findFirst({ where: { challengerId: user.userId, status: "PENDING_INVITE" }, orderBy: { createdAt: "desc" } }),
      prisma.duelo.findFirst({ where: { challengerId: user.userId, status: "QUEUED", origin: "QUEUE" } }),
      prisma.duelo.findFirst({
        where: {
          status: { in: ["MATCHED", "ACTIVE"] },
          OR: [{ challengerId: user.userId }, { challengedId: user.userId }]
        },
        orderBy: { createdAt: "desc" }
      }),
      prisma.duelo.findFirst({
        where: {
          status: "FINISHED",
          OR: [{ challengerId: user.userId }, { challengedId: user.userId }]
        },
        orderBy: { finishedAt: "desc" }
      })
    ]);

    const otherIds = new Set<string>();
    incoming.forEach((d) => otherIds.add(d.challengerId));
    if (outgoing) otherIds.add(outgoing.challengedId!);
    if (active) otherIds.add(active.challengerId === user.userId ? active.challengedId! : active.challengerId);
    if (recentFinished) otherIds.add(recentFinished.challengerId === user.userId ? recentFinished.challengedId! : recentFinished.challengerId);

    const others = otherIds.size > 0
      ? await prisma.user.findMany({ where: { id: { in: Array.from(otherIds) } }, select: { id: true, name: true } })
      : [];
    const nameById = new Map(others.map((o) => [o.id, o.name]));

    let activeSimuladoCode: string | null = null;
    if (active && active.simuladoId) {
      const simulado = await prisma.simulado.findUnique({ where: { id: active.simuladoId }, select: { codigoSala: true } });
      activeSimuladoCode = simulado?.codigoSala || null;
    }

    return {
      success: true,
      incomingInvites: incoming.map((d) => ({
        id: d.id,
        challengerId: d.challengerId,
        challengerName: nameById.get(d.challengerId) || "Combatente",
        apostilaName: d.apostilaName,
        flexoesAposta: d.flexoesAposta,
        questionCount: d.questionCount,
        createdAt: d.createdAt.toISOString()
      })),
      outgoingInvite: outgoing ? {
        id: outgoing.id,
        challengedName: nameById.get(outgoing.challengedId!) || "Combatente",
        apostilaName: outgoing.apostilaName,
        flexoesAposta: outgoing.flexoesAposta,
        status: outgoing.status
      } : null,
      queueStatus: queued ? {
        id: queued.id,
        apostilaName: queued.apostilaName,
        flexoesAposta: queued.flexoesAposta,
        questionCount: queued.questionCount,
        waitingSince: queued.createdAt.toISOString()
      } : null,
      activeDuel: (active && activeSimuladoCode) ? {
        id: active.id,
        codigoSala: activeSimuladoCode,
        opponentName: nameById.get(active.challengerId === user.userId ? active.challengedId! : active.challengerId) || "Combatente",
        flexoesAposta: active.flexoesAposta
      } : null,
      recentResult: recentFinished ? {
        id: recentFinished.id,
        opponentName: nameById.get(recentFinished.challengerId === user.userId ? recentFinished.challengedId! : recentFinished.challengerId) || "Combatente",
        won: recentFinished.winnerId === user.userId,
        isDraw: recentFinished.isDraw,
        flexoesAposta: recentFinished.flexoesAposta,
        iAmDebtor: recentFinished.loserId === user.userId,
        finishedAt: recentFinished.finishedAt ? recentFinished.finishedAt.toISOString() : null
      } : null
    };
  } catch (error) {
    console.error("Error fetching duel status:", error);
    return { error: "Erro ao carregar status de duelo." };
  }
}

export async function getDuelDebtsAction() {
  const user = await getUser();
  if (!user || user.role !== "STUDENT") {
    return { error: "Não autenticado." };
  }

  try {
    const [owedToMeRaw, owedByMeRaw, historyRaw] = await Promise.all([
      prisma.duelo.findMany({ where: { winnerId: user.userId, status: "FINISHED", isDraw: false, debtPaid: false }, orderBy: { finishedAt: "desc" } }),
      prisma.duelo.findMany({ where: { loserId: user.userId, status: "FINISHED", isDraw: false, debtPaid: false }, orderBy: { finishedAt: "desc" } }),
      prisma.duelo.findMany({
        where: {
          status: "FINISHED", isDraw: false, debtPaid: true,
          OR: [{ winnerId: user.userId }, { loserId: user.userId }]
        },
        orderBy: { debtPaidAt: "desc" },
        take: 20
      })
    ]);

    const otherIds = new Set<string>();
    [...owedToMeRaw, ...owedByMeRaw, ...historyRaw].forEach((d) => {
      otherIds.add(d.challengerId === user.userId ? d.challengedId! : d.challengerId);
    });
    const others = otherIds.size > 0
      ? await prisma.user.findMany({ where: { id: { in: Array.from(otherIds) } }, select: { id: true, name: true } })
      : [];
    const nameById = new Map(others.map((o) => [o.id, o.name]));

    const mapDebt = (d: typeof owedToMeRaw[number]) => ({
      id: d.id,
      opponentName: nameById.get(d.challengerId === user.userId ? d.challengedId! : d.challengerId) || "Combatente",
      apostilaName: d.apostilaName,
      flexoesAposta: d.flexoesAposta,
      finishedAt: d.finishedAt ? d.finishedAt.toISOString() : null,
      debtPaid: d.debtPaid,
      debtPaidAt: d.debtPaidAt ? d.debtPaidAt.toISOString() : null
    });

    return {
      success: true,
      owedToMe: owedToMeRaw.map(mapDebt),
      owedByMe: owedByMeRaw.map(mapDebt),
      history: historyRaw.map(mapDebt)
    };
  } catch (error) {
    console.error("Error fetching duel debts:", error);
    return { error: "Erro ao carregar dívidas de duelo." };
  }
}

export async function markDuelDebtPaidAction(duelId: string) {
  const user = await getUser();
  if (!user || user.role !== "STUDENT") {
    return { error: "Não autenticado." };
  }

  try {
    const duelo = await prisma.duelo.findUnique({ where: { id: duelId } });
    if (!duelo || duelo.winnerId !== user.userId || duelo.status !== "FINISHED" || duelo.debtPaid) {
      return { error: "Dívida não encontrada ou já paga." };
    }

    await prisma.duelo.update({ where: { id: duelId }, data: { debtPaid: true, debtPaidAt: new Date() } });
    revalidatePath("/aluno/duelo");
    return { success: true };
  } catch (error) {
    console.error("Error marking duel debt paid:", error);
    return { error: "Erro ao marcar dívida como paga." };
  }
}

export async function getInstructorDuelDebtsAction() {
  const user = await getUser();
  if (!user || user.role !== "INSTRUCTOR") {
    return { error: "Acesso negado. Apenas instrutores autorizados." };
  }

  try {
    const duelos = await prisma.duelo.findMany({
      where: { status: "FINISHED", isDraw: false },
      orderBy: { finishedAt: "desc" },
      take: 200
    });

    const ids = new Set<string>();
    duelos.forEach((d) => {
      ids.add(d.challengerId);
      if (d.challengedId) ids.add(d.challengedId);
    });
    const users = ids.size > 0
      ? await prisma.user.findMany({ where: { id: { in: Array.from(ids) } }, select: { id: true, name: true, numero: true } })
      : [];
    const byId = new Map(users.map((u) => [u.id, u]));

    return {
      success: true,
      duelos: duelos.map((d) => ({
        id: d.id,
        challengerName: byId.get(d.challengerId)?.name || "?",
        challengedName: d.challengedId ? (byId.get(d.challengedId)?.name || "?") : "?",
        winnerName: d.winnerId ? (byId.get(d.winnerId)?.name || "?") : null,
        loserName: d.loserId ? (byId.get(d.loserId)?.name || "?") : null,
        apostilaName: d.apostilaName,
        flexoesAposta: d.flexoesAposta,
        forfeited: !!d.forfeitedById,
        debtPaid: d.debtPaid,
        debtPaidAt: d.debtPaidAt ? d.debtPaidAt.toISOString() : null,
        clearedByInstructor: !!d.debtClearedByInstructorId,
        finishedAt: d.finishedAt ? d.finishedAt.toISOString() : null
      }))
    };
  } catch (error) {
    console.error("Error fetching instructor duel debts:", error);
    return { error: "Erro ao carregar dívidas de duelo." };
  }
}

export async function adjustDuelDebtAction(duelId: string, action: "CLEAR" | "REOPEN") {
  const user = await getUser();
  if (!user || user.role !== "INSTRUCTOR") {
    return { error: "Acesso negado. Apenas instrutores autorizados." };
  }

  try {
    const duelo = await prisma.duelo.findUnique({ where: { id: duelId } });
    if (!duelo || duelo.status !== "FINISHED" || duelo.isDraw) {
      return { error: "Duelo não encontrado ou inválido." };
    }

    if (action === "CLEAR") {
      await prisma.duelo.update({
        where: { id: duelId },
        data: { debtPaid: true, debtPaidAt: new Date(), debtClearedByInstructorId: user.userId }
      });
    } else {
      await prisma.duelo.update({
        where: { id: duelId },
        data: { debtPaid: false, debtPaidAt: null, debtClearedByInstructorId: null }
      });
    }

    revalidatePath("/instructor/duelos");
    return { success: true };
  } catch (error) {
    console.error("Error adjusting duel debt:", error);
    return { error: "Erro ao ajustar a dívida." };
  }
}
