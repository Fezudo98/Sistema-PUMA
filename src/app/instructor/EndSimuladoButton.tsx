"use client";

import { Button } from "@/components/ui/button";
import { Square } from "lucide-react";
import { endSimulado } from "@/app/actions/simulado";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { io } from "socket.io-client";

export default function EndSimuladoButton({ simuladoId, roomCode }: { simuladoId: string, roomCode: string }) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  return (
    <Button 
      variant="destructive" 
      className="w-12 px-0 shrink-0 shadow-sm" 
      title="Encerrar Simulado"
      disabled={loading}
      onClick={async () => {
        if (confirm("Tem certeza que deseja encerrar definitivamente este simulado? Esta ação cancelará as questões pendentes e não pode ser desfeita.")) {
          setLoading(true);
          
          // Notifica os alunos via WebSocket
          const socket = io();
          socket.emit("end_simulado", { roomCode, simuladoId });
          setTimeout(() => socket.disconnect(), 1000);

          await endSimulado(simuladoId);
          setLoading(false);
          router.push(`/instructor/painel/${simuladoId}/review`);
        }
      }}
    >
      <Square className="w-4 h-4" />
    </Button>
  );
}
