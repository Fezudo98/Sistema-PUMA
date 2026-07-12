"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useRouter, useSearchParams } from "next/navigation";
import { logout } from "@/app/actions/auth";
import { LogOut, Play, Target, ShieldAlert, Award, TrendingUp, AlertTriangle, Loader2, Shield, ShieldCheck, Crosshair, Skull, Zap, Medal, Lock, Frown, Timer, Moon, TrendingDown, Trophy, Edit, BookOpen, MessageSquare, Bot, Check } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import HeaderAvatar from "@/components/HeaderAvatar";
import Link from "next/link";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { updateUserAvatar, updateUserName } from "@/app/actions/user";
import { resetSimuladoAttempt } from "@/app/actions/dailySimulado";

const getBadges = (stats: any) => {
  const s = stats || { simuladosCount: 0, accuracy: 0, avgTime: 0, totalScore: 0, history: [] };
  
  return [
    {
      id: 'recruta',
      name: 'Recruta',
      icon: Shield,
      earned: s.simuladosCount >= 1, // Only for preview, actual logic is on server
      desc: 'Concluir por completo um simulado, seja qual for.',
      color: 'text-amber-600',
      bg: 'bg-amber-900/20',
      border: 'border-amber-700/50'
    },
    {
      id: 'guerreiro',
      name: 'Guerreiro',
      icon: ShieldCheck,
      earned: s.simuladosCount >= 5, 
      desc: 'Completar 5 simulados de nível avançado e ter no mínimo 70% de média de acertos neles.',
      color: 'text-slate-300',
      bg: 'bg-slate-700/30',
      border: 'border-slate-400/50'
    },
    {
      id: 'veterano',
      name: 'Veterano',
      icon: ShieldAlert,
      earned: s.simuladosCount >= 10,
      desc: 'Completar 10 simulados de nível avançado e ter no mínimo 75% de média de acertos neles.',
      color: 'text-yellow-500',
      bg: 'bg-yellow-900/20',
      border: 'border-yellow-500/50'
    },
    {
      id: 'sniper',
      name: 'Atirador de Elite',
      icon: Crosshair,
      earned: false, 
      exclusive: true,
      desc: 'Atingir 100% de acerto em um simulado de nível avançado de no mínimo 15 questões.',
      color: 'text-emerald-500',
      bg: 'bg-emerald-900/20',
      border: 'border-emerald-500/50'
    },
    {
      id: 'raio',
      name: 'Pronto Resposta (Raio)',
      icon: Zap,
      earned: false,
      exclusive: true,
      desc: 'Concluir um simulado de nível avançado, com tempo médio máximo de 20s e mín 80% de acertos.',
      color: 'text-amber-400',
      bg: 'bg-amber-900/20',
      border: 'border-amber-400/50'
    },
    {
      id: 'caveira',
      name: 'Caveira',
      icon: Skull,
      earned: false,
      exclusive: true,
      desc: 'Concluir no mínimo 15 simulados avançados e ter taxa global de acertos no mínimo 95%.',
      color: 'text-purple-500',
      bg: 'bg-purple-900/20',
      border: 'border-purple-500/50'
    },
    {
      id: 'padrao',
      name: 'Padrão PM',
      icon: Medal,
      earned: false,
      exclusive: true,
      desc: 'Alcançar 45.000 pontos totais e ter no mínimo taxa global de acertos em 90%.',
      color: 'text-blue-500',
      bg: 'bg-blue-900/20',
      border: 'border-blue-500/50'
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
  isGeneratingDaily = false
}: { 
  user: any; 
  stats?: any; 
  generalRanking?: any[]; 
  activeRooms?: any[]; 
  dailySimulados?: any[];
  pastDailySimulados?: any[];
  isGeneratingDaily?: boolean;
}) {
  const [codigo, setCodigo] = useState("");
  const [aiAnalysis, setAiAnalysis] = useState(user?.aiAnalysis || "");
  const [loadingAi, setLoadingAi] = useState(false);
  const [isArmariaOpen, setIsArmariaOpen] = useState(false);
  const [newName, setNewName] = useState(user?.name || "");
  const [updatingName, setUpdatingName] = useState(false);
  const [nameError, setNameError] = useState("");
  const [selectedDailySimId, setSelectedDailySimId] = useState<string | null>(null);
  const [selectedDailySimName, setSelectedDailySimName] = useState<string>("");
  const [useTimer, setUseTimer] = useState<boolean>(true);
  const [timerSeconds, setTimerSeconds] = useState<string>("60");
  const [dailyTab, setDailyTab] = useState<"TODAY" | "HISTORY">("TODAY");
  const [loadingResetId, setLoadingResetId] = useState<string | null>(null);
  const [generatedToday, setGeneratedToday] = useState<boolean>(false);
  const router = useRouter();

  const isAnalysisDoneToday = generatedToday || Boolean(
    user?.aiAnalysisDate &&
    new Date(user.aiAnalysisDate).toDateString() === new Date().toDateString()
  );

  const handleRefazer = async (simId: string, name: string) => {
    if (!confirm(`Deseja realmente refazer o simulado de "${name}"? Suas respostas anteriores serão apagadas.`)) {
      return;
    }
    
    setLoadingResetId(simId);
    const res = await resetSimuladoAttempt(user.id || user.userId, simId);
    setLoadingResetId(null);
    
    if (res.error) {
      alert(res.error);
      return;
    }

    // Abre o modal de configuração de tempo para reiniciar
    setSelectedDailySimId(simId);
    setSelectedDailySimName(name);
    setUseTimer(true);
    setTimerSeconds("60");
  };

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

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200">
      {/* Top Header */}
      <header className="border-b border-slate-800 bg-slate-900/50 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 h-20 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Image src="/logo.png" alt="Logo" width={50} height={50} className="drop-shadow-lg" />
            <div>
              <h1 className="text-xl font-bold text-white tracking-tight">Sistema PUMA</h1>
              <p className="text-xs text-blue-400 font-medium uppercase tracking-wider">Painel do Aluno</p>
            </div>
          </div>
          
          <div className="flex items-center gap-6">
            <div className="text-right hidden sm:block">
              <p className="text-sm text-slate-400">QRA</p>
              <div className="flex items-center justify-end gap-1.5 group">
                <p className="text-lg font-bold text-white uppercase">
                  {user?.numero ? `${String(user.numero).padStart(2, '0')} - ${user.name}` : user?.name || "Aluno"}
                </p>
                <button 
                  onClick={() => {
                    setNameError("");
                    setIsArmariaOpen(true);
                  }}
                  className="text-slate-500 hover:text-blue-400 transition-colors p-1 rounded hover:bg-slate-800"
                  title="Alterar Identificação (QRA)"
                >
                  <Edit className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
            <button onClick={() => setIsArmariaOpen(true)} className="hover:scale-105 transition-transform" title="Abrir Armaria de Ícones">
              <HeaderAvatar 
                initials={user?.name?.substring(0, 2).toUpperCase() || "AL"} 
                avatarUrl={user?.avatarUrl || null} 
                disableModal={true}
              />
            </button>
            <Button variant="ghost" onClick={handleSair} className="text-slate-500 hover:text-red-400">
              <LogOut className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8 space-y-8">
        {/* Prominent Banner: Central de Inteligência & Chat com Mentor IA */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-blue-950/90 via-slate-900/95 to-indigo-950/90 border border-blue-500/40 p-6 sm:p-8 shadow-2xl">
          <div className="absolute -right-12 -bottom-12 w-64 h-64 bg-blue-500/15 rounded-full blur-3xl pointer-events-none"></div>
          <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-blue-500 via-indigo-500 to-cyan-400"></div>

          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 relative z-10">
            <div className="space-y-2.5 max-w-2xl">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/15 border border-blue-400/40 text-blue-300 text-xs font-black uppercase tracking-widest">
                <Bot className="w-3.5 h-3.5 animate-pulse text-blue-400" />
                PUMA • Acesso Integral às Apostilas
              </div>
              <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight uppercase">
                Central de Dúvidas & Mentor IA PUMA
              </h2>
              <p className="text-sm text-slate-300 leading-relaxed font-medium">
                Converse com o Mentor PUMA em tempo real para tirar dúvidas, estudar conceitos ou criar questões. Dúvidas respondidas em conformidade com a apostila.
              </p>
            </div>

            <Link href="/aluno/chat" className="w-full md:w-auto shrink-0">
              <Button className="w-full md:w-auto h-14 px-8 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-black text-sm uppercase tracking-widest rounded-xl shadow-[0_0_25px_rgba(59,130,246,0.4)] transition-all transform hover:scale-105 cursor-pointer flex items-center justify-center gap-3">
                <MessageSquare className="w-5 h-5" />
                Abrir Chat com o Mentor IA
              </Button>
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Left Column: Join Room & Strengths/Weaknesses */}
          <div className="lg:col-span-1 space-y-8">
            
             {/* Join Room Card */}
             <Card className="border-blue-900/50 bg-blue-950/20 shadow-2xl overflow-hidden relative">
               <div className="absolute top-0 left-0 w-1 h-full bg-blue-500"></div>
               <CardHeader>
                 <CardTitle className="text-xl text-white flex items-center gap-2">
                   <Play className="w-5 h-5 text-blue-400" />
                   Entrar em Simulado
                 </CardTitle>
                 <CardDescription className="text-slate-400">
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
                     className="bg-slate-900/50 border-slate-700 h-14 text-center text-2xl uppercase tracking-[0.3em] font-bold text-white"
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
                             <span className="text-[10px] font-bold text-slate-500 block uppercase truncate mt-0.5">
                               {room.apostilaName || "Simulado da IA"}
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

              {/* Simulados Diários / Estudo Individual */}
              <Card className="border-slate-800 bg-slate-900/40 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-600 to-indigo-500"></div>
                <CardHeader className="pb-3 border-b border-slate-800/50">
                  <CardTitle className="text-lg text-white flex items-center gap-2">
                    <BookOpen className="w-5 h-5 text-blue-500" />
                    Missões do Dia: Estudo Individual
                  </CardTitle>
                  <CardDescription className="text-xs text-slate-400">
                    Simulados diários avançados gerados por IA para treinar em casa.
                  </CardDescription>
                </CardHeader>
                
                <CardContent className="pt-4 space-y-3">
                  {/* Tab Selector */}
                  <div className="flex border-b border-slate-800/80 mb-4 text-[10px] font-black uppercase tracking-wider">
                    <button
                      onClick={() => setDailyTab("TODAY")}
                      className={`flex-1 pb-2 border-b-2 text-center transition-all cursor-pointer ${
                        dailyTab === "TODAY" 
                          ? "border-blue-500 text-blue-400 font-black" 
                          : "border-transparent text-slate-500 hover:text-slate-300"
                      }`}
                    >
                      Hoje ({dailySimulados.length})
                    </button>
                    <button
                      onClick={() => setDailyTab("HISTORY")}
                      className={`flex-1 pb-2 border-b-2 text-center transition-all cursor-pointer ${
                        dailyTab === "HISTORY" 
                          ? "border-blue-500 text-blue-400 font-black" 
                          : "border-transparent text-slate-500 hover:text-slate-300"
                      }`}
                    >
                      Histórico ({pastDailySimulados.length})
                    </button>
                  </div>

                  {dailyTab === "TODAY" ? (
                    <div className="space-y-3">
                      {isGeneratingDaily && (
                        <div className="p-3 bg-blue-950/40 border border-blue-500/30 text-blue-200 rounded-xl flex items-center gap-3 animate-pulse">
                          <Loader2 className="w-5 h-5 text-blue-400 animate-spin shrink-0" />
                          <div>
                            <span className="font-bold text-xs uppercase block tracking-wider">Preparando Missões</span>
                            <span className="text-[10px] text-slate-400 font-medium">Novos simulados diários estão sendo elaborados pela inteligência artificial. Aguarde alguns instantes...</span>
                          </div>
                        </div>
                      )}

                      {dailySimulados.length === 0 ? (
                        <div className="text-center text-slate-500 py-6 text-xs uppercase font-black tracking-wider">
                          {isGeneratingDaily ? "Aguardando geração..." : "Nenhuma missão disponível hoje."}
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {dailySimulados.map((sim: any) => (
                            <div
                              key={sim.id}
                              className="p-3.5 rounded-lg border border-slate-800 bg-slate-950/40 flex items-center justify-between gap-3 text-left"
                            >
                              <div className="min-w-0 flex-1">
                                <span className="text-xs font-black text-slate-300 block truncate">
                                  {sim.apostilaName}
                                </span>
                                <span className="text-[10px] font-bold text-slate-500 block uppercase mt-0.5">
                                  {sim.questionsCount} Alvos • Dificuldade Máxima
                                </span>
                              </div>
                              
                              <div className="flex items-center gap-2 shrink-0">
                                {sim.isCompleted ? (
                                  <>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      disabled={loadingResetId === sim.id}
                                      onClick={() => handleRefazer(sim.id, sim.apostilaName || "")}
                                      className="h-9 px-3 bg-slate-900 border border-slate-800 text-slate-400 hover:text-white font-bold text-[10px] uppercase tracking-wider rounded-lg cursor-pointer"
                                    >
                                      {loadingResetId === sim.id ? (
                                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                      ) : (
                                        "Refazer"
                                      )}
                                    </Button>
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
                                    className="h-9 px-4 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs uppercase tracking-wider rounded-lg cursor-pointer"
                                  >
                                    Iniciar
                                  </Button>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : (
                    pastDailySimulados.length === 0 ? (
                      <div className="text-center text-slate-500 py-6 text-xs uppercase font-black tracking-wider">
                        Nenhum simulado histórico.
                      </div>
                    ) : (
                      <div className="space-y-2 max-h-[300px] overflow-y-auto custom-scrollbar pr-1">
                        {pastDailySimulados.map((sim: any) => (
                          <div
                            key={sim.id}
                            className="p-3.5 rounded-lg border border-slate-800 bg-slate-950/40 flex items-center justify-between gap-3 text-left"
                          >
                            <div className="min-w-0 flex-1">
                              <span className="text-xs font-black text-slate-300 block truncate">
                                {sim.apostilaName}
                              </span>
                              <div className="flex items-center gap-1.5 mt-0.5">
                                <span className="text-[9px] font-bold text-slate-500 uppercase">
                                  {new Date(sim.createdAt).toLocaleDateString("pt-BR")}
                                </span>
                                <span className="text-slate-700 text-[9px] font-bold">•</span>
                                <span className="text-[9px] font-bold text-blue-500 uppercase">
                                  {sim.questionsCount} Alvos
                                </span>
                              </div>
                            </div>
                            
                            <div className="shrink-0 flex items-center gap-1.5">
                              {sim.isCompleted ? (
                                <>
                                  <Link href={`/aluno/simulado/${sim.id}/review`}>
                                    <Button size="sm" variant="ghost" className="h-9 px-2.5 bg-emerald-950/20 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-950/30 font-black text-[10px] uppercase tracking-wider cursor-pointer">
                                      Revisar
                                    </Button>
                                  </Link>
                                  <Button 
                                    size="sm" 
                                    variant="ghost" 
                                    disabled={loadingResetId === sim.id}
                                    onClick={() => handleRefazer(sim.id, sim.apostilaName)}
                                    className="h-9 px-2.5 bg-rose-950/20 text-rose-400 border border-rose-500/20 hover:bg-rose-950/30 font-black text-[10px] uppercase tracking-wider cursor-pointer disabled:opacity-50"
                                  >
                                    {loadingResetId === sim.id ? <Loader2 className="w-3 h-3 animate-spin text-rose-400" /> : "Refazer"}
                                  </Button>
                                </>
                              ) : (
                                <Button 
                                  size="sm" 
                                  onClick={() => {
                                    setSelectedDailySimId(sim.id);
                                    setSelectedDailySimName(sim.apostilaName);
                                    setUseTimer(true);
                                    setTimerSeconds("60");
                                  }}
                                  className="h-9 px-3 bg-blue-600 hover:bg-blue-500 text-white font-black text-[10px] uppercase tracking-wider shadow-md cursor-pointer"
                                >
                                  Iniciar
                                </Button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )
                  )}
                </CardContent>
              </Card>

            {/* Strengths & Weaknesses */}
            <Card className="border-slate-800 bg-slate-900/40 relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-500 to-blue-500"></div>
              <CardHeader>
                <CardTitle className="text-lg text-white flex items-center gap-2">
                  <Target className="w-5 h-5 text-emerald-400" />
                  Análise do Mentor Policial
                </CardTitle>
              </CardHeader>
              <CardContent>
                {stats?.simuladosCount === 0 ? (
                  <div className="text-center text-slate-500 py-4 space-y-3">
                    <p>Responda simulados para gerar o seu perfil de desempenho tático.</p>
                    <Link href="/aluno/chat" className="inline-block mt-2">
                      <Button 
                        className="bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs uppercase tracking-wider px-4 py-2.5 rounded-lg cursor-pointer transition-colors"
                      >
                        Tirar Dúvidas das Apostilas
                      </Button>
                    </Link>
                  </div>
                ) : loadingAi ? (
                  <div className="flex flex-col items-center justify-center py-6 text-slate-400 space-y-3">
                    <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
                    <p className="text-sm font-medium animate-pulse">A IA está analisando seu combate...</p>
                  </div>
                ) : aiAnalysis ? (
                  <div className="space-y-4">
                    <div className="text-slate-300 leading-relaxed text-sm italic border-l-4 border-slate-700 pl-4 py-2 bg-slate-800/30 rounded-r-lg">
                      "{aiAnalysis}"
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-800/60">
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                        Uso diário: 1 vez por dia
                      </span>
                      <div className="flex flex-wrap gap-2">
                        {isAnalysisDoneToday ? (
                          <Button 
                            disabled
                            className="bg-slate-800/80 border border-slate-700 text-slate-400 font-bold text-[10px] uppercase tracking-wider h-8 px-3 cursor-not-allowed flex items-center gap-1.5"
                          >
                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                            Análise de Hoje Concluída
                          </Button>
                        ) : (
                          <Button 
                            onClick={handleGenerateAnalysis}
                            className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[10px] uppercase tracking-wider h-8 px-3 cursor-pointer"
                          >
                            Atualizar Análise do Dia
                          </Button>
                        )}
                        <Link href="/aluno/chat">
                          <Button 
                            variant="outline"
                            className="border-slate-800 text-slate-300 hover:text-white hover:bg-slate-800 text-[10px] font-bold uppercase tracking-wider h-8 px-3 cursor-pointer flex items-center gap-1.5"
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
                    <p className="text-slate-400 text-sm text-center">Você possui dados de simulados disponíveis para análise.</p>
                    <div className="flex flex-col sm:flex-row gap-2 w-full justify-center">
                      <Button 
                        onClick={handleGenerateAnalysis}
                        disabled={isAnalysisDoneToday}
                        className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs uppercase tracking-wider px-4 py-2.5 rounded-lg cursor-pointer transition-colors flex-1"
                      >
                        {isAnalysisDoneToday ? "Análise Diária Concluída" : "Solicitar Análise do Dia (1x/dia)"}
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Ranking Geral da Sala */}
            <Card className="border-slate-800 bg-slate-900/40 relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-purple-600"></div>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg text-white flex items-center gap-2">
                  <Trophy className="w-5 h-5 text-yellow-500" />
                  Ranking Geral da Sala
                </CardTitle>
                <CardDescription className="text-xs">Classificação geral de todos os combatentes ativos.</CardDescription>
              </CardHeader>
              <CardContent className="p-0 max-h-[350px] overflow-y-auto custom-scrollbar">
                {generalRanking.length === 0 ? (
                  <div className="p-6 text-center text-slate-500 text-sm">Nenhum combatente ativo.</div>
                ) : (
                  <div className="divide-y divide-slate-800/50">
                    {generalRanking.map((aluno, index) => {
                      const isMe = aluno.id === user.userId;
                      return (
                        <div 
                          key={aluno.id} 
                          className={`flex items-center justify-between p-3.5 transition-colors ${
                            isMe 
                              ? 'bg-blue-950/20 border-y border-blue-500/20 shadow-[inset_0_0_15px_rgba(59,130,246,0.05)]' 
                              : 'hover:bg-slate-800/30'
                          }`}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <span className={`flex items-center justify-center shrink-0 w-6 h-6 rounded-full text-xs font-black ${
                              index === 0 ? 'bg-yellow-500 text-yellow-950 shadow-[0_0_10px_rgba(234,179,8,0.3)]' : 
                              index === 1 ? 'bg-slate-300 text-slate-800' :
                              index === 2 ? 'bg-amber-700 text-amber-100' : 'bg-slate-800 text-slate-400'
                            }`}>
                              {index + 1}
                            </span>
                            {aluno.avatarUrl ? (
                              <img src={aluno.avatarUrl} alt="Avatar" className="w-8 h-8 rounded-full object-cover border border-slate-700 shrink-0" />
                            ) : (
                              <div className="w-8 h-8 rounded-full bg-slate-800 text-slate-400 flex items-center justify-center text-xs font-bold shrink-0 border border-slate-700">
                                {aluno.name.substring(0, 2).toUpperCase()}
                              </div>
                            )}
                            <span className={`font-bold truncate text-sm uppercase ${isMe ? 'text-blue-400' : 'text-slate-200'}`}>
                              {aluno.numero ? `${String(aluno.numero).padStart(2, '0')} - ${aluno.name}` : aluno.name}
                            </span>
                          </div>
                          <span className="font-mono font-black text-xs text-blue-400 ml-2 shrink-0">{aluno.totalScore} pts</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Mural de Brevês */}
            <Card className="border-slate-800 bg-slate-900/40 relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-yellow-500 to-amber-600"></div>
              <CardHeader>
                <CardTitle className="text-lg text-white flex items-center gap-2">
                  <Award className="w-5 h-5 text-yellow-500" />
                  Mural de Brevês
                </CardTitle>
                <CardDescription className="text-xs">Desbloqueie insígnias pelo seu desempenho em combate.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 max-h-[500px] overflow-y-auto custom-scrollbar pr-2">
                {getBadges(stats).map((b: any) => {
                  const isUnlocked = user?.unlockedBadges?.includes(b.id);
                  const Icon = b.icon;
                  return (
                    <div key={b.id} className={`flex items-start gap-4 p-3 rounded-lg border ${isUnlocked ? b.border + ' ' + b.bg : 'border-slate-800 bg-slate-900/30 grayscale opacity-50'} transition-all`}>
                      <div className={`shrink-0 w-12 h-12 rounded-full flex items-center justify-center border-2 shadow-inner ${isUnlocked ? b.border + ' ' + b.color : 'border-slate-700 text-slate-500'}`}>
                        {isUnlocked ? <Icon className="w-6 h-6" /> : <Lock className="w-5 h-5" />}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h4 className={`font-bold text-sm tracking-wide uppercase ${isUnlocked ? b.color : 'text-slate-400'}`}>{b.name}</h4>
                          {b.exclusive && (
                            <span className="text-[10px] font-black bg-amber-500/20 text-amber-500 border border-amber-500/30 px-1.5 py-0.5 rounded uppercase tracking-widest">
                              Exclusivo
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-400 mt-1">{b.desc}</p>
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
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card className="border-slate-800 bg-slate-900/60 p-4 flex flex-col items-center justify-center text-center">
                <Award className="w-8 h-8 text-yellow-500 mb-2" />
                <p className="text-3xl font-black text-white">{stats?.simuladosCount || 0}</p>
                <p className="text-xs text-slate-400 uppercase tracking-wider mt-1">Simulados</p>
              </Card>
              <Card className="border-slate-800 bg-slate-900/60 p-4 flex flex-col items-center justify-center text-center">
                <Target className="w-8 h-8 text-blue-500 mb-2" />
                <p className="text-3xl font-black text-white">{stats?.accuracy || 0}%</p>
                <p className="text-xs text-slate-400 uppercase tracking-wider mt-1">Taxa Global</p>
              </Card>
              <Card className="border-slate-800 bg-slate-900/60 p-4 flex flex-col items-center justify-center text-center">
                <TrendingUp className="w-8 h-8 text-emerald-500 mb-2" />
                <p className="text-3xl font-black text-emerald-400">{stats?.totalScore || 0}</p>
                <p className="text-xs text-slate-400 uppercase tracking-wider mt-1">Pontos Totais</p>
              </Card>
              <Card className="border-slate-800 bg-slate-900/60 p-4 flex flex-col items-center justify-center text-center">
                <AlertTriangle className="w-8 h-8 text-orange-500 mb-2" />
                <p className="text-3xl font-black text-white">{stats?.avgTime || 0}s</p>
                <p className="text-xs text-slate-400 uppercase tracking-wider mt-1">Tempo Médio</p>
              </Card>
            </div>

            {/* History Table */}
            <Card className="border-slate-800 bg-slate-900/40">
              <CardHeader>
                <CardTitle className="text-lg text-white">Histórico de Combate</CardTitle>
                <CardDescription>Seus resultados nos últimos simulados realizados.</CardDescription>
              </CardHeader>
              <CardContent>
                {!stats || stats.simuladosCount === 0 ? (
                  <div className="text-center text-slate-500 py-8 bg-slate-800/30 rounded-lg border border-slate-700/50">
                    Você ainda não participou de nenhum simulado.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-slate-800 text-slate-400">
                        <tr>
                          <th className="px-4 py-3 font-medium rounded-tl-lg">Código da Sala</th>
                          <th className="px-4 py-3 font-medium">Questões</th>
                          <th className="px-4 py-3 font-medium">Acertos</th>
                          <th className="px-4 py-3 font-medium">Taxa Local</th>
                          <th className="px-4 py-3 font-medium">Pontuação</th>
                          <th className="px-4 py-3 font-medium rounded-tr-lg text-right">Ações</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/50">
                        {stats.history.map((h: any, idx: number) => (
                          <tr key={idx} className="hover:bg-slate-800/30 transition-colors">
                            <td className="px-4 py-4 font-mono font-bold text-blue-400">{h.codigoSala}</td>
                            <td className="px-4 py-4 text-slate-300">{h.totalQuestions} resolvidas</td>
                            <td className="px-4 py-4 text-emerald-400 font-bold">{h.correctAnswers} corretas</td>
                            <td className="px-4 py-4">
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-white">{h.accuracy}%</span>
                                <Progress value={h.accuracy} className="w-16 h-1.5 bg-slate-800 [&>div]:bg-emerald-500" />
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

      {/* Armaria Modal */}
      <Dialog open={isArmariaOpen} onOpenChange={setIsArmariaOpen}>
        <DialogContent className="bg-slate-950 border-slate-800 text-slate-200 sm:max-w-2xl max-h-[80vh] overflow-y-auto custom-scrollbar">
          <DialogHeader className="border-b border-slate-800 pb-4">
            <DialogTitle className="text-xl font-black uppercase tracking-widest text-white flex items-center gap-3">
              <Target className="w-6 h-6 text-blue-500" />
              Armaria: Ícones de Perfil
            </DialogTitle>
            <DialogDescription className="text-slate-500 font-bold uppercase tracking-widest text-xs pt-1">
              Selecione um brevê desbloqueado para usar como foto de perfil tática.
            </DialogDescription>
          </DialogHeader>
          
          {/* Identificação QRA */}
          <div className="pt-4 pb-2">
            <div className="p-4 bg-slate-900/60 border border-slate-800 rounded-xl space-y-3">
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
                    className="bg-slate-950 border-slate-800 h-10 font-bold uppercase text-white"
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
              className="flex flex-col items-center justify-center p-4 rounded-xl border border-slate-800 bg-slate-900/50 hover:bg-slate-800 transition-all gap-3 h-40"
            >
              <div className="w-16 h-16 rounded-full bg-slate-800 border-2 border-slate-700 flex items-center justify-center text-slate-400 font-bold text-xl">
                {user?.name?.substring(0, 2).toUpperCase() || "AL"}
              </div>
              <span className="text-xs font-bold text-slate-400 uppercase">Recruta (Sem Foto)</span>
            </button>

            {/* Ícones Básicos / Iniciais */}
            {["01", "02", "03", "04", "05"].map((avatarId) => (
              <button 
                key={avatarId}
                onClick={() => handleChangeAvatar(`predefined/${avatarId}`)}
                className="flex flex-col items-center justify-center p-4 rounded-xl border border-slate-700 bg-slate-800/30 hover:bg-slate-800 transition-all gap-3 h-40 group"
              >
                <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-slate-600 group-hover:border-blue-500 transition-colors">
                  <img src={`/avatars/predefined/${avatarId}.png`} alt={`Avatar ${avatarId}`} className="w-full h-full object-cover" />
                </div>
                <span className="text-xs font-bold text-slate-400 uppercase">Padrão {avatarId}</span>
              </button>
            ))}

            {/* Brevês Desbloqueados */}
            {getBadges(stats).map(badge => {
              const isUnlocked = user?.unlockedBadges?.includes(badge.id);
              const Icon = badge.icon;
              
              if (!isUnlocked) return null;

              return (
                <button 
                  key={badge.id}
                  onClick={() => handleChangeAvatar(badge.id)}
                  className={`flex flex-col items-center justify-center p-4 rounded-xl border ${badge.border} ${badge.bg} hover:brightness-125 transition-all gap-3 h-40 group relative overflow-hidden`}
                >
                  <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-white to-transparent opacity-0 group-hover:opacity-50 transition-opacity"></div>
                  <div className={`w-16 h-16 rounded-full border-2 border-white/20 flex items-center justify-center shrink-0 bg-slate-950/50 relative overflow-hidden group-hover:border-white/50 transition-colors`}>
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

      {/* Daily Simulado Configuration Modal */}
      <Dialog open={selectedDailySimId !== null} onOpenChange={(open) => { if (!open) setSelectedDailySimId(null); }}>
        <DialogContent className="bg-slate-950 border-slate-800 text-slate-200 w-[92vw] max-w-md sm:max-w-md rounded-xl">
          <DialogHeader className="border-b border-slate-800 pb-4">
            <DialogTitle className="text-xl font-black uppercase tracking-widest text-white flex items-center gap-3">
              <BookOpen className="w-6 h-6 text-blue-500" />
              Configurar Simulado
            </DialogTitle>
            <DialogDescription className="text-slate-500 font-bold uppercase tracking-widest text-xs pt-1">
              Escolha as configurações para iniciar seus estudos.
            </DialogDescription>
          </DialogHeader>

          <div className="py-4 space-y-6">
            {/* Informações da apostila */}
            <div className="p-4 bg-slate-900/60 border border-slate-800 rounded-xl">
              <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest block">Material Base</span>
              <span className="text-sm font-bold text-white block mt-0.5 break-words whitespace-normal">{selectedDailySimName}</span>
              <span className="text-[9px] font-bold text-blue-400 block uppercase mt-1">25 Alvos (Questões Avançadas)</span>
            </div>

            {/* Opção de Timer */}
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3.5 rounded-xl border border-slate-800 bg-slate-900/40">
                <div>
                  <label htmlFor="use-timer-toggle" className="text-sm font-bold text-white block cursor-pointer">
                    Limite de Tempo por Questão
                  </label>
                  <span className="text-[10px] text-slate-500 uppercase font-medium">Ativa um timer regressivo para cada alvo</span>
                </div>
                <input
                  type="checkbox"
                  id="use-timer-toggle"
                  checked={useTimer}
                  onChange={(e) => setUseTimer(e.target.checked)}
                  className="w-5 h-5 text-blue-600 bg-slate-950 border-slate-800 rounded focus:ring-blue-500 cursor-pointer"
                />
              </div>

              {useTimer && (
                <div className="space-y-2 bg-slate-900/20 border border-slate-800 p-4 rounded-xl">
                  <label className="text-xs font-black text-slate-400 uppercase tracking-widest block">
                    Tempo Limite (Segundos)
                  </label>
                  <select
                    value={timerSeconds}
                    onChange={(e) => setTimerSeconds(e.target.value)}
                    className="flex h-11 w-full rounded-lg bg-slate-950 border border-slate-800 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-600 font-bold"
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

          <div className="flex flex-col sm:flex-row gap-3 border-t border-slate-800 pt-4">
            <Button 
              variant="ghost" 
              onClick={() => setSelectedDailySimId(null)}
              className="w-full sm:flex-1 h-12 font-bold uppercase tracking-wider text-xs border border-slate-800 text-slate-400 hover:text-white cursor-pointer"
            >
              Cancelar
            </Button>
            <Button
              onClick={() => {
                router.push(`/aluno/simulado/${selectedDailySimId}?timer=${useTimer}&seconds=${timerSeconds}`);
                setSelectedDailySimId(null);
              }}
              className="w-full sm:flex-1 h-12 bg-blue-600 hover:bg-blue-500 font-bold uppercase tracking-wider text-xs text-white cursor-pointer"
            >
              Iniciar Combate
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
