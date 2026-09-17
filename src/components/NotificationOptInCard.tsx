"use client";

import { useEffect, useState } from "react";
import { Bell, BellRing, BellOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { isPushSupported, registerAndSubscribePush } from "@/lib/pushClient";

// Complementa o PushNotificationManager (que tenta ativar automaticamente ao
// carregar o painel): dá ao aluno um botão pra pedir a permissão de novo a
// qualquer momento — necessário em navegadores que exigem um clique pra esse
// prompt (Safari) e útil pra quem simplesmente ignorou o prompt automático da
// primeira vez.
export function NotificationOptInCard() {
  const [supported, setSupported] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission | null>(null);
  const [requesting, setRequesting] = useState(false);

  useEffect(() => {
    const ok = isPushSupported();
    setSupported(ok);
    if (ok) setPermission(Notification.permission);
  }, []);

  const handleEnable = async () => {
    setRequesting(true);
    try {
      await registerAndSubscribePush();
    } finally {
      setPermission(Notification.permission);
      setRequesting(false);
    }
  };

  if (!supported) return null;
  if (permission === "granted") return null; // já ativado, nada a oferecer

  return (
    <div className="relative overflow-hidden rounded-2xl bg-card border border-border p-5 sm:p-6 shadow-lg">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="w-11 h-11 rounded-xl bg-amber-500/15 border border-amber-500/40 flex items-center justify-center shrink-0">
            {permission === "denied" ? (
              <BellOff className="w-5 h-5 text-amber-400" />
            ) : (
              <Bell className="w-5 h-5 text-amber-400" />
            )}
          </div>
          <div className="space-y-1">
            <h3 className="font-black text-heading uppercase tracking-wide text-sm">Ativar Notificações</h3>
            {permission === "denied" ? (
              <p className="text-xs text-muted-foreground leading-relaxed font-medium">
                As notificações estão bloqueadas nas configurações do seu navegador. Toque no ícone de cadeado/informações ao lado do endereço, permita "Notificações" e recarregue a página.
              </p>
            ) : (
              <p className="text-xs text-muted-foreground leading-relaxed font-medium">
                Receba avisos de sequência em risco e convites de duelo direto no seu aparelho.
              </p>
            )}
          </div>
        </div>

        {permission !== "denied" && (
          <Button
            onClick={handleEnable}
            disabled={requesting}
            className="w-full sm:w-auto h-11 px-6 bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs uppercase tracking-wider shrink-0 cursor-pointer flex items-center justify-center gap-2"
          >
            <BellRing className="w-4 h-4" />
            {requesting ? "Ativando..." : "Ativar Notificações"}
          </Button>
        )}
      </div>
    </div>
  );
}
