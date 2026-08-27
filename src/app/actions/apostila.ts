"use server";

import { prisma } from "@/lib/prisma";
import { getUser } from "./auth";
import { revalidatePath } from "next/cache";
import { promises as fs } from "fs";
import path from "path";
import { syncBlocoDeProvaForApostila } from "./blocoProva";

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

export async function toggleApostilaProvaStatus(id: string, currentStatus: boolean) {
  const user = await getUser();
  if (!user || user.role !== "INSTRUCTOR") {
    return { error: "Não autorizado." };
  }

  try {
    const updated = await prisma.apostila.update({
      where: { id },
      data: { isProvaSubject: !currentStatus }
    });

    // Ao ligar o modo prova, monta o bloco imediatamente para não depender do próximo cron.
    if (updated.isProvaSubject) {
      await syncBlocoDeProvaForApostila(updated);
    }

    revalidatePath("/instructor");
    revalidatePath("/aluno/painel");
    return { success: true, isProvaSubject: updated.isProvaSubject };
  } catch (error: any) {
    console.error("Erro ao alterar status de matéria de prova:", error);
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

    // Os simulados diários e o Bloco de Provas já gerados a partir desta apostila são
    // preservados: excluir o material da biblioteca não deve apagar o histórico de
    // questões/respostas que os alunos já resolveram. Só o registro da apostila (e o
    // arquivo físico) some — o que impede novas gerações futuras a partir dela.

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
