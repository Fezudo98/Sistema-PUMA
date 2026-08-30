"use client";

import { useEffect, useState } from "react";
import { Megaphone, RotateCw } from "lucide-react";
import { getAnnouncementAction } from "@/app/actions/announcement";

const POLL_INTERVAL_MS = 15000;
const SEEN_ID_KEY = "puma_announcement_seen_id";

// Modal de aviso de visualização única — genérico, reaproveitável pra qualquer
// comunicado pontual do instrutor (não só o motivo que originou este componente).
// Diferente do MaintenanceWarningBanner (persistente, some sozinho quando o aviso é
// desativado), este é bloqueante e cada aluno só vê UMA VEZ por publicação: fechar
// marca aquele id como visto no localStorage, e só reaparece se o instrutor publicar
// um aviso novo (id novo).
export function AnnouncementModal() {
  const [state, setState] = useState<{ enabled: boolean; message: string; id: string }>({
    enabled: false,
    message: "",
    id: ""
  });
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const check = async () => {
      try {
        const res = await getAnnouncementAction();
        if (cancelled) return;
        setState(res);

        if (!res.enabled || !res.message || !res.id) {
          setVisible(false);
          return;
        }

        try {
          const seenId = window.localStorage.getItem(SEEN_ID_KEY);
          setVisible(seenId !== res.id);
        } catch {
          setVisible(true);
        }
      } catch {
        // Falha de rede/servidor: não interrompe a navegação do aluno por causa disso.
      }
    };

    check();
    const interval = setInterval(check, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  const markSeen = () => {
    try {
      window.localStorage.setItem(SEEN_ID_KEY, state.id);
    } catch {
      // localStorage indisponível — o modal pode reaparecer nessa aba, mas não trava nada.
    }
  };

  const handleClose = () => {
    markSeen();
    setVisible(false);
  };

  const handleReload = () => {
    markSeen();
    window.location.reload();
  };

  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="w-full max-w-md bg-card border border-blue-500/30 rounded-2xl shadow-[0_0_50px_rgba(59,130,246,0.15)] overflow-hidden">
        <div className="h-1 bg-gradient-to-r from-blue-600 via-blue-400 to-blue-600" />
        <div className="p-6 space-y-5">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-950/40 border border-blue-500/30 text-blue-400 rounded-xl shrink-0">
              <Megaphone className="w-5 h-5" />
            </div>
            <h2 className="text-sm font-black text-heading uppercase tracking-widest">
              Aviso do Instrutor
            </h2>
          </div>

          <p className="text-sm text-heading leading-relaxed whitespace-pre-wrap">
            {state.message}
          </p>

          <div className="flex flex-col sm:flex-row gap-2.5 pt-1">
            <button
              onClick={handleReload}
              className="flex-1 h-11 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs uppercase tracking-wider transition-all cursor-pointer flex items-center justify-center gap-2"
            >
              <RotateCw className="w-3.5 h-3.5" />
              Recarregar Página
            </button>
            <button
              onClick={handleClose}
              className="h-11 px-4 rounded-xl bg-background border border-border text-muted-foreground hover:text-heading font-bold text-xs uppercase tracking-wider transition-all cursor-pointer"
            >
              Fechar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
