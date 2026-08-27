"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useRouter, useSearchParams } from "next/navigation";
import { logout } from "@/app/actions/auth";
import { LogOut, Play, Target, ShieldAlert, Award, TrendingUp, Clock, Loader2, Shield, ShieldCheck, Crosshair, Skull, Zap, Medal, Lock, Frown, Timer, Moon, TrendingDown, Trophy, Edit, BookOpen, MessageSquare, Bot, Check, Flame, Menu, GraduationCap, SlidersHorizontal, Crown, Sunrise, MoonStar, CalendarCheck, Landmark, Users, Rocket } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import HeaderAvatar from "@/components/HeaderAvatar";
import { ThemeSwitcher } from "@/components/ThemeSwitcher";
import { AlunoSidebar, getStoredSidebarCollapsed, storeSidebarCollapsed } from "@/components/AlunoSidebar";
import Link from "next/link";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { updateUserAvatar, updateUserName, updateDisplayedBadgesAction } from "@/app/actions/user";
import { MAX_DISPLAYED_BADGES } from "@/lib/badges";
import { getMorePastDailySimulados } from "@/app/actions/dailySimulado";
import { formatApostilaTitle } from "@/lib/utils";
import { getPatentByScore } from "@/lib/patents";
import { BepiEagleIcon, ChoqueSkullIcon } from "@/components/PatentIcons";
import { BepiUnlockToast } from "@/components/BepiUnlockToast";
import { ChoqueUnlockToast } from "@/components/ChoqueUnlockToast";

const LEIS_DA_SELVA = [
  {
    numero: "1ª LEI",
    texto: "Tenha iniciativa, pois não receberá ordens para todas as situações. Tenha em vista o objetivo final.",
    destaque: "Iniciativa & Objetivo"
  },
  {
    numero: "2ª LEI",
    texto: "Procure a surpresa por todos os modos.",
    destaque: "Fator Surpresa"
  },
  {
    numero: "3ª LEI",
    texto: "Mantenha seu corpo, armamento e equipamento em boas condições.",
    destaque: "Pronto Operacional"
  },
  {
    numero: "4ª LEI",
    texto: "Aprenda a suportar o desconforto e a fadiga sem queixar-se e seja moderado em suas necessidades.",
    destaque: "Resiliência & Disciplina"
  },
  {
    numero: "5ª LEI",
    texto: "Pense e aja como caçador, não como caça.",
    destaque: "Mentalidade de Caçador"
  },
  {
    numero: "6ª LEI",
    texto: "Combata sempre com inteligência e seja o mais ardiloso.",
    destaque: "Inteligência Tática"
  }
];

// Ids de brevês com arte de avatar já cadastrada em public/avatars/*.png — usado pra
// não oferecer como avatar um brevê novo que ainda não tem imagem.
const BADGE_AVATAR_IDS = new Set([
  'recruta', 'guerreiro', 'veterano', 'sniper', 'raio', 'caveira', 'padrao',
  'bizonho', 'afoito', 'dorminhoco', 'pepreto',
  'lenda', 'madrugador', 'coruja', 'fimdesemana', 'historiador', 'lider_equipe', 'sprint'
]);

const getBadges = (stats: any) => {
  const s = stats || { simuladosCount: 0, accuracy: 0, avgTime: 0, totalScore: 0, history: [] };
  
  return [
    {
      id: 'recruta',
      name: 'Recruta',
      icon: Shield,
      earned: s.simuladosCount >= 3 && s.totalScore >= 3000,
      desc: 'Concluir no mínimo 3 simulados e alcançar no mínimo 3.000 pontos totais.',
      color: 'text-amber-600',
      bg: 'bg-amber-900/20',
      border: 'border-amber-700/50'
    },
    {
      id: 'guerreiro',
      name: 'Guerreiro',
      icon: ShieldCheck,
      earned: s.simuladosCount >= 10 && s.totalScore >= 25000, 
      desc: 'Completar 10 simulados avançados com no mínimo 70% de acertos e alcançar 25.000 pontos.',
      color: 'text-muted-foreground',
      bg: 'bg-muted/30',
      border: 'border-border'
    },
    {
      id: 'veterano',
      name: 'Veterano',
      icon: ShieldAlert,
      earned: s.simuladosCount >= 25 && s.totalScore >= 60000,
      desc: 'Completar 25 simulados avançados com no mínimo 75% de acertos e alcançar 60.000 pontos.',
      color: 'text-yellow-500',
      bg: 'bg-yellow-900/20',
      border: 'border-yellow-500/50'
    },
    {
      id: 'sniper',
      name: 'Atirador de Elite',
      icon: Crosshair,
      earned: false, 
      exclusive: false,
      isElite: true,
      desc: 'Atingir 100% de acerto em um simulado avançado de no mínimo 20 questões (naquele simulado) e ter 80.000 pontos totais.',
      color: 'text-emerald-500',
      bg: 'bg-emerald-900/20',
      border: 'border-emerald-500/50'
    },
    {
      id: 'raio',
      name: 'Pronto Resposta (Raio)',
      icon: Zap,
      earned: false,
      exclusive: false,
      isElite: true,
      desc: 'Concluir um simulado avançado com tempo médio máx de 15s e acertos mín 85% (naquele simulado), e ter 50.000 pontos totais.',
      color: 'text-amber-400',
      bg: 'bg-amber-900/20',
      border: 'border-amber-400/50'
    },
    {
      id: 'caveira',
      name: 'Caveira',
      icon: Skull,
      earned: false,
      exclusive: false,
      isElite: true,
      desc: 'Concluir no mínimo 40 simulados avançados, ter taxa global de acertos (geral) mín 92% e 200.000 pontos totais.',
      color: 'text-purple-500',
      bg: 'bg-purple-900/20',
      border: 'border-purple-500/50'
    },
    {
      id: 'padrao',
      name: 'Padrão PM',
      icon: Medal,
      earned: false,
      exclusive: false,
      isElite: true,
      desc: 'Alcançar 300.000 pontos totais e ter no mínimo taxa global de acertos (geral) em 92%.',
      color: 'text-blue-500',
      bg: 'bg-blue-900/20',
      border: 'border-blue-500/50'
    },
    {
      id: 'lenda',
      name: 'Lenda PUMA',
      icon: Crown,
      earned: false,
      exclusive: false,
      isElite: true,
      desc: 'Alcançar 750.000 pontos totais e ter no mínimo taxa global de acertos (geral) em 95%.',
      color: 'text-fuchsia-400',
      bg: 'bg-fuchsia-950/20',
      border: 'border-fuchsia-500/50'
    },
    {
      id: 'madrugador',
      name: 'Madrugador',
      icon: Sunrise,
      earned: false,
      desc: 'Responder pelo menos 20 questões entre 5h e 7h da manhã.',
      color: 'text-orange-300',
      bg: 'bg-orange-950/20',
      border: 'border-orange-400/50'
    },
    {
      id: 'coruja',
      name: 'Coruja da Guarita',
      icon: MoonStar,
      earned: false,
      desc: 'Responder pelo menos 20 questões entre 23h e 3h da madrugada.',
      color: 'text-indigo-300',
      bg: 'bg-indigo-950/20',
      border: 'border-indigo-400/50'
    },
    {
      id: 'fimdesemana',
      name: 'Guerreiro de Fim de Semana',
      icon: CalendarCheck,
      earned: false,
      desc: 'Completar pelo menos um simulado no sábado e no domingo em 4 fins de semana diferentes.',
      color: 'text-teal-400',
      bg: 'bg-teal-950/20',
      border: 'border-teal-500/50'
    },
    {
      id: 'historiador',
      name: 'Historiador de Combate',
      icon: Landmark,
      earned: false,
      desc: 'Responder pelo menos 100 questões de Blocos de Provas com no mínimo 80% de acerto.',
      color: 'text-cyan-400',
      bg: 'bg-cyan-950/20',
      border: 'border-cyan-500/50'
    },
    {
      id: 'lider_equipe',
      name: 'Líder de Equipe',
      icon: Users,
      earned: false,
      desc: 'Vencer pelo menos 3 partidas do Modo Competição em Equipes.',
      color: 'text-lime-400',
      bg: 'bg-lime-950/20',
      border: 'border-lime-500/50'
    },
    {
      id: 'sprint',
      name: 'Sprint Tático',
      icon: Rocket,
      earned: false,
      desc: 'Vencer pelo menos 5 rodadas do Modo Corrida.',
      color: 'text-sky-400',
      bg: 'bg-sky-950/20',
      border: 'border-sky-500/50'
    },
    {
      id: 'bizonho',
      name: 'Bizonho',
      icon: Frown,
      earned: false,
      desc: 'Errar 3 questões seguidas em qualquer simulado.',
      color: 'text-red-400',
      bg: 'bg-red-950/20',
      border: 'border-red-900/50'
    },
    {
      id: 'afoito',
      name: 'Gatilho Afoito',
      icon: Timer,
      earned: false,
      desc: 'Responder em menos de 3 segundos e errar a questão.',
      color: 'text-orange-400',
      bg: 'bg-orange-950/20',
      border: 'border-orange-900/50'
    },
    {
      id: 'dorminhoco',
      name: 'Dormiu na Guarita',
      icon: Moon,
      earned: false,
      desc: 'Deixar o tempo expirar sem responder a uma questão.',
      color: 'text-indigo-400',
      bg: 'bg-indigo-950/20',
      border: 'border-indigo-900/50'
    },
    {
      id: 'pepreto',
      name: 'Pé Preto',
      icon: TrendingDown,
      earned: false,
      desc: 'Ter aproveitamento abaixo de 10% em um simulado de no mínimo 5 questões.',
      color: 'text-rose-600',
      bg: 'bg-rose-950/20',
      border: 'border-rose-900/50'
    }
  ];
};

export default function StudentDashboardClient({ 
  user, 
  stats, 
  generalRanking = [], 
  activeRooms = [],
  dailySimulados = [],
  pastDailySimulados = [],
  hasMorePastDailySimulados = false,
  specialSimulados = [],
  blocosDeProva = [],
  isGeneratingDaily = false
}: {
  user: any;
  stats?: any;
  generalRanking?: any[];
  activeRooms?: any[];
  dailySimulados?: any[];
  pastDailySimulados?: any[];
  hasMorePastDailySimulados?: boolean;
  specialSimulados?: any[];
  blocosDeProva?: any[];
  isGeneratingDaily?: boolean;
}) {
  const [codigo, setCodigo] = useState("");
  const [aiAnalysis, setAiAnalysis] = useState(user?.aiAnalysis || "");
  const [loadingAi, setLoadingAi] = useState(false);
  const [isArmariaOpen, setIsArmariaOpen] = useState(false);
  const [isBadgeMenuOpen, setIsBadgeMenuOpen] = useState(false);
  const [selectedBadges, setSelectedBadges] = useState<string[]>(user?.displayedBadges || []);
  const [savingBadges, setSavingBadges] = useState(false);
  const [newName, setNewName] = useState(user?.name || "");
  const [updatingName, setUpdatingName] = useState(false);
  const [nameError, setNameError] = useState("");
  const [selectedDailySimId, setSelectedDailySimId] = useState<string | null>(null);
  const [selectedDailySimName, setSelectedDailySimName] = useState<string>("");
  const [useTimer, setUseTimer] = useState<boolean>(true);
  const [timerSeconds, setTimerSeconds] = useState<string>("60");
  const [dailyTab, setDailyTab] = useState<"TODAY" | "HISTORY">("TODAY");
  const [pastDailyList, setPastDailyList] = useState<any[]>(pastDailySimulados);
  const [hasMorePastDaily, setHasMorePastDaily] = useState<boolean>(hasMorePastDailySimulados);
  const [loadingMorePastDaily, setLoadingMorePastDaily] = useState(false);

  const handleLoadMorePastDaily = async () => {
    if (loadingMorePastDaily) return;
    setLoadingMorePastDaily(true);
    try {
      const result = await getMorePastDailySimulados(pastDailyList.length);
      if (result?.items) {
        const newItems = result.items;
        setPastDailyList((prev) => [...prev, ...newItems]);
        setHasMorePastDaily(result.hasMore ?? false);
      }
    } finally {
      setLoadingMorePastDaily(false);
    }
  };
  const [generatedToday, setGeneratedToday] = useState<boolean>(false);
  const router = useRouter();
  const [currentLeiIndex, setCurrentLeiIndex] = useState(0);
  const [sidebarMobileOpen, setSidebarMobileOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  useEffect(() => {
    setSidebarCollapsed(getStoredSidebarCollapsed());
  }, []);

  const handleToggleSidebarCollapsed = (next: boolean) => {
    setSidebarCollapsed(next);
    storeSidebarCollapsed(next);
  };

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentLeiIndex((prev) => (prev + 1) % LEIS_DA_SELVA.length);
    }, 7000); // 7 segundos para cada lei
    return () => clearInterval(timer);
  }, []);

  const isAnalysisDoneToday = generatedToday || Boolean(
    user?.aiAnalysisDate &&
    new Date(user.aiAnalysisDate).toDateString() === new Date().toDateString()
  );

  useEffect(() => {
    if (user?.name) {
      setNewName(user.name);
    }
  }, [user]);

  const searchParams = useSearchParams();

  useEffect(() => {
    const setupId = searchParams.get("setupId");
    const setupName = searchParams.get("setupName");
    if (setupId && setupName) {
      setSelectedDailySimId(setupId);
      setSelectedDailySimName(setupName);
      setUseTimer(true);
      setTimerSeconds("60");
      // Limpa os parâmetros de URL para evitar reabertura ao recarregar a página
      router.replace("/aluno/painel");
    }
  }, [searchParams, router]);

  useEffect(() => {
    if (isGeneratingDaily) {
      const interval = setInterval(() => {
        router.refresh();
      }, 5000);
      return () => clearInterval(interval);
    }
  }, [isGeneratingDaily, router]);

  const handleGenerateAnalysis = () => {
    if (!stats || stats.simuladosCount === 0 || isAnalysisDoneToday) return;
    setLoadingAi(true);
    fetch("/api/aluno/analysis", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stats })
    })
      .then(res => res.json())
      .then(data => {
        if (data.analysis) {
          setAiAnalysis(data.analysis);
          setGeneratedToday(true);
        } else {
          setAiAnalysis("Mentor temporariamente indisponível (Alta demanda na rede). Mantenha o foco tático e continue simulando!");
        }
      })
      .catch(err => {
        console.error("Erro na IA:", err);
        setAiAnalysis("Mentor temporariamente indisponível na rede. Mantenha o foco e continue simulando!");
      })
      .finally(() => setLoadingAi(false));
  };

  const handleEntrar = (e: React.FormEvent) => {
    e.preventDefault();
    if (codigo.trim().length > 0) {
      router.push(`/aluno/sala/${codigo.toUpperCase()}`);
    }
  };

  const handleSair = async () => {
    await logout();
    router.push("/");
  };

  const handleChangeAvatar = async (badgeId: string) => {
    const newAvatar = badgeId ? `/avatars/${badgeId}.png` : "";
    await updateUserAvatar(newAvatar);
    setIsArmariaOpen(false);
  };

  const handleSaveName = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) {
      setNameError("O nome não pode estar vazio.");
      return;
    }
    if (newName.trim().length < 2) {
      setNameError("O nome deve ter pelo menos 2 caracteres.");
      return;
    }
    setUpdatingName(true);
    setNameError("");
    try {
      const res = await updateUserName(newName.trim());
      if (res.success) {
        // Nome atualizado com sucesso
      } else {
        setNameError(res.error || "Erro ao atualizar o nome.");
      }
    } catch (err) {
      setNameError("Erro interno ao atualizar o nome.");
    } finally {
      setUpdatingName(false);
    }
  };

  const handleOpenBadgeMenu = () => {
    setSelectedBadges(user?.displayedBadges || []);
    setIsBadgeMenuOpen(true);
  };

  const handleToggleBadgeSelection = (badgeId: string) => {
    setSelectedBadges((prev) => {
      if (prev.includes(badgeId)) return prev.filter((id) => id !== badgeId);
      if (prev.length >= MAX_DISPLAYED_BADGES) return prev;
      return [...prev, badgeId];
    });
  };

  const handleSaveDisplayedBadges = async () => {
    setSavingBadges(true);
    try {
      await updateDisplayedBadgesAction(selectedBadges);
      setIsBadgeMenuOpen(false);
      router.refresh();
    } finally {
      setSavingBadges(false);
    }
  };

  const hasBepiUnlocked = Boolean(user?.isTestUser) || (stats?.streakDays || 0) >= 35;
  const hasChoqueUnlocked = Boolean(user?.isTestUser) || (stats?.streakDays || 0) >= 50;

  const streakDaysAtual = stats?.streakDays || 0;
  const proximaMeta =
    streakDaysAtual < 25
      ? { label: "TEMA RAIO ⚡", dias: 25, corBarra: "from-yellow-600 to-yellow-400" }
      : streakDaysAtual < 35
      ? { label: "TEMA BEPI 🦅", dias: 35, corBarra: "from-emerald-600 to-emerald-400" }
      : streakDaysAtual < 50
      ? { label: "TEMA CHOQUE 💀", dias: 50, corBarra: "from-red-700 to-red-500" }
      : { label: "TRILHA COMPLETA 🏆", dias: null as number | null, corBarra: "from-red-700 to-red-500" };

  return (
    <div className="min-h-screen bg-background text-foreground lg:flex">
      <BepiUnlockToast unlocked={hasBepiUnlocked} />
      <ChoqueUnlockToast unlocked={hasChoqueUnlocked} />
      <AlunoSidebar
        mobileOpen={sidebarMobileOpen}
        onCloseMobile={() => setSidebarMobileOpen(false)}
        collapsed={sidebarCollapsed}
        onToggleCollapsed={handleToggleSidebarCollapsed}
      />

      <div className="min-w-0 flex-1">
      {/* Top Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-md sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 h-16 sm:h-20 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 sm:gap-4 min-w-0">
            <button
              onClick={() => setSidebarMobileOpen(true)}
              className="shrink-0 rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-heading lg:hidden"
              title="Abrir menu"
            >
              <Menu className="w-5 h-5" />
            </button>
            <Image src="/logo.png" alt="Logo PUMA" width={52} height={52} className="w-9 h-9 sm:w-[52px] sm:h-[52px] shrink-0 drop-shadow-[0_0_15px_rgba(245,158,11,0.35)] object-contain hover:scale-105 transition-transform duration-300" />
            <div className="min-w-0">
              <h1 className="text-base sm:text-xl font-bold text-heading tracking-tight whitespace-nowrap">Sistema PUMA</h1>
              <p className="text-xs text-blue-400 font-medium uppercase tracking-wider hidden sm:block">Painel do Aluno</p>
            </div>
          </div>

          <div className="flex items-center gap-6">
            <div className="text-right hidden sm:block">
              <div className="flex items-center justify-end gap-2 mb-0.5">
                <p className="text-sm text-muted-foreground">QRA</p>
                {(() => {
                  const patent = getPatentByScore(stats?.totalScore || 0);
                  const PatentIcon = patent.icon;
                  return (
                    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-black uppercase tracking-wider ${patent.color} ${patent.bg} ${patent.border} border ${patent.glow || ''}`} title="Sua Patente PUMA">
                      <PatentIcon className={`w-3 h-3 ${patent.iconAnimation || ''}`} />
                      {patent.name}
                    </span>
                  );
                })()}
              </div>
              <div className="flex items-center justify-end gap-1.5 group">
                <p className="text-lg font-bold text-heading uppercase">
                  {user?.numero ? `${String(user.numero).padStart(2, '0')} - ${user.name}` : user?.name || "Aluno"}
                </p>
                <button 
                  onClick={() => {
                    setNameError("");
                    setIsArmariaOpen(true);
                  }}
                  className="text-muted-foreground hover:text-blue-400 transition-colors p-1 rounded hover:bg-muted"
                  title="Alterar Identificação (QRA)"
                >
                  <Edit className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
            <button onClick={() => setIsArmariaOpen(true)} className="hover:scale-105 transition-transform" title="Abrir Armaria de Ícones">
              {(() => {
                const patent = getPatentByScore(stats?.totalScore || 0);
                const fardamentoRing = hasChoqueUnlocked
                  ? 'ring-2 ring-[#b91c1c] ring-offset-2 ring-offset-background shadow-[0_0_15px_rgba(185,28,28,0.5)]'
                  : hasBepiUnlocked
                  ? 'ring-2 ring-[#c9a227] ring-offset-2 ring-offset-background shadow-[0_0_15px_rgba(201,162,39,0.5)]'
                  : '';
                const fardamentoTitle = hasChoqueUnlocked ? "Fardamento CHOQUE" : hasBepiUnlocked ? "Fardamento BEPI" : undefined;
                return (
                  <div className={`rounded-full ${fardamentoRing}`} title={fardamentoTitle}>
                    <div className={`rounded-full ${patent.avatarRing || ''}`}>
                      <HeaderAvatar
                        initials={user?.name?.substring(0, 2).toUpperCase() || "AL"}
                        avatarUrl={user?.avatarUrl || null}
                        disableModal={true}
                      />
                    </div>
                  </div>
                );
              })()}
            </button>
            <ThemeSwitcher
              hasRaioUnlocked={user?.isTestUser || (stats?.streakDays || 0) >= 25}
              hasBepiUnlocked={hasBepiUnlocked}
              hasChoqueUnlocked={hasChoqueUnlocked}
            />
            <Button variant="ghost" onClick={handleSair} className="text-muted-foreground hover:text-red-400">
              <LogOut className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8 space-y-8">
        {/* Banner: Leis da Guerra na Selva (Tático / Dinâmico) */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-emerald-950/90 via-background/95 to-amber-950/90 border border-emerald-500/40 p-6 sm:p-7 shadow-[0_0_30px_rgba(16,185,129,0.15)] group transition-all duration-500">
          <div className="absolute -right-10 -top-10 w-48 h-48 bg-emerald-500/15 rounded-full blur-3xl pointer-events-none group-hover:bg-emerald-500/25 transition-all"></div>
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-500 via-amber-500 to-emerald-400 animate-pulse"></div>

          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 relative z-10">
            <div className="flex items-start sm:items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center shrink-0 shadow-[0_0_15px_rgba(16,185,129,0.3)]">
                <Flame className="w-6 h-6 text-emerald-400 animate-pulse" />
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[11px] font-black uppercase tracking-widest text-emerald-400 px-2.5 py-0.5 rounded bg-emerald-950 border border-emerald-800 shadow-inner">
                    {LEIS_DA_SELVA[currentLeiIndex].numero}
                  </span>
                  <span className="text-xs font-bold uppercase tracking-wider text-amber-400/90">
                    • LEIS DA GUERRA NA SELVA •
                  </span>
                  <span className="text-[11px] font-medium text-muted-foreground hidden md:inline">
                    [{LEIS_DA_SELVA[currentLeiIndex].destaque}]
                  </span>
                </div>
                <p className="text-base sm:text-lg font-bold text-heading tracking-wide leading-snug transition-all duration-500 min-h-[3.5rem] sm:min-h-[2.5rem] flex items-center">
                  "{LEIS_DA_SELVA[currentLeiIndex].texto}"
                </p>
              </div>
            </div>

            {/* Controles do Banner (Dots interativos) */}
            <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
              <div className="flex items-center gap-1.5 mr-2">
                {LEIS_DA_SELVA.map((_, idx) => (
                  <button
                    key={idx}
                    onClick={() => setCurrentLeiIndex(idx)}
                    className={`h-1.5 rounded-full transition-all duration-300 cursor-pointer ${
                      idx === currentLeiIndex 
                        ? "w-6 bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]" 
                        : "w-1.5 bg-muted hover:bg-muted"
                    }`}
                    title={`Ver ${LEIS_DA_SELVA[idx].numero}`}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Prominent Banner: Central de Inteligência & Chat com Mentor IA */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-blue-950/90 via-background/95 to-indigo-950/90 border border-blue-500/40 p-6 sm:p-8 shadow-2xl">
          <div className="absolute -right-12 -bottom-12 w-64 h-64 bg-blue-500/15 rounded-full blur-3xl pointer-events-none"></div>
          <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-blue-500 via-indigo-500 to-cyan-400"></div>

          <div className="flex flex-col gap-6 relative z-10">
            <div className="space-y-2.5 max-w-3xl">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/15 border border-blue-400/40 text-blue-300 text-xs font-black uppercase tracking-widest">
                <Bot className="w-3.5 h-3.5 animate-pulse text-blue-400" />
                PUMA • Acesso Integral às Apostilas
              </div>
              <h2 className="text-2xl sm:text-3xl font-black text-heading tracking-tight uppercase">
                Central de Dúvidas & Mentor IA PUMA
              </h2>
              <p className="text-sm text-muted-foreground leading-relaxed font-medium">
                Converse com o Mentor PUMA em tempo real para tirar dúvidas, estudar conceitos ou criar questões. Dúvidas respondidas em conformidade com a apostila.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3 w-full">
              <Link href="/aluno/chat" className="w-full sm:w-auto">
                <Button className="w-full sm:w-auto h-14 px-7 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-heading font-black text-xs uppercase tracking-widest rounded-xl shadow-[0_0_25px_rgba(59,130,246,0.3)] transition-all transform hover:scale-105 cursor-pointer flex items-center justify-center gap-2">
                  <MessageSquare className="w-4 h-4" />
                  Abrir Chat IA
                </Button>
              </Link>
            </div>
          </div>
        </div>

        {/* Gamification: Recompensas de Ofensiva */}
        <div className="relative overflow-hidden rounded-2xl bg-card border border-border p-5 sm:p-6 shadow-lg flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Award className="w-5 h-5 text-amber-500" />
              <h3 className="font-black text-heading uppercase tracking-wide">Trilha de Desbloqueios</h3>
            </div>
            <div className="text-right">
              <span className="text-sm font-bold text-muted-foreground uppercase tracking-wider block">Meta Atual</span>
              <span className="text-xs font-black text-primary">
                {proximaMeta.label} {proximaMeta.dias !== null ? `(${proximaMeta.dias} DIAS)` : ""}
              </span>
            </div>
          </div>

          <div className="space-y-2 relative">
            <div className="flex items-end justify-between text-xs font-bold text-muted-foreground mb-1">
              <span>{(stats?.streakDays || 0)} Dias</span>
              <span>{proximaMeta.dias !== null ? `${proximaMeta.dias} Dias` : "Completa"}</span>
            </div>
            <div className="w-full bg-muted rounded-full h-3.5 overflow-hidden border border-border/50">
              <div
                className={`h-full transition-all duration-1000 bg-gradient-to-r ${proximaMeta.corBarra}`}
                style={{ width: `${proximaMeta.dias !== null ? Math.min(((stats?.streakDays || 0) / proximaMeta.dias) * 100, 100) : 100}%` }}
              />
            </div>
            {/* Markers */}
            <div className="absolute top-7 w-full flex justify-between px-1 pointer-events-none">
               <span className="text-[10px] text-muted-foreground/50 font-bold">|</span>
               <span className="text-[10px] text-muted-foreground/50 font-bold">|</span>
            </div>
          </div>
          <p className="text-[11px] font-medium text-muted-foreground text-center mt-1">
            Mantenha sua ofensiva diária resolvendo simulados para desbloquear Fardamentos Táticos para o sistema.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Left Column: Join Room & Strengths/Weaknesses */}
          <div className="lg:col-span-1 space-y-8">
            
             {/* Join Room Card */}
             <Card className="border-blue-900/50 bg-blue-950/20 shadow-2xl overflow-hidden relative">
               <div className="absolute top-0 left-0 w-1 h-full bg-blue-500"></div>
               <CardHeader>
                 <CardTitle className="text-xl text-heading flex items-center gap-2">
                   <Play className="w-5 h-5 text-blue-400" />
                   Entrar em Simulado
                 </CardTitle>
                 <CardDescription className="text-muted-foreground">
                   {activeRooms && activeRooms.length > 0 
                     ? "Insira o código do telão ou acesse um simulado ativo abaixo:" 
                     : "Insira o código do telão para iniciar"}
                 </CardDescription>
               </CardHeader>
               <CardContent className="space-y-4">
                 <form onSubmit={handleEntrar} className="space-y-4">
                   <Input 
                     placeholder="CÓDIGO DA SALA" 
                     value={codigo}
                     onChange={(e) => setCodigo(e.target.value)}
                     className="bg-card/50 border-border h-14 text-center text-2xl uppercase tracking-[0.3em] font-bold text-heading"
                     maxLength={6}
                   />
                   <Button type="submit" className="w-full h-12 bg-blue-600 hover:bg-blue-500 font-bold" disabled={!codigo.trim()}>
                     Participar via Código
                   </Button>
                 </form>

                 {activeRooms && activeRooms.length > 0 && (
                   <div className="pt-4 border-t border-blue-900/40 space-y-3">
                     <label className="text-[10px] font-black text-blue-400 uppercase tracking-widest block">
                       🔴 Simulados ao Vivo (Disponíveis)
                     </label>
                     <div className="space-y-2">
                       {activeRooms.map((room: any) => (
                         <button
                           key={room.id}
                           onClick={() => router.push(`/aluno/sala/${room.codigoSala}`)}
                           className="w-full p-3 rounded-lg border border-emerald-500/30 bg-emerald-950/10 hover:bg-emerald-950/20 transition-all flex items-center justify-between text-left group cursor-pointer"
                         >
                           <div className="min-w-0 flex-1 pr-2">
                             <span className="font-mono text-sm font-black text-emerald-400 group-hover:underline flex items-center gap-1.5">
                               <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                               Sala: {room.codigoSala}
                             </span>
                             <span className="text-[10px] font-bold text-muted-foreground block uppercase line-clamp-2 leading-snug mt-0.5" title={room.apostilaName}>
                               {formatApostilaTitle(room.apostilaName || "Simulado da IA")}
                             </span>
                           </div>
                           <div className="flex items-center gap-2 shrink-0">
                             <span className={`text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded border ${
                               room.status === "WAITING"
                                 ? "bg-amber-950/50 border-amber-500/20 text-amber-400"
                                 : "bg-emerald-950/50 border-emerald-500/20 text-emerald-400"
                             }`}>
                               {room.status === "WAITING" ? "Aguardando" : "Ao Vivo"}
                             </span>
                             <Play className="w-3.5 h-3.5 text-emerald-400 group-hover:translate-x-0.5 transition-transform" />
                           </div>
                         </button>
                       ))}
                     </div>
                   </div>
                 )}
               </CardContent>
              </Card>

              {/* Blocos de Provas */}
              {blocosDeProva && blocosDeProva.length > 0 && (
                <Card className="border-border bg-card/40 relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-amber-600 to-red-500"></div>
                  <CardHeader className="pb-3 border-b border-border/50">
                    <CardTitle className="text-lg text-heading flex items-center gap-2">
                      <GraduationCap className="w-5 h-5 text-amber-500" />
                      Blocos de Provas
                    </CardTitle>
                    <CardDescription className="text-xs text-muted-foreground">
                      Todas as questões já geradas das matérias com prova em breve, reunidas para revisão sem cronômetro.
                    </CardDescription>
                  </CardHeader>

                  <CardContent className="pt-4 space-y-3">
                    <div className="space-y-3">
                      {blocosDeProva.map((bloco, i) => (
                        <div key={i} className={`p-4 rounded-xl border flex flex-col gap-3 transition-colors ${
                          bloco.isCompleted
                            ? "bg-emerald-950/10 border-emerald-900/30 grayscale-[50%]"
                            : "bg-background border-amber-500/30 hover:border-amber-500/50"
                        }`}>
                          <div className="flex justify-between items-start gap-4">
                            <div className="min-w-0 flex-1">
                              <h4 className={`text-sm font-bold line-clamp-2 leading-snug ${bloco.isCompleted ? 'text-emerald-400/80' : 'text-amber-400'}`} title={bloco.apostilaName}>
                                {formatApostilaTitle(bloco.apostilaName)}
                              </h4>
                              <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1.5">
                                <GraduationCap className="w-3 h-3" />
                                {bloco.answeredCount}/{bloco.questionsCount} Questões
                              </p>
                            </div>

                            {bloco.isCompleted ? (
                              <div className="shrink-0 flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-emerald-500 bg-emerald-950/30 px-2 py-1 rounded border border-emerald-900/50">
                                <Check className="w-3.5 h-3.5" />
                                Concluído
                              </div>
                            ) : (
                              <Link href={`/aluno/simulado/${bloco.id}?timer=false`} className="shrink-0">
                                <Button size="sm" className="bg-amber-600 hover:bg-amber-500 text-[10px] font-black uppercase tracking-widest h-8 shadow-[0_0_15px_rgba(245,158,11,0.3)]">
                                  {bloco.answeredCount > 0 ? "Continuar" : "Iniciar Revisão"} <Play className="w-3 h-3 ml-1.5" />
                                </Button>
                              </Link>
                            )}
                          </div>
                          {bloco.isCompleted && (
                            <Link href={`/aluno/simulado/${bloco.id}/review`}>
                              <Button variant="ghost" size="sm" className="h-8 px-3 bg-blue-950/30 border border-blue-900/40 text-blue-400 hover:bg-blue-950/50 hover:text-blue-300 font-bold text-[10px] uppercase tracking-wider rounded-lg cursor-pointer">
                                Revisar
                              </Button>
                            </Link>
                          )}
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Missões Especiais */}
              {specialSimulados && specialSimulados.length > 0 && (
                <Card className="border-border bg-card/40 relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-purple-600 to-pink-500"></div>
                  <CardHeader className="pb-3 border-b border-border/50">
                    <CardTitle className="text-lg text-heading flex items-center gap-2">
                      <Target className="w-5 h-5 text-purple-500" />
                      Missões Especiais
                    </CardTitle>
                    <CardDescription className="text-xs text-muted-foreground">
                      Bateria de exercícios especiais designada pelos instrutores.
                    </CardDescription>
                  </CardHeader>
                  
                  <CardContent className="pt-4 space-y-3">
                    <div className="space-y-3">
                      {specialSimulados.map((sim, i) => (
                        <div key={i} className={`p-4 rounded-xl border flex flex-col gap-3 transition-colors ${
                          sim.isCompleted 
                            ? "bg-emerald-950/10 border-emerald-900/30 grayscale-[50%]" 
                            : sim.isExpired
                              ? "bg-muted/10 border-border opacity-60"
                              : "bg-background border-purple-500/30 hover:border-purple-500/50"
                        }`}>
                          <div className="flex justify-between items-start gap-4">
                            <div className="min-w-0 flex-1">
                              <h4 className={`text-sm font-bold line-clamp-2 leading-snug ${sim.isCompleted ? 'text-emerald-400/80' : sim.isExpired ? 'text-muted-foreground' : 'text-purple-400'}`} title={sim.apostilaName}>
                                {formatApostilaTitle(sim.apostilaName)}
                              </h4>
                              <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1.5">
                                <Target className="w-3 h-3" />
                                {sim.questionsCount} Alvos Especiais
                              </p>
                              {sim.expiresAt && !sim.isCompleted && (
                                <p className={`text-[10px] font-bold mt-2 uppercase tracking-wider ${sim.isExpired ? 'text-red-400' : 'text-purple-400/80'}`}>
                                  {sim.isExpired ? 'Prazo Expirado' : `Válido até: ${new Date(sim.expiresAt).toLocaleDateString()}`}
                                </p>
                              )}
                            </div>
                            
                            {sim.isCompleted ? (
                              <div className="shrink-0 flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-emerald-500 bg-emerald-950/30 px-2 py-1 rounded border border-emerald-900/50">
                                <Check className="w-3.5 h-3.5" />
                                Cumprida
                              </div>
                            ) : sim.isExpired ? (
                              <div className="shrink-0 flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-red-500 bg-red-950/30 px-2 py-1 rounded border border-red-900/50">
                                Fechada
                              </div>
                            ) : (
                              <Link href={`/aluno/simulado/${sim.id}`} className="shrink-0">
                                <Button size="sm" className="bg-purple-600 hover:bg-purple-500 text-[10px] font-black uppercase tracking-widest h-8 shadow-[0_0_15px_rgba(168,85,247,0.3)]">
                                  Iniciar Missão <Play className="w-3 h-3 ml-1.5" />
                                </Button>
                              </Link>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Simulados Diários / Estudo Individual */}
              <Card className="border-border bg-card/40 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-600 to-indigo-500"></div>
                <CardHeader className="pb-3 border-b border-border/50">
                  <CardTitle className="text-lg text-heading flex items-center gap-2">
                    <BookOpen className="w-5 h-5 text-blue-500" />
                    Missões do Dia: Estudo Individual
                  </CardTitle>
                  <CardDescription className="text-xs text-muted-foreground">
                    Simulados diários avançados gerados por IA para treinar em casa.
                  </CardDescription>
                </CardHeader>
                
                <CardContent className="pt-4 space-y-3">
                  {/* Tab Selector */}
                  <div className="flex border-b border-border/80 mb-4 text-[10px] font-black uppercase tracking-wider">
                    <button
                      onClick={() => setDailyTab("TODAY")}
                      className={`flex-1 pb-2 border-b-2 text-center transition-all cursor-pointer ${
                        dailyTab === "TODAY" 
                          ? "border-blue-500 text-blue-400 font-black" 
                          : "border-transparent text-muted-foreground hover:text-muted-foreground"
                      }`}
                    >
                      Hoje ({dailySimulados.length})
                    </button>
                    <button
                      onClick={() => setDailyTab("HISTORY")}
                      className={`flex-1 pb-2 border-b-2 text-center transition-all cursor-pointer ${
                        dailyTab === "HISTORY" 
                          ? "border-blue-500 text-blue-400 font-black" 
                          : "border-transparent text-muted-foreground hover:text-muted-foreground"
                      }`}
                    >
                      Histórico ({pastDailyList.length}{hasMorePastDaily ? "+" : ""})
                    </button>
                  </div>

                  {dailyTab === "TODAY" ? (
                    <div className="space-y-3">
                      {isGeneratingDaily && (
                        <div className="p-3 bg-blue-950/40 border border-blue-500/30 text-blue-200 rounded-xl flex items-center gap-3 animate-pulse">
                          <Loader2 className="w-5 h-5 text-blue-400 animate-spin shrink-0" />
                          <div>
                            <span className="font-bold text-xs uppercase block tracking-wider">Preparando Missões</span>
                            <span className="text-[10px] text-muted-foreground font-medium">Novos simulados diários estão sendo elaborados pela inteligência artificial. Aguarde alguns instantes...</span>
                          </div>
                        </div>
                      )}

                      {dailySimulados.length === 0 ? (
                        <div className="text-center text-muted-foreground py-6 text-xs uppercase font-black tracking-wider">
                          {isGeneratingDaily ? "Aguardando geração..." : "Nenhuma missão disponível hoje."}
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {dailySimulados.map((sim: any) => {
                            const isNew = sim.apostilaCreatedAt ? (new Date().getTime() - new Date(sim.apostilaCreatedAt).getTime()) < 24 * 60 * 60 * 1000 : false;
                            
                            return (
                            <div
                              key={sim.id}
                              className="p-3.5 rounded-lg border border-border bg-background/40 flex items-center justify-between gap-3 text-left"
                            >
                              <div className="min-w-0 flex-1">
                                <span className="text-xs font-black text-muted-foreground block line-clamp-2 leading-snug" title={sim.apostilaName}>
                                  {formatApostilaTitle(sim.apostilaName)}
                                  {isNew && <span className="ml-2 inline-block bg-blue-600 text-heading text-[9px] px-1.5 py-0.5 rounded uppercase font-black animate-pulse">Novo</span>}
                                </span>
                                <span className="text-[10px] font-bold text-muted-foreground block uppercase mt-0.5">
                                  {sim.questionsCount} Alvos • Dificuldade Máxima
                                </span>
                              </div>
                              
                              <div className="flex items-center gap-2 shrink-0">
                                {sim.isCompleted ? (
                                  <>

                                    <Link href={`/aluno/simulado/${sim.id}/review`}>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-9 px-3 bg-blue-950/30 border border-blue-900/40 text-blue-400 hover:bg-blue-950/50 hover:text-blue-300 font-bold text-[10px] uppercase tracking-wider rounded-lg cursor-pointer"
                                      >
                                        Revisar
                                      </Button>
                                    </Link>
                                  </>
                                ) : (
                                  <Button
                                    size="sm"
                                    onClick={() => {
                                      setSelectedDailySimId(sim.id);
                                      setSelectedDailySimName(sim.apostilaName || "");
                                      setUseTimer(true);
                                      setTimerSeconds("60");
                                    }}
                                    className="h-9 px-4 bg-emerald-600 hover:bg-emerald-500 text-heading font-bold text-xs uppercase tracking-wider rounded-lg cursor-pointer"
                                  >
                                    Iniciar
                                  </Button>
                                )}
                              </div>
                            </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  ) : (
                    pastDailyList.length === 0 ? (
                      <div className="text-center text-muted-foreground py-6 text-xs uppercase font-black tracking-wider">
                        Nenhum simulado histórico.
                      </div>
                    ) : (
                      <div className="space-y-2">
                      <div className="space-y-2 max-h-[300px] overflow-y-auto custom-scrollbar pr-1">
                        {pastDailyList.map((sim: any) => {
                          const isNew = sim.apostilaCreatedAt ? (new Date().getTime() - new Date(sim.apostilaCreatedAt).getTime()) < 24 * 60 * 60 * 1000 : false;
                          
                          return (
                          <div
                            key={sim.id}
                            className="p-3.5 rounded-lg border border-border bg-background/40 flex items-center justify-between gap-3 text-left"
                          >
                            <div className="min-w-0 flex-1">
                              <span className="text-xs font-black text-muted-foreground block line-clamp-2 leading-snug" title={sim.apostilaName}>
                                {formatApostilaTitle(sim.apostilaName)}
                                {isNew && <span className="ml-2 inline-block bg-blue-600 text-heading text-[9px] px-1.5 py-0.5 rounded uppercase font-black animate-pulse">Novo</span>}
                              </span>
                              <div className="flex items-center gap-1.5 mt-0.5">
                                <span className="text-[9px] font-bold text-muted-foreground uppercase">
                                  {new Date(sim.createdAt).toLocaleDateString("pt-BR")}
                                </span>
                                <span className="text-muted-foreground text-[9px] font-bold">•</span>
                                <span className="text-[9px] font-bold text-blue-500 uppercase">
                                  {sim.questionsCount} Alvos
                                </span>
                              </div>
                            </div>
                            
                            <div className="shrink-0 flex items-center gap-1.5">
                              {sim.isCompleted ? (
                                <Link href={`/aluno/simulado/${sim.id}/review`}>
                                  <Button 
                                    size="sm" 
                                    variant="ghost" 
                                    className="h-9 px-2.5 text-blue-400 bg-blue-900/10 hover:bg-blue-900/20 font-black text-[10px] uppercase tracking-wider cursor-pointer"
                                  >
                                    Revisar
                                  </Button>
                                </Link>
                              ) : (
                                <Button 
                                  size="sm" 
                                  onClick={() => {
                                    setSelectedDailySimId(sim.id);
                                    setSelectedDailySimName(sim.apostilaName);
                                    setUseTimer(true);
                                    setTimerSeconds("60");
                                  }}
                                  className="h-9 px-3 bg-blue-600 hover:bg-blue-500 text-heading font-black text-[10px] uppercase tracking-wider shadow-md cursor-pointer"
                                >
                                  Iniciar
                                </Button>
                              )}
                            </div>
                          </div>
                          );
                        })}
                      </div>
                      {hasMorePastDaily && (
                        <Button
                          onClick={handleLoadMorePastDaily}
                          disabled={loadingMorePastDaily}
                          variant="ghost"
                          size="sm"
                          className="w-full h-9 text-blue-400 bg-blue-900/10 hover:bg-blue-900/20 font-black text-[10px] uppercase tracking-wider cursor-pointer"
                        >
                          {loadingMorePastDaily ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            "Carregar Mais"
                          )}
                        </Button>
                      )}
                      </div>
                    )
                  )}
                </CardContent>
              </Card>

            {/* Strengths & Weaknesses */}
            <Card className="border-border bg-card/40 relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-500 to-blue-500"></div>
              <CardHeader>
                <CardTitle className="text-lg text-heading flex items-center gap-2">
                  <Target className="w-5 h-5 text-emerald-400" />
                  Análise do Mentor Policial
                </CardTitle>
              </CardHeader>
              <CardContent>
                {stats?.simuladosCount === 0 ? (
                  <div className="text-center text-muted-foreground py-4 space-y-3">
                    <p>Responda simulados para gerar o seu perfil de desempenho tático.</p>
                    <Link href="/aluno/chat" className="inline-block mt-2">
                      <Button 
                        className="bg-blue-600 hover:bg-blue-500 text-heading font-bold text-xs uppercase tracking-wider px-4 py-2.5 rounded-lg cursor-pointer transition-colors"
                      >
                        Tirar Dúvidas das Apostilas
                      </Button>
                    </Link>
                  </div>
                ) : loadingAi ? (
                  <div className="flex flex-col items-center justify-center py-6 text-muted-foreground space-y-3">
                    <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
                    <p className="text-sm font-medium animate-pulse">A IA está analisando seu combate...</p>
                  </div>
                ) : aiAnalysis ? (
                  <div className="space-y-4">
                    <div className="text-muted-foreground leading-relaxed text-sm italic border-l-4 border-border pl-4 py-2 bg-muted/30 rounded-r-lg">
                      "{aiAnalysis}"
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-border/60">
                      <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                        Uso diário: 1 vez por dia
                      </span>
                      <div className="flex flex-wrap gap-2">
                        {isAnalysisDoneToday ? (
                          <Button 
                            disabled
                            className="bg-muted/80 border border-border text-muted-foreground font-bold text-[10px] uppercase tracking-wider h-8 px-3 cursor-not-allowed flex items-center gap-1.5"
                          >
                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                            Análise de Hoje Concluída
                          </Button>
                        ) : (
                          <Button 
                            onClick={handleGenerateAnalysis}
                            className="bg-emerald-600 hover:bg-emerald-500 text-heading font-bold text-[10px] uppercase tracking-wider h-8 px-3 cursor-pointer"
                          >
                            Atualizar Análise do Dia
                          </Button>
                        )}
                        <Link href="/aluno/chat">
                          <Button 
                            variant="outline"
                            className="border-border text-muted-foreground hover:text-heading hover:bg-muted text-[10px] font-bold uppercase tracking-wider h-8 px-3 cursor-pointer flex items-center gap-1.5"
                          >
                            <MessageSquare className="w-3 h-3 text-blue-400" />
                            Ir para o Chat
                          </Button>
                        </Link>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-4 space-y-3">
                    <p className="text-muted-foreground text-sm text-center">Você possui dados de simulados disponíveis para análise.</p>
                    <div className="flex flex-col sm:flex-row gap-2 w-full justify-center">
                      <Button 
                        onClick={handleGenerateAnalysis}
                        disabled={isAnalysisDoneToday}
                        className="bg-emerald-600 hover:bg-emerald-500 text-heading font-bold text-xs uppercase tracking-wider px-4 py-2.5 rounded-lg cursor-pointer transition-colors flex-1"
                      >
                        {isAnalysisDoneToday ? "Análise Diária Concluída" : "Solicitar Análise do Dia (1x/dia)"}
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Ranking Geral da Sala */}
            <Card className="border-border bg-card/40 relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-purple-600"></div>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg text-heading flex items-center gap-2">
                  <Trophy className="w-5 h-5 text-yellow-500" />
                  Ranking Geral da Sala
                </CardTitle>
                <CardDescription className="text-xs">Classificação geral de todos os combatentes ativos.</CardDescription>
              </CardHeader>
              <CardContent className="p-0 max-h-[480px] overflow-y-auto custom-scrollbar">
                {generalRanking.length === 0 ? (
                  <div className="p-6 text-center text-muted-foreground text-sm">Nenhum combatente ativo.</div>
                ) : (
                  <div className="divide-y divide-border">
                    {generalRanking.map((aluno, index) => {
                      const isMe = aluno.id === user.userId;
                      return (
                        <div 
                          key={aluno.id} 
                          className={`flex flex-col gap-2 p-3.5 transition-colors ${
                            isMe 
                              ? 'bg-blue-950/20 border-y border-blue-500/20 shadow-[inset_0_0_15px_rgba(59,130,246,0.05)]' 
                              : 'hover:bg-muted/30'
                          }`}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <span className={`flex items-center justify-center shrink-0 w-6 h-6 rounded-full text-xs font-black ${
                              index === 0 ? 'bg-yellow-500 text-yellow-950 shadow-[0_0_10px_rgba(234,179,8,0.3)]' : 
                              index === 1 ? 'bg-secondary text-foreground' :
                              index === 2 ? 'bg-amber-700 text-amber-100' : 'bg-muted text-muted-foreground'
                            }`}>
                              {index + 1}
                            </span>
                            {(() => {
                              const p = getPatentByScore(aluno.totalScore || 0);
                              const alunoHasBepi = (aluno.streakDays || 0) >= 35;
                              const alunoHasChoque = (aluno.streakDays || 0) >= 50;
                              const alunoRing = alunoHasChoque
                                ? 'ring-2 ring-[#b91c1c] ring-offset-1 ring-offset-background'
                                : alunoHasBepi
                                ? 'ring-2 ring-[#c9a227] ring-offset-1 ring-offset-background'
                                : '';
                              const alunoRingTitle = alunoHasChoque ? "Fardamento CHOQUE" : alunoHasBepi ? "Fardamento BEPI" : undefined;
                              return (
                                <div className={`shrink-0 rounded-full ${alunoRing}`} title={alunoRingTitle}>
                                  <div className={`rounded-full ${p.avatarRing || ''}`}>
                                    {aluno.avatarUrl ? (
                                      <img src={aluno.avatarUrl} alt="Avatar" className="w-8 h-8 rounded-full object-cover border border-border" />
                                    ) : (
                                      <div className="w-8 h-8 rounded-full bg-muted text-muted-foreground flex items-center justify-center text-xs font-bold border border-border">
                                        {aluno.name.substring(0, 2).toUpperCase()}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              );
                            })()}
                            <div className="flex items-center gap-1.5 flex-wrap">
                              {(() => {
                                const p = getPatentByScore(aluno.totalScore || 0);
                                const PIcon = p.icon;
                                return (
                                  <>
                                    <span className={`font-bold text-sm uppercase leading-snug ${p.nameEffect || (isMe ? 'text-blue-400' : 'text-foreground')}`} title={aluno.name}>
                                      {aluno.numero ? `${String(aluno.numero).padStart(2, '0')} - ${aluno.name}` : aluno.name}
                                    </span>
                                    <span className={`${p.color} ${p.glow || ''}`} title={p.name}>
                                      <PIcon className={`w-4 h-4 ${p.iconAnimation || ''}`} />
                                    </span>
                                  </>
                                );
                              })()}
                              {(aluno.displayedBadges || []).length > 0 && (
                                <span className="flex items-center gap-1">
                                  {getBadges(undefined)
                                    .filter((b: any) => aluno.displayedBadges.includes(b.id))
                                    .map((b: any) => {
                                      const BIcon = b.icon;
                                      return (
                                        <span key={b.id} className={b.color} title={b.name}>
                                          <BIcon className="w-3.5 h-3.5" />
                                        </span>
                                      );
                                    })}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center justify-between gap-2 pl-9">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              {aluno.streakDays > 0 && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-orange-950/80 border border-orange-500/40 text-orange-400 font-black text-xs shadow-[0_0_8px_rgba(249,115,22,0.2)]" title="Sequência Diária">
                                  <Flame className="w-3.5 h-3.5 fill-orange-500 text-orange-500 animate-pulse" />
                                  {aluno.streakDays}d
                                </span>
                              )}
                              {(aluno.streakDays || 0) >= 35 && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#2e2419]/90 border border-[#c9a227]/50 text-[#c9a227] font-black text-xs shadow-[0_0_8px_rgba(201,162,39,0.25)]" title="Fardamento BEPI Desbloqueado">
                                  <BepiEagleIcon className="w-3.5 h-3.5" />
                                  BEPI
                                </span>
                              )}
                              {(aluno.streakDays || 0) >= 50 && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-black/80 border border-[#b91c1c]/60 text-[#e05252] font-black text-xs shadow-[0_0_8px_rgba(185,28,28,0.3)]" title="Fardamento CHOQUE Desbloqueado">
                                  <ChoqueSkullIcon className="w-3.5 h-3.5" />
                                  CHOQUE
                                </span>
                              )}
                              {typeof aluno.todayPoints === 'number' && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-yellow-950/80 border border-yellow-500/40 text-yellow-400 font-black text-xs" title="Pontos conquistados hoje (Ao Dia)">
                                  <Zap className="w-3 h-3 fill-yellow-400 text-yellow-400" />
                                  +{aluno.todayPoints} ao dia
                                </span>
                              )}
                            </div>
                            <span className="font-mono font-black text-xs text-blue-400 shrink-0">{aluno.totalScore} pts</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Mural de Brevês */}
            <Card className="border-border bg-card/40 relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-yellow-500 to-amber-600"></div>
              <CardHeader className="flex flex-row items-start justify-between gap-3">
                <div>
                  <CardTitle className="text-lg text-heading flex items-center gap-2">
                    <Award className="w-5 h-5 text-yellow-500" />
                    Mural de Brevês
                  </CardTitle>
                  <CardDescription className="text-xs">Desbloqueie insígnias pelo seu desempenho em combate.</CardDescription>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleOpenBadgeMenu}
                  className="h-9 px-3 text-xs font-bold uppercase tracking-wider border-border text-muted-foreground hover:text-heading shrink-0"
                  title="Escolher quais brevês aparecem ao lado da sua divisa no ranking"
                >
                  <SlidersHorizontal className="w-3.5 h-3.5 mr-1.5" />
                  Exibir no Ranking
                </Button>
              </CardHeader>
              <CardContent className="space-y-4 max-h-[500px] overflow-y-auto custom-scrollbar pr-2">
                {getBadges(stats).map((b: any) => {
                  const isUnlocked = user?.unlockedBadges?.includes(b.id);
                  const Icon = b.icon;
                  return (
                    <div key={b.id} className={`flex items-start gap-4 p-3 rounded-lg border ${isUnlocked ? b.border + ' ' + b.bg : 'border-border bg-card/30 grayscale opacity-50'} transition-all`}>
                      <div className={`shrink-0 w-12 h-12 rounded-full flex items-center justify-center border-2 shadow-inner ${isUnlocked ? b.border + ' ' + b.color : 'border-border text-muted-foreground'}`}>
                        {isUnlocked ? <Icon className="w-6 h-6" /> : <Lock className="w-5 h-5" />}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h4 className={`font-bold text-sm tracking-wide uppercase ${isUnlocked ? b.color : 'text-muted-foreground'}`}>{b.name}</h4>
                          {(b.isElite || b.exclusive) && (
                            <span className="text-[10px] font-black bg-amber-500/20 text-amber-500 border border-amber-500/30 px-1.5 py-0.5 rounded uppercase tracking-widest">
                              Elite
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">{b.desc}</p>
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>

          </div>

          {/* Right Column: General Stats & History */}
          <div className="lg:col-span-2 space-y-8">
            
            {/* Stats Grid */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
              <Card className="border-border bg-card/60 p-3.5 flex flex-col items-center justify-center text-center">
                <Award className="w-7 h-7 text-yellow-500 mb-1.5" />
                <p className="text-2xl font-black text-heading">{stats?.simuladosCount || 0}</p>
                <p className="text-[11px] text-muted-foreground uppercase font-bold tracking-wider mt-1">Simulados</p>
              </Card>
              <Card className="border-border bg-card/60 p-3.5 flex flex-col items-center justify-center text-center">
                <Target className="w-7 h-7 text-blue-500 mb-1.5" />
                <p className="text-2xl font-black text-heading">{stats?.accuracy || 0}%</p>
                <p className="text-[11px] text-muted-foreground uppercase font-bold tracking-wider mt-1">Taxa Global</p>
              </Card>
              <Card className="border-border bg-card/60 p-3.5 flex flex-col items-center justify-center text-center">
                <TrendingUp className="w-7 h-7 text-emerald-500 mb-1.5" />
                <p className="text-2xl font-black text-emerald-400">{stats?.totalScore || 0}</p>
                <p className="text-[11px] text-muted-foreground uppercase font-bold tracking-wider mt-1">Pontos Totais</p>
              </Card>
              <Card className="border-border bg-card/60 p-3.5 flex flex-col items-center justify-center text-center">
                <Clock className="w-7 h-7 text-orange-500 mb-1.5" />
                <p className="text-2xl font-black text-heading">{stats?.avgTime || 0}s</p>
                <p className="text-[11px] text-muted-foreground uppercase font-bold tracking-wider mt-1">Tempo Médio</p>
              </Card>
              <Card className="border-orange-500/30 bg-gradient-to-b from-orange-950/40 to-card/80 p-3.5 flex flex-col items-center justify-center text-center shadow-[0_0_15px_rgba(249,115,22,0.1)] relative overflow-hidden">
                <Flame className="w-7 h-7 text-orange-500 fill-orange-500/30 mb-1.5 animate-bounce" />
                <p className="text-2xl font-black text-orange-400">{stats?.streakDays || 0}</p>
                <p className="text-[11px] text-orange-300 uppercase font-bold tracking-wider mt-1">Sequência (Dias)</p>
                <span className="text-[9px] text-muted-foreground mt-0.5">+100 pts/dia</span>
              </Card>
              <Card className="border-yellow-500/30 bg-gradient-to-b from-yellow-950/40 to-card/80 p-3.5 flex flex-col items-center justify-center text-center shadow-[0_0_15px_rgba(234,179,8,0.1)] relative overflow-hidden">
                <Zap className="w-7 h-7 text-yellow-400 fill-yellow-400/30 mb-1.5" />
                <p className="text-2xl font-black text-yellow-400">+{stats?.todayPoints || 0}</p>
                <p className="text-[11px] text-yellow-300 uppercase font-bold tracking-wider mt-1">Pontos Hoje</p>
                <span className="text-[9px] text-muted-foreground mt-0.5">Ao Dia</span>
              </Card>
            </div>

            {/* History Table */}
            <Card className="border-border bg-card/40">
              <CardHeader>
                <CardTitle className="text-lg text-heading">Histórico de Combate</CardTitle>
                <CardDescription>Seus resultados nos últimos simulados realizados.</CardDescription>
              </CardHeader>
              <CardContent>
                {!stats || stats.simuladosCount === 0 ? (
                  <div className="text-center text-muted-foreground py-8 bg-muted/30 rounded-lg border border-border/50">
                    Você ainda não participou de nenhum simulado.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-muted text-muted-foreground">
                        <tr>
                          <th className="px-4 py-3 font-medium rounded-tl-lg">Código da Sala</th>
                          <th className="px-4 py-3 font-medium">Questões</th>
                          <th className="px-4 py-3 font-medium">Acertos</th>
                          <th className="px-4 py-3 font-medium">Taxa Local</th>
                          <th className="px-4 py-3 font-medium">Pontuação</th>
                          <th className="px-4 py-3 font-medium rounded-tr-lg text-right">Ações</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {stats.history.map((h: any, idx: number) => (
                          <tr key={idx} className="hover:bg-muted/30 transition-colors">
                            <td className="px-4 py-4 font-mono font-bold text-blue-400">{h.codigoSala}</td>
                            <td className="px-4 py-4 text-muted-foreground">{h.totalQuestions} resolvidas</td>
                            <td className="px-4 py-4 text-emerald-400 font-bold">{h.correctAnswers} corretas</td>
                            <td className="px-4 py-4">
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-heading">{h.accuracy}%</span>
                                <Progress value={h.accuracy} className="w-16 h-1.5 bg-muted [&>div]:bg-emerald-500" />
                              </div>
                            </td>
                            <td className="px-4 py-4 font-mono font-bold text-yellow-500">{h.score} pts</td>
                            <td className="px-4 py-4 text-right">
                              <Button 
                                variant="outline" 
                                size="sm" 
                                className="border-blue-500/30 text-blue-400 hover:bg-blue-500/10"
                                onClick={() => router.push(`/aluno/simulado/${h.id}/review`)}
                              >
                                Ver Correção
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>

          </div>
        </div>
      </main>
      </div>

      {/* Armaria Modal */}
      <Dialog open={isArmariaOpen} onOpenChange={setIsArmariaOpen}>
        <DialogContent className="bg-background border-border text-foreground sm:max-w-2xl max-h-[80vh] overflow-y-auto custom-scrollbar">
          <DialogHeader className="border-b border-border pb-4">
            <DialogTitle className="text-xl font-black uppercase tracking-widest text-heading flex items-center gap-3">
              <Target className="w-6 h-6 text-blue-500" />
              Armaria: Ícones de Perfil
            </DialogTitle>
            <DialogDescription className="text-muted-foreground font-bold uppercase tracking-widest text-xs pt-1">
              Selecione um brevê desbloqueado para usar como foto de perfil tática.
            </DialogDescription>
          </DialogHeader>
          
          {/* Identificação QRA */}
          <div className="pt-4 pb-2">
            <div className="p-4 bg-card/60 border border-border rounded-xl space-y-3">
              <label className="text-[10px] font-black text-blue-400 uppercase tracking-widest block">
                Identificação do Combatente (QRA)
              </label>
              <form onSubmit={handleSaveName} className="flex gap-2 items-end">
                <div className="flex-1 space-y-1">
                  <Input
                    value={newName}
                    onChange={(e) => {
                      setNewName(e.target.value);
                      setNameError("");
                    }}
                    placeholder="Nome de Guerra (QRA)"
                    className="bg-background border-border h-10 font-bold uppercase text-heading"
                    maxLength={30}
                  />
                </div>
                <Button 
                  type="submit" 
                  size="sm" 
                  className="bg-blue-600 hover:bg-blue-500 font-bold h-10 px-4 shrink-0" 
                  disabled={updatingName || !newName.trim() || newName.trim().toUpperCase() === user?.name?.toUpperCase()}
                >
                  {updatingName ? <Loader2 className="w-4 h-4 animate-spin" /> : "Salvar QRA"}
                </Button>
              </form>
              {nameError && <p className="text-xs text-red-400 font-semibold">{nameError}</p>}
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 pt-4">
            {/* Ícone Padrão (Sem Foto) */}
            <button 
              onClick={() => handleChangeAvatar("")}
              className="flex flex-col items-center justify-center p-4 rounded-xl border border-border bg-card/50 hover:bg-muted transition-all gap-3 h-40"
            >
              <div className="w-16 h-16 rounded-full bg-muted border-2 border-border flex items-center justify-center text-muted-foreground font-bold text-xl">
                {user?.name?.substring(0, 2).toUpperCase() || "AL"}
              </div>
              <span className="text-xs font-bold text-muted-foreground uppercase">Recruta (Sem Foto)</span>
            </button>

            {/* Ícones Básicos / Iniciais */}
            {["01", "02", "03", "04", "05"].map((avatarId) => (
              <button 
                key={avatarId}
                onClick={() => handleChangeAvatar(`predefined/${avatarId}`)}
                className="flex flex-col items-center justify-center p-4 rounded-xl border border-border bg-muted/30 hover:bg-muted transition-all gap-3 h-40 group"
              >
                <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-border group-hover:border-blue-500 transition-colors">
                  <img src={`/avatars/predefined/${avatarId}.png`} alt={`Avatar ${avatarId}`} className="w-full h-full object-cover" />
                </div>
                <span className="text-xs font-bold text-muted-foreground uppercase">Padrão {avatarId}</span>
              </button>
            ))}

            {/* Brevês Desbloqueados (só os que já têm arte de avatar em public/avatars/) */}
            {getBadges(stats).map(badge => {
              const isUnlocked = user?.unlockedBadges?.includes(badge.id);
              const Icon = badge.icon;

              if (!isUnlocked || !BADGE_AVATAR_IDS.has(badge.id)) return null;

              return (
                <button 
                  key={badge.id}
                  onClick={() => handleChangeAvatar(badge.id)}
                  className={`flex flex-col items-center justify-center p-4 rounded-xl border ${badge.border} ${badge.bg} hover:brightness-125 transition-all gap-3 h-40 group relative overflow-hidden`}
                >
                  <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-white to-transparent opacity-0 group-hover:opacity-50 transition-opacity"></div>
                  <div className={`w-16 h-16 rounded-full border-2 border-white/20 flex items-center justify-center shrink-0 bg-background/50 relative overflow-hidden group-hover:border-white/50 transition-colors`}>
                    <img src={`/avatars/${badge.id}.png`} alt={`Avatar ${badge.name}`} className="w-full h-full object-cover" />
                  </div>
                  <span className={`text-xs font-black uppercase tracking-wider text-center ${badge.color}`}>
                    {badge.name}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="mt-4 p-4 bg-blue-950/30 border border-blue-900/50 rounded-lg">
            <p className="text-sm text-blue-400">
              <strong>Nota do Comando:</strong> Continue cumprindo missões e se destacando nas operações para desbloquear novos avatares. Os brevês não conquistados ainda não aparecem no seu arsenal.
            </p>
          </div>
        </DialogContent>
      </Dialog>

      {/* Escolha dos Brevês exibidos ao lado da divisa no Ranking */}
      <Dialog open={isBadgeMenuOpen} onOpenChange={setIsBadgeMenuOpen}>
        <DialogContent className="bg-background border-border text-foreground sm:max-w-lg max-h-[80vh] overflow-y-auto custom-scrollbar">
          <DialogHeader className="border-b border-border pb-4">
            <DialogTitle className="text-xl font-black uppercase tracking-widest text-heading flex items-center gap-3">
              <SlidersHorizontal className="w-6 h-6 text-yellow-500" />
              Brevês no Ranking
            </DialogTitle>
            <DialogDescription className="text-muted-foreground font-bold uppercase tracking-widest text-xs pt-1">
              Escolha até {MAX_DISPLAYED_BADGES} brevês desbloqueados para aparecer ao lado da sua divisa no Ranking Geral da Sala ({selectedBadges.length}/{MAX_DISPLAYED_BADGES} selecionados).
            </DialogDescription>
          </DialogHeader>

          <div className="pt-4 space-y-2">
            {getBadges(stats).filter((b: any) => user?.unlockedBadges?.includes(b.id)).length === 0 ? (
              <div className="py-8 text-center text-muted-foreground text-xs font-bold uppercase tracking-wider">
                Você ainda não desbloqueou nenhum brevê.
              </div>
            ) : (
              getBadges(stats)
                .filter((b: any) => user?.unlockedBadges?.includes(b.id))
                .map((b: any) => {
                  const Icon = b.icon;
                  const isSelected = selectedBadges.includes(b.id);
                  const isDisabled = !isSelected && selectedBadges.length >= MAX_DISPLAYED_BADGES;
                  return (
                    <button
                      key={b.id}
                      type="button"
                      onClick={() => handleToggleBadgeSelection(b.id)}
                      disabled={isDisabled}
                      className={`w-full flex items-center gap-3 p-3 rounded-lg border transition-all text-left ${
                        isSelected
                          ? b.border + ' ' + b.bg
                          : isDisabled
                          ? 'border-border bg-card/20 opacity-40 cursor-not-allowed'
                          : 'border-border bg-card/30 hover:bg-card/50 cursor-pointer'
                      }`}
                    >
                      <div className={`shrink-0 w-9 h-9 rounded-full flex items-center justify-center border-2 ${isSelected ? b.border + ' ' + b.color : 'border-border text-muted-foreground'}`}>
                        <Icon className="w-4.5 h-4.5" />
                      </div>
                      <span className={`flex-1 text-xs font-black uppercase tracking-wider ${isSelected ? b.color : 'text-muted-foreground'}`}>
                        {b.name}
                      </span>
                      {isSelected && <Check className="w-4 h-4 text-emerald-400 shrink-0" />}
                    </button>
                  );
                })
            )}
          </div>

          <Button
            onClick={handleSaveDisplayedBadges}
            disabled={savingBadges}
            className="w-full h-11 bg-yellow-600 hover:bg-yellow-500 font-bold uppercase tracking-wider text-xs mt-4"
          >
            {savingBadges ? <Loader2 className="w-4 h-4 animate-spin" /> : "Salvar Seleção"}
          </Button>
        </DialogContent>
      </Dialog>

      {/* Daily Simulado Configuration Modal */}
      <Dialog open={selectedDailySimId !== null} onOpenChange={(open) => { if (!open) setSelectedDailySimId(null); }}>
        <DialogContent className="bg-background border-border text-foreground w-[92vw] max-w-md sm:max-w-md rounded-xl">
          <DialogHeader className="border-b border-border pb-4">
            <DialogTitle className="text-xl font-black uppercase tracking-widest text-heading flex items-center gap-3">
              <BookOpen className="w-6 h-6 text-blue-500" />
              Configurar Simulado
            </DialogTitle>
            <DialogDescription className="text-muted-foreground font-bold uppercase tracking-widest text-xs pt-1">
              Escolha as configurações para iniciar seus estudos.
            </DialogDescription>
          </DialogHeader>

          <div className="py-4 space-y-6">
            {/* Informações da apostila */}
            <div className="p-4 bg-card/60 border border-border rounded-xl">
              <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest block">Material Base</span>
              <span className="text-sm font-bold text-heading block mt-0.5 break-words whitespace-normal">{selectedDailySimName}</span>
              <span className="text-[9px] font-bold text-blue-400 block uppercase mt-1">25 Alvos (Questões Avançadas)</span>
            </div>

            {/* Opção de Timer */}
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3.5 rounded-xl border border-border bg-card/40">
                <div>
                  <label htmlFor="use-timer-toggle" className="text-sm font-bold text-heading block cursor-pointer">
                    Limite de Tempo por Questão
                  </label>
                  <span className="text-[10px] text-muted-foreground uppercase font-medium">Ativa um timer regressivo para cada alvo</span>
                </div>
                <input
                  type="checkbox"
                  id="use-timer-toggle"
                  checked={useTimer}
                  onChange={(e) => setUseTimer(e.target.checked)}
                  className="w-5 h-5 text-blue-600 bg-background border-border rounded focus:ring-blue-500 cursor-pointer"
                />
              </div>

              {useTimer && (
                <div className="space-y-2 bg-card/20 border border-border p-4 rounded-xl">
                  <label className="text-xs font-black text-muted-foreground uppercase tracking-widest block">
                    Tempo Limite (Segundos)
                  </label>
                  <select
                    value={timerSeconds}
                    onChange={(e) => setTimerSeconds(e.target.value)}
                    className="flex h-11 w-full rounded-lg bg-background border border-border px-3 py-2 text-sm text-heading focus:outline-none focus:ring-2 focus:ring-blue-600 font-bold"
                  >
                    <option value="30">30 Segundos</option>
                    <option value="45">45 Segundos</option>
                    <option value="60">60 Segundos (Padrão)</option>
                    <option value="90">90 Segundos</option>
                    <option value="120">120 Segundos</option>
                    <option value="180">180 Segundos</option>
                  </select>
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 border-t border-border pt-4">
            <Button 
              variant="ghost" 
              onClick={() => setSelectedDailySimId(null)}
              className="w-full sm:flex-1 h-12 font-bold uppercase tracking-wider text-xs border border-border text-muted-foreground hover:text-heading cursor-pointer"
            >
              Cancelar
            </Button>
            <Button
              onClick={() => {
                router.push(`/aluno/simulado/${selectedDailySimId}?timer=${useTimer}&seconds=${timerSeconds}`);
                setSelectedDailySimId(null);
              }}
              className="w-full sm:flex-1 h-12 bg-blue-600 hover:bg-blue-500 font-bold uppercase tracking-wider text-xs text-heading cursor-pointer"
            >
              Iniciar Combate
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
