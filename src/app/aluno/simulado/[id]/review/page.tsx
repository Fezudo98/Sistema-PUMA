import { PrismaClient } from "@prisma/client";
import { getUser } from "@/app/actions/auth";
import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, CheckCircle, XCircle, Clock, Target, Info } from "lucide-react";
import Link from "next/link";

const prisma = new PrismaClient();

export default async function StudentSimuladoReview({ params }: { params: { id: string } }) {
  const user = await getUser();
  if (!user || user.role !== "STUDENT") {
    redirect("/aluno");
  }

  const { id } = await params;

  // Buscar simulado
  const simulado = await prisma.simulado.findUnique({
    where: { id },
    include: {
      questions: {
        orderBy: { id: "asc" }
      }
    }
  });

  if (!simulado) redirect("/aluno/painel");

  // Buscar respostas específicas deste aluno para este simulado
  const answers = await prisma.answer.findMany({
    where: {
      studentId: user.userId,
      question: {
        simuladoId: id
      }
    }
  });

  const answersMap = new Map();
  answers.forEach(a => answersMap.set(a.questionId, a));

  const totalQuestions = simulado.questions.length;
  const answeredQuestions = answers.length;
  const correctAnswers = answers.filter(a => a.isCorrect).length;
  const accuracy = answeredQuestions > 0 ? Math.round((correctAnswers / answeredQuestions) * 100) : 0;
  const score = answers.reduce((acc, curr) => acc + curr.pontuacao, 0);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 p-8">
      <div className="max-w-4xl mx-auto">
        <header className="flex justify-between items-center mb-8">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <Link href="/aluno/painel">
                <Button variant="ghost" size="icon" className="text-slate-500 hover:text-white hover:bg-slate-800">
                  <ArrowLeft className="w-5 h-5" />
                </Button>
              </Link>
              <h1 className="text-3xl font-black text-white uppercase tracking-tight">Correção do Simulado</h1>
            </div>
            <p className="text-slate-500 ml-12">Sala <strong className="text-blue-500">{simulado.codigoSala}</strong></p>
          </div>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <Card className="bg-slate-900/50 border-slate-800 shadow-sm">
            <CardContent className="p-6 text-center">
              <p className="text-sm text-slate-500 uppercase tracking-wider mb-2">Desempenho</p>
              <p className="text-3xl font-black text-emerald-400">{accuracy}%</p>
            </CardContent>
          </Card>
          <Card className="bg-slate-900/50 border-slate-800 shadow-sm">
            <CardContent className="p-6 text-center">
              <p className="text-sm text-slate-500 uppercase tracking-wider mb-2">Acertos</p>
              <p className="text-3xl font-black text-white">{correctAnswers} / {totalQuestions}</p>
            </CardContent>
          </Card>
          <Card className="bg-slate-900/50 border-slate-800 shadow-sm">
            <CardContent className="p-6 text-center">
              <p className="text-sm text-slate-500 uppercase tracking-wider mb-2">Pontuação</p>
              <p className="text-3xl font-black text-yellow-500">{score}</p>
            </CardContent>
          </Card>
          <Card className="bg-slate-900/50 border-slate-800 shadow-sm">
            <CardContent className="p-6 text-center flex flex-col justify-center min-h-[100px]">
              <p className="text-sm text-slate-500 uppercase tracking-wider mb-1">Apostila Base</p>
              <p className="text-sm font-semibold text-blue-400 truncate px-2">{simulado.apostilaName || "N/A"}</p>
              {simulado.topics && (
                <p className="text-xs text-slate-500 mt-1 truncate px-2" title={simulado.topics}>Tópicos: {simulado.topics}</p>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          {simulado.questions.map((q, index) => {
            const studentAnswer = answersMap.get(q.id);
            const isAnswered = !!studentAnswer;
            const isCorrect = isAnswered && studentAnswer.isCorrect;
            
            let cardBorder = "border-slate-800";
            if (isAnswered) {
              cardBorder = isCorrect ? "border-emerald-500/50" : "border-red-500/50";
            }

            const alternativas = JSON.parse(q.alternativas);

            return (
              <Card key={q.id} className={`bg-slate-900/50 border-l-4 shadow-sm ${cardBorder}`}>
                <CardHeader className="pb-3 border-b border-slate-800/50">
                  <div className="flex justify-between items-start">
                    <CardTitle className="text-lg text-slate-200 flex gap-4">
                      <span className="bg-slate-800 text-blue-400 px-3 py-1 rounded-full text-sm font-black">
                        Q{index + 1}
                      </span>
                      <span className="font-semibold leading-relaxed">
                        {q.enunciado}
                      </span>
                    </CardTitle>
                    {isAnswered && (
                      <div className="flex flex-col items-end shrink-0 gap-2">
                        {isCorrect ? (
                          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-400">
                            <CheckCircle className="w-4 h-4 mr-1" /> Acertou
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-red-500/10 text-red-400">
                            <XCircle className="w-4 h-4 mr-1" /> Errou
                          </span>
                        )}
                        <span className="flex items-center text-xs text-slate-500 font-mono">
                          <Clock className="w-3 h-3 mr-1" /> {studentAnswer.tempoGasto}s
                        </span>
                      </div>
                    )}
                    {!isAnswered && (
                      <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-slate-800 text-slate-400">
                        Não Respondida
                      </span>
                    )}
                  </div>
                </CardHeader>
                
                <CardContent className="pt-6 space-y-4">
                  <div className="space-y-3">
                    {alternativas.map((alt: string, aIndex: number) => {
                      const isOptionGabarito = aIndex === q.correta;
                      const isOptionStudent = isAnswered && studentAnswer.alternativa === aIndex;
                      
                      let bgClass = "bg-slate-800/30 border-slate-800 text-slate-400";
                      
                      if (isOptionGabarito && isOptionStudent) {
                        bgClass = "bg-emerald-500/10 border-emerald-500/30 text-emerald-300";
                      } else if (isOptionGabarito && !isOptionStudent) {
                        bgClass = "bg-emerald-500/5 border-emerald-500/20 text-emerald-400/80";
                      } else if (!isOptionGabarito && isOptionStudent) {
                        bgClass = "bg-red-500/10 border-red-500/30 text-red-300";
                      }

                      return (
                        <div 
                          key={aIndex} 
                          className={`p-3 rounded-lg border flex flex-col md:flex-row md:items-center gap-3 ${bgClass}`}
                        >
                          <div className="flex items-center gap-3 flex-1">
                            <span className="font-bold opacity-70">
                              {["A)", "B)", "C)", "D)", "E)"][aIndex] || `${aIndex})`}
                            </span>
                            <p>{alt.replace(/^[A-E]\)\s*/, '')}</p>
                          </div>
                          
                          <div className="flex gap-2 shrink-0 md:ml-auto pl-7 md:pl-0">
                            {isOptionStudent && (
                              <span className={`text-xs font-bold uppercase tracking-wider px-2 py-1 rounded ${isCorrect ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>
                                Sua Resposta
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
                  
                  <div className="mt-6 p-4 bg-blue-900/20 border border-blue-900/40 rounded-lg flex gap-4">
                    <Info className="w-6 h-6 text-blue-400 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-bold text-blue-400 mb-1">
                        Justificativa da IA:
                      </p>
                      <p className="text-sm text-slate-300 leading-relaxed">
                        {q.justificativa}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}
