"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { X } from "lucide-react";

const SEEN_KEY = "puma_bepi_unlock_seen";

export function BepiUnlockToast({ unlocked }: { unlocked: boolean }) {
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
      <div className="flex items-center gap-4 rounded-xl border-2 border-[#c9a227] bg-card p-4 shadow-[0_0_30px_rgba(201,162,39,0.4)] animate-in slide-in-from-right-8 fade-in duration-500">
        <div className="relative w-12 h-12 shrink-0 rounded-full overflow-hidden border border-[#c9a227]">
          <Image src="/bepi-logo.jpg" alt="BEPI" fill className="object-cover" />
        </div>
        <div className="min-w-0">
          <p className="text-xs font-black text-[#c9a227] uppercase tracking-widest mb-1">Fardamento Desbloqueado!</p>
          <p className="text-heading font-bold text-lg leading-tight">Tema BEPI 🦅</p>
          <p className="text-muted-foreground text-xs mt-1">35 dias de sequência. Novo tema tático disponível.</p>
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
