"use client";

import { useEffect } from "react";
import Link from "next/link";
import {
  Shield,
  Package,
  BookOpen,
  FileText,
  ShieldAlert,
  MessageSquare,
  ChevronLeft,
  ChevronRight,
  X,
} from "lucide-react";
import Image from "next/image";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  {
    href: "/quem-somos",
    label: "Quem Somos Nós",
    icon: Shield,
    text: "text-amber-400",
    bg: "bg-amber-950/30",
    border: "border-amber-900/50",
    hoverBg: "hover:bg-amber-900/40",
    hoverBorder: "hover:border-amber-700",
  },
  {
    href: "/aluno/inventario",
    label: "Inventário 32º PEL",
    icon: Package,
    text: "text-emerald-400",
    bg: "bg-emerald-950/30",
    border: "border-emerald-900/50",
    hoverBg: "hover:bg-emerald-900/40",
    hoverBorder: "hover:border-emerald-700",
  },
  {
    href: "/aluno/biblioteca",
    label: "Biblioteca",
    icon: BookOpen,
    text: "text-blue-400",
    bg: "bg-blue-950/30",
    border: "border-blue-900/50",
    hoverBg: "hover:bg-blue-900/40",
    hoverBorder: "hover:border-blue-700",
  },
  {
    href: "/aluno/vademecum",
    label: "Vade Mecum",
    icon: FileText,
    text: "text-violet-400",
    bg: "bg-violet-950/30",
    border: "border-violet-900/50",
    hoverBg: "hover:bg-violet-900/40",
    hoverBorder: "hover:border-violet-700",
  },
  {
    href: "/aluno/caderno-erros",
    label: "Caderno de Erros",
    icon: ShieldAlert,
    text: "text-rose-400",
    bg: "bg-rose-950/30",
    border: "border-rose-900/50",
    hoverBg: "hover:bg-rose-900/40",
    hoverBorder: "hover:border-rose-700",
  },
] as const;

const COLLAPSE_STORAGE_KEY = "puma-sidebar-collapsed";

interface AlunoSidebarProps {
  mobileOpen: boolean;
  onCloseMobile: () => void;
  collapsed: boolean;
  onToggleCollapsed: (next: boolean) => void;
}

export function AlunoSidebar({ mobileOpen, onCloseMobile, collapsed, onToggleCollapsed }: AlunoSidebarProps) {
  // Fecha o drawer mobile com a tecla Esc
  useEffect(() => {
    if (!mobileOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCloseMobile();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [mobileOpen, onCloseMobile]);

  return (
    <>
      {/* Backdrop do drawer mobile */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
          onClick={onCloseMobile}
          aria-hidden="true"
        />
      )}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex h-full flex-col border-r border-border bg-card transition-transform duration-300 lg:sticky lg:top-0 lg:z-30 lg:h-screen lg:translate-x-0 lg:transition-[width] lg:duration-300",
          mobileOpen ? "translate-x-0" : "-translate-x-full",
          collapsed ? "w-72 lg:w-[4.5rem]" : "w-72"
        )}
        aria-label="Menu de navegação do aluno"
      >
        <div className="flex h-20 shrink-0 items-center justify-between gap-2 border-b border-border px-4">
          <Link href="/aluno/painel" className="flex min-w-0 items-center gap-2.5" onClick={onCloseMobile}>
            <Image src="/logo.png" alt="Logo PUMA" width={36} height={36} className="shrink-0 object-contain" />
            {!collapsed && (
              <span className="truncate text-sm font-black uppercase tracking-wider text-heading">Menu Tático</span>
            )}
          </Link>
          <button
            onClick={onCloseMobile}
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-heading lg:hidden"
            title="Fechar menu"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 space-y-1.5 overflow-y-auto px-3 py-4 custom-scrollbar">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            return (
              <Link key={item.href} href={item.href} onClick={onCloseMobile}>
                <div
                  className={cn(
                    "flex items-center gap-3 rounded-xl border px-3.5 py-3 font-black text-xs uppercase tracking-widest transition-all cursor-pointer",
                    item.text,
                    item.bg,
                    item.border,
                    item.hoverBg,
                    item.hoverBorder,
                    collapsed && "lg:justify-center lg:px-0"
                  )}
                  title={collapsed ? item.label : undefined}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span className={cn("truncate", collapsed && "lg:hidden")}>{item.label}</span>
                </div>
              </Link>
            );
          })}

          <div className={cn("!mt-4 border-t border-border/70 pt-3", collapsed && "lg:mt-2")} />

          <Link href="/aluno/chat" onClick={onCloseMobile}>
            <div
              className={cn(
                "flex items-center gap-3 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-3.5 py-3 font-black text-xs uppercase tracking-widest text-white shadow-[0_0_20px_rgba(59,130,246,0.3)] transition-all hover:from-blue-500 hover:to-indigo-500 cursor-pointer",
                collapsed && "lg:justify-center lg:px-0"
              )}
              title={collapsed ? "Abrir Chat IA" : undefined}
            >
              <MessageSquare className="h-4 w-4 shrink-0" />
              <span className={cn("truncate", collapsed && "lg:hidden")}>Abrir Chat IA</span>
            </div>
          </Link>
        </nav>

        <button
          onClick={() => onToggleCollapsed(!collapsed)}
          className="hidden shrink-0 items-center justify-center gap-2 border-t border-border py-3 text-[10px] font-black uppercase tracking-widest text-muted-foreground hover:bg-muted hover:text-heading lg:flex cursor-pointer"
          title={collapsed ? "Expandir menu" : "Recolher menu"}
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : (
            <>
              <ChevronLeft className="h-4 w-4" />
              Recolher
            </>
          )}
        </button>
      </aside>
    </>
  );
}

export function getStoredSidebarCollapsed(): boolean {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(COLLAPSE_STORAGE_KEY) === "1";
}

export function storeSidebarCollapsed(value: boolean) {
  window.localStorage.setItem(COLLAPSE_STORAGE_KEY, value ? "1" : "0");
}
