"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { 
  Send, 
  Trash2, 
  ArrowLeft, 
  BookOpen, 
  User, 
  Bot, 
  Target, 
  Loader2, 
  MessageSquare,
  Award,
  BookOpenCheck,
  Lock
} from "lucide-react";
import { sendChatMessageAction, clearChatHistoryAction, getChatHistoryAction } from "@/app/actions/chat";
import { formatApostilaTitle } from "@/lib/utils";

interface Message {
  id: string;
  role: string; // "user" | "assistant"
  content: string;
  createdAt: string;
}

interface ChatClientProps {
  user: {
    id: string;
    name: string;
    avatarUrl: string | null;
    numero: number | null;
  };
  stats: {
    totalQuestions: number;
    accuracy: number;
  };
  apostilas: {
    id: string;
    title: string;
    isActive: boolean;
  }[];
  initialMessages: Message[];
  initialApostilaId: string | null;
  initialApostilaActive: boolean;
  isSuspended?: boolean;
  suspendedUntil?: string | null;
  isChatEnabled?: boolean;
}

export default function ChatClient({ 
  user, 
  stats, 
  apostilas, 
  initialMessages,
  initialApostilaId,
  initialApostilaActive,
  isSuspended = false,
  suspendedUntil = null,
  isChatEnabled = true
}: ChatClientProps) {
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [input, setInput] = useState("");
  const [selectedApostilaId, setSelectedApostilaId] = useState<string | null>(initialApostilaId);
  const [isApostilaActive, setIsApostilaActive] = useState<boolean>(initialApostilaActive);
  const [loadingHistory, setLoadingHistory] = useState<boolean>(false);
  const [sending, setSending] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [timeLeft, setTimeLeft] = useState<string>("");
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // Countdown timer for suspension
  useEffect(() => {
    if (!isSuspended || !suspendedUntil) return;

    const targetDate = new Date(suspendedUntil).getTime();

    const updateCountdown = () => {
      const now = new Date().getTime();
      const diff = targetDate - now;

      if (diff <= 0) {
        setTimeLeft("00h 00m 00s");
        router.refresh();
        return;
      }

      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      setTimeLeft(
        `${String(hours).padStart(2, "0")}h ${String(minutes).padStart(2, "0")}m ${String(seconds).padStart(2, "0")}s`
      );
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [isSuspended, suspendedUntil, router]);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, sending, loadingHistory]);

  // Render suspension screen
  if (isSuspended && suspendedUntil) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-center text-slate-200">
        <div className="max-w-md w-full space-y-6 bg-slate-900/40 p-8 rounded-2xl border border-rose-900/30 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-red-600 to-rose-500"></div>
          
          <div className="w-16 h-16 mx-auto rounded-full bg-rose-950/40 border border-rose-500/30 flex items-center justify-center text-rose-400">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8">
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
            </svg>
          </div>

          <div className="space-y-2">
            <h1 className="text-lg font-black uppercase tracking-wider text-white">Acesso Suspenso</h1>
            <p className="text-[10px] font-black text-rose-400 uppercase tracking-widest">Penalidade por Desvio de Foco</p>
          </div>

          <p className="text-xs text-slate-400 leading-relaxed">
            Combatente, seu acesso ao chat com o Mentor foi suspenso temporariamente por insistir em conversas alheias ao conteúdo programático das apostilas.
          </p>

          <div className="p-4 bg-slate-950/60 rounded-xl border border-slate-800 space-y-1">
            <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest block">Tempo Restante de Bloqueio</span>
            <span className="text-2xl font-mono font-black text-white tracking-widest">{timeLeft || "Calculando..."}</span>
          </div>

          <div className="pt-2">
            <Button 
              onClick={() => router.push("/aluno/painel")}
              className="w-full h-11 bg-slate-800 hover:bg-slate-700 text-white font-bold uppercase tracking-wider text-xs border border-slate-700 rounded-xl transition-all cursor-pointer"
            >
              Voltar ao Painel
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Load chat history dynamically when selecting another booklet
  const handleSelectApostila = async (id: string, active: boolean) => {
    if (loadingHistory || id === selectedApostilaId) return;

    setSelectedApostilaId(id);
    setIsApostilaActive(active);
    setLoadingHistory(true);

    try {
      const res = await getChatHistoryAction(id);
      if (res.error) {
        alert("Erro ao carregar histórico: " + res.error);
      } else if (res.success && res.messages) {
        const mapped = res.messages.map((m: any) => ({
          id: m.id,
          role: m.role,
          content: m.content,
          createdAt: m.createdAt
        }));
        setMessages(mapped);
      }
    } catch (err) {
      console.error("Erro ao carregar histórico:", err);
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleSend = async (textToSend?: string) => {
    const text = textToSend || input;
    if (!text.trim() || sending || !selectedApostilaId || !isApostilaActive) return;

    if (!textToSend) setInput(""); // Clear field if not triggered by quick suggestions

    const tempUserMsg: Message = {
      id: Math.random().toString(),
      role: "user",
      content: text.trim(),
      createdAt: new Date().toISOString()
    };

    setMessages((prev) => [...prev, tempUserMsg]);
    setSending(true);

    const res = await sendChatMessageAction(text.trim(), selectedApostilaId);
    setSending(false);

    if (res.error) {
      alert("Erro ao obter resposta do Mentor: " + res.error);
      // Remove the last message from the screen since it failed
      setMessages((prev) => prev.slice(0, -1));
    } else if (res.success && res.assistantMessage) {
      // Sync state with actual saved messages
      setMessages((prev) => {
        // Remove temp message and append saved database messages
        const withoutTemp = prev.filter(m => m.id !== tempUserMsg.id);
        const userMsgSaved = res.userMessage ? {
          id: res.userMessage.id,
          role: res.userMessage.role,
          content: res.userMessage.content,
          createdAt: res.userMessage.createdAt.toISOString()
        } : tempUserMsg;

        const assistantMsgSaved = {
          id: res.assistantMessage.id,
          role: res.assistantMessage.role,
          content: res.assistantMessage.content,
          createdAt: res.assistantMessage.createdAt.toISOString()
        };

        return [...withoutTemp, userMsgSaved, assistantMsgSaved];
      });
    }
  };

  const handleClearChat = async () => {
    if (!selectedApostilaId) return;
    if (!confirm("Combatente, deseja apagar permanentemente todas as mensagens do histórico desta apostila com o Mentor?")) {
      return;
    }
    setClearing(true);
    const res = await clearChatHistoryAction(selectedApostilaId);
    setClearing(false);
    if (res.error) {
      alert("Falha ao limpar histórico: " + res.error);
    } else {
      setMessages([]);
    }
  };

  // Safe client-side Markdown formatter for military-aesthetic rich formatting
  const formatMarkdown = (text: string) => {
    let escaped = text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");

    // Bold text **text**
    escaped = escaped.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");

    // Code blocks ```code```
    escaped = escaped.replace(/```([\s\S]*?)```/g, "<pre class='bg-slate-950/70 p-3 rounded-lg font-mono text-[11px] text-emerald-400 border border-slate-800 my-2 overflow-x-auto whitespace-pre-wrap'><code>$1</code></pre>");

    const lines = escaped.split("\n");
    let inList = false;
    const resultLines = [];

    for (let line of lines) {
      if (line.trim().startsWith("- ") || line.trim().startsWith("* ")) {
        if (!inList) {
          resultLines.push("<ul class='list-disc pl-5 my-2 space-y-1 text-slate-300'>");
          inList = true;
        }
        const itemText = line.trim().substring(2);
        resultLines.push(`<li>${itemText}</li>`);
      } else {
        if (inList) {
          resultLines.push("</ul>");
          inList = false;
        }
        if (line.trim().length > 0) {
          resultLines.push(`<p class='my-1.5 leading-relaxed text-slate-300'>${line}</p>`);
        } else {
          resultLines.push("<div class='h-2'></div>");
        }
      }
    }
    if (inList) {
      resultLines.push("</ul>");
    }

    return resultLines.join("");
  };

  const suggestions = [
    "Explique de forma simplificada a matéria contida neste material.",
    "Quais são os conceitos cruciais que preciso memorizar sobre este PDF?",
    "Crie 3 perguntas rápidas baseadas neste texto para testar meu nível.",
    "Destaque potenciais pegadinhas de concurso sobre essa legislação."
  ];

  const currentBooklet = apostilas.find(a => a.id === selectedApostilaId);
  const currentBookletName = currentBooklet ? formatApostilaTitle(currentBooklet.title) : "Apostila selecionada";

  return (
    <div className="flex flex-col h-screen bg-slate-950 text-slate-200">
      {/* Top Header Bar */}
      <header className="h-20 border-b border-slate-900 bg-slate-900/50 backdrop-blur-md flex items-center justify-between px-4 sm:px-6 shrink-0">
        <div className="flex items-center gap-2 sm:gap-3">
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => router.push("/aluno/painel")}
            className="text-slate-400 hover:text-white rounded-lg border border-slate-850 hover:bg-slate-800 h-9 w-9 sm:h-10 sm:w-10"
            title="Voltar ao painel inicial"
          >
            <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5" />
          </Button>
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-blue-950 border border-blue-500/30 flex items-center justify-center shrink-0">
            <Bot className="w-4.5 h-4.5 sm:w-5 sm:h-5 text-blue-400" />
          </div>
          <div>
            <h1 className="text-xs sm:text-sm font-black uppercase tracking-wider text-white truncate max-w-[150px] xs:max-w-[200px] sm:max-w-none">Mentoria de Estudos por Apostila</h1>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              <span className="text-[9px] sm:text-[10px] font-bold text-slate-500 uppercase tracking-widest hidden xs:block">Base de Operações Online</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <Button
            variant="ghost"
            onClick={handleClearChat}
            disabled={clearing || !selectedApostilaId || messages.length === 0}
            className="h-9 sm:h-10 px-2.5 sm:px-3.5 border border-slate-900 hover:border-red-900/40 hover:bg-red-950/20 text-slate-400 hover:text-red-400 text-xs font-bold uppercase tracking-wider rounded-xl transition-all"
            title="Limpar conversa"
          >
            {clearing ? <Loader2 className="w-3.5 h-3.5 animate-spin sm:mr-1.5" /> : <Trash2 className="w-3.5 h-3.5 sm:mr-1.5" />}
            <span className="hidden sm:inline">Limpar Histórico</span>
          </Button>
        </div>
      </header>

      {/* Main Workspace: Split layout */}
      <div className="flex-1 flex overflow-hidden min-h-0">
        {/* Left Sidebar Pane: Configuration & Performance stats */}
        <aside className="w-80 border-r border-slate-900 bg-slate-950/80 p-6 flex flex-col gap-6 overflow-y-auto hidden md:flex shrink-0">
          
          {/* List of booklet chats */}
          <div className="space-y-4 flex-1 flex flex-col min-h-0">
            <div className="space-y-2 flex-1 overflow-y-auto custom-scrollbar">
              
              {/* Active Booklets */}
              <label className="text-[10px] font-black text-blue-400 uppercase tracking-widest block mb-2">
                Apostilas Ativas
              </label>
              {apostilas.filter(a => a.isActive).length === 0 ? (
                <p className="text-[10px] text-slate-650 font-bold uppercase pl-1 mb-4">Nenhuma ativa no momento</p>
              ) : (
                <div className="space-y-1.5 mb-6">
                  {apostilas.filter(a => a.isActive).map((apo) => {
                    const isSelected = selectedApostilaId === apo.id;
                    return (
                      <button
                        key={apo.id}
                        disabled={loadingHistory}
                        onClick={() => handleSelectApostila(apo.id, apo.isActive)}
                        className={`w-full p-3 rounded-xl border text-left transition-all duration-200 cursor-pointer flex items-start gap-2.5 ${
                          isSelected 
                            ? "bg-blue-600/10 border-blue-500/50 text-white shadow-[0_0_15px_rgba(59,130,246,0.1)]" 
                            : "bg-slate-900/40 border-slate-850 text-slate-400 hover:text-slate-200 hover:bg-slate-900"
                        }`}
                      >
                        <BookOpen className={`w-4 h-4 mt-0.5 shrink-0 ${isSelected ? "text-blue-400" : "text-slate-500"}`} />
                        <span className="text-xs font-bold leading-snug line-clamp-2" title={apo.title}>{formatApostilaTitle(apo.title)}</span>
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Inactive / Deleted Booklets (History only) */}
              {apostilas.filter(a => !a.isActive).length > 0 && (
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-555 uppercase tracking-widest block mb-2">
                    Histórico (Removidas/Inativas)
                  </label>
                  <div className="space-y-1.5">
                    {apostilas.filter(a => !a.isActive).map((apo) => {
                      const isSelected = selectedApostilaId === apo.id;
                      return (
                        <button
                          key={apo.id}
                          disabled={loadingHistory}
                          onClick={() => handleSelectApostila(apo.id, apo.isActive)}
                          className={`w-full p-3 rounded-xl border text-left transition-all duration-200 cursor-pointer flex items-start gap-2.5 ${
                            isSelected 
                              ? "bg-slate-900 border-slate-800 text-slate-250" 
                              : "bg-slate-900/10 border-slate-950 text-slate-500 hover:text-slate-400"
                          }`}
                        >
                          <Lock className={`w-3.5 h-3.5 mt-0.5 shrink-0 ${isSelected ? "text-red-400" : "text-slate-700"}`} />
                          <span className="text-xs font-bold leading-snug line-clamp-2 italic" title={apo.title}>{formatApostilaTitle(apo.title)}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>

          <hr className="border-slate-900 shrink-0" />

          {/* Ficha Resumo do Combatente */}
          <div className="space-y-4 shrink-0">
            <label className="text-[10px] font-black text-emerald-400 uppercase tracking-widest block">
              Aproveitamento Global
            </label>
            
            <Card className="border-slate-900 bg-slate-900/30">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Award className="w-4 h-4 text-yellow-500" />
                    <span className="text-[10px] font-black text-slate-400 uppercase">Respostas</span>
                  </div>
                  <span className="text-xs font-black text-white">{stats.totalQuestions} alvos</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Target className="w-4 h-4 text-blue-400" />
                    <span className="text-[10px] font-black text-slate-400 uppercase">Taxa de Acerto</span>
                  </div>
                  <span className="text-xs font-black text-emerald-400">{stats.accuracy}%</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </aside>

        {/* Right Main Area: Chat Box */}
        <section className="flex-1 flex flex-col bg-slate-900/20 overflow-hidden relative">
          
          {/* Mobile Selector Dropdown (Shown only on small screens) */}
          <div className="p-4 border-b border-slate-900 bg-slate-950/40 flex items-center justify-between md:hidden gap-3 shrink-0">
            <div className="flex-1">
              <select
                value={selectedApostilaId || ""}
                onChange={(e) => {
                  const apo = apostilas.find(a => a.id === e.target.value);
                  if (apo) handleSelectApostila(apo.id, apo.isActive);
                }}
                className="w-full h-10 bg-slate-900 border border-slate-800 rounded-xl px-2.5 text-[10px] font-bold text-white focus:outline-none"
              >
                {apostilas.map((apo) => (
                  <option key={apo.id} value={apo.id}>
                    {apo.isActive ? "" : "🔒 [Inativa] "} {formatApostilaTitle(apo.title)}
                  </option>
                ))}
              </select>
            </div>
            <div className="p-2.5 bg-slate-900/80 rounded-xl border border-slate-800 flex items-center gap-1">
              <Target className="w-3.5 h-3.5 text-blue-400" />
              <span className="text-[10px] font-black text-white">{stats.accuracy}%</span>
            </div>
          </div>

          {/* Messages Thread Container */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
            {loadingHistory ? (
              <div className="flex flex-col items-center justify-center h-full py-12 text-slate-400 space-y-3">
                <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
                <span className="text-xs font-bold text-slate-500 uppercase tracking-widest animate-pulse">Carregando conversa...</span>
              </div>
            ) : !selectedApostilaId ? (
              <div className="max-w-md mx-auto py-24 flex flex-col items-center justify-center text-center space-y-4">
                <div className="w-12 h-12 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-500">
                  <BookOpen className="w-6 h-6" />
                </div>
                <h3 className="text-sm font-black text-white uppercase tracking-wider">Selecione uma Apostila</h3>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Não há apostilas disponíveis ou selecionadas para estudo no momento.
                </p>
              </div>
            ) : messages.length === 0 && !sending ? (
              <div className="max-w-2xl mx-auto py-8 flex flex-col items-center justify-center text-center space-y-6">
                <div className="w-14 h-14 rounded-xl bg-blue-950/40 border border-blue-500/20 flex items-center justify-center text-blue-400">
                  <MessageSquare className="w-7 h-7" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-white uppercase tracking-wider">Início de Mentoria Tática</h3>
                  <p className="text-xs text-slate-400 mt-2 max-w-md leading-relaxed">
                    Você abriu o canal de dúvidas para a apostila:<br />
                    <strong className="text-white">"{currentBookletName}"</strong>.
                  </p>
                </div>

                {isApostilaActive && (
                  <div className="w-full max-w-lg grid grid-cols-1 gap-2 pt-4">
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest text-left block pl-2">Sugestões de Dúvidas</span>
                    {suggestions.map((s, idx) => (
                      <button
                        key={idx}
                        onClick={() => handleSend(s)}
                        className="w-full p-3 bg-slate-900/40 hover:bg-slate-900/80 border border-slate-850 rounded-xl text-left text-xs font-semibold text-slate-300 hover:text-white transition-all cursor-pointer truncate"
                      >
                        💡 {s}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="max-w-3xl mx-auto space-y-6">
                {messages.map((m) => (
                  <div key={m.id} className={`flex gap-3.5 ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                    
                    {/* Assistant Avatar */}
                    {m.role !== "user" && (
                      <div className="w-8 h-8 rounded-lg bg-blue-950 border border-blue-500/30 flex items-center justify-center shrink-0">
                        <Bot className="w-4 h-4 text-blue-400" />
                      </div>
                    )}

                    {/* Bubble Content */}
                    <div className={`p-4 rounded-2xl max-w-[85%] text-sm shadow-md border ${
                      m.role === "user" 
                        ? "bg-blue-600/10 border-blue-500/20 text-slate-100 rounded-tr-none" 
                        : "bg-slate-900 border-slate-850 text-slate-100 rounded-tl-none"
                    }`}>
                      {m.role !== "user" ? (
                        <div 
                          className="prose prose-invert prose-xs leading-relaxed max-w-none text-left"
                          dangerouslySetInnerHTML={{ __html: formatMarkdown(m.content) }}
                        />
                      ) : (
                        <p className="leading-relaxed whitespace-pre-wrap text-left font-medium text-slate-200">{m.content}</p>
                      )}
                      
                      {/* Timestamp */}
                      <span className="text-[9px] font-bold text-slate-500 block text-right mt-2 uppercase tracking-wide">
                        {new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>

                    {/* User Avatar */}
                    {m.role === "user" && (
                      <div className="w-8 h-8 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center shrink-0">
                        <User className="w-4 h-4 text-slate-400" />
                      </div>
                    )}

                  </div>
                ))}

                {/* AI Typing Indicator */}
                {sending && (
                  <div className="flex gap-3.5 justify-start">
                    <div className="w-8 h-8 rounded-lg bg-blue-950 border border-blue-500/30 flex items-center justify-center shrink-0">
                      <Bot className="w-4 h-4 text-blue-400" />
                    </div>
                    <div className="p-4 bg-slate-900 border border-slate-850 rounded-2xl rounded-tl-none shadow-md flex items-center gap-2">
                      <Loader2 className="w-4 h-4 text-blue-400 animate-spin" />
                      <span className="text-xs font-bold text-slate-400 uppercase tracking-wider animate-pulse">Mentor PUMA está analisando...</span>
                    </div>
                  </div>
                )}
                
                <div ref={messagesEndRef} />
              </div>
            )}
          </div>

          {/* Bottom Send Input Form */}
          <div className="p-6 border-t border-slate-900 bg-slate-950/60 shrink-0">
            <div className="max-w-3xl mx-auto relative">
              {!isChatEnabled ? (
                /* Warn banner for globally disabled AI chat */
                <div className="flex items-center gap-3 p-4 bg-slate-900/60 border border-amber-900/40 text-slate-400 rounded-xl text-xs font-semibold select-none leading-relaxed">
                  <Lock className="w-4 h-4 text-amber-500 shrink-0" />
                  <span>O chat com o mentor de IA está temporariamente desativado pelo instrutor.</span>
                </div>
              ) : selectedApostilaId && !isApostilaActive ? (
                /* Warn banner for disabled chats */
                <div className="flex items-center gap-3 p-4 bg-slate-900/60 border border-red-900/40 text-slate-400 rounded-xl text-xs font-semibold select-none leading-relaxed">
                  <Lock className="w-4 h-4 text-red-500 shrink-0" />
                  <span>Esta apostila foi desativada ou removida pelo instrutor. O envio de novas mensagens está bloqueado, mas você ainda pode revisar o histórico.</span>
                </div>
              ) : selectedApostilaId ? (
                /* Active Send Message Form */
                <>
                  <form 
                    onSubmit={(e) => { e.preventDefault(); handleSend(); }}
                    className="flex items-center gap-3"
                  >
                    <input
                      type="text"
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      placeholder="Escreva sua pergunta técnica sobre a matéria..."
                      disabled={sending}
                      className="flex-1 h-12 bg-slate-900 border border-slate-800 rounded-xl px-4 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-600 font-medium"
                    />
                    <Button 
                      type="submit" 
                      disabled={sending || !input.trim()}
                      className="h-12 w-12 bg-blue-600 hover:bg-blue-500 rounded-xl flex items-center justify-center text-white shrink-0 cursor-pointer"
                    >
                      <Send className="w-4 h-4" />
                    </Button>
                  </form>
                  <div className="flex justify-between items-center mt-2 px-1 text-[9px] text-slate-500 font-bold uppercase tracking-wider">
                    <span>* Dúvidas respondidas em conformidade com a apostila.</span>
                    <span className="text-blue-400 flex items-center gap-1">
                      <BookOpenCheck className="w-3 h-3" /> Foco Ativo no PDF
                    </span>
                  </div>
                </>
              ) : null}
            </div>
          </div>

        </section>
      </div>
    </div>
  );
}
