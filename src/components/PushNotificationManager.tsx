"use client";

import { useEffect } from "react";
import { isPushSupported, registerAndSubscribePush } from "@/lib/pushClient";

// Registra o Service Worker e, se o navegador suportar e a permissão ainda não tiver
// sido decidida, pede pro aluno ativar notificações automaticamente — usado pros
// avisos de "sequência prestes a acabar" e "convite de duelo recebido". Em
// navegadores que exigem gesto do usuário pra esse prompt (Safari), essa tentativa
// automática pode não surtir efeito — nesse caso o aluno ainda pode ativar pelo
// botão manual em NotificationOptInCard.
export default function PushNotificationManager() {
  useEffect(() => {
    if (!isPushSupported()) return;

    let cancelled = false;
    (async () => {
      if (cancelled) return;
      await registerAndSubscribePush();
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return null;
}
