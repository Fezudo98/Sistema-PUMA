"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useRouter } from "next/navigation";
import { FileUp, Loader2, ArrowLeft, BookOpen, Save, Target, Check, Clock } from "lucide-react";
import Link from "next/link";
import { formatApostilaTitle } from "@/lib/utils";
import { createSimulado } from "@/app/actions/simulado";

interface Apostila {
  id: string;
  title: string;
  createdAt: string;
}

type Question = {
  enunciado: string;
  alternativas: string[];
  correta: number;
  justificativa: string;
};

export default function NovoSimuladoEspecial() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<1 | 2>(1);
  
  // Apostilas State
  const [apostilas, setApostilas] = useState<Apostila[]>([]);
  const [selectedApostilaId, setSelectedApostilaId] = useState<string>("nenhuma");
  const [file, setFile] = useState<File | null>(null);

  // Expiration State
  const [daysToExpire, setDaysToExpire] = useState("7");

  // Questions State
  const [questions, setQuestions] = useState<Question[]>([]);
  const [apostilaName, setApostilaName] = useState("");

  useEffect(() => {
    fetch("/api/apostilas")
      .then(res => res.json())
      .then(data => {
        if (data.apostilas) {
          setApostilas(data.apostilas);
        }
      })
      .catch(console.error);
  }, []);

  const handleExtract = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return alert("Selecione um arquivo PDF com suas questões.");

    setLoading(true);
    try {
      const formData = new FormData();
      formData.append("pdf", file);
      formData.append("apostilaId", selectedApostilaId);

      const response = await fetch("/api/instructor/special-simulado", {
        method: "POST",
        body: formData
      });

      let data;
      try {
        data = await response.json();
      } catch (err) {
        throw new Error("Falha no servidor. O PDF pode ser muito pesado ou a IA demorou muito.");
      }

      if (!response.ok) {
        throw new Error(data?.error || "Erro ao extrair questões.");
      }

      setQuestions(data.questions);
      setApostilaName(data.apostilaName || "Missão Especial");
      setStep(2);
    } catch (err: any) {
      alert("Erro: " + (err.message || "Falha desconhecida."));
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setLoading(true);
    
    const expiresDate = new Date();
    expiresDate.setDate(expiresDate.getDate() + parseInt(daysToExpire));

    const res = await createSimulado({
      tempoPorQuestao: 3600, // 1 hora de tolerância no banco (aluno faz livre)
      apostilaName: apostilaName,
      difficulty: "AVANCADO",
      tipo: "SPECIAL",
      expiresAt: expiresDate,
      questions
    });

    if (res.error) {
      alert("Erro ao salvar: " + res.error);
      setLoading(false);
    } else {
      router.push(`/instructor`);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground p-8">
      <div className="max-w-3xl mx-auto">
        <Link href="/instructor">
          <Button variant="ghost" className="mb-6 text-muted-foreground hover:text-heading hover:bg-card/50 font-bold">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Voltar ao Painel
          </Button>
        </Link>

        <Card className="bg-card/40 border-border shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-purple-600 to-pink-500"></div>
          <CardHeader className="border-b border-border bg-card/80 p-6">
            <CardTitle className="text-2xl font-black text-heading uppercase tracking-widest flex items-center gap-2 drop-shadow-[0_0_10px_rgba(168,85,247,0.3)]">
              <Target className="w-6 h-6 text-purple-500" />
              Nova Missão Especial
            </CardTitle>
            <CardDescription className="text-muted-foreground font-medium">
              Faça o upload do seu material (PDF de questões prontas). A IA fará a extração para o formato PUMA.
            </CardDescription>
          </CardHeader>

          <CardContent className="p-8">
            {step === 1 ? (
              <form onSubmit={handleExtract} className="space-y-8">
                
                {/* Upload Section */}
                <div className="space-y-3 bg-background/40 p-6 rounded-xl border border-border">
                  <label className="text-xs font-black text-muted-foreground uppercase tracking-widest">
                    Arquivo de Questões (PDF)
                  </label>
                  <div className="border-2 border-dashed border-border rounded-xl p-8 text-center hover:bg-card/40 hover:border-purple-500/50 transition-all bg-background/60 cursor-pointer">
                    <Input 
                      type="file" 
                      accept="application/pdf"
                      onChange={(e) => setFile(e.target.files?.[0] || null)}
                      className="hidden"
                      id="pdf-upload"
                    />
                    <label htmlFor="pdf-upload" className="cursor-pointer flex flex-col items-center">
                      <FileUp className="w-10 h-10 text-purple-500 mb-3 animate-bounce" />
                      <span className="text-base font-bold text-muted-foreground">
                        {file ? file.name : "Selecione o PDF com as Suas Questões"}
                      </span>
                    </label>
                  </div>
                </div>

                {/* Reference Material Section */}
                <div className="space-y-3">
                  <label className="text-xs font-black text-muted-foreground uppercase tracking-widest flex items-center gap-2">
                    <BookOpen className="w-4 h-4 text-purple-500" />
                    Apostila Base (para a IA buscar o gabarito)
                  </label>
                  
                  <Select value={selectedApostilaId} onValueChange={(v) => setSelectedApostilaId(v || "nenhuma")}>
                    <SelectTrigger className="h-12 text-base bg-background border-border text-heading focus-visible:ring-purple-500">
                      <SelectValue placeholder="Selecione a origem teórica (opcional)" />
                    </SelectTrigger>
                    <SelectContent className="bg-background border-border text-foreground">
                      <SelectItem value="nenhuma" className="font-bold text-muted-foreground focus:bg-muted focus:text-heading">
                        Sem apostila (Meu PDF já tem gabarito/justificativas)
                      </SelectItem>
                      {apostilas.map(apo => (
                        <SelectItem key={apo.id} value={apo.id} className="focus:bg-muted focus:text-heading">
                          {formatApostilaTitle(apo.title)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Validade */}
                <div className="space-y-3">
                  <label className="text-xs font-black text-muted-foreground uppercase tracking-widest flex items-center gap-2">
                    <Clock className="w-4 h-4 text-purple-500" />
                    Validade da Missão
                  </label>
                  <Select value={daysToExpire} onValueChange={setDaysToExpire}>
                    <SelectTrigger className="h-12 text-base bg-background border-border text-heading">
                      <SelectValue placeholder="Prazo" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">1 Dia (24h)</SelectItem>
                      <SelectItem value="3">3 Dias</SelectItem>
                      <SelectItem value="7">7 Dias</SelectItem>
                      <SelectItem value="15">15 Dias</SelectItem>
                      <SelectItem value="30">30 Dias</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">Após este prazo, a missão será trancada e ninguém mais poderá resolver.</p>
                </div>

                <Button type="submit" disabled={loading} className="w-full h-14 bg-purple-600 hover:bg-purple-500 font-black text-sm uppercase tracking-widest shadow-[0_0_20px_rgba(168,85,247,0.4)]">
                  {loading ? (
                    <><Loader2 className="w-5 h-5 mr-3 animate-spin" /> Processando com Inteligência Artificial...</>
                  ) : (
                    <><Target className="w-5 h-5 mr-3" /> Extrair Questões e Criar Simulado</>
                  )}
                </Button>
              </form>
            ) : (
              <div className="space-y-8">
                <div className="bg-emerald-950/20 border border-emerald-900/50 p-4 rounded-xl text-center">
                  <Check className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
                  <h3 className="text-lg font-bold text-emerald-400 uppercase tracking-widest">Questões Extraídas com Sucesso!</h3>
                  <p className="text-sm text-emerald-500/70">{questions.length} alvos preparados para a tropa.</p>
                </div>
                
                <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                  {questions.map((q, idx) => (
                    <div key={idx} className="bg-background/50 border border-border rounded-xl p-4">
                      <div className="flex gap-3 items-start mb-3">
                        <span className="shrink-0 w-6 h-6 rounded bg-purple-500/20 text-purple-400 flex items-center justify-center font-bold text-xs">{idx + 1}</span>
                        <p className="text-sm font-medium text-heading leading-relaxed">{q.enunciado}</p>
                      </div>
                      <div className="pl-9 space-y-2">
                        {q.alternativas.map((alt, i) => (
                          <div key={i} className={`p-2 rounded border text-xs ${i === q.correta ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-200" : "border-border text-muted-foreground"}`}>
                            {alt}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>

                <Button onClick={handleSave} disabled={loading} className="w-full h-14 bg-emerald-600 hover:bg-emerald-500 font-black text-sm uppercase tracking-widest shadow-[0_0_20px_rgba(16,185,129,0.4)]">
                  {loading ? (
                    <><Loader2 className="w-5 h-5 mr-3 animate-spin" /> Lançando Missão Especial...</>
                  ) : (
                    <><Save className="w-5 h-5 mr-3" /> Confirmar e Lançar Missão (Validade: {daysToExpire} dias)</>
                  )}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
