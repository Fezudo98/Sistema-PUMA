"use server";

import { PrismaClient } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { getUser } from "./auth";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

export async function updateUserAvatar(avatarUrl: string) {
  const user = await getUser();
  if (!user) return { success: false, error: "Not authenticated" };

  try {
    await prisma.user.update({
      where: { id: user.userId },
      data: { avatarUrl }
    });

    revalidatePath("/aluno/painel");
    revalidatePath("/instructor/painel");
    
    return { success: true };
  } catch (error) {
    console.error("Error updating avatar:", error);
    return { success: false, error: "Failed to update avatar" };
  }
}

export async function resetStudentPassword(studentId: string, newPassword: string) {
  const user = await getUser();
  if (!user || user.role !== "INSTRUCTOR") {
    return { success: false, error: "Acesso negado. Apenas instrutores autorizados." };
  }

  if (!newPassword || newPassword.trim().length < 4) {
    return { success: false, error: "A senha deve conter no mínimo 4 caracteres." };
  }

  try {
    const student = await prisma.user.findFirst({
      where: { id: studentId, role: "STUDENT" }
    });

    if (!student) {
      return { success: false, error: "Combatente não encontrado." };
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    await prisma.user.update({
      where: { id: studentId },
      data: { senha: hashedPassword }
    });

    return { success: true };
  } catch (error) {
    console.error("Error resetting student password:", error);
    return { success: false, error: "Erro interno ao redefinir senha." };
  }
}

export async function updateUserName(name: string) {
  const user = await getUser();
  if (!user) return { success: false, error: "Não autenticado." };

  if (!name || name.trim().length < 2) {
    return { success: false, error: "O nome deve conter pelo menos 2 caracteres." };
  }

  try {
    await prisma.user.update({
      where: { id: user.userId },
      data: { name: name.trim() }
    });

    revalidatePath("/aluno/painel");
    revalidatePath("/instructor/painel");
    
    return { success: true };
  } catch (error) {
    console.error("Error updating user name:", error);
    return { success: false, error: "Erro ao atualizar o nome." };
  }
}

// Instructor: Get full chat audit log of a student
export async function getStudentChatAuditAction(studentId: string) {
  const user = await getUser();
  if (!user || user.role !== "INSTRUCTOR") {
    return { success: false, error: "Acesso negado. Apenas instrutores autorizados." };
  }

  try {
    const student = await prisma.user.findUnique({
      where: { id: studentId },
      select: {
        id: true,
        name: true,
        suspendedUntil: true
      }
    });

    if (!student) {
      return { success: false, error: "Combatente não encontrado." };
    }

    const messages = await prisma.chatMessage.findMany({
      where: { studentId },
      orderBy: { createdAt: "asc" }
    });

    return {
      success: true,
      student: {
        id: student.id,
        name: student.name,
        suspendedUntil: student.suspendedUntil ? student.suspendedUntil.toISOString() : null
      },
      messages: messages.map((m: any) => ({
        id: m.id,
        role: m.role,
        content: m.content,
        apostilaId: m.apostilaId,
        apostilaTitle: m.apostilaTitle || "Geral / Não identificado",
        createdAt: m.createdAt.toISOString()
      }))
    };
  } catch (error: any) {
    console.error("Error fetching student chat audit:", error);
    return { success: false, error: "Falha ao carregar histórico de conversas." };
  }
}

// Instructor: Apply or remove chat suspension for a student
export async function toggleStudentChatSuspensionAction(studentId: string, suspend: boolean, durationHours: number = 24) {
  const user = await getUser();
  if (!user || user.role !== "INSTRUCTOR") {
    return { success: false, error: "Acesso negado. Apenas instrutores autorizados." };
  }

  try {
    const suspendedUntil = suspend
      ? new Date(Date.now() + durationHours * 60 * 60 * 1000)
      : null;

    await prisma.user.update({
      where: { id: studentId },
      data: { suspendedUntil }
    });

    revalidatePath("/instructor");
    revalidatePath("/aluno/chat");

    return {
      success: true,
      suspendedUntil: suspendedUntil ? suspendedUntil.toISOString() : null
    };
  } catch (error: any) {
    console.error("Error toggling suspension:", error);
    return { success: false, error: "Falha ao atualizar suspensão do combatente." };
  }
}

