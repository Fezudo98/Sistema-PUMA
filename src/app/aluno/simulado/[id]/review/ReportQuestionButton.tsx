"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { AlertCircle, Loader2, Flag } from "lucide-react";
import { requestAppeal } from "@/app/actions/appeal";

export default function ReportQuestionButton({
  questionId,
  simuladoId,
  hasAppealedGlobal,
  hasAppealLocal,
  appealStatus,
  appealResponse
}: {
  questionId: string;
  simuladoId: string;
  hasAppealedGlobal: boolean;
  hasAppealLocal: boolean;
  appealStatus?: string | null;
  appealResponse?: string | null;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  if (hasAppealLocal) {
    let badgeColor = "bg-slate-500 text-slate-100";
    let statusText = "Em Análise";

    if (appealStatus === "ANNULLED") {
      badgeColor = "bg-emerald-500 text-emerald-100";
      statusText = "Questão Anulada";
    } else if (appealStatus === "CORRECTED") {
      badgeColor = "bg-blue-500 text-blue-100";
      statusText = "Gabarito Corrigido";
    } else if (appealStatus === "REJECTED") {
      badgeColor = "bg-red-500 text-red-100";
      statusText = "Recurso Indeferido";
    } else if (appealStatus === "PENDING") {
      badgeColor = "bg-yellow-500 text-yellow-900";
      statusText = "Em Análise pela IA";
    }

    return (
      <div className="mt-4 p-4 rounded-lg bg-slate-900/40 border border-slate-700/50">
        <div className="flex items-center gap-2 mb-2">
          <Flag className="w-4 h-4 text-slate-400" />
          <span className="text-sm font-semibold text-slate-300">Situação do Recurso:</span>
          <span className={`px-2 py-0.5 rounded text-xs font-bold ${badgeColor}`}>{statusText}</span>
        </div>
        {appealResponse && (
          <p className="text-sm text-slate-400 mt-2 italic border-l-2 border-slate-600 pl-3">
            {appealResponse}
          </p>
        )}
        {!appealResponse && appealStatus === "PENDING" && (
          <p className="text-sm text-slate-400 mt-2 italic border-l-2 border-slate-600 pl-3">
            A Inteligência Artificial (Sonnet 5) está analisando esta questão. Atualize a página em breve.
          </p>
        )}
      </div>
    );
  }

  // Se já tem recurso em outra questão, não mostra o botão
  if (hasAppealedGlobal) {
    return null;
  }

  const handleSubmit = async () => {
    if (!reason.trim()) {
      setError("Por favor, digite o motivo do seu recurso.");
      return;
    }
    setLoading(true);
    setError("");
    
    const result = await requestAppeal(questionId, reason);
    if (result.error) {
      setError(result.error);
      setLoading(false);
    } else {
      // Recarrega a página para exibir o status atualizado
      window.location.reload();
    }
  };

  if (!isOpen) {
    return (
      <Button 
        variant="ghost" 
        size="sm"
        className="mt-4 text-red-400 hover:text-red-300 hover:bg-red-950/30 flex items-center gap-2"
        onClick={() => setIsOpen(true)}
      >
        <AlertCircle className="w-4 h-4" />
        Reportar Erro nesta Questão
      </Button>
    );
  }

  return (
    <div className="mt-4 p-4 rounded-lg bg-red-950/20 border border-red-900/30 animate-in fade-in slide-in-from-top-4">
      <h4 className="text-red-400 font-bold text-sm mb-2 flex items-center gap-2">
        <AlertCircle className="w-4 h-4" />
        Abertura de Recurso
      </h4>
      <p className="text-xs text-red-300/80 mb-3">
        Atenção: Apenas um recurso pode ser aberto por simulado. Descreva detalhadamente o porquê o gabarito está errado ou a questão deve ser anulada.
      </p>
      <textarea 
        className="w-full bg-slate-900 border border-slate-700 rounded-md p-2 text-sm text-slate-200 mb-3 focus:outline-none focus:border-red-500/50 min-h-[80px]"
        placeholder="Ex: O gabarito indica a alternativa A como correta, mas a B é a certa segundo a Lei XYZ..."
        value={reason}
        onChange={e => setReason(e.target.value)}
        disabled={loading}
      />
      {error && <p className="text-red-400 text-xs mb-3">{error}</p>}
      <div className="flex justify-end gap-2">
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={() => setIsOpen(false)}
          disabled={loading}
          className="text-slate-400 hover:text-slate-300"
        >
          Cancelar
        </Button>
        <Button 
          size="sm"
          onClick={handleSubmit}
          disabled={loading}
          className="bg-red-600 hover:bg-red-500 text-white"
        >
          {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
          Enviar Recurso
        </Button>
      </div>
    </div>
  );
}
