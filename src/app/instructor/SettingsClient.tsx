"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toggleChatEnabledAction } from "@/app/actions/chat";
import { createInstructorAction } from "@/app/actions/auth";
import { toggleMaintenanceAction, toggleMaintenanceWarningAction } from "@/app/actions/maintenance";
import { publishAnnouncementAction, clearAnnouncementAction } from "@/app/actions/announcement";
import { MessageSquare, ShieldAlert, Check, Loader2, UserPlus, Wrench, Megaphone, Send } from "lucide-react";

export default function SettingsClient({
  initialChatEnabled,
  initialMaintenanceEnabled = false,
  initialWarningEnabled = false,
  initialWarningMessage = "",
  initialAnnouncementEnabled = false
}: {
  initialChatEnabled: boolean;
  initialMaintenanceEnabled?: boolean;
  initialWarningEnabled?: boolean;
  initialWarningMessage?: string;
  initialAnnouncementEnabled?: boolean;
}) {
  const [chatEnabled, setChatEnabled] = useState(initialChatEnabled);
  const [updating, setUpdating] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const [maintenanceEnabled, setMaintenanceEnabled] = useState(initialMaintenanceEnabled);
  const [updatingMaintenance, setUpdatingMaintenance] = useState(false);
  const [maintenanceMessage, setMaintenanceMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const [warningEnabled, setWarningEnabled] = useState(initialWarningEnabled);
  const [warningText, setWarningText] = useState(initialWarningMessage);
  const [updatingWarning, setUpdatingWarning] = useState(false);
  const [warningMessage, setWarningMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const [announcementEnabled, setAnnouncementEnabled] = useState(initialAnnouncementEnabled);
  const [announcementText, setAnnouncementText] = useState("");
  const [announcementScheduleText, setAnnouncementScheduleText] = useState(""); // datetime-local, vazio = publicar já
  const [publishingAnnouncement, setPublishingAnnouncement] = useState(false);
  const [announcementMessage, setAnnouncementMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

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

  const handleToggleMaintenance = async () => {
    setUpdatingMaintenance(true);
    setMaintenanceMessage(null);
    const newValue = !maintenanceEnabled;
    
    try {
      const res = await toggleMaintenanceAction(newValue);
      if (res.error) {
        setMaintenanceMessage({ type: "error", text: res.error });
      } else {
        setMaintenanceEnabled(newValue);
        // O servidor desativa o aviso prévio automaticamente ao ativar a manutenção de
        // verdade — refletir aqui pra não mostrar o card de aviso como "ativo" desatualizado.
        if (newValue) setWarningEnabled(false);
        setMaintenanceMessage({
          type: "success",
          text: `Modo de Manutenção ${newValue ? "ATIVADO" : "DESATIVADO"} com sucesso! Todos os alunos ${newValue ? "foram bloqueados temporariamente." : "recuperaram o acesso normal."}`
        });
      }
    } catch (e: any) {
      setMaintenanceMessage({ type: "error", text: e.message || "Erro de conexão." });
    } finally {
      setUpdatingMaintenance(false);
    }
  };

  const handleToggleWarning = async () => {
    const newValue = !warningEnabled;

    if (newValue && !warningText.trim()) {
      setWarningMessage({ type: "error", text: "Escreva uma mensagem de aviso antes de ativar." });
      return;
    }

    setUpdatingWarning(true);
    setWarningMessage(null);

    try {
      const res = await toggleMaintenanceWarningAction(newValue, warningText);
      if (res.error) {
        setWarningMessage({ type: "error", text: res.error });
      } else {
        setWarningEnabled(newValue);
        setWarningMessage({
          type: "success",
          text: `Aviso prévio ${newValue ? "ATIVADO" : "DESATIVADO"} com sucesso! ${newValue ? "Os alunos vão ver a faixa de aviso em todas as páginas." : "A faixa de aviso foi removida."}`
        });
      }
    } catch (e: any) {
      setWarningMessage({ type: "error", text: e.message || "Erro de conexão." });
    } finally {
      setUpdatingWarning(false);
    }
  };

  const handlePublishAnnouncement = async () => {
    if (!announcementText.trim()) {
      setAnnouncementMessage({ type: "error", text: "Escreva uma mensagem antes de publicar." });
      return;
    }

    const scheduledForMs = announcementScheduleText ? new Date(announcementScheduleText).getTime() : null;
    if (scheduledForMs && scheduledForMs <= Date.now()) {
      setAnnouncementMessage({ type: "error", text: "O horário agendado precisa ser no futuro." });
      return;
    }

    setPublishingAnnouncement(true);
    setAnnouncementMessage(null);

    try {
      const res = await publishAnnouncementAction(announcementText, scheduledForMs);
      if (res.error) {
        setAnnouncementMessage({ type: "error", text: res.error });
      } else {
        setAnnouncementEnabled(true);
        setAnnouncementText("");
        setAnnouncementScheduleText("");
        setAnnouncementMessage({
          type: "success",
          text: scheduledForMs
            ? `Aviso agendado! Vai começar a aparecer sozinho a partir de ${new Date(scheduledForMs).toLocaleString("pt-BR")}, sem precisar de nada da sua parte nesse horário.`
            : "Aviso publicado! Cada aluno vai ver o modal uma única vez, em até 15s de qualquer página."
        });
      }
    } catch (e: any) {
      setAnnouncementMessage({ type: "error", text: e.message || "Erro de conexão." });
    } finally {
      setPublishingAnnouncement(false);
    }
  };

  const handleClearAnnouncement = async () => {
    setPublishingAnnouncement(true);
    setAnnouncementMessage(null);

    try {
      const res = await clearAnnouncementAction();
      if (res.error) {
        setAnnouncementMessage({ type: "error", text: res.error });
      } else {
        setAnnouncementEnabled(false);
        setAnnouncementMessage({ type: "success", text: "Aviso retirado. Quem ainda não viu não verá mais." });
      }
    } catch (e: any) {
      setAnnouncementMessage({ type: "error", text: e.message || "Erro de conexão." });
    } finally {
      setPublishingAnnouncement(false);
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
      {/* Maintenance Mode Card */}
      <Card className={`border-border backdrop-blur-sm shadow-[0_0_15px_rgba(0,0,0,0.5)] transition-colors ${
        maintenanceEnabled ? "bg-amber-950/20 border-amber-500/40" : "bg-card/40"
      }`}>
        <CardHeader className="border-b border-border pb-4">
          <div className="flex items-center gap-3">
            <Wrench className={`w-6 h-6 ${maintenanceEnabled ? "text-amber-400 animate-spin" : "text-amber-500"}`} style={{ animationDuration: "8s" }} />
            <div>
              <CardTitle className="text-xl font-black uppercase tracking-wider text-heading">
                Controle do Servidor em Manutenção
              </CardTitle>
              <CardDescription className="text-muted-foreground mt-1 text-xs font-bold uppercase tracking-wider">
                Bloquear ou liberar acesso temporário para alunos
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        
        <CardContent className="pt-6 space-y-6">
          <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-6 p-4 border rounded-xl ${
            maintenanceEnabled ? "bg-amber-950/30 border-amber-500/30" : "bg-background/60 border-border"
          }`}>
            <div className="space-y-1 max-w-lg">
              <h3 className="text-sm font-black text-heading uppercase tracking-wider flex items-center gap-2">
                Status do Acesso do Aluno
                <span className={`text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider border ${
                  maintenanceEnabled 
                    ? "bg-amber-500/20 text-amber-300 border-amber-500/40 animate-pulse" 
                    : "bg-emerald-950/30 text-emerald-400 border-emerald-500/30"
                }`}>
                  {maintenanceEnabled ? "EM MANUTENÇÃO (BLOQUEADO)" : "ACESSO NORMAL (LIBERADO)"}
                </span>
              </h3>
              <p className="text-xs text-muted-foreground leading-relaxed font-medium">
                Quando ativado, qualquer aluno que tentar acessar páginas de acesso ou simulados receberá uma tela de manutenção. Quando desativado, os alunos recuperam o acesso instantaneamente.
              </p>
            </div>

            <Button
              onClick={handleToggleMaintenance}
              disabled={updatingMaintenance}
              className={`h-11 px-6 font-bold text-xs uppercase tracking-wider transition-all cursor-pointer shrink-0 ${
                maintenanceEnabled 
                  ? "bg-emerald-600 hover:bg-emerald-500 text-heading shadow-[0_0_15px_rgba(16,185,129,0.3)]" 
                  : "bg-amber-600 hover:bg-amber-500 text-foreground shadow-[0_0_15px_rgba(245,158,11,0.3)]"
              }`}
            >
              {updatingMaintenance ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" />
                  Salvando...
                </>
              ) : maintenanceEnabled ? (
                "Desativar Manutenção (Liberar Alunos)"
              ) : (
                "Ativar Manutenção do Servidor"
              )}
            </Button>
          </div>

          {maintenanceMessage && (
            <div className={`p-4 rounded-xl border text-xs font-semibold flex items-center gap-2.5 animate-fadeIn ${
              maintenanceMessage.type === "success" 
                ? "bg-emerald-950/20 border-emerald-500/30 text-emerald-300" 
                : "bg-red-950/20 border-red-500/30 text-red-300"
            }`}>
              {maintenanceMessage.type === "success" ? (
                <Check className="w-4 h-4 text-emerald-400 shrink-0" />
              ) : (
                <ShieldAlert className="w-4 h-4 text-red-400 shrink-0" />
              )}
              <span>{maintenanceMessage.text}</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Aviso Prévio de Manutenção Card */}
      <Card className={`border-border backdrop-blur-sm shadow-[0_0_15px_rgba(0,0,0,0.5)] transition-colors ${
        warningEnabled ? "bg-amber-950/20 border-amber-500/40" : "bg-card/40"
      }`}>
        <CardHeader className="border-b border-border pb-4">
          <div className="flex items-center gap-3">
            <Megaphone className={`w-6 h-6 ${warningEnabled ? "text-amber-400" : "text-amber-500"}`} />
            <div>
              <CardTitle className="text-xl font-black uppercase tracking-wider text-heading">
                Aviso Prévio de Manutenção
              </CardTitle>
              <CardDescription className="text-muted-foreground mt-1 text-xs font-bold uppercase tracking-wider">
                Mostra uma faixa de aviso pros alunos sem bloquear o acesso
              </CardDescription>
            </div>
          </div>
        </CardHeader>

        <CardContent className="pt-6 space-y-6">
          <div className={`flex flex-col gap-4 p-4 border rounded-xl ${
            warningEnabled ? "bg-amber-950/30 border-amber-500/30" : "bg-background/60 border-border"
          }`}>
            <div className="space-y-1">
              <h3 className="text-sm font-black text-heading uppercase tracking-wider flex items-center gap-2">
                Status do Aviso
                <span className={`text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider border ${
                  warningEnabled
                    ? "bg-amber-500/20 text-amber-300 border-amber-500/40 animate-pulse"
                    : "bg-emerald-950/30 text-emerald-400 border-emerald-500/30"
                }`}>
                  {warningEnabled ? "AVISO ATIVO" : "SEM AVISO"}
                </span>
              </h3>
              <p className="text-xs text-muted-foreground leading-relaxed font-medium">
                Diferente do modo de manutenção acima, isso NÃO bloqueia ninguém — só mostra uma faixa no topo de todas as páginas do aluno, avisando com antecedência que uma manutenção real vai acontecer. Ativar o modo de manutenção desativa este aviso automaticamente.
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold uppercase text-muted-foreground tracking-wider">Mensagem do Aviso</label>
              <textarea
                value={warningText}
                onChange={(e) => setWarningText(e.target.value)}
                placeholder="Ex.: O sistema vai passar por manutenção hoje às 22h. Salve seu progresso antes desse horário."
                rows={2}
                className="w-full bg-background border border-border rounded-xl px-4 py-3 text-xs text-heading placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-amber-600 font-medium resize-none"
              />
            </div>

            <Button
              onClick={handleToggleWarning}
              disabled={updatingWarning}
              className={`h-11 px-6 font-bold text-xs uppercase tracking-wider transition-all cursor-pointer shrink-0 self-start ${
                warningEnabled
                  ? "bg-emerald-600 hover:bg-emerald-500 text-heading shadow-[0_0_15px_rgba(16,185,129,0.3)]"
                  : "bg-amber-600 hover:bg-amber-500 text-foreground shadow-[0_0_15px_rgba(245,158,11,0.3)]"
              }`}
            >
              {updatingWarning ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" />
                  Salvando...
                </>
              ) : warningEnabled ? (
                "Desativar Aviso"
              ) : (
                "Ativar Aviso"
              )}
            </Button>
          </div>

          {warningMessage && (
            <div className={`p-4 rounded-xl border text-xs font-semibold flex items-center gap-2.5 animate-fadeIn ${
              warningMessage.type === "success"
                ? "bg-emerald-950/20 border-emerald-500/30 text-emerald-300"
                : "bg-red-950/20 border-red-500/30 text-red-300"
            }`}>
              {warningMessage.type === "success" ? (
                <Check className="w-4 h-4 text-emerald-400 shrink-0" />
              ) : (
                <ShieldAlert className="w-4 h-4 text-red-400 shrink-0" />
              )}
              <span>{warningMessage.text}</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Aviso Único (Modal) Card */}
      <Card className={`border-border backdrop-blur-sm shadow-[0_0_15px_rgba(0,0,0,0.5)] transition-colors ${
        announcementEnabled ? "bg-blue-950/20 border-blue-500/40" : "bg-card/40"
      }`}>
        <CardHeader className="border-b border-border pb-4">
          <div className="flex items-center gap-3">
            <Send className={`w-6 h-6 ${announcementEnabled ? "text-blue-400" : "text-blue-500"}`} />
            <div>
              <CardTitle className="text-xl font-black uppercase tracking-wider text-heading">
                Aviso Único (Modal)
              </CardTitle>
              <CardDescription className="text-muted-foreground mt-1 text-xs font-bold uppercase tracking-wider">
                Comunicado pontual — cada aluno vê só uma vez, em qualquer página
              </CardDescription>
            </div>
          </div>
        </CardHeader>

        <CardContent className="pt-6 space-y-6">
          <div className={`flex flex-col gap-4 p-4 border rounded-xl ${
            announcementEnabled ? "bg-blue-950/30 border-blue-500/30" : "bg-background/60 border-border"
          }`}>
            <div className="space-y-1">
              <h3 className="text-sm font-black text-heading uppercase tracking-wider flex items-center gap-2">
                Status
                <span className={`text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider border ${
                  announcementEnabled
                    ? "bg-blue-500/20 text-blue-300 border-blue-500/40 animate-pulse"
                    : "bg-background/60 text-muted-foreground border-border"
                }`}>
                  {announcementEnabled ? "AVISO ATIVO" : "SEM AVISO ATIVO"}
                </span>
              </h3>
              <p className="text-xs text-muted-foreground leading-relaxed font-medium">
                Diferente do aviso prévio acima (faixa persistente até desativar), isso é um modal bloqueante que aparece UMA vez por aluno e some sozinho depois de fechado. Publicar um novo texto sempre reexibe pra todo mundo, mesmo quem já viu avisos anteriores.
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold uppercase text-muted-foreground tracking-wider">Nova Mensagem</label>
              <textarea
                value={announcementText}
                onChange={(e) => setAnnouncementText(e.target.value)}
                placeholder="Ex.: Estamos com instabilidade no sistema. Se sua resposta não avançar, toque em Recarregar Página."
                rows={2}
                className="w-full bg-background border border-border rounded-xl px-4 py-3 text-xs text-heading placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-blue-600 font-medium resize-none"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold uppercase text-muted-foreground tracking-wider">
                Agendar Para (opcional)
              </label>
              <input
                type="datetime-local"
                value={announcementScheduleText}
                onChange={(e) => setAnnouncementScheduleText(e.target.value)}
                className="w-full sm:w-auto bg-background border border-border rounded-xl px-4 py-3 text-xs text-heading focus:outline-none focus:ring-2 focus:ring-blue-600 font-medium"
              />
              <p className="text-[10px] text-muted-foreground/80 font-medium">
                Deixe em branco pra publicar imediatamente. Se preencher, o aviso já fica salvo mas só começa a
                aparecer pros alunos sozinho, a partir desse horário — sem precisar de ninguém online pra "ligar" nada.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Button
                onClick={handlePublishAnnouncement}
                disabled={publishingAnnouncement}
                className="h-11 px-6 font-bold text-xs uppercase tracking-wider transition-all cursor-pointer bg-blue-600 hover:bg-blue-500 text-white shadow-[0_0_15px_rgba(59,130,246,0.3)]"
              >
                {publishingAnnouncement ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" />
                    Publicando...
                  </>
                ) : (
                  "Publicar Aviso"
                )}
              </Button>

              {announcementEnabled && (
                <Button
                  onClick={handleClearAnnouncement}
                  disabled={publishingAnnouncement}
                  variant="ghost"
                  className="h-11 px-6 font-bold text-xs uppercase tracking-wider transition-all cursor-pointer bg-background border border-border text-muted-foreground hover:text-heading"
                >
                  Retirar Aviso
                </Button>
              )}
            </div>
          </div>

          {announcementMessage && (
            <div className={`p-4 rounded-xl border text-xs font-semibold flex items-center gap-2.5 animate-fadeIn ${
              announcementMessage.type === "success"
                ? "bg-emerald-950/20 border-emerald-500/30 text-emerald-300"
                : "bg-red-950/20 border-red-500/30 text-red-300"
            }`}>
              {announcementMessage.type === "success" ? (
                <Check className="w-4 h-4 text-emerald-400 shrink-0" />
              ) : (
                <ShieldAlert className="w-4 h-4 text-red-400 shrink-0" />
              )}
              <span>{announcementMessage.text}</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Control AI Card */}
      <Card className="border-border bg-card/40 backdrop-blur-sm shadow-[0_0_15px_rgba(0,0,0,0.5)]">
        <CardHeader className="border-b border-border pb-4">
          <div className="flex items-center gap-3">
            <MessageSquare className="w-6 h-6 text-blue-500" />
            <div>
              <CardTitle className="text-xl font-black uppercase tracking-wider text-heading">
                Controles do Mentor de IA
              </CardTitle>
              <CardDescription className="text-muted-foreground mt-1 text-xs font-bold uppercase tracking-wider">
                Configurações globais de inteligência artificial
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        
        <CardContent className="pt-6 space-y-6">
          <div className="flex items-center justify-between gap-6 p-4 bg-background/60 border border-border rounded-xl">
            <div className="space-y-1 max-w-lg">
              <h3 className="text-sm font-black text-heading uppercase tracking-wider flex items-center gap-2">
                Chat Geral com IA
                <span className={`text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider border ${
                  chatEnabled 
                    ? "bg-emerald-950/30 text-emerald-400 border-emerald-500/30" 
                    : "bg-red-950/30 text-red-400 border-red-500/30"
                }`}>
                  {chatEnabled ? "Ativado" : "Desativado"}
                </span>
              </h3>
              <p className="text-xs text-muted-foreground leading-relaxed font-medium">
                Quando desativado, impede todos os alunos de enviar mensagens ou fazer perguntas ao Mentor de IA das apostilas. Útil para moderar o consumo de tokens de API.
              </p>
            </div>

            <Button
              onClick={handleToggle}
              disabled={updating}
              className={`h-11 px-6 font-bold text-xs uppercase tracking-wider transition-all cursor-pointer ${
                chatEnabled 
                  ? "bg-red-900/30 border border-red-500/30 text-red-400 hover:bg-red-950/50" 
                  : "bg-emerald-600 hover:bg-emerald-500 text-heading"
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
      <Card className="border-border bg-card/40 backdrop-blur-sm shadow-[0_0_15px_rgba(0,0,0,0.5)]">
        <CardHeader className="border-b border-border pb-4">
          <div className="flex items-center gap-3">
            <UserPlus className="w-6 h-6 text-blue-500" />
            <div>
              <CardTitle className="text-xl font-black uppercase tracking-wider text-heading">
                Cadastrar Novo Instrutor
              </CardTitle>
              <CardDescription className="text-muted-foreground mt-1 text-xs font-bold uppercase tracking-wider">
                Adicione um novo membro para gerenciar simulados e turmas
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        
        <CardContent className="pt-6">
          <form onSubmit={handleCreateInstructor} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase text-muted-foreground tracking-wider">Nome Completo</label>
                <input 
                  type="text" 
                  value={newInstName} 
                  onChange={(e) => setNewInstName(e.target.value)} 
                  placeholder="Nome do Instrutor" 
                  required 
                  className="w-full h-11 bg-background border border-border rounded-xl px-4 text-xs text-heading placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-blue-600 font-medium" 
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold uppercase text-muted-foreground tracking-wider">Nome de Usuário</label>
                <input 
                  type="text" 
                  value={newInstUsername} 
                  onChange={(e) => setNewInstUsername(e.target.value)} 
                  placeholder="QRA ou usuário de login" 
                  required 
                  className="w-full h-11 bg-background border border-border rounded-xl px-4 text-xs text-heading placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-blue-600 font-medium uppercase" 
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold uppercase text-muted-foreground tracking-wider">Senha Provisória</label>
                <input 
                  type="password" 
                  value={newInstPassword} 
                  onChange={(e) => setNewInstPassword(e.target.value)} 
                  placeholder="Senha de acesso" 
                  required 
                  className="w-full h-11 bg-background border border-border rounded-xl px-4 text-xs text-heading placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-blue-600 font-medium" 
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
                className="h-11 px-8 bg-blue-600 hover:bg-blue-500 text-heading font-bold text-xs uppercase tracking-wider transition-all cursor-pointer shrink-0"
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
