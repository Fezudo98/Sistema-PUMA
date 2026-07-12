"use server";

import { PrismaClient } from "@prisma/client";
import { getUser } from "./auth";
import { revalidatePath } from "next/cache";
import { promises as fs } from "fs";
import path from "path";

const prisma = new PrismaClient();

export async function toggleApostilaStatus(id: string, currentStatus: boolean) {
  const user = await getUser();
  if (!user || user.role !== "INSTRUCTOR") {
    return { error: "Não autorizado." };
  }

  try {
    const updated = await prisma.apostila.update({
      where: { id },
      data: { isActive: !currentStatus }
    });

    revalidatePath("/instructor");
    return { success: true, isActive: updated.isActive };
  } catch (error: any) {
    console.error("Erro ao alterar status da apostila:", error);
    return { error: "Erro ao atualizar o status." };
  }
}

export async function deleteApostila(id: string) {
  const user = await getUser();
  if (!user || user.role !== "INSTRUCTOR") {
    return { error: "Não autorizado." };
  }

  try {
    const apostila = await prisma.apostila.findUnique({
      where: { id }
    });

    if (!apostila) {
      return { error: "Apostila não encontrada." };
    }

    // 1. Buscar todos os simulados diários gerados a partir desta apostila
    const dailySimulados = await prisma.simulado.findMany({
      where: {
        tipo: "DAILY",
        apostilaName: apostila.title
      },
      select: { id: true }
    });

    const dailySimuladoIds = dailySimulados.map(s => s.id);

    // 2. Deletar os simulados diários antigos e dependências em cascata manual (SQLite)
    if (dailySimuladoIds.length > 0) {
      await prisma.answer.deleteMany({
        where: {
          question: {
            simuladoId: { in: dailySimuladoIds }
          }
        }
      });

      await prisma.question.deleteMany({
        where: {
          simuladoId: { in: dailySimuladoIds }
        }
      });

      await prisma.simulado.deleteMany({
        where: {
          id: { in: dailySimuladoIds }
        }
      });
    }

    // Apaga o arquivo físico da pasta public
    if (apostila.filePath) {
      const fullPath = path.join(process.cwd(), "public", apostila.filePath);
      try {
        await fs.unlink(fullPath);
      } catch (err: any) {
        console.warn(`Arquivo físico não encontrado ou indisponível para exclusão: ${fullPath}`, err.message);
      }
    }

    // Apaga o registro do banco da apostila
    await prisma.apostila.delete({
      where: { id }
    });

    revalidatePath("/instructor");
    revalidatePath("/aluno/painel");
    return { success: true };
  } catch (error: any) {
    console.error("Erro ao deletar apostila:", error);
    return { error: "Erro ao excluir apostila do banco de dados." };
  }
}
