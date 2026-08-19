"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";

// Faixa fina fixa no topo da tela com o camuflado digital urbano (preto/cinza/branco)
// usado nas viaturas do Choque — só visível no tema CHOQUE. Reforça a identidade
// "tropa de choque" sem ocupar espaço de conteúdo (é sobreposta, pointer-events-none).
export function ChoqueCamoBar() {
  const { theme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  const currentTheme = theme === "system" ? resolvedTheme : theme;
  if (currentTheme !== "choque") return null;

  return (
    <div
      aria-hidden="true"
      className="fixed top-0 inset-x-0 h-[7px] sm:h-[9px] z-[60] pointer-events-none shadow-[0_1px_8px_rgba(0,0,0,0.6)]"
    >
      <svg width="100%" height="100%" preserveAspectRatio="none" className="block w-full h-full">
        <defs>
          <pattern id="choqueCamoTile" width="28" height="9" patternUnits="userSpaceOnUse">
            <rect width="28" height="9" fill="#0c0c0d" />
            <polygon points="0,0 9,0 6,9 0,7" fill="#d4d4d8" />
            <polygon points="9,0 17,0 20,9 12,9" fill="#52525b" />
            <polygon points="17,0 22,0 28,3 28,9 22,9" fill="#d4d4d8" />
            <polygon points="0,7 6,9 4,9 0,9" fill="#52525b" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#choqueCamoTile)" />
      </svg>
    </div>
  );
}
