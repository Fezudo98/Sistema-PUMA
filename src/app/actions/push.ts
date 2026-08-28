"use server";

import { prisma } from "@/lib/prisma";
import { getUser } from "./auth";

export async function savePushSubscriptionAction(subscription: {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}, userAgent?: string) {
  const user = await getUser();
  if (!user) {
    return { success: false, error: "Não autenticado." };
  }

  if (!subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) {
    return { success: false, error: "Inscrição inválida." };
  }

  try {
    await prisma.pushSubscription.upsert({
      where: { endpoint: subscription.endpoint },
      create: {
        userId: user.userId,
        endpoint: subscription.endpoint,
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth,
        userAgent: userAgent || null
      },
      update: {
        userId: user.userId,
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth,
        userAgent: userAgent || null
      }
    });
    return { success: true };
  } catch (error) {
    console.error("Error saving push subscription:", error);
    return { success: false, error: "Erro ao salvar a inscrição de notificações." };
  }
}

export async function deletePushSubscriptionAction(endpoint: string) {
  const user = await getUser();
  if (!user) {
    return { success: false, error: "Não autenticado." };
  }

  try {
    await prisma.pushSubscription.deleteMany({ where: { endpoint, userId: user.userId } });
    return { success: true };
  } catch (error) {
    console.error("Error deleting push subscription:", error);
    return { success: false, error: "Erro ao remover a inscrição." };
  }
}
