"use client";

import { useState, useEffect } from "react";
import { renderHighlightedText } from "@/lib/highlightText";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useRouter } from "next/navigation";
import { FileUp, Loader2, ArrowLeft, BookOpen, Target, Check, Presentation, Sparkles } from "lucide-react";
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

export default function NovaApresentacao() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<1 | 2>(1);

  // Origem das questões: IA (gera a partir de uma apostila) ou PDF pronto (extrai)
  const [source, setSource] = useState<"ia" | "pdf">("ia");

  // Apostilas State (compartilhado pelas duas origens)
  const [apostilas, setApostilas] = useState<Apostila[]>([]);
  const [selectedApostilaId, setSelectedApostilaId] = useState<string>("nenhuma");
  const [file, setFile] = useState<File | null>(null);

  // Origem IA: quantidade e tópicos
  const [qtd, setQtd] = useState("10");
  const [topics, setTopics] = useState("");

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

    if (source === "ia" && selectedApostilaId === "nenhuma") {
      return alert("Selecione uma apostila para a IA gerar as questões.");
    }
    if (source === "pdf" && !file) {
      return alert("Selecione um arquivo PDF com suas questões.");
    }

    setLoading(true);
    try {
      let data: any;

      if (source === "ia") {
        const formData = new FormData();
        formData.append("apostilaId", selectedApostilaId);
        formData.append("qtd", qtd);
        formData.append("topics", topics);

        const response = await fetch("/api/generate", { method: "POST", body: formData });
        try {
          data = await response.json();
        } catch {
          throw new Error("Falha no servidor. A IA pode ter demorado muito.");
        }
        if (!response.ok) throw new Error(data?.error || "Erro ao gerar questões.");

        const apoObj = apostilas.find(a => a.id === selectedApostilaId);
        setApostilaName(apoObj ? apoObj.title : "Apresentação");
      } else {
        const formData = new FormData();
        formData.append("pdf", file as File);
        formData.append("apostilaId", selectedApostilaId);

        const response = await fetch("/api/instructor/special-simulado", { method: "POST", body: formData });
        try {
          data = await response.json();
        } catch {
          throw new Error("Falha no servidor. O PDF pode ser muito pesado ou a IA demorou muito.");
        }
        if (!response.ok) throw new Error(data?.error || "Erro ao extrair questões.");

        setApostilaName(data.apostilaName || "Apresentação");
      }

      setQuestions(data.questions);
      setStep(2);
    } catch (err: any) {
      alert("Erro: " + (err.message || "Falha desconhecida."));
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setLoading(true);

    const res = await createSimulado({
      tempoPorQuestao: 0, // Sem cronômetro no Modo Apresentação
      apostilaName,
      difficulty: "AVANCADO",
      tipo: "PRESENTATION",
      questions
    });

    if (res.error) {
      alert("Erro ao salvar: " + res.error);
      setLoading(false);
    } else {
      router.push(`/instructor/apresentacao/${res.simuladoId}`);
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
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-amber-500 to-orange-600"></div>
          <CardHeader className="border-b border-border bg-card/80 p-6">
            <CardTitle className="text-2xl font-black text-heading uppercase tracking-widest flex items-center gap-2 drop-shadow-[0_0_10px_rgba(245,158,11,0.3)]">
              <Presentation className="w-6 h-6 text-amber-500" />
              Nova Apresentação
            </CardTitle>
            <CardDescription className="text-muted-foreground font-medium">
              Modo sem alunos conectados: a turma debate em sala e você marca a resposta na tela, no seu ritmo, sem cronômetro.
            </CardDescription>
          </CardHeader>

          <CardContent className="p-8">
            {step === 1 ? (
              <form onSubmit={handleExtract} className="space-y-8">

                {/* Origem das Questões */}
                <div className="space-y-3">
                  <label className="text-xs font-black text-muted-foreground uppercase tracking-widest">
                    Origem das Questões
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setSource("ia")}
                      className={`text-left p-4 rounded-xl border-2 transition-all ${
                        source === "ia"
                          ? "border-amber-500 bg-amber-950/20 shadow-[0_0_15px_rgba(245,158,11,0.15)]"
                          : "border-border bg-background/40 hover:border-amber-500/40"
                      }`}
                    >
                      <Sparkles className={`w-5 h-5 mb-2 ${source === "ia" ? "text-amber-400" : "text-muted-foreground"}`} />
                      <p className={`text-sm font-bold ${source === "ia" ? "text-heading" : "text-muted-foreground"}`}>Gerar por IA</p>
                      <p className="text-xs text-muted-foreground mt-1">A IA cria as questões a partir de uma apostila salva.</p>
                    </button>
                    <button
                      type="button"
                      onClick={() => setSource("pdf")}
                      className={`text-left p-4 rounded-xl border-2 transition-all ${
                        source === "pdf"
                          ? "border-amber-500 bg-amber-950/20 shadow-[0_0_15px_rgba(245,158,11,0.15)]"
                          : "border-border bg-background/40 hover:border-amber-500/40"
                      }`}
                    >
                      <FileUp className={`w-5 h-5 mb-2 ${source === "pdf" ? "text-amber-400" : "text-muted-foreground"}`} />
                      <p className={`text-sm font-bold ${source === "pdf" ? "text-heading" : "text-muted-foreground"}`}>Enviar PDF Pronto</p>
                      <p className="text-xs text-muted-foreground mt-1">Você já tem as questões prontas; a IA só extrai.</p>
                    </button>
                  </div>
                </div>

                {source === "ia" ? (
                  <>
                    <div className="space-y-3">
                      <label className="text-xs font-black text-muted-foreground uppercase tracking-widest flex items-center gap-2">
                        <BookOpen className="w-4 h-4 text-amber-500" />
                        Apostila Base
                      </label>
                      <Select value={selectedApostilaId} onValueChange={(v) => setSelectedApostilaId(v || "nenhuma")}>
                        <SelectTrigger className="h-12 text-base bg-background border-border text-heading focus-visible:ring-amber-500">
                          <SelectValue placeholder="Selecione a apostila" />
                        </SelectTrigger>
                        <SelectContent className="bg-background border-border text-foreground">
                          <SelectItem value="nenhuma" className="font-bold text-muted-foreground focus:bg-muted focus:text-heading" disabled>
                            Selecione uma apostila...
                          </SelectItem>
                          {apostilas.map(apo => (
                            <SelectItem key={apo.id} value={apo.id} className="focus:bg-muted focus:text-heading">
                              {formatApostilaTitle(apo.title)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-black text-muted-foreground uppercase tracking-widest">Qtd. de Questões</label>
                      <Input
                        type="number"
                        min="1"
                        max="50"
                        value={qtd}
                        onChange={(e) => setQtd(e.target.value)}
                        className="h-12 text-base bg-background border-border text-heading focus-visible:ring-amber-500 font-mono font-bold"
                      />
                    </div>

                    <div className="space-y-3 bg-background/40 p-6 rounded-xl border border-border">
                      <label className="text-xs font-black text-muted-foreground uppercase tracking-widest">
                        Tópicos Específicos (Opcional)
                      </label>
                      <Input
                        type="text"
                        placeholder="Ex: Tópico 1 ao 4, Capítulo 3"
                        value={topics}
                        onChange={(e) => setTopics(e.target.value)}
                        className="bg-background border-border text-heading focus-visible:ring-amber-500 h-12 text-base"
                      />
                    </div>
                  </>
                ) : (
                  <>
                    <div className="space-y-3 bg-background/40 p-6 rounded-xl border border-border">
                      <label className="text-xs font-black text-muted-foreground uppercase tracking-widest">
                        Arquivo de Questões (PDF)
                      </label>
                      <div className="border-2 border-dashed border-border rounded-xl p-8 text-center hover:bg-card/40 hover:border-amber-500/50 transition-all bg-background/60 cursor-pointer">
                        <Input
                          type="file"
                          accept="application/pdf"
                          onChange={(e) => setFile(e.target.files?.[0] || null)}
                          className="hidden"
                          id="pdf-upload"
                        />
                        <label htmlFor="pdf-upload" className="cursor-pointer flex flex-col items-center">
                          <FileUp className="w-10 h-10 text-amber-500 mb-3 animate-bounce" />
                          <span className="text-base font-bold text-muted-foreground">
                            {file ? file.name : "Selecione o PDF com as Suas Questões"}
                          </span>
                        </label>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <label className="text-xs font-black text-muted-foreground uppercase tracking-widest flex items-center gap-2">
                        <BookOpen className="w-4 h-4 text-amber-500" />
                        Apostila Base (para a IA buscar o gabarito, opcional)
                      </label>
                      <Select value={selectedApostilaId} onValueChange={(v) => setSelectedApostilaId(v || "nenhuma")}>
                        <SelectTrigger className="h-12 text-base bg-background border-border text-heading focus-visible:ring-amber-500">
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
                  </>
                )}

                <Button type="submit" disabled={loading} className="w-full h-14 bg-amber-600 hover:bg-amber-500 font-black text-sm uppercase tracking-widest shadow-[0_0_20px_rgba(245,158,11,0.4)]">
                  {loading ? (
                    <><Loader2 className="w-5 h-5 mr-3 animate-spin" /> Processando com Inteligência Artificial...</>
                  ) : (
                    <><Target className="w-5 h-5 mr-3" /> {source === "ia" ? "Gerar Questões" : "Extrair Questões"}</>
                  )}
                </Button>
              </form>
            ) : (
              <div className="space-y-8">
                <div className="bg-emerald-950/20 border border-emerald-900/50 p-4 rounded-xl text-center">
                  <Check className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
                  <h3 className="text-lg font-bold text-emerald-400 uppercase tracking-widest">Questões Prontas!</h3>
                  <p className="text-sm text-emerald-500/70">{questions.length} questões preparadas para a apresentação.</p>
                </div>

                <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                  {questions.map((q, idx) => (
                    <div key={idx} className="bg-background/50 border border-border rounded-xl p-4">
                      <div className="flex gap-3 items-start mb-3">
                        <span className="shrink-0 w-6 h-6 rounded bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold text-xs">{idx + 1}</span>
                        <p className="text-sm font-medium text-heading leading-relaxed">{q.enunciado}</p>
                      </div>
                      <div className="pl-9 space-y-2">
                        {q.alternativas.map((alt, i) => (
                          <div key={i} className={`p-2 rounded border text-xs ${i === q.correta ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-200" : "border-border text-muted-foreground"}`}>
                            {renderHighlightedText(alt)}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>

                <Button onClick={handleSave} disabled={loading} className="w-full h-14 bg-emerald-600 hover:bg-emerald-500 font-black text-sm uppercase tracking-widest shadow-[0_0_20px_rgba(16,185,129,0.4)]">
                  {loading ? (
                    <><Loader2 className="w-5 h-5 mr-3 animate-spin" /> Iniciando Apresentação...</>
                  ) : (
                    <><Presentation className="w-5 h-5 mr-3" /> Iniciar Apresentação</>
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
