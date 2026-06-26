"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useRouter } from "next/navigation";
import { Save, AlertCircle, Loader2, ArrowLeft, Edit2, Trash2, Check, X, BookOpen, Clock, AlertTriangle } from "lucide-react";
import { createSimulado } from "@/app/actions/simulado";

type Question = {
  enunciado: string;
  alternativas: string[];
  correta: number;
  justificativa: string;
};

export default function ReviewSimulado() {
  const router = useRouter();
  const [questions, setQuestions] = useState<Question[]>([]);
  const [tempo, setTempo] = useState(60);
  const [apostilaName, setApostilaName] = useState<string | undefined>();
  const [topics, setTopics] = useState<string | undefined>();
  const [loading, setLoading] = useState(false);
  const [isRaffleMode, setIsRaffleMode] = useState(false);
  const [dificuldade, setDificuldade] = useState("INTERMEDIARIO");

  // Estados de Edição
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editBuffer, setEditBuffer] = useState<Question | null>(null);

  useEffect(() => {
    const qData = localStorage.getItem("generated_questions");
    const cData = localStorage.getItem("simulado_config");
    
    if (qData) {
      setQuestions(JSON.parse(qData));
    } else {
      router.push("/instructor/simulado/new");
    }
    
    if (cData) {
      const parsed = JSON.parse(cData);
      setTempo(parsed.tempo);
      setApostilaName(parsed.apostilaName);
      if (parsed.topics) {
        setTopics(parsed.topics);
      }
      if (parsed.dificuldade) {
        setDificuldade(parsed.dificuldade);
      }
      if (parsed.isRaffleMode) {
        setIsRaffleMode(true);
      }
    }
  }, [router]);

  const startEdit = (index: number) => {
    setEditingIndex(index);
    setEditBuffer(JSON.parse(JSON.stringify(questions[index])));
  };

  const cancelEdit = () => {
    setEditingIndex(null);
    setEditBuffer(null);
  };

  const saveEdit = () => {
    if (editingIndex === null || !editBuffer) return;
    const newQuestions = [...questions];
    newQuestions[editingIndex] = editBuffer;
    setQuestions(newQuestions);
    localStorage.setItem("generated_questions", JSON.stringify(newQuestions));
    setEditingIndex(null);
    setEditBuffer(null);
  };

  const deleteQuestion = (index: number) => {
    if (!confirm("Tem certeza que deseja excluir esta questão?")) return;
    const newQuestions = questions.filter((_, idx) => idx !== index);
    setQuestions(newQuestions);
    if (newQuestions.length === 0) {
      localStorage.removeItem("generated_questions");
      localStorage.removeItem("simulado_config");
      router.push("/instructor/simulado/new");
    } else {
      localStorage.setItem("generated_questions", JSON.stringify(newQuestions));
    }
  };

  const updateBufferField = (field: keyof Question, value: any) => {
    if (!editBuffer) return;
    setEditBuffer({
      ...editBuffer,
      [field]: value
    });
  };

  const updateBufferAlternative = (altIndex: number, value: string) => {
    if (!editBuffer) return;
    const newAlts = [...editBuffer.alternativas];
    const prefix = ["A", "B", "C", "D", "E"][altIndex] || "";
    const cleanValue = value.replace(/^[A-E]\)\s*/i, "");
    newAlts[altIndex] = `${prefix}) ${cleanValue}`;
    setEditBuffer({
      ...editBuffer,
      alternativas: newAlts
    });
  };

  const handleSave = async () => {
    setLoading(true);
    const res = await createSimulado({
      tempoPorQuestao: tempo,
      apostilaName,
      topics,
      difficulty: dificuldade,
      questions
    });

    if (res.error) {
      alert("Erro: " + res.error);
      setLoading(false);
    } else {
      // Clear storage
      localStorage.removeItem("generated_questions");
      localStorage.removeItem("simulado_config");
      
      // Redirect to the active painel of the simulado
      router.push(`/instructor/painel/${res.simuladoId}${isRaffleMode ? '?raffle=true' : ''}`);
    }
  };

  if (questions.length === 0) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-8">
        <Loader2 className="w-8 h-8 text-blue-500 animate-spin mb-4" />
        <div className="text-slate-400 font-bold uppercase tracking-widest text-xs">Carregando questões táticas...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 p-8">
      <div className="max-w-4xl mx-auto">
        
        {/* Top Header */}
        <div className="flex justify-between items-center mb-8 border-b border-slate-800 pb-4">
          <Button variant="ghost" onClick={() => router.back()} className="text-slate-400 hover:text-white hover:bg-slate-900/50 font-bold">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Voltar
          </Button>
          
          <Button 
            onClick={handleSave} 
            disabled={loading || editingIndex !== null}
            className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold h-12 uppercase tracking-widest text-xs shadow-[0_0_15px_rgba(16,185,129,0.3)] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin text-white" /> : <Save className="w-4 h-4 mr-2 text-white" />}
            Aprovar e Salvar Simulado
          </Button>
        </div>

        {/* Title */}
        <div className="mb-6">
          <h1 className="text-3xl font-black text-white uppercase tracking-widest drop-shadow-[0_0_10px_rgba(59,130,246,0.2)]">Revisão das Questões (IA)</h1>
          <p className="text-slate-400 font-medium flex items-center gap-2 mt-2 text-sm uppercase tracking-wide">
            <AlertCircle className="w-4 h-4 text-amber-500" />
            A inteligência artificial gerou {questions.length} questões. Revise o material antes de salvar.
          </p>
        </div>

        {/* Card de Configuração do Simulado */}
        <div className="mb-8 bg-slate-900/60 border border-slate-800 rounded-xl p-4 flex flex-wrap gap-6 items-center justify-between shadow-lg relative overflow-hidden backdrop-blur-sm">
          <div className="absolute top-0 left-0 w-1 h-full bg-blue-500"></div>
          <div className="flex items-center gap-3">
            <BookOpen className="w-5 h-5 text-blue-500" />
            <div>
              <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider block">Material Base</span>
              <span className="text-sm font-bold text-white max-w-[250px] md:max-w-[350px] truncate block">{apostilaName || "Carregando..."}</span>
            </div>
          </div>
          
          <div className="flex flex-wrap gap-4 items-center">
            {/* Dificuldade */}
            <div className="flex flex-col">
              <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1">Dificuldade</span>
              <span className={`text-xs font-black uppercase tracking-wider px-2 py-0.5 rounded border ${
                dificuldade === "BASICO" 
                  ? "bg-sky-950/40 border-sky-500/30 text-sky-400"
                  : dificuldade === "INTERMEDIARIO"
                  ? "bg-amber-950/40 border-amber-500/30 text-amber-400"
                  : "bg-rose-950/40 border-rose-500/30 text-rose-400"
              }`}>
                {dificuldade === "BASICO" ? "Básico" : dificuldade === "INTERMEDIARIO" ? "Intermediário" : "Avançado"}
              </span>
            </div>

            {/* Tempo */}
            <div className="flex flex-col">
              <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1">Tempo por Questão</span>
              <span className="text-xs font-bold text-slate-300 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-slate-400" />
                {tempo}s
              </span>
            </div>

            {/* Modo Sorteio */}
            <div className="flex flex-col">
              <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1">Modo Sorteio</span>
              <span className={`text-xs font-black uppercase tracking-wider px-2 py-0.5 rounded border ${
                isRaffleMode
                  ? "bg-emerald-950/40 border-emerald-500/30 text-emerald-400"
                  : "bg-slate-950 border-slate-800 text-slate-500"
              }`}>
                {isRaffleMode ? "Ativado" : "Desativado"}
              </span>
            </div>
            
            {/* Tópicos */}
            {topics && (
              <div className="flex flex-col">
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1">Filtro de Tópicos</span>
                <span className="text-xs font-bold text-slate-300 bg-slate-950 px-2 py-0.5 rounded border border-slate-800 max-w-[150px] truncate" title={topics}>
                  {topics}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* List of Questions */}
        <div className="space-y-6">
          {questions.map((q, qIndex) => {
            const isEditing = editingIndex === qIndex;

            if (isEditing) {
              return (
                <Card key={qIndex} className="bg-slate-900/80 border-blue-500 shadow-2xl relative overflow-hidden ring-1 ring-blue-500/30">
                  <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-blue-400"></div>
                  
                  <CardHeader className="bg-slate-950 border-b border-slate-800 p-6">
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <span className="bg-blue-600 text-white px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider shrink-0">
                          EDITANDO Q{qIndex + 1}
                        </span>
                        <span className="text-xs font-bold text-blue-400 uppercase tracking-widest flex items-center gap-1">
                          <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                          Edição Manual Tática
                        </span>
                      </div>
                      
                      <div className="space-y-1">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Enunciado da Questão</label>
                        <textarea
                          value={editBuffer?.enunciado || ""}
                          onChange={(e) => updateBufferField("enunciado", e.target.value)}
                          className="w-full min-h-[100px] p-3 rounded-lg border border-slate-800 bg-slate-950 text-white focus:outline-none focus:border-blue-500 transition-all font-medium text-sm leading-relaxed"
                          placeholder="Edite o enunciado da questão..."
                        />
                      </div>
                    </div>
                  </CardHeader>
                  
                  <CardContent className="pt-6 space-y-6">
                    <div className="space-y-3 pl-2">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block">Alternativas e Seleção de Gabarito</label>
                      
                      {(editBuffer?.alternativas || []).map((alt, aIndex) => {
                        const isCorrect = aIndex === editBuffer?.correta;
                        return (
                          <div key={aIndex} className="flex gap-3 items-center">
                            {/* Seletor de Gabarito */}
                            <button
                              type="button"
                              onClick={() => updateBufferField("correta", aIndex)}
                              className={`font-black text-sm shrink-0 w-8 h-8 rounded-full flex items-center justify-center border transition-all ${
                                isCorrect 
                                  ? "bg-emerald-500 text-white border-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.4)]" 
                                  : "bg-slate-950 border-slate-800 text-slate-500 hover:border-slate-700 hover:text-slate-400"
                              }`}
                              title={isCorrect ? "Alternativa Correta (Gabarito)" : "Marcar como Gabarito"}
                            >
                              {["A", "B", "C", "D", "E"][aIndex] || String(aIndex)}
                            </button>
                            
                            {/* Input de Texto da Alternativa */}
                            <Input
                              type="text"
                              value={alt.replace(/^[A-E]\)\s*/i, '')}
                              onChange={(e) => updateBufferAlternative(aIndex, e.target.value)}
                              className="flex-1 bg-slate-950 border-slate-800 text-white focus-visible:ring-blue-500 h-10 px-3"
                              placeholder={`Texto da alternativa ${["A", "B", "C", "D", "E"][aIndex]}`}
                            />
                            
                            {isCorrect && (
                              <span className="text-[9px] font-black uppercase tracking-widest text-emerald-400 bg-emerald-950/40 border border-emerald-500/20 px-2 py-1 rounded hidden sm:inline-block">
                                Gabarito
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                    
                    {/* Justificativa */}
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block">Justificativa do Gabarito</label>
                      <textarea
                        value={editBuffer?.justificativa || ""}
                        onChange={(e) => updateBufferField("justificativa", e.target.value)}
                        className="w-full min-h-[80px] p-3 rounded-lg border border-slate-800 bg-slate-950 text-slate-300 focus:outline-none focus:border-blue-500 transition-all text-xs leading-relaxed"
                        placeholder="Justificativa da resposta correta..."
                      />
                    </div>
                    
                    {/* Botões de Ação do Editor */}
                    <div className="flex justify-end gap-3 pt-4 border-t border-slate-800/80">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={cancelEdit}
                        className="bg-slate-950 border border-slate-800 text-slate-400 hover:text-white hover:bg-slate-900 px-4 h-10 font-bold"
                      >
                        <X className="w-4 h-4 mr-2" />
                        Cancelar
                      </Button>
                      <Button
                        size="sm"
                        onClick={saveEdit}
                        className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 h-10 font-bold"
                      >
                        <Check className="w-4 h-4 mr-2 text-white" />
                        Confirmar
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            }

            return (
              <Card key={qIndex} className="bg-slate-900/40 border-slate-800 shadow-xl relative overflow-hidden group hover:border-slate-800/80 transition-all duration-300">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-600 to-emerald-500"></div>
                <CardHeader className="bg-slate-950/60 border-b border-slate-800 p-6">
                  <div className="flex justify-between items-start gap-4">
                    <CardTitle className="text-lg text-slate-200 flex gap-4 items-start font-bold">
                      <span className="bg-blue-950/60 text-blue-400 border border-blue-500/30 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider shrink-0 mt-0.5">
                        Q{qIndex + 1}
                      </span>
                      <span className="leading-relaxed">
                        {q.enunciado}
                      </span>
                    </CardTitle>
                    
                    {/* Botões de Ação */}
                    <div className="flex gap-2 shrink-0">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => startEdit(qIndex)}
                        disabled={editingIndex !== null}
                        className="h-8 px-2 bg-slate-950 border border-slate-800 text-slate-400 hover:text-blue-400 hover:border-blue-500/30 hover:bg-blue-950/20 disabled:opacity-30 disabled:cursor-not-allowed"
                        title="Editar Questão"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => deleteQuestion(qIndex)}
                        disabled={editingIndex !== null}
                        className="h-8 px-2 bg-slate-950 border border-slate-800 text-slate-400 hover:text-rose-400 hover:border-rose-500/30 hover:bg-rose-950/20 disabled:opacity-30 disabled:cursor-not-allowed"
                        title="Excluir Questão"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-6 space-y-4">
                  <div className="space-y-3 pl-6">
                    {q.alternativas.map((alt, aIndex) => {
                      const isCorrect = aIndex === q.correta;
                      return (
                        <div 
                          key={aIndex} 
                          className={`p-4 rounded-xl border flex gap-4 items-start ${
                            isCorrect 
                              ? "bg-emerald-950/20 border-emerald-500/30 text-emerald-400 shadow-[inset_0_0_15px_rgba(16,185,129,0.05)]" 
                              : "bg-slate-950/50 border-slate-800 text-slate-300"
                          }`}
                        >
                          <span className={`font-black text-sm shrink-0 w-6 h-6 rounded-full flex items-center justify-center border ${
                            isCorrect 
                              ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400" 
                              : "bg-slate-900 border-slate-800 text-slate-500"
                          }`}>
                            {["A", "B", "C", "D", "E"][aIndex] || String(aIndex)}
                          </span>
                          <p className="pt-0.5 text-base leading-snug flex-1">{alt.replace(/^[A-E]\)\s*/i, '')}</p>
                          
                          {isCorrect && (
                            <span className="ml-auto text-[10px] font-black uppercase tracking-widest text-emerald-400 bg-emerald-950/40 border border-emerald-500/30 px-2.5 py-1 rounded">
                              Gabarito
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  
                  {q.justificativa && (
                    <div className="mt-4 p-4 bg-blue-950/20 border border-blue-900/30 rounded-xl">
                      <p className="text-sm text-blue-300 leading-relaxed">
                        <strong className="text-xs uppercase tracking-widest text-blue-400 block mb-1">Justificativa da IA:</strong> {q.justificativa}
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
        
        {/* Bottom Button */}
        <div className="mt-8 flex justify-end pb-12 border-t border-slate-800 pt-6">
          <Button 
            size="lg"
            onClick={handleSave} 
            disabled={loading || editingIndex !== null}
            className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold h-14 px-8 uppercase tracking-widest text-xs shadow-[0_0_20px_rgba(16,185,129,0.3)] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? <Loader2 className="w-5 h-5 mr-2 animate-spin text-white" /> : <Save className="w-5 h-5 mr-2 text-white" />}
            Tudo Certo! Salvar Simulado
          </Button>
        </div>
      </div>
    </div>
  );
}
