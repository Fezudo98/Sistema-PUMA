"use client";

import { useEffect, useState, useRef } from "react";
import { useTheme } from "next-themes";
import Image from "next/image";

function LightningCanvas() {
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

    const createLightning = (startX: number, startY: number, endY: number, maxBranch: number = 3) => {
      const segments: {x: number, y: number}[] = [{x: startX, y: startY}];
      let currentY = startY;
      let currentX = startX;

      while (currentY < endY) {
        currentY += Math.random() * 20 + 10;
        currentX += (Math.random() - 0.5) * 60;
        segments.push({x: currentX, y: currentY});
      }
      return segments;
    };

    const drawLightning = () => {
      ctx.clearRect(0, 0, width, height);
      const numStrikes = Math.floor(Math.random() * 4) + 2; // 2 to 5 strikes
      
      for (let i = 0; i < numStrikes; i++) {
        const startX = Math.random() * width;
        const endY = height;
        const segments = createLightning(startX, 0, endY);
        
        ctx.beginPath();
        ctx.moveTo(segments[0].x, segments[0].y);
        
        for (let j = 1; j < segments.length; j++) {
          ctx.lineTo(segments[j].x, segments[j].y);
          
          // Chance to branch
          if (Math.random() > 0.85) {
            const branchLen = Math.random() * 300 + 100;
            const branch = createLightning(segments[j].x, segments[j].y, segments[j].y + branchLen);
            ctx.moveTo(branch[0].x, branch[0].y);
            for (let k = 1; k < branch.length; k++) {
              ctx.lineTo(branch[k].x, branch[k].y);
            }
            ctx.moveTo(segments[j].x, segments[j].y);
          }
        }
        
        // Glow effect
        ctx.strokeStyle = "rgba(255, 255, 255, 0.9)";
        ctx.lineWidth = Math.random() * 2 + 1.5;
        ctx.shadowBlur = 20;
        // Mix of electric blue and yellow for that RAIO tactical feel
        ctx.shadowColor = Math.random() > 0.5 ? "#3b82f6" : "#facc15"; 
        ctx.stroke();
        
        // Inner core
        ctx.lineWidth = 1;
        ctx.shadowBlur = 0;
        ctx.strokeStyle = "#ffffff";
        ctx.stroke();
      }
    };

    let animationFrame: number;
    let lastDraw = 0;
    
    // Quick flicker effect
    const animate = (timestamp: number) => {
      if (timestamp - lastDraw > 80 + Math.random() * 100) {
         if (Math.random() > 0.3) {
             drawLightning();
             // Fill screen with slight white flash
             ctx.fillStyle = "rgba(255, 255, 255, 0.1)";
             ctx.fillRect(0, 0, width, height);
         } else {
             ctx.clearRect(0, 0, width, height);
         }
         lastDraw = timestamp;
      }
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

export function LightningEffect() {
  const { theme, resolvedTheme } = useTheme();
  const [isFlashing, setIsFlashing] = useState(false);
  const prevTheme = useRef<string | undefined>("light");

  useEffect(() => {
    const currentTheme = theme === "system" ? resolvedTheme : theme;
    
    if (currentTheme === "raio" && prevTheme.current && prevTheme.current !== "raio") {
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
      <LightningCanvas />
      
      {/* Background strobe flashes */}
      <div className="absolute inset-0 bg-white animate-[flash_1s_ease-out_forwards]" style={{ mixBlendMode: 'overlay' }} />
      <div className="absolute inset-0 bg-blue-500/10 animate-[flash_1.5s_ease-out_forwards]" style={{ mixBlendMode: 'color' }} />
      
      {/* Giant RAIO Logo Strike */}
      <div className="relative z-10 w-[500px] h-[500px] drop-shadow-[0_0_100px_rgba(250,204,21,1)] animate-[strike_0.8s_ease-in-out_forwards]">
        <Image 
          src="/raio-logo.png" 
          alt="RAIO Logo"
          fill
          className="object-contain"
          priority
        />
      </div>
    </div>
  );
}
