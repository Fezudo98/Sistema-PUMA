"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useRouter } from "next/navigation";
import { Save, AlertCircle, Loader2, ArrowLeft } from "lucide-react";
import { createSimulado } from "@/app/actions/simulado";

type Question = {
  enunciado: string;
  alternativas: string[];
  correta: number;
  justificativa: string;
};

export default function ReviewSimulado() {
  const router = useRouter();
  const [questions, setQuestions] = useState<Question[]>([]);
  const [tempo, setTempo] = useState(60);
  const [apostilaName, setApostilaName] = useState<string | undefined>();
  const [topics, setTopics] = useState<string | undefined>();
  const [loading, setLoading] = useState(false);
  const [isRaffleMode, setIsRaffleMode] = useState(false);
  const [dificuldade, setDificuldade] = useState("INTERMEDIARIO");

  useEffect(() => {
    const qData = localStorage.getItem("generated_questions");
    const cData = localStorage.getItem("simulado_config");
    
    if (qData) {
      setQuestions(JSON.parse(qData));
    } else {
      router.push("/instructor/simulado/new");
    }
    
    if (cData) {
      const parsed = JSON.parse(cData);
      setTempo(parsed.tempo);
      setApostilaName(parsed.apostilaName);
      if (parsed.topics) {
        setTopics(parsed.topics);
      }
      if (parsed.dificuldade) {
        setDificuldade(parsed.dificuldade);
      }
      if (parsed.isRaffleMode) {
        setIsRaffleMode(true);
      }
    }
  }, [router]);

  const handleSave = async () => {
    setLoading(true);
    const res = await createSimulado({
      tempoPorQuestao: tempo,
      apostilaName,
      topics,
      difficulty: dificuldade,
      questions
    });

    if (res.error) {
      alert("Erro: " + res.error);
      setLoading(false);
    } else {
      // Clear storage
      localStorage.removeItem("generated_questions");
      localStorage.removeItem("simulado_config");
      
      // Redirect to the active painel of the simulado
      router.push(`/instructor/painel/${res.simuladoId}${isRaffleMode ? '?raffle=true' : ''}`);
    }
  };

  if (questions.length === 0) {
    return <div className="p-8 text-center text-slate-500">Carregando questões...</div>;
  }
  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-8 border-b border-slate-800 pb-4">
          <Button variant="ghost" onClick={() => router.back()} className="text-slate-400 hover:text-white hover:bg-slate-900/50 font-bold">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Voltar
          </Button>
          
          <Button 
            onClick={handleSave} 
            disabled={loading}
            className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold h-12 uppercase tracking-widest text-xs shadow-[0_0_15px_rgba(16,185,129,0.3)] cursor-pointer"
          >
            {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin text-white" /> : <Save className="w-4 h-4 mr-2 text-white" />}
            Aprovar e Salvar Simulado
          </Button>
        </div>

        <div className="mb-8">
          <h1 className="text-3xl font-black text-white uppercase tracking-widest drop-shadow-[0_0_10px_rgba(59,130,246,0.2)]">Revisão das Questões (IA)</h1>
          <p className="text-slate-400 font-medium flex items-center gap-2 mt-2 text-sm uppercase tracking-wide">
            <AlertCircle className="w-4 h-4 text-amber-500" />
            A inteligência artificial gerou {questions.length} questões. Revise o material antes de salvar.
          </p>
        </div>

        <div className="space-y-6">
          {questions.map((q, qIndex) => (
            <Card key={qIndex} className="bg-slate-900/40 border-slate-800 shadow-xl relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-600 to-emerald-500"></div>
              <CardHeader className="bg-slate-950/60 border-b border-slate-800 p-6">
                <CardTitle className="text-lg text-slate-200 flex gap-4 items-start font-bold">
                  <span className="bg-blue-950/60 text-blue-400 border border-blue-500/30 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider shrink-0 mt-0.5">
                    Q{qIndex + 1}
                  </span>
                  <span className="leading-relaxed">
                    {q.enunciado}
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-6 space-y-4">
                <div className="space-y-3 pl-6">
                  {q.alternativas.map((alt, aIndex) => {
                    const isCorrect = aIndex === q.correta;
                    return (
                      <div 
                        key={aIndex} 
                        className={`p-4 rounded-xl border flex gap-4 items-start ${
                          isCorrect 
                            ? "bg-emerald-950/30 border-emerald-500/30 text-emerald-400 shadow-[inset_0_0_15px_rgba(16,185,129,0.05)]" 
                            : "bg-slate-950/50 border-slate-800 text-slate-300"
                        }`}
                      >
                        <span className={`font-black text-sm shrink-0 w-6 h-6 rounded-full flex items-center justify-center border ${
                          isCorrect 
                            ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400" 
                            : "bg-slate-900 border-slate-800 text-slate-500"
                        }`}>
                          {["A", "B", "C", "D", "E"][aIndex] || String(aIndex)}
                        </span>
                        <p className="pt-0.5 text-base leading-snug flex-1">{alt.replace(/^[A-E]\)\s*/, '')}</p>
                        
                        {isCorrect && (
                          <span className="ml-auto text-[10px] font-black uppercase tracking-widest text-emerald-400 bg-emerald-950/40 border border-emerald-500/30 px-2.5 py-1 rounded">
                            Gabarito
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
                
                <div className="mt-4 p-4 bg-blue-950/20 border border-blue-900/30 rounded-xl">
                  <p className="text-sm text-blue-300 leading-relaxed">
                    <strong className="text-xs uppercase tracking-widest text-blue-400 block mb-1">Justificativa da IA:</strong> {q.justificativa}
                  </p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
        
        <div className="mt-8 flex justify-end pb-12 border-t border-slate-800 pt-6">
          <Button 
            size="lg"
            onClick={handleSave} 
            disabled={loading}
            className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold h-14 px-8 uppercase tracking-widest text-xs shadow-[0_0_20px_rgba(16,185,129,0.3)] cursor-pointer"
          >
            {loading ? <Loader2 className="w-5 h-5 mr-2 animate-spin text-white" /> : <Save className="w-5 h-5 mr-2 text-white" />}
            Tudo Certo! Salvar Simulado
          </Button>
        </div>
      </div>
    </div>
  );
}
