"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { randomUUID } from "crypto";
import { getUser } from "./auth";

// Aviso de visualização única (modal): diferente do banner de aviso prévio de
// manutenção (persistente, dispensável) e do MAINTENANCE_MODE (bloqueio total),
// isso é pra comunicados pontuais que cada aluno só precisa ver UMA vez — ex.:
// "recarregue a página", "prova remarcada". Cada publicação gera um ANNOUNCEMENT_ID
// novo; o cliente guarda no localStorage o último id já visto e só reexibe o modal
// quando o id mudar, então republicar o mesmo texto (ou um texto diferente) sempre
// aparece de novo pra todo mundo, mas fechar o modal uma vez nunca mais reaparece
// aquele mesmo aviso.
//
// Suporta agendamento (ANNOUNCEMENT_SCHEDULED_FOR, epoch ms): o aviso pode ser
// publicado desde já mas só passar a aparecer pros alunos a partir de um horário
// futuro. Não depende de nenhum cron/job rodando naquele exato instante — como o
// modal já faz polling a cada 15s, o gate por horário é reavaliado a cada consulta,
// então o aviso "liga sozinho" assim que o relógio do servidor passar do horário
// marcado, mesmo sem ninguém tocar em nada nesse momento.
export async function getAnnouncementAction() {
  try {
    const [enabledSetting, messageSetting, idSetting, scheduledForSetting] = await Promise.all([
      prisma.systemSetting.findUnique({ where: { key: "ANNOUNCEMENT_ENABLED" } }),
      prisma.systemSetting.findUnique({ where: { key: "ANNOUNCEMENT_MESSAGE" } }),
      prisma.systemSetting.findUnique({ where: { key: "ANNOUNCEMENT_ID" } }),
      prisma.systemSetting.findUnique({ where: { key: "ANNOUNCEMENT_SCHEDULED_FOR" } }),
    ]);

    const enabled = enabledSetting?.value === "true";
    const scheduledForMs = scheduledForSetting?.value ? parseInt(scheduledForSetting.value, 10) : null;
    const isScheduledForFuture = !!scheduledForMs && Date.now() < scheduledForMs;

    return {
      enabled: enabled && !isScheduledForFuture,
      message: messageSetting?.value || "",
      id: idSetting?.value || ""
    };
  } catch (error) {
    console.error("[ANNOUNCEMENT CHECK ERROR]:", error);
    return { enabled: false, message: "", id: "" };
  }
}

export async function publishAnnouncementAction(message: string, scheduledForMs?: number | null) {
  const user = await getUser();
  if (!user || user.role !== "INSTRUCTOR") {
    return { error: "Não autorizado. Apenas instrutores podem publicar avisos." };
  }

  const trimmedMessage = message.trim();
  if (!trimmedMessage) {
    return { error: "Escreva uma mensagem antes de publicar." };
  }

  if (scheduledForMs && scheduledForMs <= Date.now()) {
    return { error: "O horário agendado precisa ser no futuro. Deixe em branco pra publicar imediatamente." };
  }

  const newId = randomUUID();

  try {
    await Promise.all([
      prisma.systemSetting.upsert({
        where: { key: "ANNOUNCEMENT_ENABLED" },
        update: { value: "true" },
        create: { key: "ANNOUNCEMENT_ENABLED", value: "true" }
      }),
      prisma.systemSetting.upsert({
        where: { key: "ANNOUNCEMENT_MESSAGE" },
        update: { value: trimmedMessage },
        create: { key: "ANNOUNCEMENT_MESSAGE", value: trimmedMessage }
      }),
      prisma.systemSetting.upsert({
        where: { key: "ANNOUNCEMENT_ID" },
        update: { value: newId },
        create: { key: "ANNOUNCEMENT_ID", value: newId }
      }),
      prisma.systemSetting.upsert({
        where: { key: "ANNOUNCEMENT_SCHEDULED_FOR" },
        update: { value: scheduledForMs ? String(scheduledForMs) : "" },
        create: { key: "ANNOUNCEMENT_SCHEDULED_FOR", value: scheduledForMs ? String(scheduledForMs) : "" }
      }),
    ]);

    revalidatePath("/instructor");
    return { success: true, message: trimmedMessage, id: newId };
  } catch (error: any) {
    console.error("[ANNOUNCEMENT PUBLISH ERROR]:", error);
    return { error: error.message || "Erro ao publicar aviso." };
  }
}

// Retira o aviso antes que todo mundo tenha visto (ex.: publicou por engano). Não
// apaga a mensagem/id — só marca como não-ativo, então o modal para de aparecer pra
// quem ainda não viu, mas quem já viu continua com o dismiss normal.
export async function clearAnnouncementAction() {
  const user = await getUser();
  if (!user || user.role !== "INSTRUCTOR") {
    return { error: "Não autorizado. Apenas instrutores podem retirar avisos." };
  }

  try {
    await prisma.systemSetting.upsert({
      where: { key: "ANNOUNCEMENT_ENABLED" },
      update: { value: "false" },
      create: { key: "ANNOUNCEMENT_ENABLED", value: "false" }
    });

    revalidatePath("/instructor");
    return { success: true };
  } catch (error: any) {
    console.error("[ANNOUNCEMENT CLEAR ERROR]:", error);
    return { error: error.message || "Erro ao retirar aviso." };
  }
}
