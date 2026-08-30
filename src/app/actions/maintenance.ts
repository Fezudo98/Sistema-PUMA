"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { getUser } from "./auth";

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

    // Ativar a manutenção de verdade já bloqueia o acesso — o aviso prévio perde o
    // sentido nesse momento (o aluno vai ver a tela de manutenção, não mais o banner
    // de aviso). Desliga sozinho pra não sobrar um aviso preso pra próxima vez.
    if (enabled) {
      await prisma.systemSetting.upsert({
        where: { key: "MAINTENANCE_WARNING" },
        update: { value: "false" },
        create: { key: "MAINTENANCE_WARNING", value: "false" }
      });
    }

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

// Aviso PRÉVIO de manutenção: diferente de toggleMaintenanceAction (que bloqueia o
// acesso na hora), isso só mostra uma faixa de aviso pro aluno em qualquer página da
// área dele — pra ele terminar o que está fazendo e salvar o progresso antes da
// manutenção de verdade começar.
export async function getMaintenanceWarningAction() {
  try {
    const [warningSetting, messageSetting] = await Promise.all([
      prisma.systemSetting.findUnique({ where: { key: "MAINTENANCE_WARNING" } }),
      prisma.systemSetting.findUnique({ where: { key: "MAINTENANCE_WARNING_MESSAGE" } })
    ]);
    return {
      enabled: warningSetting?.value === "true",
      message: messageSetting?.value || ""
    };
  } catch (error) {
    console.error("[MAINTENANCE WARNING CHECK ERROR]:", error);
    return { enabled: false, message: "" };
  }
}

export async function toggleMaintenanceWarningAction(enabled: boolean, message: string) {
  const user = await getUser();
  if (!user || user.role !== "INSTRUCTOR") {
    return { error: "Não autorizado. Apenas instrutores podem ativar ou desativar o aviso de manutenção." };
  }

  const trimmedMessage = message.trim();
  if (enabled && !trimmedMessage) {
    return { error: "Escreva uma mensagem de aviso antes de ativar." };
  }

  try {
    await prisma.systemSetting.upsert({
      where: { key: "MAINTENANCE_WARNING" },
      update: { value: enabled ? "true" : "false" },
      create: { key: "MAINTENANCE_WARNING", value: enabled ? "true" : "false" }
    });
    await prisma.systemSetting.upsert({
      where: { key: "MAINTENANCE_WARNING_MESSAGE" },
      update: { value: trimmedMessage },
      create: { key: "MAINTENANCE_WARNING_MESSAGE", value: trimmedMessage }
    });

    revalidatePath("/instructor");

    return { success: true, enabled, message: trimmedMessage };
  } catch (error: any) {
    console.error("[MAINTENANCE WARNING TOGGLE ERROR]:", error);
    return { error: error.message || "Erro ao alterar aviso de manutenção." };
  }
}
