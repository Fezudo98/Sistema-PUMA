"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Clock, CheckCircle2, XCircle, ArrowRight, BookOpen, AlertTriangle, HelpCircle, Loader2 } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { saveSelfPacedAnswer, completeSelfPacedSimulado } from "@/app/actions/dailySimulado";

interface Question {
  id: string;
  enunciado: string;
  alternativas: string; // JSON String
  tempoLimite: number;
}

interface Simulado {
  id: string;
  apostilaName: string | null;
  questions: Question[];
}

export default function StudentSelfPacedClient({
  simulado,
  studentId,
  initialProgress = 0
}: {
  simulado: Simulado;
  studentId: string;
  initialProgress?: number;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const hasTimer = searchParams.get("timer") !== "false";
  const timerLimit = parseInt(searchParams.get("seconds") || "60", 10);

  const [currentIdx, setCurrentIdx] = useState(initialProgress);
  const [selectedAlt, setSelectedAlt] = useState<number | null>(null);
  
  // Estados do gameplay
  const [isAnswered, setIsAnswered] = useState(false);
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
  const [correctAltIndex, setCorrectAltIndex] = useState<number | null>(null);
  const [justificativa, setJustificativa] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [finishing, setFinishing] = useState(false);

  // Estados do Timer
  const [timeLeft, setTimeLeft] = useState(60);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number>(Date.now());

  const currentQuestion = simulado.questions[currentIdx];
  const alternativasList: string[] = currentQuestion 
    ? JSON.parse(currentQuestion.alternativas) 
    : [];

  // Configura o Timer para a questão atual
  useEffect(() => {
    if (!currentQuestion || isAnswered) return;

    if (!hasTimer) {
      startTimeRef.current = Date.now();
      return;
    }

    setTimeLeft(timerLimit);
    startTimeRef.current = Date.now();

    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current!);
          handleTimeout();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [currentIdx, isAnswered]);

  const handleTimeout = () => {
    // Submete resposta nula (-1) caso expire o tempo
    submitAnswer(-1, currentQuestion.tempoLimite);
  };

  const handleConfirm = () => {
    if (selectedAlt === null || isAnswered || submitting) return;
    const timeSpent = Math.round((Date.now() - startTimeRef.current) / 1000);
    submitAnswer(selectedAlt, timeSpent);
  };

  const submitAnswer = async (altIndex: number, timeSpent: number) => {
    setSubmitting(true);
    if (timerRef.current) clearInterval(timerRef.current);

    const res = await saveSelfPacedAnswer({
      questionId: currentQuestion.id,
      studentId,
      alternativa: altIndex,
      tempoGasto: timeSpent
    });

    if (res.error) {
      alert(res.error);
      setSubmitting(false);
      return;
    }

    setIsCorrect(res.isCorrect || false);
    setCorrectAltIndex(res.correta !== undefined ? res.correta : null);
    setJustificativa(res.justificativa || "Sem justificativa cadastrada.");
    setIsAnswered(true);
    setSubmitting(false);
  };

  const handleNext = async () => {
    const isLast = currentIdx === simulado.questions.length - 1;

    if (isLast) {
      setFinishing(true);
      // Processa a conclusão do simulado no servidor (badge unlocks)
      await completeSelfPacedSimulado(studentId, simulado.id);
      router.push(`/aluno/simulado/${simulado.id}/review`);
    } else {
      // Limpa os estados e vai para a próxima questão
      setSelectedAlt(null);
      setIsAnswered(false);
      setIsCorrect(null);
      setCorrectAltIndex(null);
      setJustificativa("");
      setCurrentIdx((prev) => prev + 1);
    }
  };

  if (!currentQuestion) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4">
        <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
        <span className="text-slate-400 font-bold uppercase tracking-wider text-xs mt-2">Carregando missão...</span>
      </div>
    );
  }

  const progressPercent = ((currentIdx + (isAnswered ? 1 : 0)) / simulado.questions.length) * 100;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 p-4 md:p-8 flex items-center justify-center">
      <div className="w-full max-w-4xl space-y-6">
        
        {/* Header da Missão */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-950/40 border border-blue-500/20 text-blue-400 rounded-lg">
              <BookOpen className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-sm font-black text-slate-500 uppercase tracking-widest block">Treinamento de Combate</h2>
              <h1 className="text-lg font-bold text-white truncate max-w-md">{simulado.apostilaName}</h1>
            </div>
          </div>

          <div className="flex items-center gap-3 md:gap-4">
            {/* Sair do Simulado */}
            <Button
              variant="ghost"
              onClick={() => {
                if (confirm("Deseja realmente interromper o simulado? Suas respostas dadas até aqui foram salvas e você poderá continuar depois de onde parou.")) {
                  router.push("/aluno/painel");
                }
              }}
              className="h-10 px-3.5 bg-slate-900 border border-slate-800 text-slate-400 hover:text-white font-black text-[10px] uppercase tracking-wider cursor-pointer"
            >
              Sair
            </Button>
            {/* Timer Progress */}
            <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 px-4 py-2 rounded-xl">
              <Clock className={`w-4 h-4 ${hasTimer && timeLeft <= 10 && !isAnswered ? "text-red-500 animate-pulse" : "text-blue-400"}`} />
              <span className={`font-mono ${hasTimer ? "text-base" : "text-xs"} font-black ${hasTimer && timeLeft <= 10 && !isAnswered ? "text-red-500" : "text-white"}`}>
                {hasTimer ? `${timeLeft}s` : "ILIMITADO"}
              </span>
            </div>
            
            {/* Question Progress */}
            <div className="bg-slate-900 border border-slate-800 px-4 py-2 rounded-xl text-xs font-bold text-slate-300">
              ALVO {currentIdx + 1} DE {simulado.questions.length}
            </div>
          </div>
        </div>

        {/* Barra de Progresso */}
        <div className="space-y-1">
          <div className="flex justify-between text-[10px] font-black text-slate-500 uppercase tracking-widest">
            <span>Progressão do Simulado</span>
            <span>{Math.round(progressPercent)}% concluído</span>
          </div>
          <Progress value={progressPercent} className="h-2 bg-slate-900 border border-slate-800" />
        </div>

        {/* Layout Principal da Questão */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Question Enunciado and Alternatives */}
          <div className="lg:col-span-2 space-y-6">
            <Card className="bg-slate-900/40 border-slate-800 shadow-2xl relative overflow-hidden backdrop-blur-sm">
              <div className="absolute top-0 left-0 w-1 h-full bg-blue-500"></div>
              <CardContent className="p-6 md:p-8 space-y-6">
                
                {/* Enunciado */}
                <div className="space-y-2">
                  <div className="flex items-center gap-1 text-xs font-black text-blue-400 uppercase tracking-widest">
                    <HelpCircle className="w-3.5 h-3.5" />
                    Enunciado da Questão
                  </div>
                  <p className="text-base md:text-lg font-bold leading-relaxed text-white">
                    {currentQuestion.enunciado}
                  </p>
                </div>

                {/* Alternatives List */}
                <div className="space-y-3">
                  {alternativasList.map((alt, idx) => {
                    const isSelected = selectedAlt === idx;
                    let altClass = "bg-slate-950/40 border-slate-800 text-slate-300 hover:bg-slate-900/40 hover:text-white";
                    
                    if (isAnswered) {
                      if (idx === correctAltIndex) {
                        // Highlight correct answer in green
                        altClass = "bg-emerald-950/30 border-emerald-500/50 text-emerald-300 shadow-[inset_0_0_15px_rgba(16,185,129,0.05)]";
                      } else if (isSelected && !isCorrect) {
                        // Highlight incorrect choice in red
                        altClass = "bg-red-950/30 border-red-500/50 text-red-300 shadow-[inset_0_0_15px_rgba(239,68,68,0.05)]";
                      } else {
                        // Gray out other options
                        altClass = "bg-slate-950/10 border-slate-900/50 text-slate-600 cursor-not-allowed";
                      }
                    } else if (isSelected) {
                      altClass = "bg-blue-950/20 border-blue-500 text-blue-300 shadow-[0_0_15px_rgba(59,130,246,0.1)]";
                    }

                    return (
                      <button
                        key={idx}
                        disabled={isAnswered || submitting}
                        onClick={() => setSelectedAlt(idx)}
                        className={`w-full p-4 rounded-xl border text-left font-semibold text-sm transition-all flex items-center justify-between gap-3 ${
                          !isAnswered ? "cursor-pointer" : ""
                        } ${altClass}`}
                      >
                        <span className="leading-relaxed">{alt}</span>
                        {isAnswered && idx === correctAltIndex && (
                          <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
                        )}
                        {isAnswered && isSelected && !isCorrect && (
                          <XCircle className="w-5 h-5 text-red-500 shrink-0" />
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* Confirm Action Button */}
                {!isAnswered && (
                  <Button
                    onClick={handleConfirm}
                    disabled={selectedAlt === null || submitting}
                    className="w-full h-12 bg-blue-600 hover:bg-blue-500 font-bold uppercase tracking-wider text-xs shadow-lg mt-4 cursor-pointer"
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin text-white" />
                        Validando resposta...
                      </>
                    ) : (
                      "Confirmar Resposta"
                    )}
                  </Button>
                )}

              </CardContent>
            </Card>
          </div>

          {/* Feedback & Justification Sidebar */}
          <div className="lg:col-span-1 space-y-6">
            {isAnswered ? (
              <Card className={`bg-slate-900/40 border-slate-800 shadow-2xl relative overflow-hidden backdrop-blur-sm flex flex-col h-full`}>
                <div className={`absolute top-0 left-0 w-full h-1 ${isCorrect ? "bg-emerald-500" : "bg-red-500"}`}></div>
                
                <CardHeader>
                  <CardTitle className="text-lg text-white flex items-center gap-2">
                    {isCorrect ? (
                      <>
                        <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                        ACERTOU! (+100 pts)
                      </>
                    ) : (
                      <>
                        <XCircle className="w-5 h-5 text-red-400" />
                        {selectedAlt === -1 ? "TEMPO ESGOTADO" : "ERROU..."}
                      </>
                    )}
                  </CardTitle>
                  <CardDescription className="text-xs">
                    {isCorrect 
                      ? "Excelente combate! Veja a justificativa técnica abaixo."
                      : "Foco tático! Analise a correção para não errar em prova."}
                  </CardDescription>
                </CardHeader>

                <CardContent className="flex-1 flex flex-col justify-between space-y-6">
                  {/* Justificativa */}
                  <div className="bg-slate-950/60 p-4 border border-slate-800 rounded-xl space-y-2 flex-1 overflow-y-auto max-h-[300px] custom-scrollbar">
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest block">Análise Didática da IA</span>
                    <p className="text-xs leading-relaxed text-slate-300 font-medium italic">
                      "{justificativa}"
                    </p>
                  </div>

                  {/* Next Button */}
                  <Button
                    onClick={handleNext}
                    disabled={finishing}
                    className={`w-full h-12 font-bold uppercase tracking-wider text-xs shadow-lg cursor-pointer ${
                      isCorrect 
                        ? "bg-emerald-600 hover:bg-emerald-500 text-white" 
                        : "bg-blue-600 hover:bg-blue-500 text-white"
                    }`}
                  >
                    {finishing ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin text-white" />
                        Finalizando Simulado...
                      </>
                    ) : (
                      <>
                        {currentIdx === simulado.questions.length - 1 ? "Concluir Simulado" : "Próxima Questão"}
                        <ArrowRight className="w-4 h-4 ml-1.5" />
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <Card className="bg-slate-900/40 border-slate-800 shadow-2xl relative overflow-hidden backdrop-blur-sm h-full flex flex-col justify-center">
                <div className="absolute top-0 left-0 w-full h-1 bg-slate-800"></div>
                <CardContent className="p-6 text-center space-y-4">
                  <HelpCircle className="w-12 h-12 text-slate-700 mx-auto animate-pulse" />
                  <div>
                    <h3 className="font-bold text-sm text-slate-400 uppercase tracking-wider">Aguardando Resposta</h3>
                    <p className="text-xs text-slate-500 mt-1 max-w-[200px] mx-auto leading-relaxed">
                      Selecione uma das 5 alternativas e clique em confirmar antes que o tempo se esgote!
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
