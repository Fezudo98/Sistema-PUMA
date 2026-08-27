"use client";

import { useEffect, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Swords, Clock, CheckCircle, XCircle, Loader2, Trophy, Dumbbell, Skull } from "lucide-react";

export default function DuelBattleClient({ user, simulado, duelo, opponentName }: { user: any; simulado: any; duelo: { flexoesAposta: number; questionCount: number }; opponentName: string }) {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [status, setStatus] = useState("WAITING");
  const [currentQuestion, setCurrentQuestion] = useState<any>(null);
  const [timeLeft, setTimeLeft] = useState(0);
  const [selectedAlt, setSelectedAlt] = useState<number>(-1);
  const [startTime, setStartTime] = useState<number>(0);
  const [hasConfirmed, setHasConfirmed] = useState(false);
  const [isTimeUp, setIsTimeUp] = useState(false);
  const [questionEndedData, setQuestionEndedData] = useState<any>(null);
  const [duelRounds, setDuelRounds] = useState<{ mine: number; opponent: number }>({ mine: 0, opponent: 0 });
  const [duelResult, setDuelResult] = useState<any>(null);
  const [studentCount, setStudentCount] = useState(0);

  const selectedAltRef = useRef(-1);
  const hasConfirmedRef = useRef(false);
  const currentQuestionRef = useRef<any>(null);
  const startTimeRef = useRef(0);

  useEffect(() => { selectedAltRef.current = selectedAlt; }, [selectedAlt]);
  useEffect(() => { hasConfirmedRef.current = hasConfirmed; }, [hasConfirmed]);
  useEffect(() => { currentQuestionRef.current = currentQuestion; }, [currentQuestion]);
  useEffect(() => { startTimeRef.current = startTime; }, [startTime]);

  useEffect(() => {
    const s = io({ reconnectionDelay: 1000, reconnectionDelayMax: 5000, reconnectionAttempts: Infinity });
    setSocket(s);

    s.on("connect", () => {
      s.emit("join_room", { roomCode: simulado.codigoSala, user });
    });

    s.on("room_update", (data) => {
      if (data.status) setStatus(data.status);
      if (typeof data.studentCount === "number") setStudentCount(data.studentCount);
      if (data.currentQuestion) {
        setCurrentQuestion(data.currentQuestion);
        setTimeLeft(data.timeLeft ?? 0);
      }
      if (data.questionEndedData) setQuestionEndedData(data.questionEndedData);
      if (data.restoredAnswer) {
        setHasConfirmed(true);
        setSelectedAlt(data.restoredAnswer.alternativa);
      }
    });

    s.on("new_question", (q) => {
      setCurrentQuestion(q);
      setTimeLeft(q.tempoLimite);
      setSelectedAlt(-1);
      setHasConfirmed(false);
      setIsTimeUp(false);
      setQuestionEndedData(null);
      setStartTime(Date.now());
    });

    s.on("time_tick", (data) => setTimeLeft(data.timeLeft));

    s.on("time_up", () => {
      setIsTimeUp(true);
      if (!hasConfirmedRef.current && currentQuestionRef.current) {
        // Envia resposta em branco pro servidor não ficar esperando indefinidamente
      }
    });

    s.on("question_ended", (data) => setQuestionEndedData(data));

    s.on("ranking_update", (data) => {
      if (data.duelRounds) {
        const opponentId = Object.keys(data.duelRounds).find((id) => id !== user.userId);
        setDuelRounds({
          mine: data.duelRounds[user.userId] || 0,
          opponent: opponentId ? data.duelRounds[opponentId] || 0 : 0
        });
      }
    });

    s.on("duel_ended", (data) => setDuelResult(data));

    return () => { s.disconnect(); };
  }, [simulado.codigoSala, user.userId]);

  const handleConfirmAnswer = () => {
    if (selectedAlt === -1 || hasConfirmed || questionEndedData || isTimeUp || !currentQuestion) return;
    setHasConfirmed(true);
    const tempoGasto = Math.floor((Date.now() - startTime) / 1000);
    socket?.emit("submit_answer", {
      roomCode: simulado.codigoSala,
      questionId: currentQuestion.id,
      studentId: user.userId,
      alternativa: selectedAlt,
      tempoGasto
    });
  };

  if (duelResult) {
    const isWinner = duelResult.winnerId === user.userId;
    const isDraw = !!duelResult.isDraw;
    const isCancelled = !!duelResult.cancelled;
    const finalRounds = duelResult.rounds || {};
    const finalOpponentId = Object.keys(finalRounds).find((id) => id !== user.userId);
    const finalMine = finalRounds[user.userId] ?? duelRounds.mine;
    const finalOpponent = finalOpponentId ? finalRounds[finalOpponentId] : duelRounds.opponent;

    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-4">
        <div className="max-w-md w-full text-center space-y-6">
          {isCancelled ? (
            <>
              <XCircle className="w-16 h-16 mx-auto text-muted-foreground" />
              <h1 className="text-2xl font-black uppercase tracking-widest text-heading">Duelo Cancelado</h1>
              <p className="text-sm text-muted-foreground">Seu adversário se desconectou antes do duelo começar de verdade. Ninguém deve flexões.</p>
            </>
          ) : isDraw ? (
            <>
              <Swords className="w-16 h-16 mx-auto text-amber-400" />
              <h1 className="text-2xl font-black uppercase tracking-widest text-heading">Empate!</h1>
              <p className="text-3xl font-black text-heading tracking-widest">{finalMine} x {finalOpponent}</p>
              <p className="text-sm text-muted-foreground">Vocês empataram no placar e no tempo. Ninguém deve flexões.</p>
            </>
          ) : isWinner ? (
            <>
              <Trophy className="w-16 h-16 mx-auto text-emerald-400" />
              <h1 className="text-2xl font-black uppercase tracking-widest text-emerald-400">Vitória!</h1>
              {!duelResult.forfeit && <p className="text-3xl font-black text-emerald-400 tracking-widest">{finalMine} x {finalOpponent}</p>}
              <p className="text-sm text-muted-foreground">
                {duelResult.forfeit ? "Seu adversário se desconectou. Vitória por W.O." : "Você venceu o duelo."}
              </p>
              <p className="text-lg font-bold text-heading flex items-center justify-center gap-2">
                <Dumbbell className="w-5 h-5 text-emerald-400" /> {opponentName} te deve {duelResult.flexoesAposta} flexões
              </p>
            </>
          ) : (
            <>
              <Skull className="w-16 h-16 mx-auto text-red-400" />
              <h1 className="text-2xl font-black uppercase tracking-widest text-red-400">Derrota</h1>
              {!duelResult.forfeit && <p className="text-3xl font-black text-red-400 tracking-widest">{finalMine} x {finalOpponent}</p>}
              <p className="text-sm text-muted-foreground">
                {duelResult.forfeit ? "Você se desconectou e perdeu por W.O." : "Você perdeu o duelo."}
              </p>
              <p className="text-lg font-bold text-heading flex items-center justify-center gap-2">
                <Dumbbell className="w-5 h-5 text-red-400" /> Você deve {duelResult.flexoesAposta} flexões a {opponentName}
              </p>
            </>
          )}
          <Link href="/aluno/duelo">
            <Button className="w-full h-12 bg-red-600 hover:bg-red-700 font-black uppercase tracking-widest">Voltar ao Duelo</Button>
          </Link>
        </div>
      </div>
    );
  }

  if (status === "WAITING" || !currentQuestion) {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-4">
        <div className="max-w-md w-full text-center space-y-4">
          <Loader2 className="w-12 h-12 mx-auto animate-spin text-red-500" />
          <h1 className="text-xl font-black uppercase tracking-widest text-heading">Aguardando {opponentName}...</h1>
          <p className="text-sm text-muted-foreground">O duelo começa assim que os dois estiverem conectados. Combatentes na sala: {studentCount}/2.</p>
          <p className="text-xs text-muted-foreground">Melhor de {duelo.questionCount} · <Dumbbell className="w-3 h-3 inline" /> {duelo.flexoesAposta} flexões</p>
        </div>
      </div>
    );
  }

  const isEnded = questionEndedData !== null;

  return (
    <div className="min-h-screen bg-background text-foreground p-4 md:p-8 max-w-2xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div className="text-sm font-bold text-heading">Você: {duelRounds.mine}</div>
        <div className="flex flex-col items-center gap-0.5">
          <div className="flex items-center gap-2 text-lg font-black text-red-400">
            <Clock className="w-5 h-5" /> {timeLeft}s
          </div>
          <span className="text-[10px] text-muted-foreground uppercase tracking-widest">Melhor de {duelo.questionCount}</span>
        </div>
        <div className="text-sm font-bold text-heading">{opponentName}: {duelRounds.opponent}</div>
      </div>

      <div className="p-5 rounded-xl border border-border bg-card/50">
        <p className="text-base font-medium text-heading whitespace-pre-wrap">{currentQuestion.enunciado}</p>
      </div>

      <div className="space-y-3">
        {(currentQuestion.alternativas || []).map((alt: string, index: number) => {
          const isSelected = selectedAlt === index;
          const isCorrectAlt = isEnded && questionEndedData.correta === index;
          const isWrongSelected = isEnded && isSelected && questionEndedData.correta !== index;

          return (
            <button
              key={index}
              onClick={() => !hasConfirmed && !isEnded && !isTimeUp && setSelectedAlt(index)}
              disabled={hasConfirmed || isEnded || isTimeUp}
              className={`w-full text-left p-4 rounded-lg border transition-all ${
                isCorrectAlt ? "border-emerald-500 bg-emerald-950/30" :
                isWrongSelected ? "border-red-500 bg-red-950/30" :
                isSelected ? "border-blue-500 bg-blue-950/20" :
                "border-border bg-card/30 hover:bg-muted/30"
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm text-heading">{alt}</span>
                {isCorrectAlt && <CheckCircle className="w-5 h-5 text-emerald-400 shrink-0" />}
                {isWrongSelected && <XCircle className="w-5 h-5 text-red-400 shrink-0" />}
              </div>
              {isEnded && questionEndedData.percentages && (
                <Progress value={questionEndedData.percentages[index]} className="h-1.5 mt-2" />
              )}
            </button>
          );
        })}
      </div>

      {isEnded && (
        <div className="p-4 rounded-lg border border-border bg-card/50 text-sm text-muted-foreground">
          {questionEndedData.justificativa}
        </div>
      )}

      {selectedAlt !== -1 && !hasConfirmed && !isEnded && !isTimeUp && (
        <Button onClick={handleConfirmAnswer} className="w-full h-12 bg-red-600 hover:bg-red-700 font-black uppercase tracking-widest">
          Confirmar Resposta
        </Button>
      )}

      {hasConfirmed && !isEnded && (
        <p className="text-center text-xs text-muted-foreground uppercase tracking-widest font-bold">Resposta enviada, aguardando {opponentName}...</p>
      )}
    </div>
  );
}
