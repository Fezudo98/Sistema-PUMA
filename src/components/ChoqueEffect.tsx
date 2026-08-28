"use client";

import { useEffect, useState, useRef } from "react";
import { useTheme } from "next-themes";

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

// Duração do vídeo da cutscene (public/choque-cutscene.mp4) — já vem com o áudio original
// (trilha AAC cortada junto com o vídeo), então não precisa de um som sintetizado por cima.
const CUTSCENE_DURATION_MS = 3500;

export function ChoqueEffect() {
  const { theme, resolvedTheme } = useTheme();
  const [isFlashing, setIsFlashing] = useState(false);
  const [videoFailed, setVideoFailed] = useState(false);
  const prevTheme = useRef<string | undefined>("light");
  const videoRef = useRef<HTMLVideoElement>(null);

  // Só detecta a troca pro tema Choque e liga a flag — não decide nada sobre vídeo aqui,
  // pra nunca correr o risco de travar isFlashing=true sem um caminho de volta.
  useEffect(() => {
    const currentTheme = theme === "system" ? resolvedTheme : theme;

    if (currentTheme === "choque" && prevTheme.current && prevTheme.current !== "choque") {
      setIsFlashing(true);
    }

    if (currentTheme) {
      prevTheme.current = currentTheme;
    }
  }, [theme, resolvedTheme]);

  // Enquanto a animação estiver ativa, toca o vídeo (com o áudio original) ou o fallback,
  // e agenda o fechamento do overlay. Reage também se `videoFailed` mudar no meio da
  // animação (ex.: o vídeo travou depois de já ter começado a tocar), trocando pro
  // fallback e reagendando o fechamento em vez de deixar o overlay preso na tela.
  useEffect(() => {
    if (!isFlashing) return;

    const video = videoRef.current;
    if (video && !videoFailed) {
      video.currentTime = 0;
      video.muted = false;
      const playPromise = video.play();
      if (playPromise) {
        playPromise.catch(() => {
          // Autoplay com som bloqueado pelo navegador — toca mudo em vez de perder o
          // vídeo inteiro (o gatilho é o clique no seletor de tema, então na prática
          // isso só deve acontecer em navegadores com política de autoplay mais rígida).
          video.muted = true;
          const mutedRetry = video.play();
          if (mutedRetry) mutedRetry.catch(() => setVideoFailed(true));
        });
      }

      const endTimer = setTimeout(() => setIsFlashing(false), CUTSCENE_DURATION_MS);
      return () => clearTimeout(endTimer);
    }

    playTacticalImpact();
    const timer = setTimeout(() => setIsFlashing(false), 1500);
    return () => clearTimeout(timer);
  }, [isFlashing, videoFailed]);

  return (
    <>
      {/* Um único elemento, sempre montado: fica pré-carregado (preload="auto") em segundo
          plano e é o mesmo que efetivamente toca quando o tema muda — nunca dois vídeos
          decodificando ao mesmo tempo, nem um remonte que jogaria fora o buffer já carregado. */}
      <div
        className={`fixed inset-0 z-[99999] overflow-hidden flex items-center justify-center bg-black pointer-events-none ${
          isFlashing && !videoFailed ? "" : "invisible opacity-0"
        }`}
      >
        <video
          ref={videoRef}
          src="/choque-cutscene.mp4"
          preload="auto"
          playsInline
          onError={() => setVideoFailed(true)}
          onEnded={() => setIsFlashing(false)}
          className="w-full h-full object-cover"
        />
      </div>

      {isFlashing && (
        <>
          {videoFailed && (
            <div className="fixed inset-0 pointer-events-none z-[99999] overflow-hidden flex items-center justify-center bg-black/70">
              <StaticNoiseCanvas />

              {/* Varredura de HUD tático de cima a baixo */}
              <div
                className="absolute left-0 right-0 top-0 h-[2px] bg-neutral-300/70 z-[5] animate-[hud-scan_1.2s_linear_forwards]"
                style={{ boxShadow: "0 0 12px rgba(232,232,232,0.8)" }}
              />

              {/* Strobe cinza-claro de alerta (tático, não mais vermelho) */}
              <div className="absolute inset-0 bg-neutral-400 animate-[flash_0.6s_ease-out_forwards]" style={{ mixBlendMode: "overlay" }} />
              <div className="absolute inset-0 bg-white animate-[flash_0.3s_ease-out_forwards]" style={{ mixBlendMode: "overlay" }} />
              {/* Terceiro strobe, mais discreto e mais longo — o único "hit" de vermelho da sequência */}
              <div className="absolute inset-0 bg-red-600/40 animate-[flash_0.9s_ease-out_forwards]" style={{ mixBlendMode: "overlay" }} />

              {/* Emblema do Choque em impacto */}
              <div className="relative z-10 w-[260px] h-[240px] drop-shadow-[0_0_90px_rgba(185,28,28,0.9)] animate-[strike_0.8s_ease-in-out_forwards]">
                <img src="/badges/choque-emblem.png" alt="Emblema CP Choque" className="w-full h-full object-contain" />

                {/* Cantos de mira "travando" no emblema */}
                <div className="absolute -inset-4 animate-[hud-lock_1s_ease-out_forwards]">
                  <div className="absolute top-0 left-0 w-6 h-6 border-l-2 border-t-2 border-neutral-300" />
                  <div className="absolute top-0 right-0 w-6 h-6 border-r-2 border-t-2 border-neutral-300" />
                  <div className="absolute bottom-0 left-0 w-6 h-6 border-l-2 border-b-2 border-neutral-300" />
                  <div className="absolute bottom-0 right-0 w-6 h-6 border-r-2 border-b-2 border-neutral-300" />
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </>
  );
}
