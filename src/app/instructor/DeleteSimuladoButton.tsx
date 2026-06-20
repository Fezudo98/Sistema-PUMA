"use client";

import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";
import { deleteSimulado } from "@/app/actions/simulado";
import { useState } from "react";

export default function DeleteSimuladoButton({ simuladoId }: { simuladoId: string }) {
  const [loading, setLoading] = useState(false);

  return (
    <Button 
      variant="outline" 
      className="w-12 px-0 shrink-0 border-red-200 text-red-500 hover:bg-red-50 hover:text-red-600" 
      title="Apagar Simulado"
      disabled={loading}
      onClick={async () => {
        if (confirm("Tem certeza que deseja apagar este simulado e todo o histórico de respostas dele? Essa ação não pode ser desfeita.")) {
          setLoading(true);
          await deleteSimulado(simuladoId);
          setLoading(false);
        }
      }}
    >
      <Trash2 className="w-4 h-4" />
    </Button>
  );
}
