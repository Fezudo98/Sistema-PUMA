"use client";

import { useEffect } from "react";
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

// Registra o Service Worker e, se o navegador suportar e a permissão ainda não tiver
// sido decidida, pede pro aluno ativar notificações automaticamente — usado pros
// avisos de "sequência prestes a acabar" e "convite de duelo recebido".
export default function PushNotificationManager() {
  useEffect(() => {
    const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    if (!publicKey) return;
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;

    let cancelled = false;

    (async () => {
      try {
        const registration = await navigator.serviceWorker.register("/sw.js");

        if (Notification.permission === "denied") return;

        const existing = await registration.pushManager.getSubscription();
        if (existing) {
          // Já inscrito nesse navegador — garante que o servidor ainda tem o registro
          // (ex.: reinstalação do banco), sem custo de pedir permissão de novo.
          savePushSubscriptionAction(existing.toJSON() as any, navigator.userAgent).catch(() => {});
          return;
        }

        if (Notification.permission === "default") {
          const permission = await Notification.requestPermission();
          if (permission !== "granted" || cancelled) return;
        }

        if (Notification.permission !== "granted") return;

        const subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(publicKey)
        });

        await savePushSubscriptionAction(subscription.toJSON() as any, navigator.userAgent);
      } catch (err) {
        console.warn("Não foi possível ativar notificações push:", err);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return null;
}
