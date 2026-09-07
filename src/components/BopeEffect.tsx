"use client";

import { useEffect, useState, useRef } from "react";
import { useTheme } from "next-themes";
import { BopeIcon } from "@/components/PatentIcons";

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
        buffer[i + 3] = Math.random() * 40;
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

// Estrondo tático grave, só pro fallback (se o vídeo falhar) — sintetizado via Web
// Audio API, sem depender de asset externo.
function playTacticalImpact() {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    const ctx = new AudioContextClass();
    const now = ctx.currentTime;

    const burstDuration = 0.2;
    const noiseBuffer = ctx.createBuffer(1, ctx.sampleRate * burstDuration, ctx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / data.length, 2);
    }
    const noise = ctx.createBufferSource();
    noise.buffer = noiseBuffer;
    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.55, now);
    noise.connect(noiseGain).connect(ctx.destination);
    noise.start(now);

    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(120, now);
    osc.frequency.exponentialRampToValueAtTime(35, now + 0.3);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.55, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.35);
    osc.connect(gain).connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.38);

    setTimeout(() => ctx.close(), 700);
  } catch {
    // Autoplay bloqueado pelo navegador ou Web Audio indisponível: segue só com o efeito visual
  }
}

// Duração real de public/bope-cutscene.mp4 é ~43s — bem mais longa que os outros
// temas de propósito (é o desbloqueio mais raro, 75 dias de sequência, merece um
// momento cinematográfico de verdade em vez de um flash rápido). O timeout aqui é só
// uma rede de segurança caso o evento "ended" do vídeo não dispare por algum motivo;
// quem normalmente fecha o overlay é o próprio fim do vídeo ou o botão de pular.
const CUTSCENE_FALLBACK_DURATION_MS = 45000;
const SKIP_BUTTON_DELAY_MS = 2000;

export function BopeEffect() {
  const { theme, resolvedTheme } = useTheme();
  const [isFlashing, setIsFlashing] = useState(false);
  const [videoFailed, setVideoFailed] = useState(false);
  const [showSkip, setShowSkip] = useState(false);
  // undefined = "ainda não observamos o tema real desta sessão de página" — nunca um
  // valor chutado tipo "light". Se começar com um valor fixo, um F5 (ou qualquer
  // navegação que remonta o layout) com o tema BOPE já ativo faria o efeito achar
  // que acabou de MUDAR pra BOPE (valor chutado != "bope") e tocar o vídeo de novo,
  // sozinho, sem nenhuma seleção do aluno — exatamente o bug que o vídeo não pode ter.
  const prevTheme = useRef<string | undefined>(undefined);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Só detecta a troca pro tema BOPE e liga a flag — não decide nada sobre o vídeo
  // aqui, pra nunca correr o risco de travar isFlashing=true sem um caminho de volta.
  useEffect(() => {
    const currentTheme = theme === "system" ? resolvedTheme : theme;

    if (currentTheme === "bope" && prevTheme.current !== undefined && prevTheme.current !== "bope") {
      setIsFlashing(true);
    }

    if (currentTheme) {
      prevTheme.current = currentTheme;
    }
  }, [theme, resolvedTheme]);

  useEffect(() => {
    if (!isFlashing) {
      setShowSkip(false);
      // O <video> fica sempre montado (preload="auto"), então esconder o overlay
      // sozinho (isFlashing=false) só o deixa invisível — sem isso, pular a cena ou
      // fechar pelo timeout de segurança deixa o áudio tocando escondido até o vídeo
      // terminar de verdade.
      const video = videoRef.current;
      if (video && !video.paused) {
        video.pause();
      }
      return;
    }

    const video = videoRef.current;
    if (video && !videoFailed) {
      video.currentTime = 0;
      video.muted = false;
      const playPromise = video.play();
      if (playPromise) {
        playPromise.catch(() => {
          // Autoplay com som bloqueado pelo navegador — toca mudo em vez de perder a
          // cena inteira (o gatilho é o clique no seletor de tema, então na prática
          // isso só deve acontecer em navegadores com política de autoplay mais rígida).
          video.muted = true;
          const mutedRetry = video.play();
          if (mutedRetry) mutedRetry.catch(() => setVideoFailed(true));
        });
      }

      const skipTimer = setTimeout(() => setShowSkip(true), SKIP_BUTTON_DELAY_MS);
      const endTimer = setTimeout(() => setIsFlashing(false), CUTSCENE_FALLBACK_DURATION_MS);
      return () => {
        clearTimeout(skipTimer);
        clearTimeout(endTimer);
      };
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
          src="/bope-cutscene.mp4"
          preload="auto"
          playsInline
          onError={() => setVideoFailed(true)}
          onEnded={() => setIsFlashing(false)}
          className="w-full h-full object-cover"
        />

        {isFlashing && !videoFailed && showSkip && (
          <button
            type="button"
            onClick={() => setIsFlashing(false)}
            className="absolute bottom-6 right-6 z-10 pointer-events-auto flex items-center gap-1.5 px-4 py-2 rounded-full bg-black/60 border border-white/30 text-white/90 text-xs font-black uppercase tracking-widest backdrop-blur-sm hover:bg-black/80 hover:border-white/60 transition-all animate-in fade-in duration-300 cursor-pointer"
          >
            Pular
          </button>
        )}
      </div>

      {isFlashing && videoFailed && (
        <div className="fixed inset-0 pointer-events-none z-[99999] overflow-hidden flex items-center justify-center bg-black/80">
          <StaticNoiseCanvas />

          <div
            className="absolute left-0 right-0 top-0 h-[2px] bg-neutral-200/70 z-[5] animate-[hud-scan_1.2s_linear_forwards]"
            style={{ boxShadow: "0 0 12px rgba(229,229,229,0.8)" }}
          />

          <div className="absolute inset-0 bg-neutral-300 animate-[flash_0.6s_ease-out_forwards]" style={{ mixBlendMode: "overlay" }} />
          <div className="absolute inset-0 bg-white animate-[flash_0.3s_ease-out_forwards]" style={{ mixBlendMode: "overlay" }} />
          <div className="absolute inset-0 bg-red-700/40 animate-[flash_0.9s_ease-out_forwards]" style={{ mixBlendMode: "overlay" }} />

          <div className="relative z-10 w-[220px] h-[220px] text-[#e5e5e5] drop-shadow-[0_0_90px_rgba(229,229,229,0.7)] animate-[strike_0.8s_ease-in-out_forwards]">
            <BopeIcon className="w-full h-full" />

            <div className="absolute -inset-4 animate-[hud-lock_1s_ease-out_forwards]">
              <div className="absolute top-0 left-0 w-6 h-6 border-l-2 border-t-2 border-neutral-200" />
              <div className="absolute top-0 right-0 w-6 h-6 border-r-2 border-t-2 border-neutral-200" />
              <div className="absolute bottom-0 left-0 w-6 h-6 border-l-2 border-b-2 border-neutral-200" />
              <div className="absolute bottom-0 right-0 w-6 h-6 border-r-2 border-b-2 border-neutral-200" />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
