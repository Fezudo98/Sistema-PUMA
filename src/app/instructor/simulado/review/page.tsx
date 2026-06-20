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
  const [loading, setLoading] = useState(false);
  const [isRaffleMode, setIsRaffleMode] = useState(false);

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
    <div className="min-h-screen bg-slate-50 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <Button variant="ghost" onClick={() => router.back()} className="text-slate-500">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Voltar
          </Button>
          
          <Button 
            onClick={handleSave} 
            disabled={loading}
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
          >
            {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
            Aprovar e Salvar Simulado
          </Button>
        </div>

        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Revisão das Questões (IA)</h1>
          <p className="text-slate-600 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-amber-500" />
            A inteligência artificial gerou {questions.length} questões. Revise o material antes de salvar.
          </p>
        </div>

        <div className="space-y-6">
          {questions.map((q, qIndex) => (
            <Card key={qIndex} className="border-slate-200 shadow-sm">
              <CardHeader className="bg-slate-100/50 border-b border-slate-100">
                <CardTitle className="text-lg text-slate-800 flex gap-4">
                  <span className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-sm">
                    Q{qIndex + 1}
                  </span>
                  <span className="font-semibold leading-relaxed">
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
                        className={`p-3 rounded-lg border flex gap-3 ${
                          isCorrect ? "bg-emerald-50 border-emerald-200 text-emerald-800" : "bg-white border-slate-200 text-slate-600"
                        }`}
                      >
                        <span className={`font-bold ${isCorrect ? "text-emerald-600" : "text-slate-400"}`}>
                          {["A)", "B)", "C)", "D)", "E)"][aIndex] || `${aIndex})`}
                        </span>
                        <p>{alt.replace(/^[A-E]\)\s*/, '')}</p>
                        
                        {isCorrect && (
                          <span className="ml-auto text-xs font-bold uppercase tracking-wider text-emerald-600 bg-emerald-100 px-2 py-1 rounded">
                            Gabarito
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
                
                <div className="mt-4 p-4 bg-blue-50 border border-blue-100 rounded-lg">
                  <p className="text-sm text-blue-800">
                    <strong>Justificativa da IA:</strong> {q.justificativa}
                  </p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
        
        <div className="mt-8 flex justify-end">
          <Button 
            size="lg"
            onClick={handleSave} 
            disabled={loading}
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold h-14 px-8"
          >
            {loading ? <Loader2 className="w-5 h-5 mr-2 animate-spin" /> : <Save className="w-5 h-5 mr-2" />}
            Tudo Certo! Salvar Simulado
          </Button>
        </div>
      </div>
    </div>
  );
}
