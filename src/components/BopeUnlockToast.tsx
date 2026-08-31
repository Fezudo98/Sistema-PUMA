"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { BopeIcon } from "@/components/PatentIcons";

const SEEN_KEY = "puma_bope_unlock_seen";

export function BopeUnlockToast({ unlocked }: { unlocked: boolean }) {
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
      <div className="flex items-center gap-4 rounded-xl border-2 border-[#e5e5e5] bg-black p-4 shadow-[0_0_30px_rgba(229,229,229,0.35)] animate-in slide-in-from-right-8 fade-in duration-500">
        <div className="relative w-14 h-14 shrink-0 flex items-center justify-center rounded-full bg-[#141414] border border-[#e5e5e5]/60">
          <BopeIcon className="w-8 h-8 text-[#e5e5e5]" />
        </div>
        <div className="min-w-0">
          <p className="text-xs font-black text-[#e5e5e5] uppercase tracking-widest mb-1">Fardamento Desbloqueado!</p>
          <p className="text-heading font-bold text-lg leading-tight">Tema BOPE ☠️</p>
          <p className="text-muted-foreground text-xs mt-1">75 dias de sequência. Novo tema tático disponível.</p>
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
