"use client";

import { useEffect, useState, useRef } from "react";
import { useTheme } from "next-themes";
import Image from "next/image";

export function LightningEffect() {
  const { theme, resolvedTheme } = useTheme();
  const [isFlashing, setIsFlashing] = useState(false);
  const prevTheme = useRef<string | undefined>("light");

  useEffect(() => {
    // Wait for mount to avoid hydration mismatch, but here we can just use the resolvedTheme
    const currentTheme = theme === "system" ? resolvedTheme : theme;
    
    if (currentTheme === "raio" && prevTheme.current && prevTheme.current !== "raio") {
      setIsFlashing(true);
      
      // Flash duration
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
    <div className="fixed inset-0 pointer-events-none z-[99999] overflow-hidden flex items-center justify-center">
      {/* Background strobe flashes */}
      <div className="absolute inset-0 bg-white animate-[flash_1s_ease-out_forwards]" style={{ mixBlendMode: 'overlay' }} />
      <div className="absolute inset-0 bg-yellow-400/20 animate-[flash_1.5s_ease-out_forwards]" style={{ mixBlendMode: 'color' }} />
      
      {/* Giant RAIO Logo Strike */}
      <div className="relative w-[500px] h-[500px] drop-shadow-[0_0_100px_rgba(250,204,21,1)] animate-[strike_0.8s_ease-in-out_forwards]">
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
