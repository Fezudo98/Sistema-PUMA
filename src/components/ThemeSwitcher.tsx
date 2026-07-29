"use client";

import * as React from "react";
import { Moon, Sun, Zap } from "lucide-react";
import { useTheme } from "next-themes";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";

export function ThemeSwitcher({ hasRaioUnlocked = false }: { hasRaioUnlocked?: boolean }) {
  const { setTheme, theme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <Button variant="outline" size="icon" className="rounded-full opacity-50 cursor-not-allowed">
        <Moon className="h-4 w-4" />
      </Button>
    );
  }

  const currentTheme = theme === "system" ? resolvedTheme : theme;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="icon" className="rounded-full border-border bg-muted/50 hover:bg-accent relative group overflow-hidden">
          <div className="absolute inset-0 group-hover:bg-primary/10 transition-colors pointer-events-none" />
          {currentTheme === "light" && <Sun className="h-4 w-4 text-amber-500 transition-all" />}
          {currentTheme === "dark" && <Moon className="h-4 w-4 text-blue-500 transition-all" />}
          {currentTheme === "raio" && <Zap className="h-4 w-4 text-yellow-500 drop-shadow-[0_0_5px_rgba(234,179,8,0.5)] transition-all" />}
          <span className="sr-only">Toggle theme</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="bg-card border-border rounded-xl">
        <DropdownMenuItem onClick={() => setTheme("light")} className="cursor-pointer font-bold text-muted-foreground hover:text-foreground">
          <Sun className="mr-2 h-4 w-4 text-amber-500" />
          <span>Modo Claro</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme("dark")} className="cursor-pointer font-bold text-muted-foreground hover:text-foreground">
          <Moon className="mr-2 h-4 w-4 text-blue-500" />
          <span>Modo Escuro (Padrão)</span>
        </DropdownMenuItem>
        {hasRaioUnlocked && (
          <DropdownMenuItem onClick={() => setTheme("raio")} className="cursor-pointer font-black text-muted-foreground hover:text-foreground">
            <Zap className="mr-2 h-4 w-4 text-yellow-500" />
            <span>Modo Tático (RAIO) ⚡</span>
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
