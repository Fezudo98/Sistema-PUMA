"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Trophy, ArrowLeft, Target, Users, AlertTriangle, CheckCircle, BarChart2, X, Clock } from "lucide-react";
import Link from "next/link";
import { Progress } from "@/components/ui/progress";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";

export default function ReviewClient({ 
  simulado, 
  ranking, 
  globalAccuracy 
}: { 
  simulado: any, 
  ranking: any[], 
  globalAccuracy: number 
}) {
  const [showParticipants, setShowParticipants] = useState(false);
  const [showGlobalChart, setShowGlobalChart] = useState(false);
  const [expandedQuestion, setExpandedQuestion] = useState<string | null>(null);

  // Preparar dados do gráfico
  const chartData = simulado.questions.map((q: any, index: number) => {
    const qAnswers = q.answers.length;
    const qCorrects = q.answers.filter((a: any) => a.isCorrect).length;
    const accuracy = qAnswers > 0 ? Math.round((qCorrects / qAnswers) * 100) : 0;
    return {
      name: `Q${index + 1}`,
      accuracy,
      isHard: accuracy < 40 && qAnswers > 0
    };
  });

  return (
    <div className="min-h-screen bg-slate-50 p-6 md:p-12">
      <div className="w-full">
        <header className="flex justify-between items-center mb-8">
          <div>
            <div className="flex items-center gap-3 mb-2 flex-wrap">
              <Link 
                href="/instructor"
                className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold text-sm transition-all shadow-sm active:scale-95 cursor-pointer shrink-0"
                title="Voltar para o Painel do Instrutor"
              >
                <ArrowLeft className="w-5 h-5 text-slate-700" />
                <span>Voltar ao Painel</span>
              </Link>
              <h1 className="text-2xl sm:text-3xl font-black text-slate-900 uppercase tracking-tight">Relatório do Simulado</h1>
            </div>
            <p className="text-slate-500 font-medium">Sala <strong className="text-blue-600">{simulado.codigoSala}</strong> • Finalizado</p>
          </div>
          <div className="flex gap-3">
            <Link href="/instructor/simulado/new">
              <Button variant="outline" className="border-blue-200 text-blue-700 bg-blue-50 hover:bg-blue-100">
                Criar Novo Simulado
              </Button>
            </Link>
          </div>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card 
            className="bg-white border-slate-200 shadow-sm cursor-pointer hover:border-blue-300 hover:shadow-md transition-all group"
            onClick={() => setShowParticipants(true)}
          >
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-slate-500 uppercase tracking-wider flex items-center justify-between gap-2">
                <span className="flex items-center gap-2"><Users className="w-4 h-4 text-blue-500" /> Participantes</span>
                <span className="text-xs text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity">Ver Lista</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-black text-slate-800">{ranking.length}</div>
            </CardContent>
          </Card>
          
          <Card 
            className="bg-white border-slate-200 shadow-sm cursor-pointer hover:border-emerald-300 hover:shadow-md transition-all group"
            onClick={() => setShowGlobalChart(true)}
          >
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-slate-500 uppercase tracking-wider flex items-center justify-between gap-2">
                <span className="flex items-center gap-2"><Target className="w-4 h-4 text-emerald-500" /> Acerto Global</span>
                <span className="text-xs text-emerald-500 opacity-0 group-hover:opacity-100 transition-opacity">Ver Gráfico</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-black text-slate-800">{globalAccuracy}%</div>
              <Progress value={globalAccuracy} className="h-1.5 mt-3 bg-slate-100 [&>div]:bg-emerald-500" />
            </CardContent>
          </Card>

          <Card className="bg-white border-slate-200 shadow-sm md:col-span-2">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-slate-500 uppercase tracking-wider flex items-center gap-2">
                <Trophy className="w-4 h-4 text-yellow-500" /> Pódio (Top 3)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-6">
                {ranking.slice(0, 3).map((aluno, idx) => (
                  <div key={idx} className="flex-1 flex flex-col items-center p-3 rounded-lg bg-slate-50 border border-slate-100 relative">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm mb-2 ${
                      idx === 0 ? 'bg-yellow-100 text-yellow-700 border border-yellow-200' :
                      idx === 1 ? 'bg-slate-200 text-slate-700 border border-slate-300' :
                      'bg-orange-100 text-orange-800 border border-orange-200'
                    }`}>
                      {idx + 1}º
                    </div>
                    {aluno.avatarUrl ? (
                      <img src={aluno.avatarUrl} alt="Avatar" className="w-8 h-8 rounded-full object-cover absolute top-2 right-2 border border-slate-200" />
                    ) : null}
                    <span className="font-bold text-slate-800 text-sm text-center truncate w-full">{aluno.name}</span>
                    <span className="text-xs text-slate-500 font-mono mt-1">{aluno.score} pts</span>
                  </div>
                ))}
                {ranking.length === 0 && <span className="text-slate-400 text-sm py-4">Nenhum aluno pontuou.</span>}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="mb-8">
          <h2 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-2">
            <BarChart2 className="w-6 h-6 text-blue-600" /> Análise por Questão
          </h2>
          
          <div className="space-y-6">
            {simulado.questions.map((q: any, index: number) => {
              const qAnswers = q.answers.length;
              const qCorrects = q.answers.filter((a: any) => a.isCorrect).length;
              const qAccuracy = qAnswers > 0 ? Math.round((qCorrects / qAnswers) * 100) : 0;
              const isHard = qAnswers > 0 && qAccuracy < 40;
              const isExpanded = expandedQuestion === q.id;
              return (
                <Card key={q.id} className={`bg-white border-l-4 shadow-sm transition-all ${isHard ? 'border-l-red-500' : 'border-l-blue-500'}`}>
                  <CardContent className="p-6 md:p-10">
                    <div className="flex flex-col lg:flex-row gap-8">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-4">
                          <span className="font-black text-slate-400 text-2xl md:text-3xl">Q{index + 1}</span>
                          {isHard && (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs md:text-sm font-bold bg-red-100 text-red-700">
                              <AlertTriangle className="w-4 h-4" /> Questão Crítica
                            </span>
                          )}
                        </div>
                        <p className="text-slate-950 text-xl md:text-3xl lg:text-4xl font-semibold leading-relaxed mb-8">{q.enunciado}</p>
                        
                        <div className="bg-slate-50 p-6 md:p-8 rounded-lg border border-slate-200 mt-6">
                          <p className="text-lg md:text-2xl font-black text-slate-800 mb-2">Gabarito e Justificativa:</p>
                          <p className="text-lg md:text-2xl text-emerald-700 font-extrabold mb-3">Opção Correta: {String.fromCharCode(65 + q.correta)}</p>
                          <p className="text-base md:text-xl text-slate-800 italic leading-relaxed font-medium">{q.justificativa}</p>
                        </div>
                      </div>
                      
                      <div className="w-full lg:w-80 shrink-0 flex flex-col justify-center border-t lg:border-t-0 lg:border-l border-slate-200 pt-6 lg:pt-0 lg:pl-8">
                        <div className="text-center mb-6">
                          <span className="block text-5xl md:text-7xl font-black text-slate-800 mb-1">{qAccuracy}%</span>
                          <span className="text-xs md:text-sm font-bold text-slate-400 uppercase tracking-widest">Taxa de Acerto</span>
                        </div>
                        <Progress value={qAccuracy} className={`h-3 mb-6 ${isHard ? '[&>div]:bg-red-500' : '[&>div]:bg-blue-500'}`} />
                        <div className="flex justify-between text-xs md:text-sm text-slate-500 mb-6">
                          <span className="flex items-center gap-1.5 font-medium"><CheckCircle className="w-4 h-4 text-emerald-500"/> {qCorrects} acertos</span>
                          <span className="flex items-center gap-1.5 font-medium"><Users className="w-4 h-4 text-slate-400"/> {qAnswers} total</span>
                        </div>
                        
                        <Button 
                          variant="outline" 
                          onClick={() => setExpandedQuestion(isExpanded ? null : q.id)}
                          className="w-full text-base font-bold py-5 h-auto"
                        >
                          {isExpanded ? "Ocultar Alunos" : "Ver Alunos"}
                        </Button>
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="mt-6 pt-6 border-t border-slate-100 animate-in fade-in slide-in-from-top-4 duration-300">
                        <h4 className="text-sm font-bold text-slate-700 mb-4 uppercase tracking-wider">Desempenho Individual</h4>
                        {q.answers.length === 0 ? (
                          <p className="text-slate-500 text-sm">Ninguém respondeu esta questão.</p>
                        ) : (
                          <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm">
                              <thead className="bg-slate-50 text-slate-500 border-b border-slate-200">
                                <tr>
                                  <th className="px-4 py-2 font-medium">Aluno</th>
                                  <th className="px-4 py-2 font-medium">Alternativa Escolhida</th>
                                  <th className="px-4 py-2 font-medium">Tempo Gasto</th>
                                  <th className="px-4 py-2 font-medium">Pontos Gerados</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100">
                                {q.answers.map((ans: any, ansIdx: number) => (
                                  <tr key={ansIdx} className="hover:bg-slate-50">
                                    <td className="px-4 py-3 flex items-center gap-3">
                                      {ans.student.avatarUrl ? (
                                        <img src={ans.student.avatarUrl} alt="Avatar" className="w-6 h-6 rounded-full object-cover border border-slate-200" />
                                      ) : (
                                        <div className="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center text-[10px] font-bold text-slate-500">
                                          {ans.student.name.substring(0,2).toUpperCase()}
                                        </div>
                                      )}
                                      <span className="font-medium text-slate-800">{ans.student.name}</span>
                                    </td>
                                    <td className="px-4 py-3">
                                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-bold ${
                                        ans.isCorrect ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'
                                      }`}>
                                        Letra {String.fromCharCode(65 + ans.alternativa)}
                                        {ans.isCorrect ? <CheckCircle className="w-3 h-3 ml-1" /> : <X className="w-3 h-3 ml-1" />}
                                      </span>
                                    </td>
                                    <td className="px-4 py-3 text-slate-600 flex items-center gap-1">
                                      <Clock className="w-3 h-3 text-slate-400" /> {ans.tempoGasto}s
                                    </td>
                                    <td className="px-4 py-3 font-mono font-bold text-blue-600">+{ans.pontuacao}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </div>

      {/* Modal de Participantes */}
      <Dialog open={showParticipants} onOpenChange={setShowParticipants}>
        <DialogContent className="sm:max-w-xl bg-white max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl text-slate-800">
              <Users className="w-5 h-5 text-blue-600" /> Ranking Completo de Participantes
            </DialogTitle>
            <DialogDescription>
              Ordem dos alunos que pontuaram neste simulado.
            </DialogDescription>
          </DialogHeader>
          <div className="mt-4">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-slate-500 border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-2 font-medium">Posição</th>
                    <th className="px-4 py-2 font-medium">Aluno</th>
                    <th className="px-4 py-2 font-medium text-center">Respostas</th>
                    <th className="px-4 py-2 font-medium text-center">Acertos</th>
                    <th className="px-4 py-2 font-medium text-center">Erros</th>
                    <th className="px-4 py-2 font-medium text-center">Tempo Médio</th>
                    <th className="px-4 py-2 font-medium text-right">Pontuação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {ranking.map((aluno, idx) => (
                    <tr key={idx} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-bold text-slate-500">
                        {idx + 1}º
                      </td>
                      <td className="px-4 py-3 flex items-center gap-3">
                        {aluno.avatarUrl ? (
                          <img src={aluno.avatarUrl} alt="Avatar" className="w-6 h-6 rounded-full object-cover border border-slate-200" />
                        ) : (
                          <div className="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center text-[10px] font-bold text-slate-500">
                            {aluno.name.substring(0,2).toUpperCase()}
                          </div>
                        )}
                        <span className="font-bold text-slate-800">{aluno.name}</span>
                      </td>
                      <td className="px-4 py-3 text-center text-slate-600">{aluno.answers}</td>
                      <td className="px-4 py-3 text-center text-emerald-600 font-bold">{aluno.corrects || 0}</td>
                      <td className="px-4 py-3 text-center text-red-500 font-bold">{aluno.incorrects || 0}</td>
                      <td className="px-4 py-3 text-center text-slate-600">{aluno.avgTime}s</td>
                      <td className="px-4 py-3 text-right font-mono font-bold text-blue-600">{aluno.score} pts</td>
                    </tr>
                  ))}
                  {ranking.length === 0 && (
                    <tr>
                      <td colSpan={5} className="text-center py-6 text-slate-500">Nenhum participante.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal de Gráfico de Desempenho */}
      <Dialog open={showGlobalChart} onOpenChange={setShowGlobalChart}>
        <DialogContent className="sm:max-w-2xl bg-white">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl text-slate-800">
              <BarChart2 className="w-5 h-5 text-emerald-600" /> Desempenho da Sala por Questão
            </DialogTitle>
            <DialogDescription>
              Visualização gráfica das taxas de acerto. Barras vermelhas representam questões com menos de 40% de acerto.
            </DialogDescription>
          </DialogHeader>
          <div className="mt-6 h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
                <XAxis dataKey="name" stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `${value}%`} />
                <Tooltip 
                  cursor={{ fill: 'rgba(241, 245, 249, 0.5)' }}
                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)' }}
                  formatter={(value) => [`${value}% de Acerto`, 'Taxa']}
                />
                <Bar dataKey="accuracy" radius={[4, 4, 0, 0]}>
                  {chartData.map((entry: any, index: number) => (
                    <Cell key={`cell-${index}`} fill={entry.isHard ? '#ef4444' : '#3b82f6'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </DialogContent>
      </Dialog>

    </div>
  );
}
