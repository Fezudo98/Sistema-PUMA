"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Swords, Users, Clock, Check, X, Loader2, Dumbbell, Trophy } from "lucide-react";
import {
  createDuelChallengeAction,
  respondToDuelChallengeAction,
  cancelDuelInviteAction,
  joinDuelQueueAction,
  leaveDuelQueueAction,
  getMyDuelStatusAction,
  getDuelDebtsAction,
  markDuelDebtPaidAction
} from "@/app/actions/duelo";

type Student = { id: string; name: string; numero: number | null };
type Apostila = { id: string; title: string };

export default function DueloLobbyClient({ user, students, apostilas }: { user: any; students: Student[]; apostilas: Apostila[] }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [challengedId, setChallengedId] = useState<string>(searchParams.get("challenge") || "");
  const [apostilaId, setApostilaId] = useState<string>("");
  const [flexoes, setFlexoes] = useState<string>("10");
  const [questionCount, setQuestionCount] = useState<string>("10");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [status, setStatus] = useState<any>(null);
  const [debts, setDebts] = useState<{ owedToMe: any[]; owedByMe: any[]; history: any[] } | null>(null);
  const seenResultRef = useRef<string | null>(null);

  const refreshStatus = async () => {
    const res = await getMyDuelStatusAction();
    if ((res as any).success) {
      setStatus(res);
      const active = (res as any).activeDuel;
      if (active?.codigoSala) {
        router.push(`/aluno/duelo/sala/${active.codigoSala}`);
      }
    }
  };

  const refreshDebts = async () => {
    const res = await getDuelDebtsAction();
    if ((res as any).success) setDebts(res as any);
  };

  useEffect(() => {
    try {
      seenResultRef.current = localStorage.getItem("duelo_last_seen_result");
    } catch {
      // localStorage indisponível (modo privado, etc.) — segue sem lembrar o último resultado visto
    }
    refreshStatus();
    refreshDebts();
    const interval = setInterval(refreshStatus, 5000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (status?.recentResult && status.recentResult.id !== seenResultRef.current) {
      seenResultRef.current = status.recentResult.id;
      try {
        localStorage.setItem("duelo_last_seen_result", status.recentResult.id);
      } catch {
        // localStorage indisponível — o resultado pode reaparecer, mas não trava nada
      }
      refreshDebts();
    }
  }, [status?.recentResult?.id]);

  const handleChallenge = async () => {
    setFormError(null);
    if (!challengedId || !apostilaId) {
      setFormError("Escolha um adversário e uma apostila.");
      return;
    }
    setSubmitting(true);
    const res = await createDuelChallengeAction(challengedId, apostilaId, parseInt(flexoes) || 0, parseInt(questionCount) || 10);
    setSubmitting(false);
    if ((res as any).error) {
      setFormError((res as any).error);
    } else {
      refreshStatus();
    }
  };

  const handleQueue = async () => {
    setFormError(null);
    if (!apostilaId) {
      setFormError("Escolha uma apostila.");
      return;
    }
    setSubmitting(true);
    const res = await joinDuelQueueAction(apostilaId, parseInt(flexoes) || 0, parseInt(questionCount) || 10);
    setSubmitting(false);
    if ((res as any).error) {
      setFormError((res as any).error);
    } else if ((res as any).codigoSala) {
      router.push(`/aluno/duelo/sala/${(res as any).codigoSala}`);
    } else {
      refreshStatus();
    }
  };

  const respond = async (duelId: string, accept: boolean) => {
    const res = await respondToDuelChallengeAction(duelId, accept);
    if ((res as any).codigoSala) {
      router.push(`/aluno/duelo/sala/${(res as any).codigoSala}`);
    } else {
      refreshStatus();
    }
  };

  const cancelInvite = async (duelId: string) => {
    await cancelDuelInviteAction(duelId);
    refreshStatus();
  };

  const leaveQueue = async (duelId: string) => {
    await leaveDuelQueueAction(duelId);
    refreshStatus();
  };

  const markPaid = async (duelId: string) => {
    await markDuelDebtPaidAction(duelId);
    refreshDebts();
  };

  const hasOutstanding = !!status?.outgoingInvite || !!status?.queueStatus;

  return (
    <div className="min-h-screen bg-background text-foreground p-4 md:p-8 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/aluno/painel">
          <Button variant="outline" size="icon" className="border-border">
            <ArrowLeft className="w-4 h-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-black uppercase tracking-widest text-heading flex items-center gap-2">
            <Swords className="w-6 h-6 text-red-500" />
            Duelo
          </h1>
          <p className="text-xs text-muted-foreground font-bold uppercase tracking-wider">Desafie um combatente e aposte flexões</p>
        </div>
      </div>

      {status?.incomingInvites?.length > 0 && (
        <Card className="border-amber-600/50 bg-amber-950/10">
          <CardHeader>
            <CardTitle className="text-base uppercase tracking-wider text-amber-400">Convites Recebidos</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {status.incomingInvites.map((inv: any) => (
              <div key={inv.id} className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-lg border border-border bg-card/50">
                <div>
                  <p className="font-bold text-sm text-heading">{inv.challengerName}</p>
                  <p className="text-xs text-muted-foreground">{inv.apostilaName} · {inv.questionCount} questões · <Dumbbell className="w-3 h-3 inline" /> {inv.flexoesAposta} flexões</p>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => respond(inv.id, true)} className="bg-emerald-600 hover:bg-emerald-700">
                    <Check className="w-4 h-4 mr-1" /> Aceitar
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => respond(inv.id, false)} className="border-border">
                    <X className="w-4 h-4 mr-1" /> Recusar
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {status?.outgoingInvite && (
        <Card className="border-border">
          <CardContent className="pt-6 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" />
              Aguardando <strong className="text-heading">{status.outgoingInvite.challengedName}</strong> responder ao desafio ({status.outgoingInvite.flexoesAposta} flexões, {status.outgoingInvite.apostilaName}).
            </div>
            <Button size="sm" variant="outline" onClick={() => cancelInvite(status.outgoingInvite.id)} className="border-border">Cancelar</Button>
          </CardContent>
        </Card>
      )}

      {status?.queueStatus && (
        <Card className="border-border">
          <CardContent className="pt-6 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" />
              Na fila de <strong className="text-heading">{status.queueStatus.apostilaName}</strong> ({status.queueStatus.flexoesAposta} flexões) — aguardando adversário.
            </div>
            <Button size="sm" variant="outline" onClick={() => leaveQueue(status.queueStatus.id)} className="border-border">Sair da fila</Button>
          </CardContent>
        </Card>
      )}

      {!hasOutstanding && (
        <Card className="border-border">
          <CardHeader>
            <CardTitle className="text-base uppercase tracking-wider text-heading flex items-center gap-2">
              <Users className="w-5 h-5" /> Novo Duelo
            </CardTitle>
            <CardDescription>Desafie um combatente específico ou entre na fila de pareamento automático.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Apostila</Label>
                <Select value={apostilaId} onValueChange={(v) => setApostilaId(v || "")}>
                  <SelectTrigger className="w-full h-11"><SelectValue placeholder="Escolha a matéria" /></SelectTrigger>
                  <SelectContent>
                    {apostilas.map((a) => (
                      <SelectItem key={a.id} value={a.id}>{a.title}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Adversário (desafio direto)</Label>
                <Select value={challengedId} onValueChange={(v) => setChallengedId(v || "")}>
                  <SelectTrigger className="w-full h-11"><SelectValue placeholder="Escolha um combatente" /></SelectTrigger>
                  <SelectContent>
                    {students.map((s) => (
                      <SelectItem key={s.id} value={s.id}>{s.numero ? `${String(s.numero).padStart(2, "0")} - ${s.name}` : s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Flexões apostadas</Label>
                <Input type="number" min={1} max={100} value={flexoes} onChange={(e) => setFlexoes(e.target.value)} className="h-11" />
              </div>
              <div className="space-y-1.5">
                <Label>Nº de questões</Label>
                <Input type="number" min={5} max={20} value={questionCount} onChange={(e) => setQuestionCount(e.target.value)} className="h-11" />
              </div>
            </div>

            {formError && <p className="text-sm text-red-400 font-bold">{formError}</p>}

            <div className="flex flex-col sm:flex-row gap-3">
              <Button onClick={handleChallenge} disabled={submitting || !challengedId} className="flex-1 h-11 bg-red-600 hover:bg-red-700">
                <Swords className="w-4 h-4 mr-2" /> Desafiar
              </Button>
              <Button onClick={handleQueue} disabled={submitting} variant="outline" className="flex-1 h-11 border-border">
                <Clock className="w-4 h-4 mr-2" /> Entrar na Fila
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">Na fila, a aposta final é a menor entre a sua e a do adversário pareado.</p>
          </CardContent>
        </Card>
      )}

      <Card className="border-border">
        <CardHeader>
          <CardTitle className="text-base uppercase tracking-wider text-heading flex items-center gap-2">
            <Dumbbell className="w-5 h-5" /> Flexões
          </CardTitle>
          <CardDescription>Dívidas pendentes de duelos já encerrados.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="text-xs font-black uppercase tracking-widest text-emerald-400 mb-2">A receber</p>
            {(!debts || debts.owedToMe.length === 0) ? (
              <p className="text-xs text-muted-foreground">Nenhuma dívida a receber.</p>
            ) : (
              <div className="space-y-2">
                {debts.owedToMe.map((d) => (
                  <div key={d.id} className="flex items-center justify-between gap-3 p-3 rounded-lg border border-emerald-800/40 bg-emerald-950/10">
                    <span className="text-sm text-heading">
                      <strong>{d.opponentName}</strong> te deve <strong>{d.flexoesAposta}</strong> flexões ({d.apostilaName})
                    </span>
                    <Button size="sm" onClick={() => markPaid(d.id)} className="bg-emerald-600 hover:bg-emerald-700 shrink-0">
                      <Trophy className="w-3.5 h-3.5 mr-1" /> Marcar Paga
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div>
            <p className="text-xs font-black uppercase tracking-widest text-red-400 mb-2">A pagar</p>
            {(!debts || debts.owedByMe.length === 0) ? (
              <p className="text-xs text-muted-foreground">Nenhuma dívida pendente.</p>
            ) : (
              <div className="space-y-2">
                {debts.owedByMe.map((d) => (
                  <div key={d.id} className="p-3 rounded-lg border border-red-800/40 bg-red-950/10 text-sm text-heading">
                    Você deve <strong>{d.flexoesAposta}</strong> flexões a <strong>{d.opponentName}</strong> ({d.apostilaName})
                  </div>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
