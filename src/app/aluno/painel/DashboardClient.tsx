"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useRouter } from "next/navigation";
import { logout } from "@/app/actions/auth";
import { LogOut, Play, Target, ShieldAlert, Award, TrendingUp, AlertTriangle, Loader2, Shield, ShieldCheck, Crosshair, Skull, Zap, Medal, Lock } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import HeaderAvatar from "@/components/HeaderAvatar";

const getBadges = (stats: any) => {
  const s = stats || { simuladosCount: 0, accuracy: 0, avgTime: 0, totalScore: 0, history: [] };
  
  return [
    {
      id: 'recruta',
      name: 'Recruta',
      icon: Shield,
      earned: s.simuladosCount >= 1,
      desc: 'Participou do seu primeiro simulado no sistema.',
      color: 'text-amber-600',
      bg: 'bg-amber-900/20',
      border: 'border-amber-700/50'
    },
    {
      id: 'guerreiro',
      name: 'Guerreiro',
      icon: ShieldCheck,
      earned: s.simuladosCount >= 10,
      desc: 'Completou 10 simulados. Mostrou persistência no combate.',
      color: 'text-slate-300',
      bg: 'bg-slate-700/30',
      border: 'border-slate-400/50'
    },
    {
      id: 'veterano',
      name: 'Veterano',
      icon: ShieldAlert,
      earned: s.simuladosCount >= 25,
      desc: 'Completou 25 simulados. Um verdadeiro veterano de guerra.',
      color: 'text-yellow-500',
      bg: 'bg-yellow-900/20',
      border: 'border-yellow-500/50'
    },
    {
      id: 'sniper',
      name: 'Atirador de Elite',
      icon: Crosshair,
      earned: s.history && s.history.some((h: any) => h.accuracy === 100 && h.totalQuestions >= 5),
      desc: 'Gabaritou 100% de acertos em um simulado com pelo menos 5 questões.',
      color: 'text-emerald-500',
      bg: 'bg-emerald-900/20',
      border: 'border-emerald-500/50'
    },
    {
      id: 'raio',
      name: 'Pronto Resposta (Raio)',
      icon: Zap,
      earned: s.simuladosCount >= 5 && s.avgTime <= 10 && s.avgTime > 0,
      desc: 'Manteve tempo médio de resposta abaixo de 10 segundos (mínimo 5 simulados).',
      color: 'text-amber-400',
      bg: 'bg-amber-900/20',
      border: 'border-amber-400/50'
    },
    {
      id: 'caveira',
      name: 'Caveira',
      icon: Skull,
      earned: s.simuladosCount >= 10 && s.accuracy >= 90,
      desc: 'Manteve taxa global de acertos acima de 90% (mínimo 10 simulados).',
      color: 'text-purple-500',
      bg: 'bg-purple-900/20',
      border: 'border-purple-500/50'
    },
    {
      id: 'padrao',
      name: 'Padrão PM',
      icon: Medal,
      earned: s.totalScore >= 15000,
      desc: 'Alcançou a incrível marca de 15.000 pontos totais acumulados.',
      color: 'text-blue-500',
      bg: 'bg-blue-900/20',
      border: 'border-blue-500/50'
    }
  ];
};

export default function StudentDashboardClient({ user, stats }: { user: any, stats?: any }) {
  const [codigo, setCodigo] = useState("");
  const [aiAnalysis, setAiAnalysis] = useState("");
  const [loadingAi, setLoadingAi] = useState(false);
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
              <p className="text-lg font-bold text-white uppercase">{user?.name || "Aluno"}</p>
            </div>
            <HeaderAvatar 
              initials={user?.name?.substring(0, 2).toUpperCase() || "AL"} 
              avatarUrl={user?.avatarUrl || null} 
            />
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
                {getBadges(stats).map((b) => {
                  const Icon = b.icon;
                  return (
                    <div key={b.id} className={`flex items-start gap-4 p-3 rounded-lg border ${b.earned ? b.border + ' ' + b.bg : 'border-slate-800 bg-slate-900/30 grayscale opacity-50'} transition-all`}>
                      <div className={`shrink-0 w-12 h-12 rounded-full flex items-center justify-center border-2 shadow-inner ${b.earned ? b.border + ' ' + b.color : 'border-slate-700 text-slate-500'}`}>
                        {b.earned ? <Icon className="w-6 h-6" /> : <Lock className="w-5 h-5" />}
                      </div>
                      <div className="flex-1">
                        <h4 className={`font-bold text-sm tracking-wide uppercase ${b.earned ? b.color : 'text-slate-400'}`}>{b.name}</h4>
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
    </div>
  );
}
