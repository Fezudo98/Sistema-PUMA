"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, TrendingUp, Target, Users, FileText, Download } from "lucide-react";
import { getInstructorReports } from "@/app/actions/reports";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Legend } from "recharts";
import { formatApostilaTitle } from "@/lib/utils";
import { useRouter } from "next/navigation";

export default function ReportsDashboardClient() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [metrics, setMetrics] = useState<any>(null);

  // Default to last 30 days
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().split("T")[0];
  });
  const [endDate, setEndDate] = useState(() => {
    return new Date().toISOString().split("T")[0];
  });

  const fetchData = async () => {
    setLoading(true);
    const res = await getInstructorReports(startDate, endDate);
    if (res.success) {
      setMetrics(res.data);
    } else {
      alert("Erro ao carregar relatórios: " + res.error);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleGenerateAIReport = async () => {
    if (!metrics) return;
    setGeneratingPdf(true);
    try {
      const payload = {
        startDate,
        endDate,
        metrics
      };
      
      // Store in localStorage and redirect to print page
      localStorage.setItem("ai_report_payload", JSON.stringify(payload));
      router.push("/instructor/relatorio");
      
    } catch (error) {
      console.error(error);
      alert("Erro ao processar relatório.");
    } finally {
      setGeneratingPdf(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Date Filter */}
      <Card className="bg-card/40 border-border">
        <CardContent className="p-4 flex flex-col sm:flex-row items-end gap-4">
          <div className="flex-1 w-full space-y-2">
            <label className="text-xs font-black text-muted-foreground uppercase tracking-widest">Data Inicial</label>
            <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="bg-background" />
          </div>
          <div className="flex-1 w-full space-y-2">
            <label className="text-xs font-black text-muted-foreground uppercase tracking-widest">Data Final</label>
            <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="bg-background" />
          </div>
          <Button onClick={fetchData} disabled={loading} className="w-full sm:w-auto bg-blue-600 hover:bg-blue-500 font-bold h-10 px-8 shadow-[0_0_15px_rgba(37,99,235,0.3)]">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Filtrar"}
          </Button>
          <Button 
            onClick={handleGenerateAIReport} 
            disabled={loading || generatingPdf || !metrics} 
            className="w-full sm:w-auto bg-purple-600 hover:bg-purple-500 font-black h-10 px-6 shadow-[0_0_15px_rgba(168,85,247,0.3)] gap-2"
          >
            {generatingPdf ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
            Gerar Relatório IA (PDF)
          </Button>
        </CardContent>
      </Card>

      {loading && !metrics ? (
        <div className="flex flex-col items-center justify-center py-20">
          <Loader2 className="w-10 h-10 text-blue-500 animate-spin mb-4" />
          <p className="text-muted-foreground font-bold tracking-widest uppercase text-xs">Mapeando terreno...</p>
        </div>
      ) : metrics ? (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="bg-card/40 border-border shadow-[0_0_15px_rgba(0,0,0,0.5)] overflow-hidden relative group">
              <div className="absolute top-0 left-0 w-1 h-full bg-blue-500 group-hover:bg-blue-400 transition-colors"></div>
              <CardContent className="p-6">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-xs font-black tracking-widest uppercase text-muted-foreground mb-1">Questões Resolvidas</p>
                    <p className="text-4xl font-mono font-black text-heading drop-shadow-[0_0_10px_rgba(59,130,246,0.3)]">{metrics.totalAnswers}</p>
                  </div>
                  <div className="p-3 bg-blue-950/30 rounded-xl border border-blue-900/50">
                    <Target className="w-6 h-6 text-blue-400" />
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card className="bg-card/40 border-border shadow-[0_0_15px_rgba(0,0,0,0.5)] overflow-hidden relative group">
              <div className="absolute top-0 left-0 w-1 h-full bg-emerald-500 group-hover:bg-emerald-400 transition-colors"></div>
              <CardContent className="p-6">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-xs font-black tracking-widest uppercase text-muted-foreground mb-1">Aproveitamento Global</p>
                    <p className="text-4xl font-mono font-black text-heading drop-shadow-[0_0_10px_rgba(16,185,129,0.3)]">{metrics.accuracy}%</p>
                  </div>
                  <div className="p-3 bg-emerald-950/30 rounded-xl border border-emerald-900/50">
                    <TrendingUp className="w-6 h-6 text-emerald-400" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-card/40 border-border shadow-[0_0_15px_rgba(0,0,0,0.5)] overflow-hidden relative group">
              <div className="absolute top-0 left-0 w-1 h-full bg-purple-500 group-hover:bg-purple-400 transition-colors"></div>
              <CardContent className="p-6">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-xs font-black tracking-widest uppercase text-muted-foreground mb-1">Alunos em Combate</p>
                    <p className="text-4xl font-mono font-black text-heading drop-shadow-[0_0_10px_rgba(168,85,247,0.3)]">{metrics.uniqueStudents}</p>
                  </div>
                  <div className="p-3 bg-purple-950/30 rounded-xl border border-purple-900/50">
                    <Users className="w-6 h-6 text-purple-400" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="bg-card/40 border-border shadow-[0_0_15px_rgba(0,0,0,0.5)]">
              <CardHeader className="pb-2 border-b border-border/50 mb-4">
                <CardTitle className="text-base uppercase tracking-widest font-black text-heading">Engajamento Diário</CardTitle>
                <CardDescription>Resoluções por dia no período selecionado</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[300px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={metrics.engagementData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.5} />
                      <XAxis 
                        dataKey="date" 
                        stroke="#64748b" 
                        fontSize={10} 
                        tickFormatter={(val) => {
                          const [, m, d] = val.split('-');
                          return `${d}/${m}`;
                        }}
                      />
                      <YAxis stroke="#64748b" fontSize={10} />
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '8px' }}
                        labelStyle={{ color: '#94a3b8' }}
                        formatter={(value: number) => [value, 'Questões']}
                        labelFormatter={(label) => `Data: ${label}`}
                      />
                      <Line type="monotone" dataKey="respostas" stroke="#3b82f6" strokeWidth={3} dot={{ r: 4, fill: '#3b82f6', strokeWidth: 0 }} activeDot={{ r: 6, fill: '#60a5fa' }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-card/40 border-border shadow-[0_0_15px_rgba(0,0,0,0.5)]">
              <CardHeader className="pb-2 border-b border-border/50 mb-4">
                <CardTitle className="text-base uppercase tracking-widest font-black text-heading">Aproveitamento por Módulo</CardTitle>
                <CardDescription>Taxa de acerto (%) por disciplina teórica</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[300px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={metrics.apostilaData.slice(0, 7)} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.5} vertical={false} />
                      <XAxis 
                        dataKey="name" 
                        stroke="#64748b" 
                        fontSize={10} 
                        tickFormatter={(val) => formatApostilaTitle(val).substring(0, 15) + "..."}
                      />
                      <YAxis stroke="#64748b" fontSize={10} domain={[0, 100]} />
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '8px' }}
                        cursor={{ fill: '#1e293b', opacity: 0.4 }}
                        formatter={(value: number) => [`${value}%`, 'Acerto']}
                        labelFormatter={(label) => formatApostilaTitle(label as string)}
                      />
                      <Bar dataKey="acerto" fill="#10b981" radius={[4, 4, 0, 0]} barSize={40} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>
        </>
      ) : null}
    </div>
  );
}
