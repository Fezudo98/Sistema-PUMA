"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";

// Faixa decorativa fixa no rodapé da tela: sol baixo no horizonte + silhuetas de
// mandacarus, só visível no tema BEPI e em opacidade bem baixa pra não atrapalhar leitura.
export function SertaoBackdrop() {
  const { theme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  const currentTheme = theme === "system" ? resolvedTheme : theme;
  if (currentTheme !== "bepi") return null;

  return (
    <div
      aria-hidden="true"
      className="fixed inset-x-0 bottom-0 h-28 sm:h-44 pointer-events-none z-0 opacity-[0.08]"
    >
      <svg viewBox="0 0 1200 200" preserveAspectRatio="none" className="w-full h-full">
        {/* Sol baixo no horizonte */}
        <circle cx="1000" cy="70" r="55" fill="#c9a227" />

        {/* Linha do horizonte / solo */}
        <path d="M0 170 L1200 170 L1200 200 L0 200 Z" fill="#b3703c" />

        {/* Mandacarus (cactos colunares da caatinga) */}
        <g fill="#4b5320">
          <rect x="94" y="120" width="12" height="50" rx="5" />
          <rect x="114" y="90" width="14" height="90" rx="6" />
          <rect x="136" y="110" width="12" height="60" rx="5" />

          <rect x="404" y="115" width="12" height="65" rx="5" />

          <rect x="818" y="130" width="12" height="45" rx="5" />
          <rect x="838" y="100" width="16" height="80" rx="6" />
          <rect x="862" y="118" width="12" height="55" rx="5" />
        </g>
      </svg>
    </div>
  );
}
