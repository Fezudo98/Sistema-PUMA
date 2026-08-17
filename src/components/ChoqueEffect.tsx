"use client";

import { useEffect, useState, useRef } from "react";
import { useTheme } from "next-themes";
import { ChoqueSkullIcon } from "@/components/PatentIcons";

function StaticNoiseCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let width = window.innerWidth;
    let height = window.innerHeight;
    canvas.width = width;
    canvas.height = height;

    let animationFrame: number;

    const drawStatic = () => {
      const imageData = ctx.createImageData(width, height);
      const buffer = imageData.data;
      for (let i = 0; i < buffer.length; i += 4) {
        const shade = Math.random() * 255;
        buffer[i] = shade;
        buffer[i + 1] = shade;
        buffer[i + 2] = shade;
        buffer[i + 3] = Math.random() * 40; // baixa opacidade, granulado sutil
      }
      ctx.putImageData(imageData, 0, 0);
      animationFrame = requestAnimationFrame(drawStatic);
    };

    animationFrame = requestAnimationFrame(drawStatic);

    const handleResize = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = width;
      canvas.height = height;
    };

    window.addEventListener("resize", handleResize);

    return () => {
      cancelAnimationFrame(animationFrame);
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  return <canvas ref={canvasRef} className="absolute inset-0 pointer-events-none z-0 mix-blend-overlay" />;
}

// Estrondo tático de "carga de choque" sintetizado via Web Audio API — sem depender de asset externo.
function playTacticalImpact() {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    const ctx = new AudioContextClass();
    const now = ctx.currentTime;

    // Estouro seco (impacto/estilhaço)
    const burstDuration = 0.18;
    const noiseBuffer = ctx.createBuffer(1, ctx.sampleRate * burstDuration, ctx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / data.length, 2);
    }
    const noise = ctx.createBufferSource();
    noise.buffer = noiseBuffer;
    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.5, now);
    noise.connect(noiseGain).connect(ctx.destination);
    noise.start(now);

    // Thump grave (impacto de baixa frequência)
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(140, now);
    osc.frequency.exponentialRampToValueAtTime(40, now + 0.25);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.5, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.3);
    osc.connect(gain).connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.32);

    setTimeout(() => ctx.close(), 700);
  } catch {
    // Autoplay bloqueado pelo navegador ou Web Audio indisponível: segue só com o efeito visual
  }
}

export function ChoqueEffect() {
  const { theme, resolvedTheme } = useTheme();
  const [isFlashing, setIsFlashing] = useState(false);
  const prevTheme = useRef<string | undefined>("light");

  useEffect(() => {
    const currentTheme = theme === "system" ? resolvedTheme : theme;

    if (currentTheme === "choque" && prevTheme.current && prevTheme.current !== "choque") {
      setIsFlashing(true);
      playTacticalImpact();

      const timer = setTimeout(() => {
        setIsFlashing(false);
      }, 1500);

      return () => clearTimeout(timer);
    }

    if (currentTheme) {
      prevTheme.current = currentTheme;
    }
  }, [theme, resolvedTheme]);

  if (!isFlashing) return null;

  return (
    <div className="fixed inset-0 pointer-events-none z-[99999] overflow-hidden flex items-center justify-center bg-black/70">
      <StaticNoiseCanvas />

      {/* Strobe vermelho de alerta */}
      <div className="absolute inset-0 bg-red-600 animate-[flash_0.6s_ease-out_forwards]" style={{ mixBlendMode: "overlay" }} />
      <div className="absolute inset-0 bg-white animate-[flash_0.3s_ease-out_forwards]" style={{ mixBlendMode: "overlay" }} />

      {/* Caveira do Choque em impacto */}
      <div className="relative z-10 w-[260px] h-[260px] text-red-600 drop-shadow-[0_0_90px_rgba(185,28,28,0.9)] animate-[strike_0.8s_ease-in-out_forwards]">
        <ChoqueSkullIcon className="w-full h-full" />
      </div>
    </div>
  );
}
