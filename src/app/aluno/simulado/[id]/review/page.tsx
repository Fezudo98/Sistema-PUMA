import { prisma } from "@/lib/prisma";
import { getUser } from "@/app/actions/auth";
import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, CheckCircle, XCircle, Clock, Target, Info, Trophy, Users } from "lucide-react";
import Link from "next/link";
import ReportQuestionButton from "./ReportQuestionButton";
import { formatApostilaTitle } from "@/lib/utils";
import { JustificativaWithCitation } from "@/components/JustificativaWithCitation";
import { renderHighlightedText } from "@/lib/highlightText";

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

  let apostilaFilePath = null;
  if (simulado.apostilaName) {
    const apostila = await prisma.apostila.findFirst({
      where: { title: simulado.apostilaName }
    });
    if (apostila) {
      apostilaFilePath = apostila.filePath;
    }
  }

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

  const otherRaffleCount = await prisma.answer.count({
    where: {
      question: { simuladoId: id },
      isRaffle: true,
      studentId: { not: user.userId },
      student: { isTestUser: false }
    }
  });

  const totalQuestions = Math.max(0, simulado.questions.length - otherRaffleCount);
  const answeredQuestions = answers.length;
  const correctAnswers = answers.filter(a => a.isCorrect).length;
  
  // Verificar se o aluno concluiu o simulado
  const isLive = simulado.tipo === "LIVE";
  const isLiveFinished = isLive && simulado.status === "FINISHED";
  const isDailyCompleted = simulado.tipo === "DAILY" && answeredQuestions >= totalQuestions;
  const isSpecialCompleted = simulado.tipo === "SPECIAL" && answeredQuestions >= totalQuestions;

  if (!isLiveFinished && !isDailyCompleted && !isSpecialCompleted) {
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
      },
      student: { isTestUser: false }
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
  })).sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.avgTime - b.avgTime;
  });

  return (
    <div className="min-h-screen bg-background text-foreground p-8">
      <div className="max-w-4xl mx-auto">
        <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
          <div>
            <div className="flex items-center gap-3 mb-2 flex-wrap">
              <Link 
                href="/aluno/painel"
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-card hover:bg-muted border border-border/80 hover:border-blue-500/50 text-foreground hover:text-heading font-bold text-sm tracking-wide transition-all shadow-md active:scale-95 cursor-pointer shrink-0"
                title="Voltar para o Painel Principal"
              >
                <ArrowLeft className="w-5 h-5 text-blue-400" />
                <span>Voltar ao Painel</span>
              </Link>
              <h1 className="text-2xl sm:text-3xl font-black text-heading uppercase tracking-tight">Correção do Simulado</h1>
            </div>
            {simulado.tipo === "LIVE" ? (
              <p className="text-muted-foreground font-medium">Sala <strong className="text-blue-500">{simulado.codigoSala}</strong></p>
            ) : (
              <p className="text-muted-foreground font-medium">Treinamento de Estudo Individual: <strong className="text-blue-500">IA Avançado</strong></p>
            )}
          </div>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <Card className="bg-card/50 border-border shadow-sm">
            <CardContent className="p-6 text-center">
              <p className="text-sm text-muted-foreground uppercase tracking-wider mb-2">Desempenho</p>
              <p className="text-3xl font-black text-emerald-400">{accuracy}%</p>
            </CardContent>
          </Card>
          <Card className="bg-card/50 border-border shadow-sm">
            <CardContent className="p-6 text-center">
              <p className="text-sm text-muted-foreground uppercase tracking-wider mb-2">Acertos</p>
              <p className="text-3xl font-black text-heading">{correctAnswers} / {totalQuestions}</p>
            </CardContent>
          </Card>
          <Card className="bg-card/50 border-border shadow-sm">
            <CardContent className="p-6 text-center">
              <p className="text-sm text-muted-foreground uppercase tracking-wider mb-2">Pontuação</p>
              <p className="text-3xl font-black text-yellow-500">{score}</p>
            </CardContent>
          </Card>
          <Card className="bg-card/50 border-border shadow-sm">
            <CardContent className="p-6 text-center flex flex-col justify-center min-h-[100px]">
              <p className="text-sm text-muted-foreground uppercase tracking-wider mb-1">Apostila Base</p>
              <p className="text-sm font-semibold text-blue-400 line-clamp-2 px-2" title={simulado.apostilaName || "N/A"}>{formatApostilaTitle(simulado.apostilaName || "N/A")}</p>
              {simulado.topics && (
                <p className="text-xs text-muted-foreground mt-1 truncate px-2" title={simulado.topics}>Tópicos: {simulado.topics}</p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Card de Ranking Geral */}
        <Card className="bg-card/50 border-border shadow-sm mb-8">
          <CardHeader className="pb-3 border-b border-border/50 flex flex-row items-center justify-between">
            <CardTitle className="text-lg text-foreground flex items-center gap-2">
              <Trophy className="w-5 h-5 text-yellow-500" /> Ranking Geral de Participantes
            </CardTitle>
            <span className="text-xs text-muted-foreground font-bold uppercase">{ranking.length} Combatentes</span>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-background text-muted-foreground border-b border-border">
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
                <tbody className="divide-y divide-border">
                  {ranking.map((aluno, idx) => (
                    <tr key={idx} className="hover:bg-card/30">
                      <td className="px-4 py-3 font-bold text-muted-foreground">
                        {idx + 1}º
                      </td>
                      <td className="px-4 py-3 flex items-center gap-3">
                        {aluno.avatarUrl ? (
                          <img src={aluno.avatarUrl} alt="Avatar" className="w-6 h-6 rounded-full object-cover border border-border" />
                        ) : (
                          <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-[10px] font-bold text-muted-foreground border border-border">
                            {aluno.name.substring(0,2).toUpperCase()}
                          </div>
                        )}
                        <span className="font-bold text-foreground">{aluno.name}</span>
                      </td>
                      <td className="px-4 py-3 text-center text-muted-foreground">{aluno.answers}</td>
                      <td className="px-4 py-3 text-center text-emerald-400 font-bold">{aluno.corrects}</td>
                      <td className="px-4 py-3 text-center text-red-400 font-bold">{aluno.incorrects}</td>
                      <td className="px-4 py-3 text-muted-foreground">{aluno.avgTime}s</td>
                      <td className="px-4 py-3 text-right font-mono font-bold text-blue-400">{aluno.score} pts</td>
                    </tr>
                  ))}
                  {ranking.length === 0 && (
                    <tr>
                      <td colSpan={7} className="text-center py-6 text-muted-foreground">Nenhum participante pontuou neste simulado.</td>
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
            
            let cardBorder = "border-border";
            if (isAnswered) {
              cardBorder = isCorrect ? "border-emerald-500/50" : "border-red-500/50";
            }

            const alternativas = JSON.parse(q.alternativas);

            return (
              <Card key={q.id} className={`bg-card/50 border-l-4 shadow-sm ${cardBorder}`}>
                <CardHeader className="pb-3 border-b border-border/50">
                  <div className="flex justify-between items-start">
                    <CardTitle className="text-lg text-foreground flex gap-4">
                      <span className="bg-muted text-blue-400 px-3 py-1 rounded-full text-sm font-black">
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
                        <span className="flex items-center text-xs text-muted-foreground font-mono">
                          <Clock className="w-3 h-3 mr-1" /> {studentAnswer.tempoGasto}s
                        </span>
                      </div>
                    )}
                    {!isAnswered && (
                      <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-muted text-muted-foreground">
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
                      
                      let bgClass = "bg-muted/30 border-border text-muted-foreground";
                      
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
                            <p>{renderHighlightedText(alt.replace(/^[A-E]\)\s*/i, ''))}</p>
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
                      <div className="text-sm text-muted-foreground leading-relaxed">
                        <JustificativaWithCitation text={q.justificativa} apostilaFilePath={apostilaFilePath} />
                      </div>
                    </div>
                  </div>
                  
                  {simulado.tipo === "DAILY" && (
                    <ReportQuestionButton 
                      questionId={q.id}
                      simuladoId={simulado.id}
                      hasAppealedGlobal={simulado.hasAppealed}
                      hasAppealLocal={q.hasAppeal}
                      appealStatus={q.appealStatus}
                      appealResponse={q.appealResponse}
                    />
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Rodapé de Navegação Rápida ao final da Correção */}
        <div className="mt-12 pt-8 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-4">
          <Link 
            href="/aluno/painel"
            className="w-full sm:w-auto flex items-center justify-center gap-3 px-8 py-4 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-heading font-black text-sm sm:text-base uppercase tracking-wider transition-all shadow-[0_0_25px_rgba(59,130,246,0.3)] hover:scale-105 active:scale-95 cursor-pointer"
          >
            <ArrowLeft className="w-5 h-5" />
            <span>Voltar para o Painel Principal</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
