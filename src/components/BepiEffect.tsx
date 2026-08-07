"use client";

import { useEffect, useState, useRef } from "react";
import { useTheme } from "next-themes";
import Image from "next/image";

function DustStormCanvas() {
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

    const particles = Array.from({ length: 140 }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      len: Math.random() * 120 + 40,
      speed: Math.random() * 14 + 6,
      drift: Math.random() * 2 - 1,
      opacity: Math.random() * 0.5 + 0.15,
    }));

    let animationFrame: number;

    const animate = () => {
      ctx.clearRect(0, 0, width, height);
      particles.forEach((p) => {
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x - p.len, p.y + p.drift * p.len * 0.2);
        ctx.strokeStyle = `rgba(201, 162, 39, ${p.opacity})`;
        ctx.lineWidth = 1.5;
        ctx.stroke();

        p.x += p.speed;
        p.y += p.drift;
        if (p.x - p.len > width) {
          p.x = -p.len;
          p.y = Math.random() * height;
        }
      });
      animationFrame = requestAnimationFrame(animate);
    };

    animationFrame = requestAnimationFrame(animate);

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

  return <canvas ref={canvasRef} className="absolute inset-0 pointer-events-none z-0 mix-blend-screen" />;
}

// Bipe de rádio tático (PTT) sintetizado via Web Audio API — sem depender de asset externo.
function playTacticalRadioChirp() {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    const ctx = new AudioContextClass();
    const now = ctx.currentTime;

    // Clique de squelch (estalo curto ao abrir o canal)
    const clickDuration = 0.05;
    const noiseBuffer = ctx.createBuffer(1, ctx.sampleRate * clickDuration, ctx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
    }
    const noise = ctx.createBufferSource();
    noise.buffer = noiseBuffer;
    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.35, now);
    noise.connect(noiseGain).connect(ctx.destination);
    noise.start(now);

    // Dois bipes curtos (confirmação de canal, estilo HT)
    [
      { start: 0.08, freq: 950 },
      { start: 0.22, freq: 1300 },
    ].forEach(({ start, freq }) => {
      const osc = ctx.createOscillator();
      osc.type = "square";
      osc.frequency.setValueAtTime(freq, now + start);
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.0001, now + start);
      gain.gain.exponentialRampToValueAtTime(0.15, now + start + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + start + 0.1);
      osc.connect(gain).connect(ctx.destination);
      osc.start(now + start);
      osc.stop(now + start + 0.12);
    });

    setTimeout(() => ctx.close(), 700);
  } catch {
    // Autoplay bloqueado pelo navegador ou Web Audio indisponível: segue só com o efeito visual
  }
}

export function BepiEffect() {
  const { theme, resolvedTheme } = useTheme();
  const [isFlashing, setIsFlashing] = useState(false);
  const prevTheme = useRef<string | undefined>("light");

  useEffect(() => {
    const currentTheme = theme === "system" ? resolvedTheme : theme;

    if (currentTheme === "bepi" && prevTheme.current && prevTheme.current !== "bepi") {
      setIsFlashing(true);
      playTacticalRadioChirp();

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
    <div className="fixed inset-0 pointer-events-none z-[99999] overflow-hidden flex items-center justify-center bg-black/60">
      <DustStormCanvas />

      {/* Background strobe flashes (tom terroso) */}
      <div className="absolute inset-0 bg-amber-100 animate-[flash_1s_ease-out_forwards]" style={{ mixBlendMode: 'overlay' }} />
      <div className="absolute inset-0 bg-amber-700/10 animate-[flash_1.5s_ease-out_forwards]" style={{ mixBlendMode: 'color' }} />

      {/* Giant BEPI Patch Strike */}
      <div className="relative z-10 w-[380px] h-[480px] drop-shadow-[0_0_100px_rgba(201,162,39,0.9)] animate-[strike_0.8s_ease-in-out_forwards]">
        <Image
          src="/bepi-logo.jpg"
          alt="BEPI Logo"
          fill
          className="object-contain rounded-2xl"
          priority
        />
      </div>
    </div>
  );
}
