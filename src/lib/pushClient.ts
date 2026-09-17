import { savePushSubscriptionAction } from "@/app/actions/push";

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export function isPushSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "Notification" in window &&
    "serviceWorker" in navigator &&
    "PushManager" in window
  );
}

export type PushSetupResult = "unsupported" | "no-key" | "denied" | "granted" | "error";

// Registra o Service Worker e pede a permissão de notificação — precisa ser chamada
// a partir de um gesto do usuário (clique) em navegadores como o Safari, que ignoram
// silenciosamente Notification.requestPermission() disparada fora de um clique.
export async function registerAndSubscribePush(): Promise<PushSetupResult> {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!publicKey) return "no-key";
  if (!isPushSupported()) return "unsupported";

  try {
    const registration = await navigator.serviceWorker.register("/sw.js");

    if (Notification.permission === "default") {
      await Notification.requestPermission();
    }

    if (Notification.permission !== "granted") {
      return Notification.permission === "denied" ? "denied" : "error";
    }

    const existing = await registration.pushManager.getSubscription();
    const subscription =
      existing ||
      (await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey)
      }));

    await savePushSubscriptionAction(subscription.toJSON() as any, navigator.userAgent);
    return "granted";
  } catch (err) {
    console.warn("Não foi possível ativar notificações push:", err);
    return "error";
  }
}
