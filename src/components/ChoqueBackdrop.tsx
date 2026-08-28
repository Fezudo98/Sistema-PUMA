"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";

// Faixa decorativa fixa no rodapé da tela: skyline urbano sitiado, facho de holofote
// de vigia, concertina no horizonte, uma faixa de camuflado digital (a mesma paleta
// preto/cinza/branco das viaturas do Choque) na base e o emblema oficial do Choque
// como marca d'água — só visível no tema CHOQUE e em opacidade baixa pra não
// atrapalhar leitura.
export function ChoqueBackdrop() {
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
      className="fixed inset-x-0 bottom-0 h-32 sm:h-52 pointer-events-none z-0 overflow-hidden"
    >
      <svg viewBox="0 0 1200 200" preserveAspectRatio="none" className="w-full h-full opacity-[0.1]">
        <defs>
          <linearGradient id="choqueBeam" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#ececec" stopOpacity="0.55" />
            <stop offset="100%" stopColor="#ececec" stopOpacity="0" />
          </linearGradient>
          <pattern id="choqueBackdropCamo" width="32" height="32" patternUnits="userSpaceOnUse">
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

        {/* Faixa de camuflado digital na base, como o rodapé camuflado das viaturas */}
        <rect x="0" y="176" width="1200" height="24" fill="url(#choqueBackdropCamo)" />

        {/* Facho de holofote de vigia */}
        <polygon points="1130,0 930,200 1200,200 1200,30" fill="url(#choqueBeam)" />

        {/* Skyline urbano */}
        <g fill="#4a4a4a">
          <rect x="0" y="140" width="70" height="60" />
          <rect x="76" y="112" width="50" height="88" />
          <rect x="132" y="156" width="92" height="44" />
          <rect x="230" y="96" width="46" height="104" />
          <rect x="282" y="132" width="108" height="68" />
          <rect x="400" y="172" width="60" height="28" />
          <rect x="620" y="168" width="70" height="32" />
          <rect x="702" y="118" width="60" height="82" />
          <rect x="768" y="150" width="82" height="50" />
          <rect x="856" y="88" width="50" height="112" />
          <rect x="912" y="134" width="102" height="66" />
          <rect x="1020" y="150" width="90" height="50" />
        </g>

        {/* Luzes de janelas acesas */}
        <g fill="#dc2626">
          <rect x="15" y="156" width="4" height="6" />
          <rect x="97" y="132" width="4" height="6" />
          <rect x="242" y="116" width="4" height="6" />
          <rect x="722" y="140" width="4" height="6" />
          <rect x="872" y="112" width="4" height="6" />
          <rect x="1040" y="164" width="4" height="6" />
        </g>

        {/* Concertina (arame farpado) isolando o quarteirão */}
        <line x1="380" y1="96" x2="700" y2="96" stroke="#a1a1aa" strokeWidth="1.2" />
        <path
          stroke="#a1a1aa"
          strokeWidth="1"
          fill="none"
          d="M395,91 L405,101 M395,101 L405,91
             M427,91 L437,101 M427,101 L437,91
             M459,91 L469,101 M459,101 L469,91
             M491,91 L501,101 M491,101 L501,91
             M523,91 L533,101 M523,101 L533,91
             M555,91 L565,101 M555,101 L565,91
             M587,91 L597,101 M587,101 L597,91
             M619,91 L629,101 M619,101 L629,91
             M651,91 L661,101 M651,101 L661,91
             M683,91 L693,101 M683,101 L693,91"
        />
      </svg>

      {/* Emblema oficial do Choque como marca d'água */}
      <img
        src="/badges/choque-emblem.png"
        alt=""
        className="absolute left-1/2 top-1 -translate-x-1/2 w-16 h-14 sm:w-24 sm:h-20 object-contain opacity-[0.12]"
      />
    </div>
  );
}
