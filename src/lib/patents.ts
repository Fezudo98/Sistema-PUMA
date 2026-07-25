import { Shield, Target, Award, Star, Flame, Zap, ShieldAlert, Crosshair, Skull, Medal } from "lucide-react";

export interface PatentInfo {
  id: string;
  name: string;
  icon: any; // Lucide icon
  color: string;
  bg: string;
  border: string;
  glow?: string;
  requiredScore: number;
}

const PATENTS: PatentInfo[] = [
  {
    id: "recruta",
    name: "Recruta",
    icon: Shield,
    color: "text-slate-400",
    bg: "bg-slate-900/40",
    border: "border-slate-700",
    requiredScore: 0
  },
  {
    id: "soldado",
    name: "Soldado Combatente",
    icon: Crosshair,
    color: "text-blue-400",
    bg: "bg-blue-900/20",
    border: "border-blue-500/30",
    glow: "shadow-[0_0_10px_rgba(59,130,246,0.1)]",
    requiredScore: 50000
  },
  {
    id: "cabo",
    name: "Cabo Especialista",
    icon: Target,
    color: "text-emerald-400",
    bg: "bg-emerald-900/20",
    border: "border-emerald-500/30",
    glow: "shadow-[0_0_10px_rgba(16,185,129,0.1)]",
    requiredScore: 100000
  },
  {
    id: "sargento",
    name: "Sargento Tático",
    icon: Medal,
    color: "text-yellow-400",
    bg: "bg-yellow-900/20",
    border: "border-yellow-500/30",
    glow: "shadow-[0_0_15px_rgba(234,179,8,0.2)]",
    requiredScore: 200000
  },
  {
    id: "subtenente",
    name: "Subtenente Veterano",
    icon: Star,
    color: "text-orange-400",
    bg: "bg-orange-900/20",
    border: "border-orange-500/30",
    glow: "shadow-[0_0_15px_rgba(249,115,22,0.2)]",
    requiredScore: 350000
  },
  {
    id: "raio",
    name: "Operador RAIO",
    icon: Zap,
    color: "text-purple-400",
    bg: "bg-purple-900/20",
    border: "border-purple-500/30",
    glow: "shadow-[0_0_20px_rgba(168,85,247,0.3)]",
    requiredScore: 600000
  },
  {
    id: "bope",
    name: "Comandante BOPE",
    icon: Skull,
    color: "text-red-500",
    bg: "bg-red-950/40",
    border: "border-red-500/50",
    glow: "shadow-[0_0_25px_rgba(239,68,68,0.4)]",
    requiredScore: 1000000
  }
];

export function getPatentByScore(score: number): PatentInfo {
  // Encontra a patente mais alta que o usuário alcançou
  for (let i = PATENTS.length - 1; i >= 0; i--) {
    if (score >= PATENTS[i].requiredScore) {
      return PATENTS[i];
    }
  }
  return PATENTS[0]; // Fallback para Recruta
}

export function getAllPatents(): PatentInfo[] {
  return PATENTS;
}
