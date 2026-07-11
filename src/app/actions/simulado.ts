"use server";

import { PrismaClient } from "@prisma/client";
import { getUser } from "./auth";
import { revalidatePath } from "next/cache";

const prisma = new PrismaClient();

function generateCode() {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let result = "";
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

export async function createSimulado(data: {
  tempoPorQuestao: number;
  apostilaName?: string;
  topics?: string;
  difficulty?: string;
  questions: {
    enunciado: string;
    alternativas: string[];
    correta: number;
    justificativa: string;
  }[];
}) {
  const user = await getUser();
  if (!user || user.role !== "INSTRUCTOR") {
    return { error: "Não autorizado." };
  }

  // Gera um código de sala único
  let codigoSala = generateCode();
  let codeExists = await prisma.simulado.findUnique({ where: { codigoSala } });
  while (codeExists) {
    codigoSala = generateCode();
    codeExists = await prisma.simulado.findUnique({ where: { codigoSala } });
  }

  // Salva no banco de dados
  try {
    const simulado = await prisma.simulado.create({
      data: {
        codigoSala,
        instructorId: user.userId,
        status: "WAITING",
        apostilaName: data.apostilaName,
        topics: data.topics,
        difficulty: data.difficulty || "AVANCADO",
        questions: {
          create: data.questions.map((q) => ({
            enunciado: q.enunciado,
            alternativas: JSON.stringify(q.alternativas),
            correta: q.correta,
            justificativa: q.justificativa,
            tempoLimite: data.tempoPorQuestao,
            status: "PENDING"
          }))
        }
      }
    });

    return { success: true, simuladoId: simulado.id, codigoSala };
  } catch (error: any) {
    console.error("Erro ao salvar simulado:", error);
    return { error: "Falha ao salvar simulado no banco de dados." };
  }
}

export async function endSimulado(simuladoId: string) {
  const user = await getUser();
  if (!user || user.role !== "INSTRUCTOR") {
    return { error: "Não autorizado." };
  }

  try {
    await prisma.simulado.update({
      where: { id: simuladoId, instructorId: user.userId },
      data: { status: "FINISHED" }
    });
    
    // Anula todas as questões ativas ou pendentes
    await prisma.question.updateMany({
      where: { simuladoId: simuladoId, status: { not: "FINISHED" } },
      data: { status: "CANCELLED" }
    });

    revalidatePath("/instructor");
    return { success: true };
  } catch (error: any) {
    console.error("Erro ao encerrar simulado:", error);
    return { error: "Falha ao encerrar simulado." };
  }
}

export async function deleteSimulado(simuladoId: string) {
  const user = await getUser();
  if (!user || user.role !== "INSTRUCTOR") {
    return { error: "Não autorizado." };
  }

  try {
    const simulado = await prisma.simulado.findUnique({ where: { id: simuladoId } });
    if (!simulado || simulado.instructorId !== user.userId) {
      return { error: "Simulado não encontrado." };
    }

    // Deleta em cascata manualmente para SQLite
    await prisma.answer.deleteMany({
      where: { question: { simuladoId } }
    });
    
    await prisma.question.deleteMany({
      where: { simuladoId }
    });
    
    await prisma.simulado.delete({
      where: { id: simuladoId }
    });

    revalidatePath("/instructor");
    return { success: true };
  } catch (error: any) {
    console.error("Erro ao deletar simulado:", error);
    return { error: "Falha ao deletar simulado." };
  }
}
