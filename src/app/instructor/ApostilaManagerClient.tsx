"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { BookOpen, FileUp, Loader2, Power, PowerOff, Trash2, Calendar, FileText, CheckCircle2, Sparkles, GraduationCap, ListTree, X, Plus, RefreshCw } from "lucide-react";
import { toggleApostilaStatus, toggleApostilaProvaStatus, deleteApostila } from "@/app/actions/apostila";
import { forceGenerateDailySimuladoForApostila, forceGenerateAllDailySimuladosAction } from "@/app/actions/dailySimulado";
import { generateVadeMecumAction } from "@/app/actions/vadeMecum";
import { extractApostilaTopicsAction, saveApostilaProvaTopicsAction } from "@/app/actions/provaTopics";
import { formatApostilaTitle } from "@/lib/utils";

interface Apostila {
  id: string;
  title: string;
  filePath: string;
  isActive: boolean;
  isProvaSubject: boolean;
  provaTopics?: string | null;
  vadeMecum?: string | null;
  createdAt: Date;
}

export default function ApostilaManagerClient({
  initialApostilas
}: {
  initialApostilas: Apostila[];
}) {
  const [apostilas, setApostilas] = useState<Apostila[]>(initialApostilas);
  const [uploading, setUploading] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [successMsg, setSuccessMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [generatingAll, setGeneratingAll] = useState(false);
  const [generatingId, setGeneratingId] = useState<string | null>(null);
  const [generatingVadeMecumId, setGeneratingVadeMecumId] = useState<string | null>(null);
  const [togglingProvaId, setTogglingProvaId] = useState<string | null>(null);

  // Dialog de extração/revisão da lista fixa de tópicos (Bloco de Provas)
  const [topicsDialogApostila, setTopicsDialogApostila] = useState<Apostila | null>(null);
  const [topicsDraft, setTopicsDraft] = useState<string[]>([]);
  const [newTopicInput, setNewTopicInput] = useState("");
  const [extractingTopics, setExtractingTopics] = useState(false);
  const [savingTopics, setSavingTopics] = useState(false);
  const [topicsError, setTopicsError] = useState("");
  // Se true, ao salvar os tópicos também ativamos "Matéria de Prova" (fluxo de
  // primeira marcação, que exige revisão da lista antes de valer)
  const [enableProvaAfterTopics, setEnableProvaAfterTopics] = useState(false);

  const handleGenerateVadeMecum = async (id: string, title: string) => {
    if (!confirm(`Deseja gerar/regerar o Vade Mecum (resumo didático completo) para a apostila "${title}"?`)) {
      return;
    }
    setGeneratingVadeMecumId(id);
    const res = await generateVadeMecumAction(id);
    setGeneratingVadeMecumId(null);
    if (res.success && res.vadeMecum) {
      alert(`Vade Mecum para "${title}" gerado com sucesso pelo Gemini!`);
      setApostilas(prev => prev.map(a => a.id === id ? { ...a, vadeMecum: res.vadeMecum } : a));
    } else {
      alert("Erro ao gerar Vade Mecum: " + res.error);
    }
  };

  const handleGenerateSingleDaily = async (id: string, title: string) => {
    if (!confirm(`Deseja gerar um novo simulado diário de 25 questões para a apostila "${title}"? Se já existir um diário gerado hoje, ele continua disponível normalmente — o novo é adicionado ao lado dele.`)) {
      return;
    }
    setGeneratingId(id);
    const res = await forceGenerateDailySimuladoForApostila(id);
    setGeneratingId(null);
    if ("error" in res) {
      alert("Erro ao gerar: " + res.error);
    } else {
      alert(`Simulado diário para "${title}" gerado com sucesso pelo Gemini!`);
    }
  };

  const handleGenerateAllDaily = async () => {
    if (!confirm("Deseja gerar um novo simulado diário pra cada apostila ativa? Os diários já gerados hoje continuam disponíveis normalmente — os novos são adicionados ao lado deles.")) {
      return;
    }
    setGeneratingAll(true);
    const res = await forceGenerateAllDailySimuladosAction();
    setGeneratingAll(false);
    if ("error" in res) {
      alert("Erro ao gerar: " + res.error);
    } else {
      const countText = "generatedCount" in res ? ` (Total de simulados gerados: ${res.generatedCount})` : "";
      alert(`Simulados diários para todas as apostilas ativas gerados com sucesso pelo Gemini!${countText}`);
    }
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (files.length === 0) return;

    setUploading(true);
    setSuccessMsg("");
    setErrorMsg("");

    const uploadedApostilas: any[] = [];
    let errorsCount = 0;

    try {
      await Promise.all(
        files.map(async (f) => {
          const formData = new FormData();
          formData.append("pdf", f);

          try {
            const response = await fetch("/api/apostilas", {
              method: "POST",
              body: formData
            });

            const data = await response.json();
            if (!response.ok) {
              console.error(`Erro ao subir ${f.name}:`, data.error);
              errorsCount++;
            } else if (data.apostila) {
              uploadedApostilas.push(data.apostila);
            }
          } catch (err: any) {
            console.error(`Falha na requisição para ${f.name}:`, err.message);
            errorsCount++;
          }
        })
      );

      if (uploadedApostilas.length > 0) {
        setApostilas((prev) => {
          let updated = [...prev];
          uploadedApostilas.forEach((newApo) => {
            const idx = updated.findIndex((a) => a.id === newApo.id);
            if (idx !== -1) {
              updated[idx] = { ...newApo, createdAt: new Date(newApo.createdAt) };
            } else {
              updated = [{ ...newApo, createdAt: new Date(newApo.createdAt) }, ...updated];
            }
          });
          return updated;
        });

        const successText = errorsCount > 0 
          ? `Subiu ${uploadedApostilas.length} arquivo(s) com sucesso. ${errorsCount} falharam.`
          : `${uploadedApostilas.length} arquivo(s) salvos e ativados com sucesso!`;

        setSuccessMsg(successText);
        setFiles([]);
      } else {
        setErrorMsg("Falha ao subir os arquivos selecionados.");
      }
    } catch (err: any) {
      setErrorMsg("Erro: " + err.message);
    } finally {
      setUploading(false);
    }
  };

  const handleToggleStatus = async (id: string, currentStatus: boolean) => {
    const res = await toggleApostilaStatus(id, currentStatus);
    if (res.error) {
      alert(res.error);
    } else if (res.success && res.isActive !== undefined) {
      setApostilas(apostilas.map(a => a.id === id ? { ...a, isActive: res.isActive! } : a));
    }
  };

  const doToggleProvaStatus = async (id: string, currentStatus: boolean) => {
    setTogglingProvaId(id);
    const res = await toggleApostilaProvaStatus(id, currentStatus);
    setTogglingProvaId(null);
    if (res.error) {
      alert(res.error);
    } else if (res.success && res.isProvaSubject !== undefined) {
      setApostilas(prev => prev.map(a => a.id === id ? { ...a, isProvaSubject: res.isProvaSubject! } : a));
    }
  };

  const handleToggleProvaStatus = async (apo: Apostila) => {
    // Desativar matéria de prova não precisa de revisão de tópicos.
    if (apo.isProvaSubject) {
      await doToggleProvaStatus(apo.id, true);
      return;
    }

    // Já tem lista de tópicos revisada de antes: liga direto, sem passar pela revisão de novo.
    if (apo.provaTopics) {
      if (!confirm(`Marcar "${apo.title}" como matéria de prova? Um Bloco de Provas será montado com todas as questões dos simulados diários já gerados dessa matéria.`)) {
        return;
      }
      await doToggleProvaStatus(apo.id, false);
      return;
    }

    // Primeira vez marcando como prova: precisa extrair e revisar a lista de tópicos antes.
    handleOpenTopicsDialog(apo, true);
  };

  const handleOpenTopicsDialog = (apo: Apostila, enableProvaAfter: boolean) => {
    setTopicsDialogApostila(apo);
    setEnableProvaAfterTopics(enableProvaAfter);
    setTopicsError("");
    setNewTopicInput("");
    if (apo.provaTopics) {
      try {
        const parsed = JSON.parse(apo.provaTopics);
        setTopicsDraft(Array.isArray(parsed) ? parsed : []);
      } catch {
        setTopicsDraft([]);
      }
    } else {
      setTopicsDraft([]);
      handleExtractTopics(apo.id);
    }
  };

  const handleExtractTopics = async (apostilaId: string) => {
    setExtractingTopics(true);
    setTopicsError("");
    const res = await extractApostilaTopicsAction(apostilaId);
    setExtractingTopics(false);
    if (res.error || !res.topics) {
      setTopicsError(res.error || "Falha ao extrair os tópicos.");
      return;
    }
    setTopicsDraft(res.topics);
  };

  const handleAddTopic = () => {
    const value = newTopicInput.trim();
    if (!value || topicsDraft.includes(value)) return;
    setTopicsDraft(prev => [...prev, value]);
    setNewTopicInput("");
  };

  const handleRemoveTopic = (topic: string) => {
    setTopicsDraft(prev => prev.filter(t => t !== topic));
  };

  const handleCloseTopicsDialog = () => {
    setTopicsDialogApostila(null);
    setTopicsDraft([]);
    setTopicsError("");
    setEnableProvaAfterTopics(false);
  };

  const handleSaveTopics = async () => {
    if (!topicsDialogApostila) return;
    if (topicsDraft.length === 0) {
      setTopicsError("Adicione pelo menos um tópico.");
      return;
    }

    setSavingTopics(true);
    const res = await saveApostilaProvaTopicsAction(topicsDialogApostila.id, topicsDraft);
    setSavingTopics(false);

    if (res.error) {
      setTopicsError(res.error);
      return;
    }

    const savedTopics = res.topics || topicsDraft;
    setApostilas(prev => prev.map(a => a.id === topicsDialogApostila.id ? { ...a, provaTopics: JSON.stringify(savedTopics) } : a));

    if (enableProvaAfterTopics) {
      await doToggleProvaStatus(topicsDialogApostila.id, false);
    }

    handleCloseTopicsDialog();
  };

  const handleDelete = async (id: string, title: string) => {
    if (!confirm(`Tem certeza de que deseja excluir permanentemente a apostila "${title}"?\nIsso também removerá o arquivo físico do servidor.`)) {
      return;
    }

    const res = await deleteApostila(id);
    if (res.error) {
      alert(res.error);
    } else if (res.success) {
      setApostilas(apostilas.filter(a => a.id !== id));
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      {/* Upload Column */}
      <div className="lg:col-span-1 space-y-6">
        <Card className="bg-card/40 border-border shadow-2xl relative overflow-hidden backdrop-blur-sm">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-600 to-indigo-500"></div>
          <CardHeader>
            <CardTitle className="text-lg font-black uppercase tracking-wider text-heading flex items-center gap-2">
              <FileUp className="w-5 h-5 text-blue-500" />
              Adicionar Material
            </CardTitle>
            <CardDescription className="text-muted-foreground">
              Suba novas apostilas em PDF para o acervo de estudos. Elas iniciarão automaticamente como Ativas.
            </CardDescription>
          </CardHeader>

          <CardContent>
            <form onSubmit={handleUpload} className="space-y-4">
              <div className="border-2 border-dashed border-border rounded-xl p-6 text-center hover:bg-card/20 hover:border-blue-500/30 transition-all bg-background/40 cursor-pointer">
                <Input 
                  type="file" 
                  accept="application/pdf"
                  multiple
                  onChange={(e) => {
                    const selected = e.target.files ? Array.from(e.target.files) : [];
                    setFiles(selected);
                  }}
                  className="hidden"
                  id="pdf-manager-upload"
                />
                <label htmlFor="pdf-manager-upload" className="cursor-pointer flex flex-col items-center">
                  <BookOpen className="w-8 h-8 text-blue-500 mb-2 animate-bounce" />
                  <span className="text-sm font-bold text-muted-foreground">
                    {files.length > 0 
                      ? `${files.length} arquivo(s) selecionado(s)` 
                      : "Clique para escolher o(s) PDF(s)"}
                  </span>
                  {files.length > 0 && (
                    <div className="mt-2 text-left w-full max-h-[120px] overflow-y-auto bg-background/50 p-2.5 rounded-lg border border-border space-y-1 text-xs text-muted-foreground font-medium">
                      {files.map((f, i) => (
                        <div key={i} className="truncate select-none">
                          • {f.name}
                        </div>
                      ))}
                    </div>
                  )}
                  <span className="text-[10px] text-muted-foreground mt-1.5 uppercase">Apenas arquivos .PDF (Múltiplos permitidos)</span>
                </label>
              </div>

              {errorMsg && (
                <div className="p-3 bg-red-950/40 border border-red-500/30 text-red-200 text-xs rounded-lg text-center font-bold">
                  {errorMsg}
                </div>
              )}

              {successMsg && (
                <div className="p-3 bg-emerald-950/40 border border-emerald-500/30 text-emerald-200 text-xs rounded-lg text-center font-bold flex items-center justify-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  {successMsg}
                </div>
              )}

              <Button 
                type="submit" 
                className="w-full h-12 bg-blue-600 hover:bg-blue-500 font-bold uppercase tracking-wider text-xs shadow-lg"
                disabled={uploading || files.length === 0}
              >
                {uploading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin text-heading" />
                    Enviando Material...
                  </>
                ) : (
                  "Salvar na Biblioteca"
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>

      {/* List Column */}
      <div className="lg:col-span-2 space-y-6">
        <Card className="bg-card/40 border-border shadow-2xl relative overflow-hidden backdrop-blur-sm">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 to-emerald-500"></div>
          <CardHeader className="pb-3 border-b border-border/50 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <CardTitle className="text-lg font-black uppercase tracking-wider text-heading flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-indigo-500" />
                Biblioteca de Apostilas ({apostilas.length})
              </CardTitle>
              <CardDescription className="text-muted-foreground">
                Materiais cadastrados na plataforma. Apostilas marcadas como **Ativas** receberão simulados diários gerados por IA para estudo autônomo dos alunos.
              </CardDescription>
            </div>
            {apostilas.some(a => a.isActive) && (
              <Button
                size="sm"
                onClick={handleGenerateAllDaily}
                disabled={generatingAll}
                className="bg-indigo-600 hover:bg-indigo-500 font-bold uppercase tracking-wider text-[10px] h-9 shrink-0 cursor-pointer text-heading"
              >
                {generatingAll ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                    Gerando Bateria...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5 mr-1.5" />
                    Regerar Todos Diários
                  </>
                )}
              </Button>
            )}
          </CardHeader>

          <CardContent className="p-0">
            {apostilas.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground uppercase tracking-widest text-sm font-bold">
                Nenhuma apostila na biblioteca.
              </div>
            ) : (
              <div className="divide-y divide-border">
                {apostilas.map((apo) => (
                  <div 
                    key={apo.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between p-5 gap-4 hover:bg-card/10 transition-colors"
                  >
                    <div className="min-w-0 flex-1 flex gap-3.5 items-start">
                      <div className={`p-2.5 rounded-lg border shrink-0 ${
                        apo.isActive 
                          ? "bg-blue-950/20 border-blue-500/20 text-blue-400"
                          : "bg-background border-border text-muted-foreground"
                      }`}>
                        <FileText className="w-6 h-6" />
                      </div>
                      <div className="min-w-0">
                        <h4 className={`text-base font-bold break-words ${apo.isActive ? "text-heading" : "text-muted-foreground line-through"}`} title={apo.title}>
                          {formatApostilaTitle(apo.title)}
                        </h4>
                        
                        <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1 text-xs text-muted-foreground font-medium">
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
                            {new Date(apo.createdAt).toLocaleDateString()}
                          </span>
                          <span className="flex items-center gap-1.5">
                            <span className={`w-1.5 h-1.5 rounded-full ${apo.isActive ? "bg-emerald-500 animate-pulse" : "bg-muted"}`}></span>
                            {apo.isActive ? "Participa dos simulados diários" : "Inativa"}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0 self-end sm:self-auto">
                      {/* Gerar Simulado Diário da Apostila */}
                      {apo.isActive && (
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={generatingId === apo.id}
                          onClick={() => handleGenerateSingleDaily(apo.id, apo.title)}
                          className="h-10 px-3 font-bold text-xs uppercase tracking-wider border border-border bg-card hover:bg-muted text-indigo-400 hover:text-indigo-300 rounded-lg transition-all cursor-pointer"
                          title="Forçar geração imediata de simulado diário para esta apostila"
                        >
                          {generatingId === apo.id ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-400" />
                          ) : (
                            <>
                              <Sparkles className="w-3.5 h-3.5 mr-1" />
                              IA
                            </>
                          )}
                        </Button>
                      )}

                      {/* Gerar Vade Mecum da Apostila */}
                      {apo.isActive && (
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={generatingVadeMecumId === apo.id}
                          onClick={() => handleGenerateVadeMecum(apo.id, apo.title)}
                          className={`h-10 px-3 font-bold text-xs uppercase tracking-wider border transition-all cursor-pointer rounded-lg ${
                            apo.vadeMecum
                              ? "bg-blue-950/20 border-blue-500/30 text-blue-400 hover:bg-blue-950/40 hover:text-blue-300"
                              : "bg-background border-border text-muted-foreground hover:bg-card hover:text-heading"
                          }`}
                          title={apo.vadeMecum ? "Atualizar Vade Mecum (Resumo)" : "Gerar Vade Mecum com IA"}
                        >
                          {generatingVadeMecumId === apo.id ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-400" />
                          ) : (
                            <>
                              <FileText className="w-3.5 h-3.5 mr-1" />
                              {apo.vadeMecum ? "Vade Mecum ✓" : "Criar Vade"}
                            </>
                          )}
                        </Button>
                      )}

                      {/* Toggle Matéria de Prova */}
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={togglingProvaId === apo.id}
                        onClick={() => handleToggleProvaStatus(apo)}
                        className={`h-10 px-3 font-bold text-xs uppercase tracking-wider border rounded-lg transition-all cursor-pointer ${
                          apo.isProvaSubject
                            ? "bg-amber-950/20 border-amber-500/30 text-amber-400 hover:bg-amber-950/40 hover:text-amber-300"
                            : "bg-background border-border text-muted-foreground hover:bg-card hover:text-heading"
                        }`}
                        title={apo.isProvaSubject ? "Matéria de prova: os alunos veem um Bloco de Provas no painel" : "Marcar como matéria de prova"}
                      >
                        {togglingProvaId === apo.id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-400" />
                        ) : (
                          <>
                            <GraduationCap className="w-3.5 h-3.5 mr-1.5" />
                            {apo.isProvaSubject ? "Matéria de Prova" : "Marcar p/ Prova"}
                          </>
                        )}
                      </Button>

                      {/* Editar Tópicos (só quando já é matéria de prova) */}
                      {apo.isProvaSubject && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleOpenTopicsDialog(apo, false)}
                          className="h-10 px-3 font-bold text-xs uppercase tracking-wider border border-border bg-background text-muted-foreground hover:bg-card hover:text-heading rounded-lg transition-all cursor-pointer"
                          title="Editar a lista de tópicos usada pra classificar as questões desta matéria"
                        >
                          <ListTree className="w-3.5 h-3.5 mr-1.5" />
                          Tópicos
                        </Button>
                      )}

                      {/* Toggle Button */}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleToggleStatus(apo.id, apo.isActive)}
                        className={`h-10 px-3 font-bold text-xs uppercase tracking-wider border rounded-lg transition-all ${
                          apo.isActive
                            ? "bg-emerald-950/20 border-emerald-500/30 text-emerald-400 hover:bg-emerald-950/40 hover:text-emerald-300"
                            : "bg-background border-border text-muted-foreground hover:bg-card hover:text-heading"
                        }`}
                      >
                        {apo.isActive ? (
                          <>
                            <Power className="w-3.5 h-3.5 mr-1.5 text-emerald-400 animate-pulse" />
                            Ativa
                          </>
                        ) : (
                          <>
                            <PowerOff className="w-3.5 h-3.5 mr-1.5 text-muted-foreground" />
                            Inativa
                          </>
                        )}
                      </Button>

                      {/* Delete Button */}
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(apo.id, apo.title)}
                        className="h-10 w-10 text-muted-foreground hover:text-red-400 hover:bg-red-950/30 border border-transparent hover:border-red-900/30 rounded-lg transition-colors"
                        title="Excluir apostila"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Dialog de Extração/Revisão de Tópicos (Bloco de Provas) */}
      <Dialog open={!!topicsDialogApostila} onOpenChange={(open) => { if (!open) handleCloseTopicsDialog(); }}>
        <DialogContent className="bg-background border-border text-foreground sm:max-w-lg max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="text-heading flex items-center gap-2">
              <ListTree className="w-5 h-5 text-amber-500" />
              Tópicos de {topicsDialogApostila ? formatApostilaTitle(topicsDialogApostila.title) : ""}
            </DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Essa lista é usada pela IA pra classificar cada questão gerada, alimentando o filtro por tópico no Bloco de Provas. Revise antes de confirmar — edite, remova ou adicione o que faltar.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto custom-scrollbar py-2 space-y-4">
            {extractingTopics ? (
              <div className="py-10 flex flex-col items-center justify-center gap-3 text-muted-foreground">
                <Loader2 className="w-6 h-6 animate-spin text-amber-500" />
                <span className="text-xs font-bold uppercase tracking-wider">Lendo a apostila e sugerindo tópicos...</span>
              </div>
            ) : (
              <>
                {topicsError && (
                  <div className="p-3 bg-red-950/40 border border-red-500/30 text-red-200 text-xs rounded-lg font-bold">
                    {topicsError}
                  </div>
                )}

                {topicsDraft.length === 0 && !topicsError && (
                  <div className="py-6 text-center text-muted-foreground text-xs font-bold uppercase tracking-wider">
                    Nenhum tópico ainda. Extraia com a IA ou adicione manualmente abaixo.
                  </div>
                )}

                <div className="space-y-2">
                  {topicsDraft.map((topic) => (
                    <div key={topic} className="flex items-center justify-between gap-2 bg-card/40 border border-border rounded-lg px-3 py-2">
                      <span className="text-sm text-foreground break-words">{topic}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveTopic(topic)}
                        className="shrink-0 text-muted-foreground hover:text-red-400 transition-colors cursor-pointer"
                        title="Remover tópico"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>

                <div className="flex gap-2">
                  <Input
                    type="text"
                    placeholder="Adicionar tópico manualmente"
                    value={newTopicInput}
                    onChange={(e) => setNewTopicInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleAddTopic(); } }}
                    className="bg-background border-border text-heading h-10"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleAddTopic}
                    disabled={!newTopicInput.trim()}
                    className="h-10 px-3 border-border shrink-0"
                  >
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>

                {topicsDialogApostila && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => handleExtractTopics(topicsDialogApostila.id)}
                    className="w-full h-10 border-border text-muted-foreground hover:text-heading"
                  >
                    <RefreshCw className="w-3.5 h-3.5 mr-2" />
                    Reextrair sugestão da IA (substitui a lista atual)
                  </Button>
                )}
              </>
            )}
          </div>

          <div className="pt-3 border-t border-border flex gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={handleCloseTopicsDialog}
              className="flex-1 h-11 border-border"
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={handleSaveTopics}
              disabled={savingTopics || extractingTopics || topicsDraft.length === 0}
              className="flex-1 h-11 bg-amber-600 hover:bg-amber-500 font-bold uppercase tracking-wider text-xs"
            >
              {savingTopics ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : enableProvaAfterTopics ? (
                "Confirmar e Ativar Matéria de Prova"
              ) : (
                "Salvar Tópicos"
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
