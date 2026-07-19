"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  Users, Target, Clock, Trophy, Search, User as UserIcon, KeyRound, Eye, EyeOff, Check, 
  AlertTriangle, Loader2, MessageSquare, ShieldAlert, ShieldCheck, Lock, Unlock, Bot, Hash, Flame, Zap
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { resetStudentPassword, getStudentChatAuditAction, toggleStudentChatSuspensionAction, getStudentSimuladosAction, updateStudentNumber } from "@/app/actions/user";
import { formatApostilaTitle } from "@/lib/utils";

type StudentPerformance = {
  id: string;
  name: string;
  numero: number | null;
  avatarUrl: string | null;
  totalAnswers: number;
  accuracy: number;
  totalScore: number;
  avgTime: number;
  streakDays?: number;
  todayPoints?: number;
  suspendedUntil?: string | null;
};

interface StudentListClientProps {
  studentsPerformance: StudentPerformance[];
}

export default function StudentListClient({ studentsPerformance }: StudentListClientProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedStudent, setSelectedStudent] = useState<StudentPerformance | null>(null);
  const [activeModalTab, setActiveModalTab] = useState<"dossier" | "simulados" | "chat">("dossier");

  // Password reset state
  const [newPassword, setNewPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [resetMessage, setResetMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Chat Audit & Suspension state
  const [loadingAudit, setLoadingAudit] = useState(false);
  const [auditMessages, setAuditMessages] = useState<any[]>([]);
  const [currentSuspendedUntil, setCurrentSuspendedUntil] = useState<string | null>(null);
  const [togglingSuspension, setTogglingSuspension] = useState(false);

  // Student simulados states
  const [loadingSimulados, setLoadingSimulados] = useState(false);
  const [studentSimulados, setStudentSimulados] = useState<any[]>([]);
  const [expandedSimuladoId, setExpandedSimuladoId] = useState<string | null>(null);

  // Number edit state
  const [newStudentNumber, setNewStudentNumber] = useState<string>("");
  const [isUpdatingNumber, setIsUpdatingNumber] = useState(false);
  const [numberUpdateMessage, setNumberUpdateMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      setSelectedStudent(null);
      setNewPassword("");
      setShowPassword(false);
      setResetMessage(null);
      setNewStudentNumber("");
      setNumberUpdateMessage(null);
      setActiveModalTab("dossier");
      setAuditMessages([]);
      setStudentSimulados([]);
      setExpandedSimuladoId(null);
    }
  };

  useEffect(() => {
    if (selectedStudent) {
      setCurrentSuspendedUntil(selectedStudent.suspendedUntil || null);
      setNewStudentNumber(selectedStudent.numero ? String(selectedStudent.numero) : "");
      setNumberUpdateMessage(null);
      
      // Fetch Chat Audit
      setLoadingAudit(true);
      getStudentChatAuditAction(selectedStudent.id)
        .then((res) => {
          setLoadingAudit(false);
          if (res.success) {
            setAuditMessages(res.messages || []);
            if (res.student) {
              setCurrentSuspendedUntil(res.student.suspendedUntil);
            }
          }
        })
        .catch(() => setLoadingAudit(false));

      // Fetch Simulated Exams
      setLoadingSimulados(true);
      getStudentSimuladosAction(selectedStudent.id)
        .then((res) => {
          setLoadingSimulados(false);
          if (res.success) {
            setStudentSimulados(res.simulados || []);
          }
        })
        .catch(() => setLoadingSimulados(false));

      setExpandedSimuladoId(null);
    }
  }, [selectedStudent]);

  const handleUpdateNumber = async () => {
    if (!selectedStudent || !newStudentNumber) return;
    const num = parseInt(newStudentNumber, 10);
    if (isNaN(num) || num < 1 || num > 34) {
      setNumberUpdateMessage({ type: "error", text: "O número deve ser entre 1 e 34." });
      return;
    }

    setIsUpdatingNumber(true);
    setNumberUpdateMessage(null);

    const res = await updateStudentNumber(selectedStudent.id, num);
    setIsUpdatingNumber(false);

    if (res.success) {
      setNumberUpdateMessage({ type: "success", text: "Número do combatente atualizado com sucesso!" });
      setSelectedStudent((prev) => prev ? { ...prev, numero: num } : null);
    } else {
      setNumberUpdateMessage({ type: "error", text: res.error || "Erro ao atualizar número." });
    }
  };

  const handleToggleSuspension = async (suspend: boolean) => {
    if (!selectedStudent || togglingSuspension) return;
    const msg = suspend 
      ? `Deseja aplicar uma suspensão de 24 horas no chat com IA para o combatente ${selectedStudent.name}?`
      : `Deseja remover a suspensão e liberar o acesso do combatente ${selectedStudent.name} ao chat com IA?`;
    
    if (!confirm(msg)) return;

    setTogglingSuspension(true);
    const res = await toggleStudentChatSuspensionAction(selectedStudent.id, suspend, 24);
    setTogglingSuspension(false);

    if (res.success) {
      const newSuspendedUntil = res.suspendedUntil || null;
      setCurrentSuspendedUntil(newSuspendedUntil);
      // Update local state in selectedStudent
      setSelectedStudent((prev) => prev ? { ...prev, suspendedUntil: newSuspendedUntil } : null);
    } else {
      alert("Erro ao atualizar suspensão: " + res.error);
    }
  };

  const handleResetPassword = async () => {
    if (!selectedStudent || !newPassword) return;
    setIsResetting(true);
    setResetMessage(null);

    const res = await resetStudentPassword(selectedStudent.id, newPassword);
    setIsResetting(false);

    if (res.success) {
      setResetMessage({ type: "success", text: "Senha do combatente redefinida com sucesso!" });
      setNewPassword("");
    } else {
      setResetMessage({ type: "error", text: res.error || "Erro ao redefinir senha." });
    }
  };

  const filteredStudents = studentsPerformance.filter(student => 
    student.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const isCurrentlySuspended = currentSuspendedUntil && new Date(currentSuspendedUntil) > new Date();

  return (
    <Card className="bg-slate-900/40 border-slate-800 shadow-2xl relative overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-600 to-emerald-500"></div>
      <CardHeader className="border-b border-slate-800 bg-slate-900/80 p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <CardTitle className="flex items-center gap-2 text-2xl font-black text-white uppercase tracking-widest">
            <Users className="w-6 h-6 text-blue-500" />
            Divisão de Combatentes & Auditoria
          </CardTitle>
          <CardDescription className="text-slate-400 font-medium">Radar de desempenho, credenciais e fiscalização de conversas no Mentor IA.</CardDescription>
        </div>
        <div className="relative w-full md:w-72">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-500 w-4 h-4" />
          <Input 
            placeholder="Buscar por QRA do aluno..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 bg-slate-950/80 border-slate-800 text-white placeholder:text-slate-500 focus-visible:ring-blue-500"
          />
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {filteredStudents.length === 0 ? (
          <div className="p-12 text-center text-slate-500 font-bold uppercase tracking-wider">
            Nenhum combatente encontrado no contingente.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-900/60 text-[11px] font-black uppercase tracking-widest text-slate-400">
                  <th className="p-5">Combatente</th>
                  <th className="p-5 text-center">Status Chat IA</th>
                  <th className="p-5 text-center">Tiros Efetuados</th>
                  <th className="p-5 text-center">Aproveitamento</th>
                  <th className="p-5 text-center">Reação Média</th>
                  <th className="p-5 text-right">Score Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-sm">
                {filteredStudents.map((student, index) => {
                  const rankIndex = searchTerm ? studentsPerformance.findIndex(s => s.id === student.id) : index;
                  const isStudentSuspended = student.suspendedUntil && new Date(student.suspendedUntil) > new Date();

                  return (
                    <tr 
                      key={student.id} 
                      onClick={() => setSelectedStudent(student)}
                      className="hover:bg-slate-800/60 transition-colors cursor-pointer"
                    >
                      <td className="p-5">
                        <div className="flex items-center gap-4">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center font-black text-xs border ${
                            rankIndex === 0 ? "bg-yellow-900/30 border-yellow-500 text-yellow-500 shadow-[0_0_10px_rgba(234,179,8,0.3)]" :
                            rankIndex === 1 ? "bg-slate-800 border-slate-400 text-slate-300" :
                            rankIndex === 2 ? "bg-amber-900/20 border-amber-700 text-amber-600" :
                            "bg-slate-900 border-slate-800 text-slate-600"
                          }`}>
                            {rankIndex + 1}º
                          </div>
                          <div className="flex items-center gap-3">
                            {student.avatarUrl ? (
                              <img src={student.avatarUrl} alt={student.name} className="w-8 h-8 rounded-full object-cover border border-slate-700" />
                            ) : (
                              <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-400">
                                <UserIcon className="w-4 h-4" />
                              </div>
                            )}
                            <div className="flex flex-col gap-1">
                              <span className="font-bold text-white uppercase tracking-wider">
                                {student.numero ? `${String(student.numero).padStart(2, '0')} - ${student.name}` : student.name}
                              </span>
                              <div className="flex items-center gap-2">
                                {typeof student.streakDays === 'number' && student.streakDays > 0 && (
                                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-orange-950/80 border border-orange-500/40 text-orange-400 font-bold text-[10px]" title="Sequência Diária">
                                    <Flame className="w-3 h-3 fill-orange-500 text-orange-500" />
                                    {student.streakDays}d ({student.streakDays * 100} pts)
                                  </span>
                                )}
                                {typeof student.todayPoints === 'number' && (
                                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-yellow-950/80 border border-yellow-500/40 text-yellow-400 font-bold text-[10px]" title="Pontos hoje (Ao Dia)">
                                    <Zap className="w-3 h-3 fill-yellow-400 text-yellow-400" />
                                    +{student.todayPoints} hoje
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="p-5 text-center">
                        {isStudentSuspended ? (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black bg-rose-950/80 border border-rose-500/40 text-rose-400 uppercase tracking-widest">
                            <Lock className="w-3 h-3" /> Suspenso 24h
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black bg-emerald-950/60 border border-emerald-500/30 text-emerald-400 uppercase tracking-widest">
                            <Check className="w-3 h-3" /> Regular
                          </span>
                        )}
                      </td>
                      <td className="p-5 text-center text-slate-300 font-bold">{student.totalAnswers}</td>
                      <td className="p-5 text-center">
                        <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold border ${
                          student.accuracy >= 70 ? "bg-emerald-900/30 text-emerald-400 border-emerald-500/30 shadow-[0_0_10px_rgba(16,185,129,0.15)]" :
                          student.accuracy >= 50 ? "bg-amber-900/30 text-amber-400 border-amber-500/30" :
                          "bg-red-900/30 text-red-400 border-red-500/30"
                        }`}>
                          <Target className="w-3 h-3 mr-1.5" />
                          {student.accuracy}%
                        </span>
                      </td>
                      <td className="p-5 text-center text-slate-400 font-mono font-bold">
                        <span className="flex items-center justify-center gap-1.5">
                          <Clock className="w-3 h-3 text-slate-500" />
                          {student.avgTime > 0 ? `${student.avgTime}s` : "-"}
                        </span>
                      </td>
                      <td className="p-5 text-right">
                        <span className="flex items-center justify-end gap-2 font-black text-white text-lg tracking-wider">
                          {student.totalScore > 0 && <Trophy className="w-4 h-4 text-yellow-500 drop-shadow-[0_0_5px_rgba(234,179,8,0.5)]" />}
                          {student.totalScore}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>

      <Dialog open={!!selectedStudent} onOpenChange={handleOpenChange}>
        <DialogContent className="bg-slate-950 border-slate-800 text-slate-200 sm:max-w-2xl max-h-[88vh] overflow-hidden flex flex-col">
          <DialogHeader className="border-b border-slate-800 pb-4 shrink-0">
            <DialogTitle className="text-lg font-black uppercase tracking-widest text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                {selectedStudent?.avatarUrl ? (
                  <img src={selectedStudent.avatarUrl} alt={selectedStudent.name} className="w-11 h-11 rounded-full object-cover border-2 border-blue-500" />
                ) : (
                  <div className="w-11 h-11 rounded-full bg-slate-900 border-2 border-blue-500 flex items-center justify-center text-blue-500">
                    <UserIcon className="w-5 h-5" />
                  </div>
                )}
                <div>
                  <span>{selectedStudent?.numero ? `${String(selectedStudent.numero).padStart(2, '0')} - ${selectedStudent.name}` : selectedStudent?.name}</span>
                  <DialogDescription className="text-slate-500 font-bold uppercase tracking-widest text-[10px] block mt-0.5">
                    Painel Operacional & Administrativo de Aluno
                  </DialogDescription>
                </div>
              </div>

              {/* Navigation Tabs Header */}
              <div className="flex bg-slate-900 border border-slate-800 p-1 rounded-xl gap-1">
                <button
                  onClick={() => setActiveModalTab("dossier")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
                    activeModalTab === "dossier" 
                      ? "bg-blue-600 text-white shadow-md" 
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  Dossiê
                </button>
                <button
                  onClick={() => setActiveModalTab("simulados")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all cursor-pointer flex items-center gap-1 ${
                    activeModalTab === "simulados" 
                      ? "bg-blue-600 text-white shadow-md" 
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  <Target className="w-3.5 h-3.5" />
                  Simulados
                </button>
                <button
                  onClick={() => setActiveModalTab("chat")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all cursor-pointer flex items-center gap-1 ${
                    activeModalTab === "chat" 
                      ? "bg-blue-600 text-white shadow-md" 
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                  Auditoria
                </button>
              </div>
            </DialogTitle>
          </DialogHeader>

          {/* Modal Content Tabs Container */}
          <div className="py-4 flex-1 overflow-y-auto custom-scrollbar">
            {activeModalTab === "dossier" ? (
              /* TAB 1: Dossier stats and credentials */
              <div className="space-y-6">
                <div className="grid grid-cols-4 gap-3">
                  <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-3.5 text-center">
                    <Target className="w-4 h-4 text-blue-500 mx-auto mb-1.5" />
                    <div className="text-xl font-black text-white">{selectedStudent?.accuracy}%</div>
                    <div className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mt-1">Precisão</div>
                  </div>
                  <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-3.5 text-center">
                    <Trophy className="w-4 h-4 text-yellow-500 mx-auto mb-1.5" />
                    <div className="text-xl font-black text-white">{selectedStudent?.totalScore}</div>
                    <div className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mt-1">Score Total</div>
                  </div>
                  <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-3.5 text-center">
                    <Users className="w-4 h-4 text-emerald-500 mx-auto mb-1.5" />
                    <div className="text-xl font-black text-white">{selectedStudent?.totalAnswers}</div>
                    <div className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mt-1">Questões</div>
                  </div>
                  <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-3.5 text-center">
                    <Clock className="w-4 h-4 text-amber-500 mx-auto mb-1.5" />
                    <div className="text-xl font-black text-white">{selectedStudent?.avgTime}s</div>
                    <div className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mt-1">Reação Média</div>
                  </div>
                </div>
                
                <div className="bg-slate-900/30 border border-slate-800 rounded-xl p-4">
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 border-b border-slate-800 pb-2">Parecer Tático do Aluno</h4>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    {selectedStudent && selectedStudent.accuracy >= 80 && selectedStudent.avgTime <= 15 ? 
                      "Excelente atirador. Combina altíssima precisão com velocidade de reação formidável. Padrão Ouro." :
                    selectedStudent && selectedStudent.accuracy >= 60 ? 
                      "Desempenho satisfatório na linha de frente. Recomenda-se mais treinamentos simulados para elevar a taxa crítica de acertos." :
                    selectedStudent && selectedStudent.totalAnswers > 0 ?
                      "Recruta necessita de treinamento intensivo. Desempenho letal comprometido. Encaminhar para reforço teórico." :
                        "Recruta ainda não iniciou atividades de simulados."
                    }
                  </p>
                </div>

                {/* Password Reset Section */}
                <div className="bg-slate-900/30 border border-slate-800 rounded-xl p-4 space-y-4">
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest border-b border-slate-800 pb-2 flex items-center gap-2">
                    <KeyRound className="w-4 h-4 text-blue-500" />
                    Redefinir Senha do Aluno
                  </h4>

                  <div className="space-y-3">
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <Input
                          type={showPassword ? "text" : "password"}
                          placeholder="Nova senha do combatente"
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          className="bg-slate-950 border-slate-800 text-white placeholder:text-slate-600 focus-visible:ring-blue-500 pr-10"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors cursor-pointer"
                        >
                          {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          setNewPassword("PMCE123");
                          setShowPassword(true);
                        }}
                        className="border-slate-800 hover:bg-slate-800 hover:text-white font-bold text-xs shrink-0 cursor-pointer"
                      >
                        Padrão (PMCE123)
                      </Button>
                    </div>

                    {resetMessage && (
                      <div
                        className={`p-3 rounded-lg border text-xs font-bold flex items-center gap-2 ${
                          resetMessage.type === "success"
                            ? "bg-emerald-950/40 border-emerald-500/30 text-emerald-400"
                            : "bg-red-950/40 border-red-500/30 text-red-400"
                        }`}
                      >
                        {resetMessage.type === "success" ? <Check className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
                        {resetMessage.text}
                      </div>
                    )}

                    <Button
                      type="button"
                      onClick={handleResetPassword}
                      disabled={isResetting || !newPassword}
                      className="w-full bg-blue-600 hover:bg-blue-500 text-white font-black uppercase tracking-widest text-xs cursor-pointer"
                    >
                      {isResetting ? "Redefinindo..." : "Atualizar Senha Agora"}
                    </Button>
                  </div>
                </div>

                {/* Alterar Número de Combate */}
                <div className="bg-slate-900/30 border border-slate-800 rounded-xl p-4 space-y-4">
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest border-b border-slate-800 pb-2 flex items-center gap-2">
                    <Hash className="w-4 h-4 text-blue-500" />
                    Alterar Identificação (Número de Combate)
                  </h4>

                  <div className="space-y-3">
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <Input
                          type="number"
                          min={1}
                          max={34}
                          placeholder="Número do combatente (1 a 34)"
                          value={newStudentNumber}
                          onChange={(e) => {
                            setNewStudentNumber(e.target.value);
                            setNumberUpdateMessage(null);
                          }}
                          className="bg-slate-950 border-slate-800 text-white placeholder:text-slate-600 focus-visible:ring-blue-500"
                        />
                      </div>
                      <Button
                        type="button"
                        onClick={handleUpdateNumber}
                        disabled={isUpdatingNumber || !newStudentNumber || String(selectedStudent?.numero) === newStudentNumber}
                        className="bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shrink-0 cursor-pointer h-10 px-4"
                      >
                        {isUpdatingNumber ? <Loader2 className="w-4 h-4 animate-spin" /> : "Atualizar Número"}
                      </Button>
                    </div>

                    {numberUpdateMessage && (
                      <div
                        className={`p-3 rounded-lg border text-xs font-bold flex items-center gap-2 ${
                          numberUpdateMessage.type === "success"
                            ? "bg-emerald-950/40 border-emerald-500/30 text-emerald-400"
                            : "bg-red-950/40 border-red-500/30 text-red-400"
                        }`}
                      >
                        {numberUpdateMessage.type === "success" ? <Check className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
                        {numberUpdateMessage.text}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ) : activeModalTab === "simulados" ? (
              /* TAB 3: Student Simulated Exams and details */
              <div className="space-y-6">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <h4 className="text-xs font-black uppercase tracking-widest text-slate-300 flex items-center gap-2">
                    <Target className="w-4 h-4 text-blue-400" />
                    Histórico de Simulados
                  </h4>
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                    Fiscalização de Respostas
                  </span>
                </div>

                {loadingSimulados ? (
                  <div className="py-12 flex flex-col items-center justify-center">
                    <Loader2 className="w-6 h-6 text-blue-500 animate-spin" />
                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 mt-2">Carregando relatórios...</span>
                  </div>
                ) : studentSimulados.length === 0 ? (
                  <div className="py-12 text-center text-xs text-slate-500 font-bold uppercase tracking-wider">
                    Nenhum simulado registrado para este combatente.
                  </div>
                ) : (
                  <div className="space-y-4">
                    {studentSimulados.map((sim) => {
                      const isExpanded = expandedSimuladoId === sim.id;
                      const inProgress = sim.tipo === "DAILY" && sim.answeredCount < sim.questionsCount;
                      const accuracy = sim.questionsCount > 0 ? Math.round((sim.correctAnswersCount / sim.questionsCount) * 100) : 0;
                      
                      return (
                        <div key={sim.id} className="border border-slate-850 bg-slate-900/30 rounded-xl overflow-hidden">
                          {/* Row Header */}
                          <div 
                            onClick={() => setExpandedSimuladoId(isExpanded ? null : sim.id)}
                            className="p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 cursor-pointer hover:bg-slate-900/50 transition-colors"
                          >
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <span className={`text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider border ${
                                  inProgress 
                                    ? "bg-amber-950/40 text-amber-400 border-amber-500/20" 
                                    : "bg-emerald-950/40 text-emerald-400 border-emerald-500/20"
                                }`}>
                                  {inProgress ? "Em Andamento" : "Concluído"}
                                </span>
                                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                                  {sim.codigoSala} • {sim.tipo}
                                </span>
                              </div>
                              <h5 className="text-xs font-bold text-white max-w-sm line-clamp-2" title={sim.apostilaName || ""}>{formatApostilaTitle(sim.apostilaName)}</h5>
                              <p className="text-[10px] font-medium text-slate-500">Realizado em {new Date(sim.createdAt).toLocaleDateString("pt-BR")}</p>
                            </div>

                            <div className="flex items-center gap-4">
                              <div className="text-right">
                                <div className="text-sm font-black text-white">{sim.correctAnswersCount}/{sim.questionsCount}</div>
                                <div className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Acertos ({accuracy}%)</div>
                              </div>
                              <div className="text-right">
                                <div className="text-sm font-black text-emerald-400">{sim.totalScore} pts</div>
                                <div className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Pontuação</div>
                              </div>
                              <div className="text-slate-500">
                                {isExpanded ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                              </div>
                            </div>
                          </div>

                          {/* Expanded Details */}
                          {isExpanded && (
                            <div className="border-t border-slate-850 bg-slate-950/40 p-4 space-y-4 max-h-[450px] overflow-y-auto custom-scrollbar">
                              {sim.questionsList.map((q: any, idx: number) => {
                                return (
                                  <div key={q.id} className="space-y-3 pb-4 border-b border-slate-900 last:border-b-0 last:pb-0">
                                    <div className="flex justify-between items-start gap-3">
                                      <h6 className="text-xs font-bold text-white">
                                        Q{idx + 1}. {q.enunciado}
                                      </h6>
                                      <div className="flex items-center gap-1.5 shrink-0">
                                        <span className="text-[9px] font-mono text-slate-500 font-bold uppercase">{q.tempoGasto}s</span>
                                        <span className={`text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider ${
                                          q.isCorrect 
                                            ? "bg-emerald-950/40 text-emerald-400 border border-emerald-500/20" 
                                            : "bg-red-950/40 text-red-400 border border-red-500/20"
                                        }`}>
                                          {q.isCorrect ? `+${q.pontuacao} pts` : "Errou"}
                                        </span>
                                      </div>
                                    </div>

                                    {/* Alternatives List */}
                                    <div className="space-y-2 pl-3">
                                      {q.alternativas.map((alt: string, altIdx: number) => {
                                        const isSelected = q.alunoEscolha === altIdx;
                                        const isCorrectAlt = q.correta === altIdx;
                                        
                                        let borderClass = "border-slate-900 bg-slate-900/10";
                                        let textClass = "text-slate-400";
                                        let badge = null;

                                        if (isCorrectAlt) {
                                          borderClass = "border-emerald-500/20 bg-emerald-950/10";
                                          textClass = "text-emerald-400 font-bold";
                                          badge = <span className="text-[8px] font-black bg-emerald-500 text-slate-950 px-1.5 py-0.5 rounded uppercase tracking-wider shrink-0">Gabarito</span>;
                                        }
                                        if (isSelected && !isCorrectAlt) {
                                          borderClass = "border-red-500/20 bg-red-950/10";
                                          textClass = "text-red-400 font-bold";
                                          badge = <span className="text-[8px] font-black bg-red-500 text-slate-950 px-1.5 py-0.5 rounded uppercase tracking-wider shrink-0">Marcou</span>;
                                        } else if (isSelected && isCorrectAlt) {
                                          badge = (
                                            <div className="flex gap-1 shrink-0">
                                              <span className="text-[8px] font-black bg-emerald-500 text-slate-950 px-1.5 py-0.5 rounded uppercase tracking-wider">Marcou</span>
                                              <span className="text-[8px] font-black bg-emerald-500 text-slate-950 px-1.5 py-0.5 rounded uppercase tracking-wider">Gabarito</span>
                                            </div>
                                          );
                                        }

                                        return (
                                          <div key={altIdx} className={`flex justify-between items-center p-2.5 rounded-lg border text-xs leading-normal ${borderClass} ${textClass}`}>
                                            <span>{alt}</span>
                                            {badge}
                                          </div>
                                        );
                                      })}
                                    </div>

                                    {/* Justification */}
                                    <div className="p-3 bg-slate-900/30 border border-slate-900 rounded-lg text-[11px] text-slate-400 leading-normal flex items-start gap-2 pl-3">
                                      <div className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-1.5 shrink-0"></div>
                                      <p><strong className="text-slate-300">Justificativa:</strong> {q.justificativa}</p>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ) : (
              /* TAB 2: AI Chat Audit & Disciplinary Suspension Controls */
              <div className="space-y-6">
                
                {/* Disciplinary Banner & Control */}
                <div className={`p-4 rounded-xl border flex flex-col sm:flex-row items-center justify-between gap-4 ${
                  isCurrentlySuspended 
                    ? "bg-rose-950/30 border-rose-500/40" 
                    : "bg-slate-900/40 border-slate-800"
                }`}>
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                      isCurrentlySuspended ? "bg-rose-900/40 text-rose-400" : "bg-emerald-900/40 text-emerald-400"
                    }`}>
                      {isCurrentlySuspended ? <Lock className="w-5 h-5" /> : <Unlock className="w-5 h-5" />}
                    </div>
                    <div>
                      <h4 className="text-xs font-black uppercase tracking-wider text-white">
                        {isCurrentlySuspended ? "Combatente Suspenso do Chat" : "Acesso Disciplinar Regular"}
                      </h4>
                      <p className="text-[10px] text-slate-400 leading-relaxed">
                        {isCurrentlySuspended 
                          ? `Suspensão aplicada até ${new Date(currentSuspendedUntil!).toLocaleString("pt-BR")}`
                          : "O aluno tem permissão integral para interagir com o Mentor PUMA."}
                      </p>
                    </div>
                  </div>

                  <Button
                    onClick={() => handleToggleSuspension(!isCurrentlySuspended)}
                    disabled={togglingSuspension}
                    className={`h-10 px-4 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
                      isCurrentlySuspended 
                        ? "bg-emerald-600 hover:bg-emerald-500 text-white" 
                        : "bg-rose-600 hover:bg-rose-500 text-white"
                    }`}
                  >
                    {togglingSuspension ? (
                      <Loader2 className="w-4 h-4 animate-spin mr-1.5" />
                    ) : isCurrentlySuspended ? (
                      <ShieldCheck className="w-4 h-4 mr-1.5" />
                    ) : (
                      <ShieldAlert className="w-4 h-4 mr-1.5" />
                    )}
                    {isCurrentlySuspended ? "Remover Suspensão" : "Aplicar Suspensão 24h"}
                  </Button>
                </div>

                {/* Audit Chat Log Viewer */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                    <h4 className="text-xs font-black uppercase tracking-widest text-slate-300 flex items-center gap-2">
                      <MessageSquare className="w-4 h-4 text-blue-400" />
                      Auditoria de Conversas com IA ({auditMessages.length} mensagens)
                    </h4>
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                      Fiscalização Administrativa
                    </span>
                  </div>

                  {loadingAudit ? (
                    <div className="py-16 flex flex-col items-center justify-center space-y-3 text-slate-500">
                      <Loader2 className="w-7 h-7 text-blue-500 animate-spin" />
                      <span className="text-xs font-bold uppercase tracking-wider">Carregando auditoria do chat...</span>
                    </div>
                  ) : auditMessages.length === 0 ? (
                    <div className="py-12 text-center border border-slate-850 rounded-xl bg-slate-900/20 text-slate-500 font-bold uppercase tracking-wider text-xs">
                      Este combatente ainda não enviou mensagens para o Mentor IA.
                    </div>
                  ) : (
                    <div className="space-y-3 max-h-[360px] overflow-y-auto pr-2 custom-scrollbar">
                      {auditMessages.map((msg) => (
                        <div 
                          key={msg.id} 
                          className={`p-3.5 rounded-xl border text-xs space-y-1.5 ${
                            msg.role === "user" 
                              ? "bg-blue-950/20 border-blue-900/30 text-slate-200 ml-6" 
                              : "bg-slate-900/60 border-slate-800 text-slate-300 mr-6"
                          }`}
                        >
                          <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-wider">
                            <div className="flex items-center gap-1.5">
                              {msg.role === "user" ? (
                                <span className="text-blue-400 flex items-center gap-1">
                                  <UserIcon className="w-3 h-3" /> Aluno ({selectedStudent?.name})
                                </span>
                              ) : (
                                <span className="text-emerald-400 flex items-center gap-1">
                                  <Bot className="w-3 h-3" /> Mentor IA PUMA
                                </span>
                              )}
                              <span className="text-slate-600">•</span>
                              <span className="text-slate-400 truncate max-w-[160px]" title={msg.apostilaTitle}>
                                📘 {msg.apostilaTitle}
                              </span>
                            </div>
                            <span className="text-slate-500">
                              {new Date(msg.createdAt).toLocaleString("pt-BR", {
                                day: "2-digit",
                                month: "2-digit",
                                hour: "2-digit",
                                minute: "2-digit"
                              })}
                            </span>
                          </div>
                          <p className="leading-relaxed whitespace-pre-wrap font-medium">{msg.content}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
