"use server";

import { PrismaClient } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { getUser } from "./auth";

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
