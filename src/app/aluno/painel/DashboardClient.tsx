"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useRouter } from "next/navigation";
import { logout } from "@/app/actions/auth";
import { LogOut, Play, Target, ShieldAlert, Award, TrendingUp, AlertTriangle, Loader2, Shield, ShieldCheck, Crosshair, Skull, Zap, Medal, Lock, Frown, Timer, Moon, TrendingDown, Trophy } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import HeaderAvatar from "@/components/HeaderAvatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { updateUserAvatar } from "@/app/actions/user";

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
      desc: 'Alcançar 15.000 pontos totais e ter no mínimo taxa global de acertos em 90%.',
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

export default function StudentDashboardClient({ user, stats, generalRanking = [] }: { user: any, stats?: any, generalRanking?: any[] }) {
  const [codigo, setCodigo] = useState("");
  const [aiAnalysis, setAiAnalysis] = useState("");
  const [loadingAi, setLoadingAi] = useState(false);
  const [isArmariaOpen, setIsArmariaOpen] = useState(false);
  const router = useRouter();

  useEffect(() => {
    if (stats && stats.simuladosCount > 0) {
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
          } else {
            setAiAnalysis("Mentor temporariamente indisponível (Alta demanda na rede). Mantenha o foco tático e continue simulando!");
          }
        })
        .catch(err => {
          console.error("Erro na IA:", err);
          setAiAnalysis("Mentor temporariamente indisponível na rede. Mantenha o foco e continue simulando!");
        })
        .finally(() => setLoadingAi(false));
    }
  }, [stats]);

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
              <p className="text-lg font-bold text-white uppercase">
                {user?.numero ? `${String(user.numero).padStart(2, '0')} - ${user.name}` : user?.name || "Aluno"}
              </p>
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

      <main className="max-w-7xl mx-auto px-4 py-8">
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
                  Insira o código do telão para iniciar
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleEntrar} className="space-y-4">
                  <Input 
                    placeholder="CÓDIGO DA SALA" 
                    value={codigo}
                    onChange={(e) => setCodigo(e.target.value)}
                    className="bg-slate-900/50 border-slate-700 h-14 text-center text-2xl uppercase tracking-[0.3em] font-bold text-white"
                    maxLength={6}
                  />
                  <Button type="submit" className="w-full h-12 bg-blue-600 hover:bg-blue-500 font-bold" disabled={!codigo.trim()}>
                    Participar Agora
                  </Button>
                </form>
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
                  <div className="text-center text-slate-500 py-4">
                    <p>Responda simulados para gerar o seu perfil de desempenho tático.</p>
                  </div>
                ) : loadingAi ? (
                  <div className="flex flex-col items-center justify-center py-6 text-slate-400 space-y-3">
                    <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
                    <p className="text-sm font-medium animate-pulse">A IA está analisando seu combate...</p>
                  </div>
                ) : (
                  <div className="text-slate-300 leading-relaxed text-sm italic border-l-4 border-slate-700 pl-4 py-2 bg-slate-800/30 rounded-r-lg">
                    "{aiAnalysis}"
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
    </div>
  );
}
