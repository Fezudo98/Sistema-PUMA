"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, Zap } from "lucide-react";
import { useRouter } from "next/navigation";
import { resetSimuladoAttempt } from "@/app/actions/dailySimulado";

export default function RefazerReviewButton({
  simId,
  studentId,
  simName
}: {
  simId: string;
  studentId: string;
  simName: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handleRefazer = async () => {
    if (!confirm(`Deseja realmente refazer o simulado de "${simName}"? Suas respostas anteriores serão apagadas.`)) {
      return;
    }
    
    setLoading(true);
    const res = await resetSimuladoAttempt(studentId, simId);
    setLoading(false);

    if (res.error) {
      alert(res.error);
      return;
    }

    // Redireciona para o painel com parâmetros para abrir o modal de configuração de tempo
    router.push(`/aluno/painel?setupId=${simId}&setupName=${encodeURIComponent(simName)}`);
  };

  return (
    <Button
      onClick={handleRefazer}
      disabled={loading}
      className="bg-rose-600 hover:bg-rose-500 text-white font-black text-xs uppercase tracking-wider h-11 px-4 cursor-pointer"
    >
      {loading ? (
        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
      ) : (
        <Zap className="w-4 h-4 mr-2" />
      )}
      Refazer Simulado
    </Button>
  );
}
