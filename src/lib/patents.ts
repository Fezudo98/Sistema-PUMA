import {
  RecrutaIcon,
  SoldadoIcon,
  CaboIcon,
  SargentoIcon,
  SubtenenteIcon,
  RaioIcon,
  BopeIcon
} from "@/components/PatentIcons";

export interface PatentInfo {
  id: string;
  name: string;
  icon: any; // React SVG Component
  color: string;
  bg: string;
  border: string;
  glow?: string;
  requiredScore: number;
  avatarRing?: string;
  nameEffect?: string;
  iconAnimation?: string;
}

const PATENTS: PatentInfo[] = [
  {
    id: "recruta",
    name: "Recruta",
    icon: RecrutaIcon,
    color: "text-slate-400",
    bg: "bg-slate-900/40",
    border: "border-slate-700",
    requiredScore: 0,
    avatarRing: "border-slate-700",
    nameEffect: "text-slate-300"
  },
  {
    id: "soldado",
    name: "Soldado Combatente",
    icon: SoldadoIcon,
    color: "text-blue-400",
    bg: "bg-blue-900/20",
    border: "border-blue-500/30",
    glow: "shadow-[0_0_10px_rgba(59,130,246,0.1)]",
    requiredScore: 50000,
    avatarRing: "ring-1 ring-blue-500/50 ring-offset-1 ring-offset-slate-950",
    nameEffect: "text-blue-200"
  },
  {
    id: "cabo",
    name: "Cabo Especialista",
    icon: CaboIcon,
    color: "text-emerald-400",
    bg: "bg-emerald-900/20",
    border: "border-emerald-500/30",
    glow: "shadow-[0_0_10px_rgba(16,185,129,0.1)]",
    requiredScore: 100000,
    avatarRing: "ring-2 ring-emerald-500/60 ring-offset-1 ring-offset-slate-950 shadow-[0_0_10px_rgba(16,185,129,0.2)]",
    nameEffect: "text-emerald-300"
  },
  {
    id: "sargento",
    name: "Sargento Tático",
    icon: SargentoIcon,
    color: "text-yellow-400",
    bg: "bg-yellow-900/20",
    border: "border-yellow-500/30",
    glow: "shadow-[0_0_15px_rgba(234,179,8,0.2)]",
    requiredScore: 200000,
    avatarRing: "ring-2 ring-yellow-500/80 ring-offset-2 ring-offset-slate-950 shadow-[0_0_15px_rgba(234,179,8,0.3)]",
    nameEffect: "text-yellow-300 drop-shadow-[0_0_5px_rgba(234,179,8,0.3)]",
    iconAnimation: "animate-pulse"
  },
  {
    id: "subtenente",
    name: "Subtenente Veterano",
    icon: SubtenenteIcon,
    color: "text-orange-400",
    bg: "bg-orange-900/20",
    border: "border-orange-500/30",
    glow: "shadow-[0_0_15px_rgba(249,115,22,0.2)]",
    requiredScore: 350000,
    avatarRing: "ring-2 ring-orange-500 ring-offset-2 ring-offset-slate-950 shadow-[0_0_20px_rgba(249,115,22,0.4)]",
    nameEffect: "text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-amber-500 drop-shadow-[0_0_8px_rgba(249,115,22,0.4)] font-black",
    iconAnimation: "animate-pulse"
  },
  {
    id: "raio",
    name: "Operador RAIO",
    icon: RaioIcon,
    color: "text-purple-400",
    bg: "bg-purple-900/20",
    border: "border-purple-500/30",
    glow: "shadow-[0_0_20px_rgba(168,85,247,0.3)]",
    requiredScore: 600000,
    avatarRing: "ring-2 ring-purple-500 ring-offset-2 ring-offset-purple-950 shadow-[0_0_25px_rgba(168,85,247,0.6)] animate-pulse",
    nameEffect: "text-transparent bg-clip-text bg-gradient-to-r from-purple-400 via-fuchsia-500 to-purple-500 drop-shadow-[0_0_10px_rgba(168,85,247,0.6)] font-black",
    iconAnimation: "animate-pulse drop-shadow-[0_0_8px_rgba(168,85,247,0.8)]"
  },
  {
    id: "bope",
    name: "Comandante BOPE",
    icon: BopeIcon,
    color: "text-red-500",
    bg: "bg-red-950/40",
    border: "border-red-500/50",
    glow: "shadow-[0_0_25px_rgba(239,68,68,0.4)]",
    requiredScore: 1000000,
    avatarRing: "ring-4 ring-red-600 ring-offset-2 ring-offset-red-950 shadow-[0_0_35px_rgba(239,68,68,0.8)] animate-pulse",
    nameEffect: "text-transparent bg-clip-text bg-gradient-to-r from-red-500 via-rose-600 to-red-600 drop-shadow-[0_0_15px_rgba(239,68,68,0.8)] font-black tracking-widest",
    iconAnimation: "animate-bounce drop-shadow-[0_0_10px_rgba(239,68,68,1)] text-red-500"
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
