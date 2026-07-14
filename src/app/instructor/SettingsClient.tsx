"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toggleChatEnabledAction } from "@/app/actions/chat";
import { MessageSquare, ShieldAlert, Check, Loader2 } from "lucide-react";

export default function SettingsClient({ 
  initialChatEnabled 
}: { 
  initialChatEnabled: boolean 
}) {
  const [chatEnabled, setChatEnabled] = useState(initialChatEnabled);
  const [updating, setUpdating] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const handleToggle = async () => {
    setUpdating(true);
    setMessage(null);
    const newValue = !chatEnabled;
    
    try {
      const res = await toggleChatEnabledAction(newValue);
      if (res.error) {
        setMessage({ type: "error", text: res.error });
      } else {
        setChatEnabled(newValue);
        setMessage({ 
          type: "success", 
          text: `Chat com Mentor de IA ${newValue ? "ativado" : "desativado"} com sucesso!` 
        });
      }
    } catch (e: any) {
      setMessage({ type: "error", text: e.message || "Erro de conexão." });
    } finally {
      setUpdating(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <Card className="border-slate-800 bg-slate-900/40 backdrop-blur-sm shadow-[0_0_15px_rgba(0,0,0,0.5)]">
        <CardHeader className="border-b border-slate-850 pb-4">
          <div className="flex items-center gap-3">
            <MessageSquare className="w-6 h-6 text-blue-500" />
            <div>
              <CardTitle className="text-xl font-black uppercase tracking-wider text-white">
                Controles do Mentor de IA
              </CardTitle>
              <CardDescription className="text-slate-400 mt-1 text-xs font-bold uppercase tracking-wider">
                Configurações globais de inteligência artificial
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        
        <CardContent className="pt-6 space-y-6">
          <div className="flex items-center justify-between gap-6 p-4 bg-slate-950/60 border border-slate-850 rounded-xl">
            <div className="space-y-1 max-w-lg">
              <h3 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
                Chat Geral com IA
                <span className={`text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider border ${
                  chatEnabled 
                    ? "bg-emerald-950/30 text-emerald-400 border-emerald-500/30" 
                    : "bg-red-950/30 text-red-400 border-red-500/30"
                }`}>
                  {chatEnabled ? "Ativado" : "Desativado"}
                </span>
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed font-medium">
                Quando desativado, impede todos os alunos de enviar mensagens ou fazer perguntas ao Mentor de IA das apostilas. Útil para moderar o consumo de tokens de API.
              </p>
            </div>

            <Button
              onClick={handleToggle}
              disabled={updating}
              className={`h-11 px-6 font-bold text-xs uppercase tracking-wider transition-all cursor-pointer ${
                chatEnabled 
                  ? "bg-red-900/30 border border-red-500/30 text-red-400 hover:bg-red-950/50" 
                  : "bg-emerald-600 hover:bg-emerald-500 text-white"
              }`}
            >
              {updating ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" />
                  Salvando
                </>
              ) : chatEnabled ? (
                "Desativar Chat"
              ) : (
                "Ativar Chat"
              )}
            </Button>
          </div>

          {message && (
            <div className={`p-4 rounded-xl border text-xs font-semibold flex items-center gap-2.5 animate-fadeIn ${
              message.type === "success" 
                ? "bg-emerald-950/20 border-emerald-500/30 text-emerald-300" 
                : "bg-red-950/20 border-red-500/30 text-red-300"
            }`}>
              {message.type === "success" ? (
                <Check className="w-4 h-4 text-emerald-400 shrink-0" />
              ) : (
                <ShieldAlert className="w-4 h-4 text-red-400 shrink-0" />
              )}
              <span>{message.text}</span>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
