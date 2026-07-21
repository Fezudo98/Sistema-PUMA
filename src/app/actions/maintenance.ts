"use server";

import { PrismaClient } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { getUser } from "./auth";

const prisma = new PrismaClient();

export async function getMaintenanceStatusAction() {
  try {
    const setting = await prisma.systemSetting.findUnique({
      where: { key: "MAINTENANCE_MODE" }
    });
    return { enabled: setting?.value === "true" };
  } catch (error) {
    console.error("[MAINTENANCE CHECK ERROR]:", error);
    return { enabled: false };
  }
}

export async function toggleMaintenanceAction(enabled: boolean) {
  const user = await getUser();
  if (!user || user.role !== "INSTRUCTOR") {
    return { error: "Não autorizado. Apenas instrutores podem ativar ou desativar a manutenção do servidor." };
  }

  try {
    await prisma.systemSetting.upsert({
      where: { key: "MAINTENANCE_MODE" },
      update: { value: enabled ? "true" : "false" },
      create: { key: "MAINTENANCE_MODE", value: enabled ? "true" : "false" }
    });

    revalidatePath("/");
    revalidatePath("/aluno");
    revalidatePath("/aluno/painel");
    revalidatePath("/aluno/simulado/[id]", "page");
    revalidatePath("/instructor");
    revalidatePath("/manutencao");

    return { success: true, enabled };
  } catch (error: any) {
    console.error("[MAINTENANCE TOGGLE ERROR]:", error);
    return { error: error.message || "Erro ao alterar modo de manutenção." };
  }
}
