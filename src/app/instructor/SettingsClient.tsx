"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toggleChatEnabledAction } from "@/app/actions/chat";
import { createInstructorAction } from "@/app/actions/auth";
import { MessageSquare, ShieldAlert, Check, Loader2, UserPlus } from "lucide-react";

export default function SettingsClient({ 
  initialChatEnabled 
}: { 
  initialChatEnabled: boolean 
}) {
  const [chatEnabled, setChatEnabled] = useState(initialChatEnabled);
  const [updating, setUpdating] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // States for creating a new instructor
  const [newInstName, setNewInstName] = useState("");
  const [newInstUsername, setNewInstUsername] = useState("");
  const [newInstPassword, setNewInstPassword] = useState("");
  const [instCreating, setInstCreating] = useState(false);
  const [instMessage, setInstMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

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

  const handleCreateInstructor = async (e: React.FormEvent) => {
    e.preventDefault();
    setInstCreating(true);
    setInstMessage(null);

    const formData = new FormData();
    formData.append("name", newInstName);
    formData.append("username", newInstUsername);
    formData.append("password", newInstPassword);

    try {
      const res = await createInstructorAction(formData);
      if (res.error) {
        setInstMessage({ type: "error", text: res.error });
      } else {
        setInstMessage({ type: "success", text: "Novo instrutor cadastrado com sucesso!" });
        setNewInstName("");
        setNewInstUsername("");
        setNewInstPassword("");
      }
    } catch (err: any) {
      setInstMessage({ type: "error", text: err.message || "Erro de conexão." });
    } finally {
      setInstCreating(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Control AI Card */}
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

      {/* Cadastrar Novo Instrutor Card */}
      <Card className="border-slate-800 bg-slate-900/40 backdrop-blur-sm shadow-[0_0_15px_rgba(0,0,0,0.5)]">
        <CardHeader className="border-b border-slate-850 pb-4">
          <div className="flex items-center gap-3">
            <UserPlus className="w-6 h-6 text-blue-500" />
            <div>
              <CardTitle className="text-xl font-black uppercase tracking-wider text-white">
                Cadastrar Novo Instrutor
              </CardTitle>
              <CardDescription className="text-slate-400 mt-1 text-xs font-bold uppercase tracking-wider">
                Adicione um novo membro para gerenciar simulados e turmas
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        
        <CardContent className="pt-6">
          <form onSubmit={handleCreateInstructor} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase text-slate-400 tracking-wider">Nome Completo</label>
                <input 
                  type="text" 
                  value={newInstName} 
                  onChange={(e) => setNewInstName(e.target.value)} 
                  placeholder="Nome do Instrutor" 
                  required 
                  className="w-full h-11 bg-slate-950 border border-slate-850 rounded-xl px-4 text-xs text-white placeholder-slate-650 focus:outline-none focus:ring-2 focus:ring-blue-600 font-medium" 
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold uppercase text-slate-400 tracking-wider">Nome de Usuário</label>
                <input 
                  type="text" 
                  value={newInstUsername} 
                  onChange={(e) => setNewInstUsername(e.target.value)} 
                  placeholder="QRA ou usuário de login" 
                  required 
                  className="w-full h-11 bg-slate-950 border border-slate-850 rounded-xl px-4 text-xs text-white placeholder-slate-650 focus:outline-none focus:ring-2 focus:ring-blue-600 font-medium uppercase" 
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold uppercase text-slate-400 tracking-wider">Senha Provisória</label>
                <input 
                  type="password" 
                  value={newInstPassword} 
                  onChange={(e) => setNewInstPassword(e.target.value)} 
                  placeholder="Senha de acesso" 
                  required 
                  className="w-full h-11 bg-slate-950 border border-slate-850 rounded-xl px-4 text-xs text-white placeholder-slate-650 focus:outline-none focus:ring-2 focus:ring-blue-600 font-medium" 
                />
              </div>
            </div>

            <div className="flex justify-between items-center pt-2 gap-4">
              <div className="flex-1">
                {instMessage && (
                  <div className={`p-3 rounded-xl border text-xs font-semibold flex items-center gap-2.5 animate-fadeIn ${
                    instMessage.type === "success" 
                      ? "bg-emerald-950/20 border-emerald-500/30 text-emerald-300" 
                      : "bg-red-950/20 border-red-500/30 text-red-300"
                  }`}>
                    {instMessage.type === "success" ? (
                      <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                    ) : (
                      <ShieldAlert className="w-4 h-4 text-red-400 shrink-0" />
                    )}
                    <span>{instMessage.text}</span>
                  </div>
                )}
              </div>

              <Button
                type="submit"
                disabled={instCreating}
                className="h-11 px-8 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs uppercase tracking-wider transition-all cursor-pointer shrink-0"
              >
                {instCreating ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" />
                    Salvando
                  </>
                ) : (
                  "Cadastrar Instrutor"
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
