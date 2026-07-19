import { PrismaClient } from "@prisma/client";
import { getUser } from "@/app/actions/auth";
import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, CheckCircle, XCircle, Clock, Target, Info, Trophy, Users } from "lucide-react";
import Link from "next/link";
import RefazerReviewButton from "./RefazerReviewButton";
import { formatApostilaTitle } from "@/lib/utils";

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

  // Buscar todas as respostas de sorteio de outros alunos para este simulado
  const otherRaffleCount = await prisma.answer.count({
    where: {
      question: { simuladoId: id },
      isRaffle: true,
      studentId: { not: user.userId }
    }
  });

  const totalQuestions = Math.max(0, simulado.questions.length - otherRaffleCount);
  const answeredQuestions = answers.length;
  const correctAnswers = answers.filter(a => a.isCorrect).length;
  
  // Verificar se o aluno concluiu o simulado
  const isLive = simulado.tipo === "LIVE";
  const isLiveFinished = isLive && simulado.status === "FINISHED";
  const isDailyCompleted = simulado.tipo === "DAILY" && answeredQuestions >= totalQuestions;

  if (!isLiveFinished && !isDailyCompleted) {
    redirect(`/aluno/simulado/${id}`);
  }

  // O divisor da precisão deve ser o total de questões para evitar trapaças/distorções de quem sai mais cedo
  const accuracy = totalQuestions > 0 ? Math.round((correctAnswers / totalQuestions) * 100) : 0;
  const score = answers.reduce((acc, curr) => acc + curr.pontuacao, 0);

  // Garantir que as medalhas/brevês do aluno sejam re-avaliadas e desbloqueadas ao ver o resultado
  const { completeSelfPacedSimulado } = await import("@/app/actions/dailySimulado");
  await completeSelfPacedSimulado(user.userId, id);

  // Buscar todas as respostas de todos os participantes para este simulado
  const allAnswers = await prisma.answer.findMany({
    where: {
      question: {
        simuladoId: id
      }
    },
    include: {
      student: true
    }
  });

  const raffleQuestionIds = new Set(
    allAnswers.filter(a => a.isRaffle).map(a => a.questionId)
  );

  const studentScores: Record<string, { name: string; score: number; answers: number; totalTime: number; corrects: number; incorrects: number; avatarUrl: string | null }> = {};

  allAnswers.forEach(a => {
    if (!studentScores[a.studentId]) {
      studentScores[a.studentId] = {
        name: a.student.name,
        score: 0,
        answers: 0,
        totalTime: 0,
        corrects: 0,
        incorrects: 0,
        avatarUrl: a.student.avatarUrl
      };
    }
    studentScores[a.studentId].score += a.pontuacao;
    studentScores[a.studentId].answers += 1;
    studentScores[a.studentId].totalTime += a.tempoGasto;
    if (a.isCorrect) {
      studentScores[a.studentId].corrects += 1;
    } else {
      studentScores[a.studentId].incorrects += 1;
    }
  });

  const ranking = Object.values(studentScores).map(s => ({
    ...s,
    avgTime: s.answers > 0 ? Math.round(s.totalTime / s.answers) : 0
  })).sort((a, b) => b.score - a.score);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 p-8">
      <div className="max-w-4xl mx-auto">
        <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <Link href="/aluno/painel">
                <Button variant="ghost" size="icon" className="text-slate-500 hover:text-white hover:bg-slate-800">
                  <ArrowLeft className="w-5 h-5" />
                </Button>
              </Link>
              <h1 className="text-3xl font-black text-white uppercase tracking-tight">Correção do Simulado</h1>
            </div>
            {simulado.tipo === "LIVE" ? (
              <p className="text-slate-500 ml-12">Sala <strong className="text-blue-500">{simulado.codigoSala}</strong></p>
            ) : (
              <p className="text-slate-500 ml-12">Treinamento de Estudo Individual: <strong className="text-blue-500">IA Avançado</strong></p>
            )}
          </div>
          
          {simulado.tipo === "DAILY" && (
            <RefazerReviewButton 
              simId={simulado.id} 
              studentId={user.userId} 
              simName={simulado.apostilaName || "Simulado de Estudo"} 
            />
          )}
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
              <p className="text-sm font-semibold text-blue-400 line-clamp-2 px-2" title={simulado.apostilaName || "N/A"}>{formatApostilaTitle(simulado.apostilaName || "N/A")}</p>
              {simulado.topics && (
                <p className="text-xs text-slate-500 mt-1 truncate px-2" title={simulado.topics}>Tópicos: {simulado.topics}</p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Card de Ranking Geral */}
        <Card className="bg-slate-900/50 border-slate-800 shadow-sm mb-8">
          <CardHeader className="pb-3 border-b border-slate-800/50 flex flex-row items-center justify-between">
            <CardTitle className="text-lg text-slate-200 flex items-center gap-2">
              <Trophy className="w-5 h-5 text-yellow-500" /> Ranking Geral de Participantes
            </CardTitle>
            <span className="text-xs text-slate-400 font-bold uppercase">{ranking.length} Combatentes</span>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-950 text-slate-400 border-b border-slate-800">
                  <tr>
                    <th className="px-4 py-2 font-medium">Posição</th>
                    <th className="px-4 py-2 font-medium">Aluno</th>
                    <th className="px-4 py-2 font-medium text-center">Respostas</th>
                    <th className="px-4 py-2 font-medium text-center">Acertos</th>
                    <th className="px-4 py-2 font-medium text-center">Erros</th>
                    <th className="px-4 py-2 font-medium">Tempo Médio</th>
                    <th className="px-4 py-2 font-medium text-right">Pontuação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50">
                  {ranking.map((aluno, idx) => (
                    <tr key={idx} className="hover:bg-slate-900/30">
                      <td className="px-4 py-3 font-bold text-slate-500">
                        {idx + 1}º
                      </td>
                      <td className="px-4 py-3 flex items-center gap-3">
                        {aluno.avatarUrl ? (
                          <img src={aluno.avatarUrl} alt="Avatar" className="w-6 h-6 rounded-full object-cover border border-slate-700" />
                        ) : (
                          <div className="w-6 h-6 rounded-full bg-slate-800 flex items-center justify-center text-[10px] font-bold text-slate-400 border border-slate-700">
                            {aluno.name.substring(0,2).toUpperCase()}
                          </div>
                        )}
                        <span className="font-bold text-slate-200">{aluno.name}</span>
                      </td>
                      <td className="px-4 py-3 text-center text-slate-400">{aluno.answers}</td>
                      <td className="px-4 py-3 text-center text-emerald-400 font-bold">{aluno.corrects}</td>
                      <td className="px-4 py-3 text-center text-red-400 font-bold">{aluno.incorrects}</td>
                      <td className="px-4 py-3 text-slate-400">{aluno.avgTime}s</td>
                      <td className="px-4 py-3 text-right font-mono font-bold text-blue-400">{aluno.score} pts</td>
                    </tr>
                  ))}
                  {ranking.length === 0 && (
                    <tr>
                      <td colSpan={7} className="text-center py-6 text-slate-500">Nenhum participante pontuou neste simulado.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

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
                        {raffleQuestionIds.has(q.id) ? "Apenas Observou" : "Não Respondida"}
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
                            <p>{alt.replace(/^[A-E]\)\s*/i, '')}</p>
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
