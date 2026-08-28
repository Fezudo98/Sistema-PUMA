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
      className="fixed top-0 inset-x-0 h-[10px] sm:h-[14px] z-[60] pointer-events-none shadow-[0_1px_8px_rgba(0,0,0,0.6)]"
    >
      <svg width="100%" height="100%" preserveAspectRatio="none" className="block w-full h-full">
        <defs>
          <pattern id="choqueCamoTile" width="32" height="32" patternUnits="userSpaceOnUse">
            <rect width="32" height="32" fill="#0a0a0a" />
            <rect x="0" y="0" width="8" height="8" fill="#3a3a3a" />
            <rect x="16" y="0" width="8" height="8" fill="#6b6b6b" />
            <rect x="8" y="8" width="16" height="8" fill="#a8a8a8" />
            <rect x="0" y="16" width="16" height="8" fill="#3a3a3a" />
            <rect x="24" y="16" width="8" height="8" fill="#6b6b6b" />
            <rect x="0" y="24" width="8" height="8" fill="#6b6b6b" />
            <rect x="16" y="24" width="16" height="8" fill="#3a3a3a" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#choqueCamoTile)" />
      </svg>
    </div>
  );
}
