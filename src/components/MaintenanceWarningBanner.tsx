"use client";

import { useEffect, useState, useRef } from "react";
import { Wrench, X } from "lucide-react";
import { getMaintenanceWarningAction } from "@/app/actions/maintenance";

const POLL_INTERVAL_MS = 15000;
const DISMISSED_KEY = "puma_maintenance_warning_dismissed";

// Faixa de aviso PRÉVIO de manutenção — aparece em qualquer página da área do aluno
// (montada em src/app/aluno/layout.tsx), diferente da tela de bloqueio de
// /manutencao (que só existe quando o acesso já foi cortado de verdade). Existe
// pra dar tempo do aluno terminar o que está fazendo e salvar o progresso antes.
export function MaintenanceWarningBanner() {
  const [state, setState] = useState<{ enabled: boolean; message: string }>({ enabled: false, message: "" });
  const [dismissed, setDismissed] = useState(false);
  const lastDismissedMessage = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const check = async () => {
      try {
        const res = await getMaintenanceWarningAction();
        if (cancelled) return;
        setState(res);

        // O "dismiss" vale só pra ESSA mensagem específica — se o instrutor mudar o
        // texto (ex.: atualizar o horário previsto), o aviso reaparece mesmo que o
        // aluno já tenha fechado a versão anterior.
        try {
          const stored = window.localStorage.getItem(DISMISSED_KEY);
          lastDismissedMessage.current = stored;
          setDismissed(stored === res.message && res.message !== "");
        } catch {
          setDismissed(false);
        }
      } catch {
        // Falha de rede/servidor: não derruba a página do aluno por causa disso,
        // só mantém o que já estava mostrando.
      }
    };

    check();
    const interval = setInterval(check, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  const handleDismiss = () => {
    setDismissed(true);
    try {
      window.localStorage.setItem(DISMISSED_KEY, state.message);
    } catch {
      // localStorage indisponível — some só pra essa aba/sessão
    }
  };

  if (!state.enabled || !state.message || dismissed) return null;

  return (
    <div className="sticky top-0 z-[9997] w-full bg-amber-950/90 backdrop-blur-sm border-b-2 border-amber-500/50 shadow-[0_2px_20px_rgba(245,158,11,0.15)]">
      <div className="max-w-6xl mx-auto px-4 py-3 flex items-center gap-3">
        <Wrench className="w-5 h-5 text-amber-400 shrink-0 animate-pulse" />
        <p className="flex-1 text-xs sm:text-sm font-bold text-amber-100 leading-snug">
          <span className="uppercase tracking-widest text-amber-400 mr-2">Aviso:</span>
          {state.message}
        </p>
        <button
          onClick={handleDismiss}
          className="text-amber-400/70 hover:text-amber-200 shrink-0 p-1 -m-1"
          title="Dispensar aviso"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
