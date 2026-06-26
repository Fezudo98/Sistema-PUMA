"use client";

import { useEffect, useState, useRef } from "react";
import { io, Socket } from "socket.io-client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useSearchParams } from "next/navigation";
import { Clock, Users, Play, Target, Square, Pause, CheckCircle, Trophy, Flame, Snowflake, Ban, BarChart2, ChevronRight } from "lucide-react";
import Link from "next/link";
import { Progress } from "@/components/ui/progress";
import { endSimulado } from "@/app/actions/simulado";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

export default function InstructorLiveClient({ user, simulado }: { user: any, simulado: any }) {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [status, setStatus] = useState(simulado.status);
  const [students, setStudents] = useState<any[]>([]);
  const [ranking, setRanking] = useState<{id: string, name: string, score: number, streak: number, avatarUrl?: string | null}[]>([]);
  const [notifications, setNotifications] = useState<{id: string, text: string}[]>([]);
  
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(-1);
  const [isQuestionActive, setIsQuestionActive] = useState(false);
  const [timeLeft, setTimeLeft] = useState(0);
  const [answersReceived, setAnswersReceived] = useState(0);
  const [questionEndedData, setQuestionEndedData] = useState<any>(null);
  const [isPaused, setIsPaused] = useState(false);
  const [isTimeUp, setIsTimeUp] = useState(false);
  const searchParams = useSearchParams();
  const [isRaffleMode, setIsRaffleMode] = useState(searchParams.get("raffle") === "true");
  const [isRaffling, setIsRaffling] = useState(false);
  const [raffleWinner, setRaffleWinner] = useState<any>(null);
  const [displayStudent, setDisplayStudent] = useState<any>(null);
  const [answeredStudentIds, setAnsweredStudentIds] = useState<string[]>([]);
  const [selectedAltForDetails, setSelectedAltForDetails] = useState<number | null>(null);

  useEffect(() => {
    if (isRaffling && students.length > 0) {
      const interval = setInterval(() => {
        const random = students[Math.floor(Math.random() * students.length)];
        setDisplayStudent(random);
      }, 100);

      const timeout = setTimeout(() => {
        clearInterval(interval);
        setDisplayStudent(raffleWinner);
      }, 3000); // 3s spin, 1s rest

      return () => {
        clearInterval(interval);
        clearTimeout(timeout);
      };
    } else {
      setDisplayStudent(raffleWinner);
    }
  }, [isRaffling, students, raffleWinner]);

  useEffect(() => {
    const s = io();
    setSocket(s);

    s.on("connect", () => {
      s.emit("join_room", { roomCode: simulado.codigoSala, user });
    });

    s.on("room_update", (data) => {
      setStudents(data.students);
      if (data.status === "ACTIVE") {
        setStatus((prev: string) => prev === "WAITING" ? "ACTIVE" : prev);
      }
      if (data.answeredStudentIds) {
        setAnsweredStudentIds(data.answeredStudentIds);
      }
    });
    
    s.on("ranking_update", (data) => {
      setRanking(data.ranking);
    });

    s.on("streak_notifications", (data) => {
      data.notifications.forEach((notif: string, index: number) => {
        setTimeout(() => {
          const id = Math.random().toString(36).substr(2, 9);
          setNotifications(prev => [...prev.slice(-4), { id, text: notif }]);
          setTimeout(() => {
            setNotifications(prev => prev.filter(n => n.id !== id));
          }, 6000);
        }, index * 800); // Stagger animations
      });
    });

    s.on("simulado_started", () => {
      setStatus("ACTIVE");
    });

    s.on("time_tick", (data) => {
      setTimeLeft(data.timeLeft);
    });

    s.on("time_paused", () => {
      setIsPaused(true);
    });

    s.on("time_resumed", () => {
      setIsPaused(false);
    });

    s.on("instructor_student_answered", (data) => {
      setAnswersReceived(data.count);
      if (data.answeredStudentIds) {
        setAnsweredStudentIds(data.answeredStudentIds);
      }
    });

    s.on("question_ended", (data) => {
      setIsQuestionActive(false);
      setIsTimeUp(false);
      setQuestionEndedData(data);
    });

    s.on("time_up", () => {
      setIsTimeUp(true);
      setIsPaused(false);
    });

    s.on("question_cancelled", () => {
      setIsQuestionActive(false);
      setQuestionEndedData(null);
      setIsPaused(false);
      setIsTimeUp(false);
      setRaffleWinner(null);
      setIsRaffling(false);
      setAnsweredStudentIds([]);
    });

    s.on("raffle_started", ({ winner }) => {
      setRaffleWinner(winner);
      setIsRaffling(true);
      setTimeout(() => {
        setIsRaffling(false);
      }, 6000);
    });

    return () => {
      s.disconnect();
    };
  }, [simulado.codigoSala, user.userId]);

  const handleStartSimulado = () => {
    if (socket) {
      socket.emit("start_simulado", { roomCode: simulado.codigoSala, simuladoId: simulado.id });
    }
  };

  const handleNextQuestion = () => {
    const nextIndex = currentQuestionIndex + 1;
    if (nextIndex < simulado.questions.length) {
      const q = simulado.questions[nextIndex];
      setCurrentQuestionIndex(nextIndex);
      setIsQuestionActive(true);
      setQuestionEndedData(null);
      setAnswersReceived(0);
      setAnsweredStudentIds([]);
      setTimeLeft(q.tempoLimite);
      setIsPaused(false);
      setIsTimeUp(false);
      
      const isLast = nextIndex === simulado.questions.length - 1;
      if (isRaffleMode) {
        socket?.emit("next_question_raffle", { roomCode: simulado.codigoSala, question: q, isLast });
      } else {
        setRaffleWinner(null);
        socket?.emit("next_question", { roomCode: simulado.codigoSala, question: q, isLast });
      }
    } else {
      setStatus("FINISHED");
      socket?.emit("end_simulado", { roomCode: simulado.codigoSala, simuladoId: simulado.id });
      endSimulado(simulado.id);
    }
  };

  const handleEndTimeEarly = () => {
    socket?.emit("end_time", { roomCode: simulado.codigoSala });
  };

  const handlePauseTime = () => {
    socket?.emit("pause_time", { roomCode: simulado.codigoSala });
  };

  const handleResumeTime = () => {
    socket?.emit("resume_time", { roomCode: simulado.codigoSala });
  };

  const handleCancelQuestion = () => {
    if (confirm("Tem certeza que deseja anular esta questão? Ninguém pontuará e ela será pulada.")) {
      socket?.emit("cancel_question", { roomCode: simulado.codigoSala });
    }
  };

  const currentQuestion = currentQuestionIndex >= 0 ? simulado.questions[currentQuestionIndex] : null;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 flex flex-col relative overflow-hidden">
      {/* Toast Notifications */}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-3 pointer-events-none w-80">
        {notifications.map(n => (
          <div key={n.id} className="bg-slate-900 border border-slate-700 text-white p-4 rounded-xl shadow-[0_0_30px_rgba(0,0,0,0.5)] animate-in slide-in-from-right-8 fade-in duration-300 pointer-events-auto flex items-start gap-3">
            <span className="text-sm font-bold leading-tight">{n.text}</span>
          </div>
        ))}
      </div>
      <header className="border-b border-slate-800 bg-slate-900 px-6 py-4 flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold text-white tracking-widest uppercase">
            Sala <span className="text-blue-500">{simulado.codigoSala}</span>
          </h1>
          <p className="text-xs text-slate-400">Controle Remoto do Instrutor</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-emerald-400 bg-emerald-400/10 px-4 py-2 rounded-full border border-emerald-400/20">
            <Users className="w-5 h-5" />
            <span className="font-bold">{students.length} Alunos</span>
          </div>
          {status !== "FINISHED" && (
            <Button 
              variant="destructive" 
              className="font-bold bg-red-600 hover:bg-red-500 text-white"
              onClick={async () => {
                if (confirm("Tem certeza que deseja encerrar definitivamente este simulado agora?")) {
                  setStatus("FINISHED");
                  socket?.emit("end_simulado", { roomCode: simulado.codigoSala, simuladoId: simulado.id });
                  await endSimulado(simulado.id);
                }
              }}
            >
              <Square className="w-4 h-4 mr-2" /> Encerrar Simulado
            </Button>
          )}
          <Link href="/instructor">
            <Button variant="outline" className="border-slate-700 text-slate-300 hover:bg-slate-800">Sair da Sala</Button>
          </Link>
        </div>
      </header>

      <main className="flex-1 p-4 md:p-6 flex items-start justify-center overflow-y-auto">
        {status === "WAITING" && (
          <div className="text-center max-w-4xl w-full p-8 bg-slate-900/30 border border-slate-800/80 rounded-3xl backdrop-blur-md shadow-2xl">
            <div className="w-24 h-24 mx-auto bg-blue-600 rounded-full flex items-center justify-center mb-6 shadow-[0_0_50px_rgba(37,99,235,0.4)] animate-pulse">
              <Play className="w-10 h-10 text-white ml-1.5" />
            </div>
            <h2 className="text-4xl md:text-5xl font-black text-white mb-2 uppercase tracking-wide">Aguardando Alunos</h2>
            <p className="text-slate-400 text-lg md:text-xl mb-8">
              Peça para os alunos entrarem no painel do aluno e ingressarem no simulado, ou insira o código:
            </p>
            
            <div className="bg-slate-950/90 border-2 border-blue-500/30 rounded-2xl p-6 md:p-8 mb-8 text-center shadow-[0_0_50px_rgba(59,130,246,0.15)] select-all cursor-pointer group hover:border-blue-500/50 transition-all">
              <span className="block text-slate-500 text-xs md:text-sm font-black tracking-widest uppercase mb-3">CÓDIGO DE ACESSO DA SALA</span>
              <span className="font-mono text-6xl md:text-8xl font-black text-white tracking-widest animate-pulse drop-shadow-[0_0_20px_rgba(59,130,246,0.5)]">
                {simulado.codigoSala}
              </span>
            </div>

            <Button onClick={handleStartSimulado} className="w-full h-20 text-xl md:text-2xl font-black uppercase tracking-wider bg-blue-600 hover:bg-blue-500 shadow-[0_0_35px_rgba(37,99,235,0.4)] transition-all" disabled={students.length === 0}>
              INICIAR SIMULADO AGORA
            </Button>
            
            <div className="mt-10 border-t border-slate-800 pt-8 text-left">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-lg font-bold text-slate-400 uppercase tracking-wider">Combatentes Conectados</h3>
                <span className="bg-blue-500/20 text-blue-400 border border-blue-500/30 px-3.5 py-1.5 rounded-full text-sm font-black">
                  {students.length} Online
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {students.map((s, i) => (
                  <div key={i} className="px-4 py-3 bg-slate-950/60 border border-slate-800/80 rounded-xl text-base md:text-lg font-bold text-slate-200 flex items-center gap-3 shadow-sm animate-in fade-in zoom-in duration-300">
                    {s.avatarUrl ? (
                      <img src={s.avatarUrl} alt="Avatar" className="w-8 h-8 rounded-full object-cover border border-slate-700 shrink-0" />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-slate-850 flex items-center justify-center text-xs font-bold text-slate-400 border border-slate-700 shrink-0">
                        {s.name.substring(0, 2).toUpperCase()}
                      </div>
                    )}
                    <span className="truncate flex-1">{s.name}</span>
                  </div>
                ))}
                {students.length === 0 && (
                  <div className="col-span-full text-center py-6 text-slate-650 font-bold text-lg animate-pulse">
                    Ninguém entrou ainda. Aguardando conexão dos recrutas...
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {status === "ACTIVE" && (
          <div className="max-w-[95vw] w-full flex flex-col lg:flex-row gap-6">
            {/* Esquerda: Controle da Questão */}
            <div className="flex-1 space-y-6 flex flex-col">
              {currentQuestionIndex === -1 ? (
                <div className="flex-1 bg-slate-900 border border-slate-800 rounded-2xl flex flex-col items-center justify-center text-center p-6 md:p-8">
                  <Target className="w-16 h-16 text-blue-500 mb-4" />
                  <h2 className="text-2xl font-bold text-white mb-2">Simulado Iniciado!</h2>
                  <p className="text-slate-400 mb-8">Os alunos estão vendo a tela de aguarde. Libere a primeira questão quando estiver pronto.</p>
                  <Button onClick={handleNextQuestion} className="h-12 md:h-14 px-8 text-base md:text-lg bg-blue-600 hover:bg-blue-500 font-bold">
                    Liberar Questão 1
                  </Button>
                </div>
              ) : (
                <div className="flex-1 bg-slate-900 border border-slate-800 rounded-2xl p-5 md:p-8 flex flex-col">
                  <div className="flex justify-between items-center mb-6">
                    <span className="text-blue-400 font-bold tracking-wider uppercase text-sm">Questão {currentQuestionIndex + 1} de {simulado.questions.length}</span>
                    {isQuestionActive ? (
                      <span className="flex items-center gap-2 text-emerald-400 font-bold animate-pulse">
                        <div className="w-2 h-2 rounded-full bg-emerald-400"></div> AO VIVO
                      </span>
                    ) : (
                      <span className="flex items-center gap-2 text-red-400 font-bold">
                        <Square className="w-4 h-4" /> ENCERRADA
                      </span>
                    )}
                  </div>
                  
                  {raffleWinner && !isRaffling && (
                    <div className="mb-6 p-4 bg-red-900/20 border border-red-500/50 rounded-lg flex items-center gap-4 shadow-[0_0_15px_rgba(239,68,68,0.2)]">
                      <Target className="w-8 h-8 text-red-500 animate-pulse" />
                      <div className="flex-1">
                        <h3 className="text-red-400 font-bold uppercase tracking-wider text-xs">Alvo Sorteado</h3>
                        <p className="text-white font-black text-xl tracking-wide">{raffleWinner.name}</p>
                      </div>
                    </div>
                  )}

                  <div className="mb-6 flex-1 flex flex-col gap-4 md:gap-6 overflow-y-auto pr-2 custom-scrollbar">
                    <p className="text-xl md:text-2xl lg:text-3xl font-extrabold text-white leading-normal tracking-wide drop-shadow-[0_2px_4px_rgba(0,0,0,0.4)]">{currentQuestion?.enunciado}</p>
                    
                    {currentQuestion?.alternativas && (
                      <div className="flex flex-col gap-3">
                        {currentQuestion.alternativas.map((alt: string, index: number) => {
                          const letter = String.fromCharCode(65 + index);
                          const cleanAlt = alt.replace(/^[A-E]\)\s*/i, '');
                          
                          // Se a questão já foi encerrada e temos os dados, podemos destacar a correta
                          const isEnded = questionEndedData !== null;
                          const isCorrect = isEnded && questionEndedData.correta === index;
                          
                          const isClickable = isEnded && questionEndedData.answersByAlt;
                          
                          return (
                            <div 
                              key={index} 
                              onClick={() => {
                                if (isClickable) {
                                  setSelectedAltForDetails(index);
                                }
                              }}
                              className={`flex flex-col gap-3 p-4 md:p-5 rounded-xl border transition-all ${
                                isCorrect 
                                  ? 'bg-emerald-950/30 border-emerald-500/70 shadow-[0_0_20px_rgba(16,185,129,0.15)]' 
                                  : 'bg-slate-900 border-slate-850'
                              } ${isClickable ? 'cursor-pointer hover:bg-slate-850 hover:border-blue-500/40' : ''}`}
                            >
                              <div className="flex items-start gap-4">
                                <span className={`flex shrink-0 items-center justify-center w-8 h-8 md:w-10 md:h-10 rounded-full text-sm md:text-lg font-extrabold border-2 ${
                                  isCorrect
                                    ? 'bg-emerald-500 text-white shadow-[0_0_15px_rgba(16,185,129,0.4)] border-emerald-400'
                                    : 'bg-slate-850 text-slate-300 border-slate-700'
                                }`}>
                                  {letter}
                                </span>
                                <span className={`flex-1 pt-0.5 text-base md:text-lg lg:text-xl leading-relaxed ${isCorrect ? 'text-emerald-400 font-black' : 'text-slate-200 font-semibold'}`}>
                                  {cleanAlt}
                                </span>
                              </div>

                              {isEnded && questionEndedData.percentages && (
                                <div className="pl-14 flex items-center gap-4 w-full animate-in fade-in slide-in-from-left-2 duration-300">
                                  <Progress 
                                    value={questionEndedData.percentages[index]} 
                                    className={`h-2.5 flex-1 bg-slate-950 ${isCorrect ? '[&>div]:bg-emerald-500' : '[&>div]:bg-blue-500/80'}`} 
                                  />
                                  <span className={`text-sm md:text-lg font-black font-mono w-14 text-right ${isCorrect ? 'text-emerald-400' : 'text-slate-300'}`}>
                                    {questionEndedData.percentages[index]}%
                                  </span>
                                </div>
                              )}
                            </div>
                          );
                        })}

                        {/* Percentual sem resposta / timeout */}
                        {questionEndedData !== null && questionEndedData.unansweredPercentage > 0 && (
                          <div 
                            onClick={() => {
                              if (questionEndedData.answersByAlt) {
                                setSelectedAltForDetails(-1);
                              }
                            }}
                            className={`p-4 md:p-5 bg-red-950/20 border border-red-900/40 rounded-xl text-sm md:text-base text-red-400 flex justify-between items-center transition-all ${
                              questionEndedData.answersByAlt ? 'cursor-pointer hover:bg-red-950/40 hover:border-red-500/40' : ''
                            }`}
                          >
                            <span className="font-bold uppercase tracking-wider">Combatentes sem resposta (Tempo esgotado):</span>
                            <span className="font-mono font-black text-lg md:text-xl">{questionEndedData.unansweredPercentage}%</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {isQuestionActive && !isTimeUp ? (
                    <div className="flex flex-col gap-3">
                      <div className="flex gap-3">
                        {isPaused ? (
                          <Button onClick={handleResumeTime} className="flex-1 h-12 md:h-14 font-bold text-base md:text-lg bg-emerald-600 hover:bg-emerald-500">
                            <Play className="w-5 h-5 mr-2" /> Retomar Tempo
                          </Button>
                        ) : (
                          <Button onClick={handlePauseTime} className="flex-1 h-12 md:h-14 font-bold text-base md:text-lg bg-amber-600 hover:bg-amber-500">
                            <Pause className="w-5 h-5 mr-2" /> Pausar Tempo
                          </Button>
                        )}
                        <Button onClick={handleCancelQuestion} variant="outline" className="flex-1 h-12 md:h-14 font-bold text-base md:text-lg border-red-500/50 text-red-400 hover:bg-red-500/10">
                          <Ban className="w-5 h-5 mr-2" /> Anular Questão
                        </Button>
                      </div>
                      <Button onClick={handleEndTimeEarly} variant="destructive" className="w-full h-12 md:h-14 font-bold text-base md:text-lg">
                        <Square className="w-5 h-5 mr-2" /> Encerrar Tempo Imediatamente
                      </Button>
                    </div>
                  ) : isQuestionActive && isTimeUp ? (
                    <div className="flex flex-col gap-3">
                      <Button onClick={() => socket?.emit("reveal_result", { roomCode: simulado.codigoSala })} className="w-full h-14 md:h-16 font-black text-xl md:text-2xl bg-emerald-600 hover:bg-emerald-500 shadow-[0_0_30px_rgba(16,185,129,0.3)] animate-pulse text-white">
                        <Trophy className="w-8 h-8 mr-3" /> VER RESULTADO
                      </Button>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-3">
                      <Button onClick={handleNextQuestion} disabled={isRaffling} className="w-full h-12 md:h-14 font-bold text-base md:text-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50">
                        {currentQuestionIndex + 1 < simulado.questions.length ? "Próxima Questão" : "Finalizar Simulado"} <ChevronRight className="w-5 h-5 ml-2" />
                      </Button>
                      <div className="flex items-center justify-center gap-2 mt-2">
                        <label className="text-sm text-slate-300 font-bold flex items-center gap-2 cursor-pointer hover:text-white transition-colors">
                          <input type="checkbox" checked={isRaffleMode} onChange={e => setIsRaffleMode(e.target.checked)} className="w-5 h-5 rounded border-slate-700 bg-slate-800 text-blue-500 focus:ring-blue-500 cursor-pointer" />
                          Modo Sorteio (Roleta Tática) 🎲
                        </label>
                      </div>
                    </div>
                  )}
                  
                  {isRaffling && (
                    <div className="absolute inset-0 bg-slate-900/95 backdrop-blur-sm z-20 flex flex-col items-center justify-center rounded-2xl">
                      <Target className="w-24 h-24 text-red-500 mb-6 animate-[spin_0.5s_linear_infinite]" />
                      <h2 className="text-4xl font-black text-white mb-2 uppercase tracking-widest text-center px-4 animate-pulse">Sorteando Alvo...</h2>
                      <div className="mt-8 p-6 bg-red-900/20 rounded-xl border border-red-500/30 flex flex-col items-center gap-4 w-full max-w-sm">
                        {displayStudent?.avatarUrl ? (
                          <img src={displayStudent.avatarUrl} alt="Avatar" className="w-24 h-24 rounded-full border-4 border-red-500 object-cover shadow-[0_0_30px_rgba(239,68,68,0.5)]" />
                        ) : (
                          <div className="w-24 h-24 rounded-full bg-slate-800 border-4 border-red-500 flex items-center justify-center text-4xl font-bold text-slate-400 shadow-[0_0_30px_rgba(239,68,68,0.5)]">
                            {displayStudent?.name?.substring(0, 2).toUpperCase() || "?"}
                          </div>
                        )}
                        <p className="text-3xl text-red-400 font-black uppercase tracking-wider text-center line-clamp-1">{displayStudent?.name || "???"}</p>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Direita: Status Ao Vivo & Ranking */}
            <div className="w-full lg:w-80 xl:w-96 flex flex-col gap-6 shrink-0">
              <div className="grid grid-cols-2 gap-4">
                <Card className="bg-slate-900 border-slate-800 shadow-lg">
                  <CardHeader className="p-4 pb-2">
                    <CardTitle className="text-xs md:text-sm text-slate-400 flex items-center justify-center gap-2 uppercase tracking-wider font-black"><Clock className="w-4 h-4 text-amber-500"/> Tempo</CardTitle>
                  </CardHeader>
                  <CardContent className="p-4 pt-0">
                    <div className="text-3xl md:text-5xl font-black text-center text-white font-mono flex items-center justify-center gap-2">
                      {timeLeft}s
                      {isPaused && <Pause className="w-5 h-5 md:w-6 md:h-6 text-amber-500 animate-pulse" />}
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-slate-900 border-slate-800 shadow-lg">
                  <CardHeader className="p-4 pb-2">
                    <CardTitle className="text-xs md:text-sm text-slate-400 flex items-center justify-center gap-2 uppercase tracking-wider font-black"><CheckCircle className="w-4 h-4 text-blue-500"/> Respostas</CardTitle>
                  </CardHeader>
                  <CardContent className="p-4 pt-0">
                    <div className="text-2xl md:text-4xl font-black text-center text-white mb-2">
                      {answersReceived}<span className="text-xs md:text-base text-slate-500">/{students.length}</span>
                    </div>
                    <Progress value={students.length > 0 ? (answersReceived / students.length) * 100 : 0} className="h-1.5 md:h-2 bg-slate-800 [&>div]:bg-blue-500" />
                  </CardContent>
                </Card>
              </div>

              {!isQuestionActive && questionEndedData && (
                <Card className="bg-slate-900 border-emerald-900/50 shadow-xl">
                  <CardHeader className="py-3">
                    <CardTitle className="text-emerald-400 text-xs md:text-sm uppercase tracking-widest font-black">Gabarito Divulgado</CardTitle>
                  </CardHeader>
                  <CardContent className="pb-4">
                    <p className="text-lg md:text-xl font-bold text-white flex items-center justify-between">
                      Alternativa Correta: <span className="text-emerald-400 text-4xl md:text-5xl font-black">{String.fromCharCode(65 + questionEndedData.correta)}</span>
                    </p>
                  </CardContent>
                </Card>
              )}

              {/* Ranking Ao Vivo */}
              <Card className="bg-slate-900 border-slate-800 flex-1 flex flex-col shadow-2xl">
                <CardHeader className="border-b border-slate-800 py-3 md:py-4">
                  <CardTitle className="text-slate-200 flex items-center gap-2 font-bold text-sm md:text-base">
                    <Trophy className="w-4 h-4 md:w-5 md:h-5 text-yellow-500"/> 
                    Ranking Ao Vivo
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0 flex-1 overflow-auto max-h-[350px] md:max-h-[400px] xl:max-h-[500px]">
                  {ranking.length === 0 ? (
                    <div className="p-6 text-center text-slate-500 text-sm font-medium">
                      O ranking aparecerá aqui assim que os alunos pontuarem.
                    </div>
                  ) : (
                    <ul className="divide-y divide-slate-800/40">
                      {ranking.map((aluno, index) => (
                        <li key={index} className="flex items-center justify-between p-3 md:p-4 hover:bg-slate-850 transition-colors">
                          <div className="flex items-center gap-2.5">
                            <span className={`flex items-center justify-center shrink-0 w-6 h-6 md:w-7 md:h-7 rounded-full text-xs md:text-sm font-extrabold ${
                              index === 0 ? 'bg-yellow-500 text-yellow-950' : 
                              index === 1 ? 'bg-slate-300 text-slate-800' :
                              index === 2 ? 'bg-amber-700 text-amber-100' : 'bg-slate-800 text-slate-400'
                            }`}>
                              {index + 1}
                            </span>
                            {aluno.avatarUrl ? (
                              <img src={aluno.avatarUrl} alt="Avatar" className="w-7 h-7 md:w-9 md:h-9 rounded-full object-cover border border-slate-700 shrink-0" />
                            ) : (
                              <div className="w-7 h-7 md:w-9 md:h-9 rounded-full bg-slate-800 text-slate-400 flex items-center justify-center text-[10px] md:text-xs font-bold shrink-0 border border-slate-700">
                                {aluno.name.substring(0, 2).toUpperCase()}
                              </div>
                            )}
                            <span className="font-bold text-slate-200 text-sm md:text-base lg:text-lg truncate flex items-center">
                              {aluno.name}
                              {isQuestionActive && !questionEndedData && (
                                answeredStudentIds.includes(aluno.id) ? (
                                  <span className="text-[9px] md:text-xs bg-emerald-500/20 text-emerald-400 font-bold px-1.5 py-0.5 rounded border border-emerald-500/30 ml-1.5 animate-pulse">Respondeu</span>
                                ) : (
                                  <span className="text-[9px] md:text-xs bg-slate-850 text-slate-500 font-bold px-1.5 py-0.5 rounded border border-slate-750 ml-1.5">Aguardando</span>
                                )
                              )}
                              {aluno.streak >= 3 && (
                                <span className="text-orange-500 font-bold flex items-center text-xs ml-1.5 animate-pulse" title={`${aluno.streak} acertos seguidos`}>
                                  <Flame className="w-3 h-3 mr-0.5" /> {aluno.streak}
                                </span>
                              )}
                              {aluno.streak <= -3 && (
                                <span className="text-cyan-400 font-bold flex items-center text-xs ml-1.5" title={`${Math.abs(aluno.streak)} erros seguidos`}>
                                  <Snowflake className="w-3 h-3 mr-0.5" /> {Math.abs(aluno.streak)}
                                </span>
                              )}
                            </span>
                          </div>
                          <span className="font-black text-blue-400 font-mono text-sm md:text-base lg:text-xl ml-2 shrink-0">{aluno.score} pts</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {status === "FINISHED" && (
          <div className="text-center max-w-2xl w-full animate-in fade-in zoom-in duration-500">
            <Trophy className="w-20 h-20 text-yellow-500 mx-auto mb-4 drop-shadow-[0_0_20px_rgba(234,179,8,0.5)]" />
            <h2 className="text-3xl font-black text-white mb-2 uppercase tracking-widest">Simulado Finalizado!</h2>
            <p className="text-slate-400 mb-8">
              Obrigado por utilizar o sistema. As pontuações já foram processadas.
            </p>

            {/* Podium Top 3 */}
            {ranking.length > 0 && (
              <div className="w-full bg-slate-900/50 border border-slate-800 rounded-xl p-6 mb-8">
                <h3 className="text-sm font-bold text-slate-300 uppercase tracking-widest mb-6">Top 3 Combatentes</h3>
                <div className="flex justify-center items-end gap-4 h-48">
                  {/* Segundo Colocado */}
                  {ranking.length > 1 && (
                    <div className="flex flex-col items-center w-28">
                      <div className="w-12 h-12 rounded-full border-2 border-slate-400 mb-3 overflow-hidden bg-slate-800 flex items-center justify-center">
                        {ranking[1].avatarUrl ? (
                          <img src={ranking[1].avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-slate-400 font-bold text-sm">{ranking[1].name.substring(0,2).toUpperCase()}</span>
                        )}
                      </div>
                      <div className="text-sm text-slate-300 truncate w-full text-center">{ranking[1].name.split(' ')[0]}</div>
                      <div className="text-xs font-bold text-slate-300 mb-2">{ranking[1].score} pts</div>
                      <div className="w-full h-20 bg-slate-700 rounded-t-lg flex items-end justify-center pb-2 text-slate-400 font-black text-2xl">2</div>
                    </div>
                  )}
                  {/* Primeiro Colocado */}
                  {ranking.length > 0 && (
                    <div className="flex flex-col items-center w-32">
                      <Trophy className="w-6 h-6 text-yellow-500 mb-2" />
                      <div className="w-16 h-16 rounded-full border-2 border-yellow-500 mb-3 overflow-hidden bg-slate-800 flex items-center justify-center shadow-[0_0_15px_rgba(234,179,8,0.3)]">
                        {ranking[0].avatarUrl ? (
                          <img src={ranking[0].avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-yellow-500 font-bold text-lg">{ranking[0].name.substring(0,2).toUpperCase()}</span>
                        )}
                      </div>
                      <div className="text-base font-bold text-yellow-500 truncate w-full text-center">{ranking[0].name.split(' ')[0]}</div>
                      <div className="text-sm font-bold text-yellow-400 mb-2">{ranking[0].score} pts</div>
                      <div className="w-full h-28 bg-gradient-to-t from-yellow-700 to-yellow-600 rounded-t-lg flex items-end justify-center pb-2 text-white font-black text-3xl shadow-lg">1</div>
                    </div>
                  )}
                  {/* Terceiro Colocado */}
                  {ranking.length > 2 && (
                    <div className="flex flex-col items-center w-28">
                      <div className="w-12 h-12 rounded-full border-2 border-amber-700 mb-3 overflow-hidden bg-slate-800 flex items-center justify-center">
                        {ranking[2].avatarUrl ? (
                          <img src={ranking[2].avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-amber-700 font-bold text-sm">{ranking[2].name.substring(0,2).toUpperCase()}</span>
                        )}
                      </div>
                      <div className="text-sm text-slate-300 truncate w-full text-center">{ranking[2].name.split(' ')[0]}</div>
                      <div className="text-xs font-bold text-amber-500 mb-2">{ranking[2].score} pts</div>
                      <div className="w-full h-16 bg-amber-900 rounded-t-lg flex items-end justify-center pb-2 text-amber-700 font-black text-2xl">3</div>
                    </div>
                  )}
                </div>
              </div>
            )}
            <Link href={`/instructor/painel/${simulado.id}/review`}>
              <Button className="w-full h-14 text-lg font-bold bg-blue-600 hover:bg-blue-500 text-white mb-4 shadow-[0_0_20px_rgba(37,99,235,0.2)]">
                Ver Relatório do Simulado
              </Button>
            </Link>
            <Link href="/instructor">
              <Button variant="outline" className="w-full h-14 text-lg font-bold border-slate-700 text-slate-300 hover:bg-slate-800">
                Voltar ao Painel
              </Button>
            </Link>
          </div>
        )}
      </main>

      {/* Modal de Detalhes dos Alunos por Alternativa */}
      <Dialog 
        open={selectedAltForDetails !== null} 
        onOpenChange={(open) => {
          if (!open) setSelectedAltForDetails(null);
        }}
      >
        <DialogContent className="sm:max-w-md bg-slate-900 border-slate-800 text-slate-200">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl text-white">
              <Users className="w-5 h-5 text-blue-500" /> 
              {selectedAltForDetails === -1 
                ? "Combatentes sem Resposta" 
                : `Combatentes na Alternativa ${String.fromCharCode(65 + (selectedAltForDetails ?? 0))}`}
            </DialogTitle>
            <DialogDescription className="text-slate-400">
              {selectedAltForDetails === -1
                ? "Lista de alunos que sofreram timeout ou não enviaram resposta."
                : "Lista de alunos que selecionaram esta opção."}
            </DialogDescription>
          </DialogHeader>
          <div className="mt-4 max-h-[50vh] overflow-y-auto pr-1">
            {(() => {
              if (selectedAltForDetails === null || !questionEndedData?.answersByAlt) return null;
              const key = String(selectedAltForDetails);
              const list = questionEndedData.answersByAlt[key] || [];
              
              if (list.length === 0) {
                return (
                  <p className="text-center py-6 text-slate-500 font-medium">
                    Nenhum aluno marcou esta alternativa.
                  </p>
                );
              }
              
              return (
                <div className="flex flex-col gap-2">
                  {list.map((aluno: any, idx: number) => (
                    <div key={idx} className="flex items-center gap-3 p-2 bg-slate-950/40 rounded-lg border border-slate-800/60">
                      {aluno.avatarUrl ? (
                        <img src={aluno.avatarUrl} alt="Avatar" className="w-8 h-8 rounded-full object-cover border border-slate-700" />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-slate-850 flex items-center justify-center text-xs font-bold text-slate-400 border border-slate-700">
                          {aluno.name.substring(0, 2).toUpperCase()}
                        </div>
                      )}
                      <span className="font-bold text-slate-200">{aluno.name}</span>
                    </div>
                  ))}
                </div>
              );
            })()}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
