"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { ChoqueSkullIcon } from "@/components/PatentIcons";

const SEEN_KEY = "puma_choque_unlock_seen";

export function ChoqueUnlockToast({ unlocked }: { unlocked: boolean }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!unlocked) return;
    try {
      if (window.localStorage.getItem(SEEN_KEY) === "1") return;
      window.localStorage.setItem(SEEN_KEY, "1");
    } catch {
      // localStorage indisponível (modo privado, etc.) — mostra mesmo assim, sem persistir
    }

    setVisible(true);
    const timer = setTimeout(() => setVisible(false), 7000);
    return () => clearTimeout(timer);
  }, [unlocked]);

  if (!visible) return null;

  return (
    <div className="fixed top-20 right-4 z-[9998] w-[90vw] max-w-sm">
      <div className="flex items-center gap-4 rounded-xl border-2 border-[#b91c1c] bg-card p-4 shadow-[0_0_30px_rgba(185,28,28,0.4)] animate-in slide-in-from-right-8 fade-in duration-500">
        <div className="relative w-12 h-12 shrink-0 rounded-full overflow-hidden border border-[#b91c1c] bg-black flex items-center justify-center">
          <ChoqueSkullIcon className="w-7 h-7 text-red-600" />
        </div>
        <div className="min-w-0">
          <p className="text-xs font-black text-[#b91c1c] uppercase tracking-widest mb-1">Fardamento Desbloqueado!</p>
          <p className="text-heading font-bold text-lg leading-tight">Tema CHOQUE 💀</p>
          <p className="text-muted-foreground text-xs mt-1">50 dias de sequência. Novo tema tático disponível.</p>
        </div>
        <button
          onClick={() => setVisible(false)}
          className="text-muted-foreground hover:text-foreground shrink-0"
          title="Fechar"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
