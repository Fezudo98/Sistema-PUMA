"use client";

import { useEffect, useState, useRef } from "react";
import { io, Socket } from "socket.io-client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Clock, ShieldAlert, CheckCircle, XCircle, Trophy, BookOpen, Target, BarChart2, Users } from "lucide-react";
import Link from "next/link";
import { Progress } from "@/components/ui/progress";
import { useSearchParams } from "next/navigation";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

export default function StudentLiveClient({ user, simulado }: { user: any, simulado: any }) {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [status, setStatus] = useState("WAITING");
  
  const [currentQuestion, setCurrentQuestion] = useState<any>(null);
  const [timeLeft, setTimeLeft] = useState(0);
  
  const [selectedAlt, setSelectedAlt] = useState<number>(-1);
  const [startTime, setStartTime] = useState<number>(0);
  
  const [questionEndedData, setQuestionEndedData] = useState<any>(null);

  const [isPaused, setIsPaused] = useState(false);
  const [isTimeUp, setIsTimeUp] = useState(false);
  const [hasConfirmed, setHasConfirmed] = useState(false);
  const searchParams = useSearchParams();
  const [isRaffling, setIsRaffling] = useState(false);
  const [raffleWinner, setRaffleWinner] = useState<any>(null);
  const [students, setStudents] = useState<any[]>([]);
  const [displayStudent, setDisplayStudent] = useState<any>(null);
  const [ranking, setRanking] = useState<{id: string, name: string, score: number, streak: number, avatarUrl?: string | null}[]>([]);
  const [notifications, setNotifications] = useState<{id: string, text: string}[]>([]);
  const [unlockedBadges, setUnlockedBadges] = useState<any[]>([]);
  const [answeredStudentIds, setAnsweredStudentIds] = useState<string[]>([]);
  const [showParticipants, setShowParticipants] = useState(false);

  // Refs to avoid stale state in Socket.io event listeners
  const selectedAltRef = useRef<number>(-1);
  const hasConfirmedRef = useRef<boolean>(false);
  const currentQuestionRef = useRef<any>(null);
  const startTimeRef = useRef<number>(0);
  const raffleWinnerRef = useRef<any>(null);

  useEffect(() => {
    selectedAltRef.current = selectedAlt;
  }, [selectedAlt]);

  useEffect(() => {
    hasConfirmedRef.current = hasConfirmed;
  }, [hasConfirmed]);

  useEffect(() => {
    currentQuestionRef.current = currentQuestion;
  }, [currentQuestion]);

  useEffect(() => {
    startTimeRef.current = startTime;
  }, [startTime]);

  useEffect(() => {
    raffleWinnerRef.current = raffleWinner;
  }, [raffleWinner]);

  // Limpa o toast de badge após 6 segundos
  useEffect(() => {
    if (unlockedBadges.length > 0) {
      const timer = setTimeout(() => {
        setUnlockedBadges(prev => prev.slice(1));
      }, 6000);
      return () => clearTimeout(timer);
    }
  }, [unlockedBadges]);

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
    const s = io({
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: Infinity
    });
    setSocket(s);

    s.on("connect", () => {
      s.emit("join_room", { roomCode: simulado.codigoSala, user });
    });

    s.on("room_update", (data) => {
      if (data.students) setStudents(data.students);
      if (data.status === "ACTIVE") {
        setStatus(prev => prev === "WAITING" ? "ACTIVE" : prev);
      }
      if (data.status === "FINISHED" && status !== "FINISHED") {
        setStatus("FINISHED");
      }
      if (data.status === "ACTIVE" && data.currentQuestion) {
        setCurrentQuestion((prev: any) => {
          if (!prev || prev.id !== data.currentQuestion.id) {
            setQuestionEndedData(data.questionEndedData);
            setSelectedAlt(-1);
            setHasConfirmed(false);
            setStartTime(Date.now());
            return data.currentQuestion;
          }
          return prev;
        });
        
        // Sincroniza o estado exato
        setTimeLeft(data.timeLeft);
        setIsPaused(data.isPaused);
        
        if (data.raffleWinnerId) {
          const winner = data.students.find((st: any) => st.id === data.raffleWinnerId);
          setRaffleWinner(winner || null);
        } else {
          setRaffleWinner(null);
        }

        if (data.questionEndedData) {
           setQuestionEndedData(data.questionEndedData);
           setIsTimeUp(true); // Se tem dados finais, tempo acabou
        } else {
           setQuestionEndedData(null);
           if (data.timeLeft <= 0 && data.currentQuestion.id) {
             setIsTimeUp(true);
           } else {
             setIsTimeUp(false);
           }
        }
      }
      if (data.answeredStudentIds) {
        setAnsweredStudentIds(data.answeredStudentIds);
        if (data.answeredStudentIds.includes(user.userId)) {
          setHasConfirmed(true);
        }
      }
    });

    s.on("simulado_started", () => {
      setStatus("ACTIVE");
    });

    s.on("new_question", (questionData) => {
      setStatus("ACTIVE");
      setCurrentQuestion(questionData);
      setTimeLeft(questionData.tempoLimite);
      setSelectedAlt(-1);
      setQuestionEndedData(null);
      setStartTime(Date.now());
      setIsPaused(false);
      setIsTimeUp(false);
      setHasConfirmed(false);
      setAnsweredStudentIds([]);
      
      if (!questionData.raffleWinnerId) {
        setRaffleWinner(null);
      }
    });

    s.on("instructor_student_answered", (data) => {
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
        }, index * 800);
      });
    });

    s.on("raffle_started", ({ winner }) => {
      setRaffleWinner(winner);
      setIsRaffling(true);
      setTimeout(() => {
        setIsRaffling(false);
      }, 4000);
    });

    s.on("time_tick", (data) => {
      setTimeLeft(data.timeLeft);
    });

    s.on("time_paused", () => {
      setIsPaused(true);
    });

    s.on("time_resumed", () => {
      setIsPaused(false);
      // adjust startTime so that the pause time is not counted in tempoGasto
      setStartTime(Date.now());
    });

    s.on("time_up", () => {
      setIsTimeUp(true);
      setIsPaused(false);

      // Auto-confirm option if selected but not confirmed yet
      const isObserver = raffleWinnerRef.current && raffleWinnerRef.current.id !== user.userId;
      if (selectedAltRef.current !== -1 && !hasConfirmedRef.current && currentQuestionRef.current && !isObserver) {
        setHasConfirmed(true);
        const timeGasto = Math.max(0, Math.floor((Date.now() - startTimeRef.current) / 1000));
        s.emit("submit_answer", {
          roomCode: simulado.codigoSala,
          questionId: currentQuestionRef.current.id,
          studentId: user.userId,
          alternativa: selectedAltRef.current,
          tempoGasto: timeGasto
        });
      }
    });

    s.on("question_ended", (data) => {
      setQuestionEndedData(data);
      setIsTimeUp(false);
    });

    s.on("question_cancelled", () => {
      setCurrentQuestion(null);
      setQuestionEndedData(null);
      setSelectedAlt(-1);
      setHasConfirmed(false);
      setIsPaused(false);
      setIsTimeUp(false);
      setRaffleWinner(null);
      setIsRaffling(false);
      setAnsweredStudentIds([]);
      alert("⚠️ A questão atual foi anulada pelo instrutor.");
    });

    s.on("simulado_ended", () => {
      setStatus("FINISHED");
    });

    s.on("badges_unlocked", (data) => {
      if (data.studentId === user.userId) {
        setUnlockedBadges(prev => [...prev, ...data.newBadges]);
      }
    });

    return () => {
      s.disconnect();
    };
  }, [simulado.codigoSala, user.userId]);

  const handleSelectAlternative = (index: number) => {
    if (hasConfirmed || questionEndedData) return; // Already confirmed or ended
    
    setSelectedAlt(index);
  };

  const handleConfirmAnswer = () => {
    if (selectedAlt === -1 || hasConfirmed || questionEndedData || isTimeUp) return;

    setHasConfirmed(true);
    const timeGasto = Math.floor((Date.now() - startTime) / 1000);
    
    socket?.emit("submit_answer", {
      roomCode: simulado.codigoSala,
      questionId: currentQuestion.id,
      studentId: user.userId,
      alternativa: selectedAlt,
      tempoGasto: timeGasto
    });
  };

  if (status === "WAITING") {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-center relative overflow-hidden">
        {/* Toast Notifications */}
        <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-3 pointer-events-none w-72 sm:w-80">
          {notifications.map(n => (
            <div key={n.id} className="bg-slate-900 border border-slate-700 text-white p-4 rounded-xl shadow-[0_0_30px_rgba(0,0,0,0.5)] animate-in slide-in-from-right-8 fade-in duration-300 pointer-events-auto flex items-start gap-3">
              <span className="text-sm font-bold leading-tight">{n.text}</span>
            </div>
          ))}
        </div>
        <Link href="/aluno/painel" className="absolute top-6 left-6">
          <Button variant="ghost" className="text-slate-400 hover:text-white">Sair da Sala</Button>
        </Link>
        <div className="w-24 h-24 rounded-full bg-slate-900 border-2 border-blue-500/30 flex items-center justify-center mb-8 shadow-[0_0_30px_rgba(37,99,235,0.2)]">
          <ShieldAlert className="w-10 h-10 text-blue-500 animate-pulse" />
        </div>
        <h1 className="text-2xl font-bold text-white mb-2">Sala {simulado.codigoSala}</h1>
        <p className="text-slate-400 max-w-sm mb-12">Você entrou com sucesso. Aguarde o instrutor iniciar o simulado na tela principal.</p>
        
        <div className="flex gap-2 items-center">
          <div className="w-3 h-3 rounded-full bg-blue-500 animate-ping"></div>
          <span className="text-sm font-bold text-blue-400 tracking-widest uppercase">Conectado ao Telão</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 flex flex-col relative overflow-hidden">
      {/* Toast Notifications */}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-3 pointer-events-none w-72 sm:w-80">
        {notifications.map(n => (
          <div key={n.id} className="bg-slate-900 border border-slate-700 text-white p-4 rounded-xl shadow-[0_0_30px_rgba(0,0,0,0.5)] animate-in slide-in-from-right-8 fade-in duration-300 pointer-events-auto flex items-start gap-3">
            <span className="text-sm font-bold leading-tight">{n.text}</span>
          </div>
        ))}
      </div>
      {/* Top Bar */}
      <header className="h-16 border-b border-slate-800 flex justify-between items-center px-4 bg-slate-900 shrink-0">
        <div className="flex items-center gap-4">
          <Link href="/aluno/painel">
            <Button variant="ghost" size="sm" className="text-slate-400 hover:text-white px-2">Sair</Button>
          </Link>
          <span className="font-bold text-slate-300">SALA {simulado.codigoSala}</span>
          
          {(() => {
            const myRankIndex = ranking.findIndex(r => r.id === user.userId);
            if (myRankIndex === -1) return null;
            const myRank = myRankIndex + 1;
            const myData = ranking[myRankIndex];
            return (
              <div className="flex items-center gap-1.5 bg-blue-950/40 border border-blue-500/30 px-2.5 py-1 rounded-full text-blue-400 font-bold text-xs shadow-[0_0_15px_rgba(59,130,246,0.1)]">
                <Trophy className="w-3.5 h-3.5 text-yellow-500 shrink-0" />
                <span>{myRank}º <span className="text-slate-400 text-[10px] sm:text-xs">({myData.score} pts)</span></span>
              </div>
            );
          })()}
        </div>
        {currentQuestion && !questionEndedData && (
          <div className={`flex items-center gap-2 ${isPaused ? 'bg-amber-900/40 border border-amber-500/50' : 'bg-slate-800'} px-3 py-1.5 rounded-full transition-colors`}>
            {isPaused ? <Clock className="w-4 h-4 text-amber-500 animate-pulse" /> : <Clock className="w-4 h-4 text-amber-400" />}
            <span className={`font-mono font-bold ${isPaused ? 'text-amber-500' : 'text-amber-400'}`}>
              {isPaused ? 'PAUSADO' : `${timeLeft}s`}
            </span>
          </div>
        )}
      </header>

      {/* Floating Badges Notifications */}
      <div className="fixed top-20 right-4 z-50 flex flex-col gap-3">
        {unlockedBadges.map((badge, idx) => (
          <div key={idx} className="bg-slate-900 border-2 border-yellow-500 rounded-xl p-4 shadow-[0_0_30px_rgba(234,179,8,0.4)] flex items-center gap-4 animate-in slide-in-from-right-8 fade-in duration-500">
            <div className="w-12 h-12 bg-yellow-900/30 rounded-full border border-yellow-500 flex items-center justify-center shrink-0">
              <Trophy className="w-6 h-6 text-yellow-500" />
            </div>
            <div>
              <p className="text-xs font-black text-yellow-500 uppercase tracking-widest mb-1">Novo Brevê Desbloqueado!</p>
              <p className="text-white font-bold text-lg leading-tight">{badge.name}</p>
              <p className="text-slate-400 text-xs mt-1">Novo ícone de perfil disponível na Armaria.</p>
            </div>
          </div>
        ))}
      </div>

      <main className="flex-1 overflow-hidden relative">
        {isRaffling && (
          <div className="absolute inset-0 bg-slate-950 z-50 flex flex-col items-center justify-center p-4">
            <Target className="w-24 h-24 text-red-500 mb-6 animate-[spin_0.5s_linear_infinite]" />
            <h2 className="text-3xl font-black text-white mb-2 uppercase tracking-widest text-center animate-pulse">Sorteando Alvo...</h2>
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

        {status === "FINISHED" ? null : !currentQuestion ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center">
            <div className="w-16 h-16 rounded-full border-4 border-slate-800 border-t-blue-500 animate-spin mb-6"></div>
            <p className="text-lg font-bold text-slate-300">Aguardando Instrutor liberar a próxima questão...</p>
          </div>
        ) : (
          <div className="h-full flex flex-col p-4 max-w-lg mx-auto overflow-y-auto custom-scrollbar">
            <div className="mb-6 flex-1">
              <div className="flex items-center gap-2 mb-4">
                <Target className="w-5 h-5 text-blue-500" />
                <h3 className="text-slate-400 font-bold tracking-widest uppercase text-sm">Questão Ao Vivo</h3>
              </div>
              <p className="text-lg text-slate-200 leading-relaxed font-medium">{currentQuestion.enunciado}</p>
            </div>

            {raffleWinner && raffleWinner.id !== user.userId && !questionEndedData && (
              <div className="mb-6 p-4 bg-red-900/20 border border-red-500/50 rounded-lg flex items-center gap-3 shadow-[0_0_15px_rgba(239,68,68,0.15)]">
                <Target className="w-8 h-8 text-red-500 animate-pulse shrink-0" />
                <div>
                  <p className="text-red-400 font-black text-sm uppercase tracking-widest">Alvo Sorteado</p>
                  <p className="text-slate-300 text-sm mt-0.5">Aguardando a resposta de: <strong className="text-white">{raffleWinner.name}</strong></p>
                </div>
              </div>
            )}

            {questionEndedData && (
              <Card className={`border mb-6 ${selectedAlt === questionEndedData.correta ? 'border-emerald-500 bg-emerald-950/20' : 'border-red-500 bg-red-950/20'}`}>
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    {selectedAlt === questionEndedData.correta ? (
                      <><CheckCircle className="w-6 h-6 text-emerald-500" /> <span className="text-emerald-400">Você Acertou!</span></>
                    ) : (
                      <><XCircle className="w-6 h-6 text-red-500" /> <span className="text-red-400">Você Errou.</span></>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm font-bold text-slate-300 mb-2">Justificativa:</p>
                  <p className="text-sm text-slate-400 bg-slate-950 p-3 rounded-lg border border-slate-800">
                    {questionEndedData.justificativa}
                  </p>
                </CardContent>
              </Card>
            )}

            <div className="flex flex-col gap-3 mb-8">
              {currentQuestion.alternativas?.map((alt: string, index: number) => {
                const isSelected = selectedAlt === index;
                const isEnded = questionEndedData !== null;
                const isCorrect = isEnded && questionEndedData.correta === index;
                const isWrongSelected = isEnded && isSelected && !isCorrect;
                
                const isObserver = raffleWinner && raffleWinner.id !== user.userId;

                let btnClass = "bg-slate-900 border-slate-700 text-slate-300 hover:bg-slate-800";
                
                if (isEnded) {
                  if (isCorrect) btnClass = "bg-emerald-900/50 border-emerald-500 text-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.3)]";
                  else if (isWrongSelected) btnClass = "bg-red-900/50 border-red-500 text-red-400";
                  else btnClass = "bg-slate-950 border-slate-800 text-slate-600 opacity-50";
                } else if (isSelected) {
                  btnClass = "bg-blue-600 border-blue-500 text-white shadow-[0_0_20px_rgba(37,99,235,0.4)]";
                }

                return (
                  <button
                    key={index}
                    onClick={() => handleSelectAlternative(index)}
                    disabled={hasConfirmed || isTimeUp || isEnded || isObserver}
                    className={`w-full p-4 rounded-xl border-2 text-left transition-all flex gap-4 items-start ${btnClass} ${isObserver && !isEnded ? 'opacity-50 cursor-not-allowed grayscale' : ''}`}
                  >
                    <span className={`flex shrink-0 items-center justify-center w-8 h-8 rounded-full text-sm font-bold border ${
                      isEnded && isCorrect ? 'bg-emerald-500 border-emerald-400 text-white' :
                      isEnded && isWrongSelected ? 'bg-red-500 border-red-400 text-white' :
                      isSelected && !isEnded ? 'bg-white border-white text-blue-600' :
                      'bg-slate-800 border-slate-600 text-slate-400'
                    }`}>
                      {String.fromCharCode(65 + index)}
                    </span>
                    <span className="flex-1 pt-1 text-base leading-snug">{alt.replace(/^[A-E]\)\s*/, '')}</span>
                  </button>
                );
              })}
            </div>

            {selectedAlt !== -1 && !hasConfirmed && !questionEndedData && !isTimeUp && (
              <div className="flex flex-col gap-2 mb-4 animate-in fade-in slide-in-from-bottom-2">
                <Button 
                  onClick={handleConfirmAnswer} 
                  className="w-full h-16 font-black text-xl bg-blue-600 hover:bg-blue-500 text-white shadow-[0_0_30px_rgba(37,99,235,0.4)] animate-pulse"
                >
                  <CheckCircle className="w-6 h-6 mr-2" /> CONFIRMAR RESPOSTA
                </Button>
                <p className="text-xs text-center text-slate-400">O seu tempo de resposta só será travado após a confirmação.</p>
              </div>
            )}

            {hasConfirmed && !questionEndedData && !isTimeUp && (
              <div className="text-center p-4 bg-blue-950/30 rounded-lg border border-blue-900/50 animate-pulse">
                <p className="text-blue-400 font-medium">Resposta Registrada! Aguardando o tempo acabar...</p>
              </div>
            )}

            {/* Time Up Waiting for Reveal */}
            {!questionEndedData && isTimeUp && (
              <div className="text-center p-6 bg-amber-950/30 rounded-lg border border-amber-500/50 animate-pulse shadow-[0_0_20px_rgba(245,158,11,0.2)]">
                <p className="text-amber-400 font-bold text-lg">⏳ Tempo Esgotado!</p>
                <p className="text-amber-500/80 text-sm mt-1">Aguardando o instrutor revelar o gabarito...</p>
              </div>
            )}

          </div>
        )}

        {status === "FINISHED" && (
          <div className="h-full flex flex-col items-center justify-center p-6 text-center animate-in fade-in zoom-in duration-500 overflow-y-auto custom-scrollbar">
            <Trophy className="w-20 h-20 text-yellow-500 mb-2 drop-shadow-[0_0_20px_rgba(234,179,8,0.5)]" />
            <h2 className="text-3xl font-black text-white mb-2 uppercase tracking-widest">Missão Cumprida!</h2>
            <p className="text-slate-400 mb-8 max-w-md text-sm">
              O instrutor encerrou este simulado. Suas respostas e pontuações já foram processadas no sistema.
            </p>

            {/* Resultado Pessoal */}
            {(() => {
              const myRankIndex = ranking.findIndex(r => r.id === user.userId);
              if (myRankIndex === -1) return null;
              
              const myRank = myRankIndex + 1;
              const myData = ranking[myRankIndex];
              
              return (
                <div className="w-full max-w-md bg-gradient-to-br from-blue-900/40 to-slate-900 border border-blue-500/30 rounded-xl p-6 mb-8 flex items-center gap-6 shadow-[0_0_30px_rgba(59,130,246,0.15)]">
                  <div className="w-20 h-20 rounded-full border-4 border-blue-500 overflow-hidden bg-slate-800 flex items-center justify-center shrink-0 shadow-[0_0_15px_rgba(59,130,246,0.3)]">
                    {user.avatarUrl ? (
                      <img src={user.avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-blue-500 font-bold text-2xl">{user.name.substring(0,2).toUpperCase()}</span>
                    )}
                  </div>
                  <div className="text-left flex-1">
                    <h3 className="text-slate-400 text-xs font-bold tracking-widest uppercase mb-1">Seu Desempenho</h3>
                    <p className="text-white font-black text-2xl mb-1">{myData.score} pts</p>
                    <p className="text-blue-400 font-medium text-sm flex items-center gap-1">
                      <BarChart2 className="w-4 h-4" /> Você ficou em {myRank}º lugar
                    </p>
                  </div>
                </div>
              );
            })()}

            {/* Podium Top 3 */}
            {ranking.length > 0 && (
              <div className="w-full max-w-md bg-slate-900/50 border border-slate-800 rounded-xl p-4 mb-8">
                <h3 className="text-sm font-bold text-slate-300 uppercase tracking-widest mb-4">Top 3 Combatentes</h3>
                <div className="flex justify-center items-end gap-2 h-40">
                  {/* Segundo Colocado */}
                  {ranking.length > 1 && (
                    <div className="flex flex-col items-center w-24">
                      <div className="w-10 h-10 rounded-full border-2 border-slate-400 mb-2 overflow-hidden bg-slate-800 flex items-center justify-center">
                        {ranking[1].avatarUrl ? (
                          <img src={ranking[1].avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-slate-400 font-bold text-sm">{ranking[1].name.substring(0,2).toUpperCase()}</span>
                        )}
                      </div>
                      <div className="text-xs text-slate-300 truncate w-full text-center">{ranking[1].name.split(' ')[0]}</div>
                      <div className="text-xs font-bold text-slate-300 mb-2">{ranking[1].score} pts</div>
                      <div className="w-full h-16 bg-slate-700 rounded-t-lg flex items-end justify-center pb-2 text-slate-400 font-black text-xl">2</div>
                    </div>
                  )}
                  {/* Primeiro Colocado */}
                  {ranking.length > 0 && (
                    <div className="flex flex-col items-center w-28">
                      <Trophy className="w-5 h-5 text-yellow-500 mb-1" />
                      <div className="w-12 h-12 rounded-full border-2 border-yellow-500 mb-2 overflow-hidden bg-slate-800 flex items-center justify-center shadow-[0_0_15px_rgba(234,179,8,0.3)]">
                        {ranking[0].avatarUrl ? (
                          <img src={ranking[0].avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-yellow-500 font-bold text-sm">{ranking[0].name.substring(0,2).toUpperCase()}</span>
                        )}
                      </div>
                      <div className="text-sm font-bold text-yellow-500 truncate w-full text-center">{ranking[0].name.split(' ')[0]}</div>
                      <div className="text-sm font-bold text-yellow-400 mb-2">{ranking[0].score} pts</div>
                      <div className="w-full h-24 bg-gradient-to-t from-yellow-700 to-yellow-600 rounded-t-lg flex items-end justify-center pb-2 text-white font-black text-2xl shadow-lg">1</div>
                    </div>
                  )}
                  {/* Terceiro Colocado */}
                  {ranking.length > 2 && (
                    <div className="flex flex-col items-center w-24">
                      <div className="w-10 h-10 rounded-full border-2 border-amber-700 mb-2 overflow-hidden bg-slate-800 flex items-center justify-center">
                        {ranking[2].avatarUrl ? (
                          <img src={ranking[2].avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-amber-700 font-bold text-sm">{ranking[2].name.substring(0,2).toUpperCase()}</span>
                        )}
                      </div>
                      <div className="text-xs text-slate-300 truncate w-full text-center">{ranking[2].name.split(' ')[0]}</div>
                      <div className="text-xs font-bold text-amber-500 mb-2">{ranking[2].score} pts</div>
                      <div className="w-full h-12 bg-amber-900 rounded-t-lg flex items-end justify-center pb-2 text-amber-700 font-black text-xl">3</div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {ranking.length > 0 && (
              <Button 
                onClick={() => setShowParticipants(true)} 
                variant="outline" 
                className="w-full max-w-sm h-14 mb-4 border-slate-700 text-slate-300 hover:bg-slate-800 font-bold"
              >
                <Users className="w-5 h-5 mr-2" /> Ver Ranking Completo
              </Button>
            )}

            <div className="flex flex-col gap-4 w-full max-w-sm mx-auto">
              <Link href={`/aluno/simulado/${simulado.id}/review`} className="w-full">
                <Button className="w-full h-14 font-bold text-lg bg-blue-600 hover:bg-blue-500 text-white shadow-[0_0_20px_rgba(37,99,235,0.3)]">
                  <BookOpen className="w-5 h-5 mr-2" />
                  Ver Meu Desempenho
                </Button>
              </Link>
              <Link href="/aluno/painel" className="w-full">
                <Button variant="outline" className="w-full h-14 font-bold text-lg border-slate-700 text-slate-300 hover:bg-slate-800">
                  Voltar ao QG
                </Button>
              </Link>
            </div>
          </div>
        )}
        {/* Modal de Ranking Geral */}
        <Dialog open={showParticipants} onOpenChange={setShowParticipants}>
          <DialogContent className="sm:max-w-xl bg-slate-900 border-slate-800 text-slate-200 max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-xl text-white">
                <Trophy className="w-5 h-5 text-yellow-500" /> Ranking Completo de Participantes
              </DialogTitle>
              <DialogDescription className="text-slate-400">
                Ordem de pontuação de todos os recrutas neste simulado.
              </DialogDescription>
            </DialogHeader>
            <div className="mt-4">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-slate-300">
                  <thead className="bg-slate-950 text-slate-400 border-b border-slate-800">
                    <tr>
                      <th className="px-4 py-2 font-medium">Posição</th>
                      <th className="px-4 py-2 font-medium">Aluno</th>
                      <th className="px-4 py-2 font-medium text-right">Pontuação</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/50">
                    {ranking.map((aluno, idx) => (
                      <tr key={idx} className="hover:bg-slate-800/30">
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
                        <td className="px-4 py-3 text-right font-mono font-bold text-blue-400">{aluno.score} pts</td>
                      </tr>
                    ))}
                    {ranking.length === 0 && (
                      <tr>
                        <td colSpan={3} className="text-center py-6 text-slate-500">Nenhum participante.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
}
