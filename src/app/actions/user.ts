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

