"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ArrowLeft, CheckCircle2, XCircle, ChevronRight, Presentation, Loader2, Info } from "lucide-react";
import Link from "next/link";
import { formatApostilaTitle } from "@/lib/utils";
import { markPresentationAnswer, finishPresentationSimulado } from "@/app/actions/presentation";

interface QuestionData {
  id: string;
  enunciado: string;
  alternativas: string; // JSON string
  correta: number;
  justificativa: string;
  presentationAnswer: number | null;
}

interface SimuladoData {
  id: string;
  apostilaName: string | null;
  status: string;
  questions: QuestionData[];
}

export default function InstructorPresentationClient({ simulado }: { simulado: SimuladoData }) {
  const router = useRouter();

  const firstUnanswered = simulado.questions.findIndex((q) => q.presentationAnswer === null);
  const initialIdx = firstUnanswered === -1 ? simulado.questions.length - 1 : firstUnanswered;

  const [questions, setQuestions] = useState<QuestionData[]>(simulado.questions);
  const [currentIdx, setCurrentIdx] = useState(initialIdx);
  const [marking, setMarking] = useState(false);
  const [finishing, setFinishing] = useState(false);

  const currentQuestion = questions[currentIdx];
  const alternativas: string[] = currentQuestion ? JSON.parse(currentQuestion.alternativas) : [];
  const isAnswered = currentQuestion?.presentationAnswer !== null && currentQuestion?.presentationAnswer !== undefined;
  const isLast = currentIdx === questions.length - 1;
  const allAnswered = questions.every((q) => q.presentationAnswer !== null);

  const handleMark = async (altIndex: number) => {
    if (!currentQuestion || isAnswered || marking) return;
    setMarking(true);
    try {
      const res = await markPresentationAnswer(currentQuestion.id, altIndex);
      if (res.error) {
        alert("Erro ao marcar: " + res.error);
        return;
      }
      setQuestions((prev) =>
        prev.map((q, i) => (i === currentIdx ? { ...q, presentationAnswer: altIndex } : q))
      );
    } finally {
      setMarking(false);
    }
  };

  const handleNext = async () => {
    if (isLast) {
      setFinishing(true);
      const res = await finishPresentationSimulado(simulado.id);
      setFinishing(false);
      if (res.error) {
        alert("Erro ao finalizar: " + res.error);
        return;
      }
      router.push(`/instructor/apresentacao/${simulado.id}/review`);
    } else {
      setCurrentIdx((prev) => prev + 1);
    }
  };

  if (!currentQuestion) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground font-bold">Nenhuma questão nesta apresentação.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground p-4 sm:p-8">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
          <Link href="/instructor">
            <Button variant="ghost" className="text-muted-foreground hover:text-heading hover:bg-card/50 font-bold">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Sair da Apresentação
            </Button>
          </Link>
          <span className="text-xs font-black text-amber-500 uppercase tracking-widest flex items-center gap-2">
            <Presentation className="w-4 h-4" />
            Modo Apresentação
          </span>
        </div>

        <Card className="bg-card/40 border-border shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-amber-500 to-orange-600"></div>
          <CardHeader className="border-b border-border bg-card/80 p-6">
            <div className="flex justify-between items-center mb-1">
              <CardTitle className="text-lg font-black text-heading uppercase tracking-widest">
                Questão {currentIdx + 1} de {questions.length}
              </CardTitle>
              <span className="text-xs font-bold text-muted-foreground">
                {questions.filter((q) => q.presentationAnswer !== null).length} marcadas
              </span>
            </div>
            {simulado.apostilaName && (
              <CardDescription className="text-muted-foreground font-medium truncate">
                Base: {formatApostilaTitle(simulado.apostilaName)}
              </CardDescription>
            )}
          </CardHeader>

          <CardContent className="p-6 sm:p-8 space-y-6">
            <p className="text-xl sm:text-2xl font-extrabold text-heading leading-normal tracking-wide">
              {currentQuestion.enunciado}
            </p>

            <div className="flex flex-col gap-3">
              {alternativas.map((alt, index) => {
                const letter = String.fromCharCode(65 + index);
                const cleanAlt = alt.replace(/^[A-E]\)\s*/i, "");
                const isCorrectAlt = index === currentQuestion.correta;
                const isMarkedAlt = currentQuestion.presentationAnswer === index;

                let cardClass = "border-border bg-background/40 hover:border-amber-500/40 cursor-pointer";
                if (isAnswered) {
                  cardClass = "border-border bg-background/20 cursor-default";
                  if (isCorrectAlt) cardClass = "border-emerald-500/70 bg-emerald-950/20 cursor-default";
                  if (isMarkedAlt && !isCorrectAlt) cardClass = "border-red-500/70 bg-red-950/20 cursor-default";
                }

                return (
                  <button
                    key={index}
                    type="button"
                    disabled={isAnswered || marking}
                    onClick={() => handleMark(index)}
                    className={`w-full text-left p-4 rounded-xl border-2 transition-all flex items-center gap-4 ${cardClass}`}
                  >
                    <span
                      className={`shrink-0 flex items-center justify-center w-9 h-9 rounded-full text-sm font-extrabold border-2 ${
                        isAnswered && isCorrectAlt
                          ? "bg-emerald-500 text-heading border-emerald-400"
                          : isAnswered && isMarkedAlt
                          ? "bg-red-500 text-heading border-red-400"
                          : "bg-muted text-muted-foreground border-border"
                      }`}
                    >
                      {letter}
                    </span>
                    <span className="flex-1 text-sm sm:text-base font-semibold text-foreground">{cleanAlt}</span>
                    {isAnswered && isCorrectAlt && <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />}
                    {isAnswered && isMarkedAlt && !isCorrectAlt && <XCircle className="w-5 h-5 text-red-500 shrink-0" />}
                  </button>
                );
              })}
            </div>

            {isAnswered && (
              <div className="p-4 bg-blue-900/20 border border-blue-900/40 rounded-lg flex gap-3 animate-in fade-in slide-in-from-top-2 duration-300">
                <Info className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-bold text-blue-400 mb-1">Justificativa:</p>
                  <p className="text-sm text-muted-foreground leading-relaxed">{currentQuestion.justificativa}</p>
                </div>
              </div>
            )}

            {isAnswered && (
              <Button
                onClick={handleNext}
                disabled={finishing}
                className="w-full h-14 font-black text-base uppercase tracking-widest bg-amber-600 hover:bg-amber-500 shadow-[0_0_20px_rgba(245,158,11,0.3)]"
              >
                {finishing ? (
                  <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Finalizando...</>
                ) : isLast ? (
                  <>Finalizar Apresentação <ChevronRight className="w-5 h-5 ml-2" /></>
                ) : (
                  <>Próxima Questão <ChevronRight className="w-5 h-5 ml-2" /></>
                )}
              </Button>
            )}

            {!isAnswered && marking && (
              <div className="flex items-center justify-center gap-2 text-muted-foreground text-sm font-bold py-2">
                <Loader2 className="w-4 h-4 animate-spin" /> Marcando...
              </div>
            )}

            {allAnswered && !isAnswered && (
              <p className="text-center text-xs text-muted-foreground font-bold uppercase tracking-widest">
                Todas as questões já foram marcadas.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
