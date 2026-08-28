import webpush from "web-push";
import { prisma } from "./prisma";

let configured = false;
function ensureConfigured() {
  if (configured) return true;
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) {
    console.warn("[Push] VAPID_PUBLIC_KEY/VAPID_PRIVATE_KEY não configuradas — notificações push desativadas.");
    return false;
  }
  webpush.setVapidDetails("mailto:contato@sistemapuma32pel.com.br", publicKey, privateKey);
  configured = true;
  return true;
}

export type PushPayload = {
  title: string;
  body: string;
  url?: string;
  tag?: string;
};

// Manda uma notificação push pra todos os dispositivos inscritos de um usuário.
// Nunca lança erro pro chamador — falha de push nunca deve derrubar a ação principal
// (ex.: criar um desafio de duelo não pode falhar por causa de notificação).
export async function sendPushToUser(userId: string, payload: PushPayload) {
  if (!ensureConfigured()) return;

  try {
    const subscriptions = await prisma.pushSubscription.findMany({ where: { userId } });
    if (subscriptions.length === 0) return;

    const body = JSON.stringify(payload);

    await Promise.all(
      subscriptions.map(async (sub) => {
        try {
          await webpush.sendNotification(
            { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
            body
          );
        } catch (err: any) {
          // 404/410 = inscrição expirada ou o navegador cancelou — limpa do banco.
          if (err?.statusCode === 404 || err?.statusCode === 410) {
            await prisma.pushSubscription.delete({ where: { id: sub.id } }).catch(() => {});
          } else {
            console.error("[Push] Erro ao enviar notificação:", err?.statusCode, err?.body || err?.message);
          }
        }
      })
    );
  } catch (err) {
    console.error("[Push] Erro geral ao enviar notificações:", err);
  }
}
