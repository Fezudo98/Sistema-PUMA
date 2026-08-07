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

export function BepiEffect() {
  const { theme, resolvedTheme } = useTheme();
  const [isFlashing, setIsFlashing] = useState(false);
  const prevTheme = useRef<string | undefined>("light");

  useEffect(() => {
    const currentTheme = theme === "system" ? resolvedTheme : theme;

    if (currentTheme === "bepi" && prevTheme.current && prevTheme.current !== "bepi") {
      setIsFlashing(true);

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
