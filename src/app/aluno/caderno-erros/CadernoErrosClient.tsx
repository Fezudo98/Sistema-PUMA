"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ShieldAlert, BookOpen, Clock, Brain, AlertTriangle, CheckCircle2, Search, Filter } from "lucide-react";
import { formatApostilaTitle } from "@/lib/utils";
import { Input } from "@/components/ui/input";

export default function CadernoErrosClient({ initialMistakes }: { initialMistakes: any[] }) {
  const [searchTerm, setSearchTerm] = useState("");

  const filteredMistakes = initialMistakes.filter(mistake => 
    (mistake.question?.enunciado || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
    (mistake.question?.justificativa || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
    (mistake.question?.simulado?.apostilaName || "").toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center bg-card border border-border p-4 rounded-2xl">
        <div className="flex items-center gap-3 text-muted-foreground">
          <ShieldAlert className="w-5 h-5 text-rose-500" />
          <span className="font-medium text-sm">
            Total de erros registrados: <strong className="text-heading font-black">{initialMistakes.length}</strong>
          </span>
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input 
            placeholder="Buscar assunto ou questão..." 
            className="pl-9 bg-background/50 border-border h-10"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {filteredMistakes.length === 0 ? (
        <Card className="border-dashed border-2 border-border bg-transparent shadow-none">
          <CardContent className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
              <CheckCircle2 className="w-8 h-8 text-emerald-500" />
            </div>
            <h3 className="text-lg font-bold text-heading">Nenhum erro encontrado!</h3>
            <p className="text-sm text-muted-foreground mt-2 max-w-md">
              Você não tem registros de erros ou nenhuma questão corresponde à sua busca atual. Padrão total!
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-6">
          {filteredMistakes.map((mistake) => (
            <Card key={mistake.id} className="border-border overflow-hidden group">
              <div className="bg-muted/30 border-b border-border p-4 flex flex-col sm:flex-row gap-3 justify-between sm:items-center">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-1 bg-background border border-border rounded text-[10px] font-black uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <BookOpen className="w-3 h-3 text-blue-400" />
                    {formatApostilaTitle(mistake.question?.simulado?.apostilaName || "Questão Avulsa")}
                  </span>
                </div>
                <div className="text-[11px] font-medium text-muted-foreground flex items-center gap-1.5">
                  <Clock className="w-3 h-3" />
                  Respondido em {new Date(mistake.createdAt).toLocaleDateString('pt-BR')}
                </div>
              </div>
              
              <CardContent className="p-5 sm:p-6 space-y-6">
                <div className="space-y-4">
                  <div className="flex gap-3">
                    <div className="shrink-0 mt-1">
                      <div className="w-6 h-6 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center font-bold text-xs border border-blue-500/30">
                        Q
                      </div>
                    </div>
                    <div className="text-sm sm:text-base text-heading font-medium leading-relaxed whitespace-pre-wrap">
                      {mistake.question?.enunciado || "Questão indisponível"}
                    </div>
                  </div>

                  <div className="pl-9 space-y-3">
                    {(() => {
                      let alts: string[] = [];
                      try {
                        alts = JSON.parse(mistake.question?.alternativas || '[]');
                      } catch (e) {
                        alts = ["Erro ao carregar alternativas."];
                      }
                      
                      return alts.map((alt: string, idx: number) => {
                        const isStudentChoice = Number(mistake.alternativa) === idx;
                        const isRealCorrect = Number(mistake.question?.correta) === idx;

                        let styleClass = "border-border bg-background/50 text-muted-foreground";
                        let icon = null;

                        if (isRealCorrect) {
                          styleClass = "border-emerald-500/50 bg-emerald-950/20 text-emerald-100 ring-1 ring-emerald-500/50";
                          icon = <CheckCircle2 className="w-4 h-4 text-emerald-400" />;
                        } else if (isStudentChoice) {
                          styleClass = "border-rose-500/50 bg-rose-950/20 text-rose-100 ring-1 ring-rose-500/50";
                          icon = <AlertTriangle className="w-4 h-4 text-rose-400" />;
                        }

                        return (
                          <div key={idx} className={`relative p-3 rounded-xl border flex gap-3 items-start transition-all ${styleClass}`}>
                            <div className={`shrink-0 w-6 h-6 rounded border flex items-center justify-center text-xs font-bold ${
                              isRealCorrect ? "border-emerald-500/50 bg-emerald-500/20 text-emerald-400" :
                              isStudentChoice ? "border-rose-500/50 bg-rose-500/20 text-rose-400" :
                              "border-border bg-muted text-muted-foreground"
                            }`}>
                              {String.fromCharCode(65 + idx)}
                            </div>
                            <span className="text-sm font-medium leading-snug pt-0.5">{alt}</span>
                            {icon && (
                              <div className="absolute right-3 top-3">
                                {icon}
                              </div>
                            )}
                          </div>
                        );
                      });
                    })()}
                  </div>
                </div>

                {mistake.question?.justificativa && (
                  <div className="mt-6 pt-5 border-t border-border">
                    <div className="bg-indigo-950/10 border border-indigo-900/30 rounded-xl p-4 sm:p-5 relative overflow-hidden">
                      <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-indigo-500 to-purple-500"></div>
                      <h4 className="text-xs font-black uppercase tracking-widest text-indigo-400 flex items-center gap-2 mb-3">
                        <Brain className="w-4 h-4" />
                        Comentário da IA
                      </h4>
                      <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">
                        {mistake.question?.justificativa}
                      </p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
