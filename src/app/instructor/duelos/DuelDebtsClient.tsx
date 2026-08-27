"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ArrowLeft, Swords, Dumbbell, Check, RotateCcw } from "lucide-react";
import { adjustDuelDebtAction } from "@/app/actions/duelo";

export default function DuelDebtsClient({ initialDuelos }: { initialDuelos: any[] }) {
  const [duelos, setDuelos] = useState(initialDuelos);
  const [filter, setFilter] = useState<"all" | "pending" | "paid">("pending");
  const [busyId, setBusyId] = useState<string | null>(null);

  const adjust = async (id: string, action: "CLEAR" | "REOPEN") => {
    setBusyId(id);
    const res = await adjustDuelDebtAction(id, action);
    if ((res as any).success) {
      setDuelos((prev) =>
        prev.map((d) =>
          d.id === id ? { ...d, debtPaid: action === "CLEAR", debtPaidAt: action === "CLEAR" ? new Date().toISOString() : null } : d
        )
      );
    }
    setBusyId(null);
  };

  const filtered = duelos.filter((d) => {
    if (filter === "pending") return !d.debtPaid;
    if (filter === "paid") return d.debtPaid;
    return true;
  });

  return (
    <div className="min-h-screen bg-background text-foreground p-4 md:p-8 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/instructor">
          <Button variant="outline" size="icon" className="border-border">
            <ArrowLeft className="w-4 h-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-black uppercase tracking-widest text-heading flex items-center gap-2">
            <Swords className="w-6 h-6 text-red-500" />
            Dívidas de Duelo
          </h1>
          <p className="text-xs text-muted-foreground font-bold uppercase tracking-wider">Flexões apostadas entre combatentes</p>
        </div>
      </div>

      <div className="flex gap-2">
        {(["pending", "paid", "all"] as const).map((f) => (
          <Button
            key={f}
            size="sm"
            variant={filter === f ? "default" : "outline"}
            onClick={() => setFilter(f)}
            className={filter === f ? "bg-red-600 hover:bg-red-700" : "border-border"}
          >
            {f === "pending" ? "Pendentes" : f === "paid" ? "Pagas" : "Todas"}
          </Button>
        ))}
      </div>

      <Card className="border-border">
        <CardHeader>
          <CardTitle className="text-base uppercase tracking-wider text-heading">Duelos Encerrados</CardTitle>
          <CardDescription>{filtered.length} registro(s)</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {filtered.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">Nenhum duelo encontrado.</div>
          ) : (
            <div className="divide-y divide-border">
              {filtered.map((d) => (
                <div key={d.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-heading">
                      {d.winnerName} <span className="text-muted-foreground font-normal">venceu</span> {d.loserName}
                      {d.forfeited && <span className="text-amber-400 text-xs font-black ml-2">W.O.</span>}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {d.apostilaName} · <Dumbbell className="w-3 h-3 inline" /> {d.flexoesAposta} flexões · {d.finishedAt ? new Date(d.finishedAt).toLocaleDateString("pt-BR") : ""}
                      {d.clearedByInstructor && " · ajustado pelo instrutor"}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className={`text-xs font-black uppercase px-2 py-1 rounded-full ${d.debtPaid ? "bg-emerald-950/50 text-emerald-400 border border-emerald-800/50" : "bg-amber-950/50 text-amber-400 border border-amber-800/50"}`}>
                      {d.debtPaid ? "Paga" : "Pendente"}
                    </span>
                    {d.debtPaid ? (
                      <Button size="sm" variant="outline" disabled={busyId === d.id} onClick={() => adjust(d.id, "REOPEN")} className="border-border">
                        <RotateCcw className="w-3.5 h-3.5 mr-1" /> Reabrir
                      </Button>
                    ) : (
                      <Button size="sm" disabled={busyId === d.id} onClick={() => adjust(d.id, "CLEAR")} className="bg-emerald-600 hover:bg-emerald-700">
                        <Check className="w-3.5 h-3.5 mr-1" /> Marcar Paga
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
