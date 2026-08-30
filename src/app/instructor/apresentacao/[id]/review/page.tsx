import { prisma } from "@/lib/prisma";
import { getUser } from "@/app/actions/auth";
import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, CheckCircle, XCircle, Target, Info, Trophy } from "lucide-react";
import Link from "next/link";
import { formatApostilaTitle } from "@/lib/utils";
import { renderHighlightedText } from "@/lib/highlightText";

export default async function InstructorPresentationReview({ params }: { params: { id: string } }) {
  const user = await getUser();
  if (!user || user.role !== "INSTRUCTOR") {
    redirect("/auth/login");
  }

  const { id } = await params;

  const simulado = await prisma.simulado.findUnique({
    where: { id },
    include: {
      questions: { orderBy: { id: "asc" } }
    }
  });

  if (!simulado || simulado.tipo !== "PRESENTATION" || simulado.instructorId !== user.userId) {
    redirect("/instructor");
  }

  const totalQuestions = simulado.questions.length;
  const answeredQuestions = simulado.questions.filter((q) => q.presentationAnswer !== null).length;
  const correctAnswers = simulado.questions.filter((q) => q.presentationAnswer === q.correta).length;
  const accuracy = answeredQuestions > 0 ? Math.round((correctAnswers / answeredQuestions) * 100) : 0;

  return (
    <div className="min-h-screen bg-background text-foreground p-8">
      <div className="max-w-4xl mx-auto">
        <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
          <div>
            <div className="flex items-center gap-3 mb-2 flex-wrap">
              <Link
                href="/instructor"
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-card hover:bg-muted border border-border/80 hover:border-amber-500/50 text-foreground hover:text-heading font-bold text-sm tracking-wide transition-all shadow-md active:scale-95 cursor-pointer shrink-0"
              >
                <ArrowLeft className="w-5 h-5 text-amber-400" />
                <span>Voltar ao Painel</span>
              </Link>
              <h1 className="text-2xl sm:text-3xl font-black text-heading uppercase tracking-tight">Resultado da Apresentação</h1>
            </div>
            <p className="text-muted-foreground font-medium">
              Modo Apresentação: <strong className="text-amber-500">{formatApostilaTitle(simulado.apostilaName || "Apresentação")}</strong>
            </p>
          </div>
        </header>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          <Card className="bg-card/50 border-border shadow-sm">
            <CardContent className="p-6 text-center">
              <Trophy className="w-5 h-5 text-yellow-500 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground uppercase tracking-wider mb-1">Aproveitamento da Turma</p>
              <p className="text-3xl font-black text-emerald-400">{accuracy}%</p>
            </CardContent>
          </Card>
          <Card className="bg-card/50 border-border shadow-sm">
            <CardContent className="p-6 text-center">
              <Target className="w-5 h-5 text-blue-500 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground uppercase tracking-wider mb-1">Acertos</p>
              <p className="text-3xl font-black text-heading">{correctAnswers} / {answeredQuestions}</p>
            </CardContent>
          </Card>
          <Card className="bg-card/50 border-border shadow-sm">
            <CardContent className="p-6 text-center">
              <Info className="w-5 h-5 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground uppercase tracking-wider mb-1">Total de Questões</p>
              <p className="text-3xl font-black text-heading">{totalQuestions}</p>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          {simulado.questions.map((q, index) => {
            const alternativas = JSON.parse(q.alternativas);
            const isAnswered = q.presentationAnswer !== null;
            const isCorrect = isAnswered && q.presentationAnswer === q.correta;

            let cardBorder = "border-border";
            if (isAnswered) {
              cardBorder = isCorrect ? "border-emerald-500/50" : "border-red-500/50";
            }

            return (
              <Card key={q.id} className={`bg-card/50 border-l-4 shadow-sm ${cardBorder}`}>
                <CardHeader className="pb-3 border-b border-border/50">
                  <div className="flex justify-between items-start">
                    <CardTitle className="text-lg text-foreground flex gap-4">
                      <span className="bg-muted text-amber-400 px-3 py-1 rounded-full text-sm font-black">
                        Q{index + 1}
                      </span>
                      <span className="font-semibold leading-relaxed">{q.enunciado}</span>
                    </CardTitle>
                    {isAnswered ? (
                      isCorrect ? (
                        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-400 shrink-0">
                          <CheckCircle className="w-4 h-4 mr-1" /> Acertou
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-red-500/10 text-red-400 shrink-0">
                          <XCircle className="w-4 h-4 mr-1" /> Errou
                        </span>
                      )
                    ) : (
                      <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-muted text-muted-foreground shrink-0">
                        Não Marcada
                      </span>
                    )}
                  </div>
                </CardHeader>

                <CardContent className="pt-6 space-y-4">
                  <div className="space-y-3">
                    {alternativas.map((alt: string, aIndex: number) => {
                      const isOptionGabarito = aIndex === q.correta;
                      const isOptionMarked = isAnswered && q.presentationAnswer === aIndex;

                      let bgClass = "bg-muted/30 border-border text-muted-foreground";
                      if (isOptionGabarito && isOptionMarked) {
                        bgClass = "bg-emerald-500/10 border-emerald-500/30 text-emerald-300";
                      } else if (isOptionGabarito && !isOptionMarked) {
                        bgClass = "bg-emerald-500/5 border-emerald-500/20 text-emerald-400/80";
                      } else if (!isOptionGabarito && isOptionMarked) {
                        bgClass = "bg-red-500/10 border-red-500/30 text-red-300";
                      }

                      return (
                        <div key={aIndex} className={`p-3 rounded-lg border flex flex-col md:flex-row md:items-center gap-3 ${bgClass}`}>
                          <div className="flex items-center gap-3 flex-1">
                            <span className="font-bold opacity-70">
                              {["A)", "B)", "C)", "D)", "E)"][aIndex] || `${aIndex})`}
                            </span>
                            <p>{renderHighlightedText(alt.replace(/^[A-E]\)\s*/i, ""))}</p>
                          </div>
                          <div className="flex gap-2 shrink-0 md:ml-auto pl-7 md:pl-0">
                            {isOptionMarked && (
                              <span className="text-xs font-bold uppercase tracking-wider px-2 py-1 rounded bg-background/60">
                                Marcada
                              </span>
                            )}
                            {isOptionGabarito && (
                              <span className="text-xs font-bold uppercase tracking-wider text-emerald-400 bg-emerald-500/20 px-2 py-1 rounded">
                                Gabarito
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="mt-4 p-4 bg-blue-900/20 border border-blue-900/40 rounded-lg flex gap-4">
                    <Info className="w-6 h-6 text-blue-400 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-bold text-blue-400 mb-1">Justificativa da IA:</p>
                      <p className="text-sm text-muted-foreground leading-relaxed">{q.justificativa}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <div className="mt-12 pt-8 border-t border-border flex justify-center">
          <Link
            href="/instructor"
            className="w-full sm:w-auto flex items-center justify-center gap-3 px-8 py-4 rounded-xl bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-heading font-black text-sm sm:text-base uppercase tracking-wider transition-all shadow-[0_0_25px_rgba(245,158,11,0.3)] hover:scale-105 active:scale-95 cursor-pointer"
          >
            <ArrowLeft className="w-5 h-5" />
            <span>Voltar para o Painel</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
