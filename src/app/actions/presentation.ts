"use server";

import { prisma } from "@/lib/prisma";
import { getUser } from "@/app/actions/auth";
import { revalidatePath } from "next/cache";

// Modo Apresentação: o instrutor conduz a sala sozinho (sem alunos conectados),
// debate cada questão em sala e marca na tela qual alternativa a turma escolheu.
// Não há cronômetro nem conexão de alunos — é um fluxo separado do motor de
// salas ao vivo (sem socket, sem código de sala funcional).

export async function markPresentationAnswer(questionId: string, alternativa: number) {
  const user = await getUser();
  if (!user || user.role !== "INSTRUCTOR") {
    return { error: "Não autorizado." };
  }

  if (typeof alternativa !== "number" || alternativa < 0 || alternativa > 4) {
    return { error: "Alternativa inválida." };
  }

  try {
    const question = await prisma.question.findUnique({
      where: { id: questionId },
      include: { simulado: true }
    });

    if (!question) {
      return { error: "Questão não encontrada." };
    }

    if (question.simulado.tipo !== "PRESENTATION" || question.simulado.instructorId !== user.userId) {
      return { error: "Não autorizado." };
    }

    await prisma.question.update({
      where: { id: questionId },
      data: { presentationAnswer: alternativa }
    });

    return {
      success: true,
      isCorrect: alternativa === question.correta,
      correta: question.correta,
      justificativa: question.justificativa
    };
  } catch (error: any) {
    console.error("Erro ao marcar resposta da apresentação:", error);
    return { error: "Erro ao salvar a marcação." };
  }
}

export async function finishPresentationSimulado(simuladoId: string) {
  const user = await getUser();
  if (!user || user.role !== "INSTRUCTOR") {
    return { error: "Não autorizado." };
  }

  try {
    const simulado = await prisma.simulado.findUnique({ where: { id: simuladoId } });
    if (!simulado || simulado.tipo !== "PRESENTATION" || simulado.instructorId !== user.userId) {
      return { error: "Não autorizado." };
    }

    await prisma.simulado.update({
      where: { id: simuladoId },
      data: { status: "FINISHED" }
    });

    revalidatePath("/instructor");
    return { success: true };
  } catch (error: any) {
    console.error("Erro ao finalizar apresentação:", error);
    return { error: "Erro ao finalizar a apresentação." };
  }
}
