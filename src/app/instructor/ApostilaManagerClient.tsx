"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BookOpen, FileUp, Loader2, Power, PowerOff, Trash2, Calendar, FileText, CheckCircle2, Sparkles } from "lucide-react";
import { toggleApostilaStatus, deleteApostila } from "@/app/actions/apostila";
import { forceGenerateDailySimuladoForApostila, forceGenerateAllDailySimuladosAction } from "@/app/actions/dailySimulado";

interface Apostila {
  id: string;
  title: string;
  filePath: string;
  isActive: boolean;
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

  const handleGenerateSingleDaily = async (id: string, title: string) => {
    if (!confirm(`Deseja gerar/regerar um simulado diário de 25 questões para a apostila "${title}"?`)) {
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
    if (!confirm("Deseja regerar todos os simulados diários das apostilas ativas? Isso excluirá os simulados diários gerados hoje e gerará novos.")) {
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
        <Card className="bg-slate-900/40 border-slate-800 shadow-2xl relative overflow-hidden backdrop-blur-sm">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-600 to-indigo-500"></div>
          <CardHeader>
            <CardTitle className="text-lg font-black uppercase tracking-wider text-white flex items-center gap-2">
              <FileUp className="w-5 h-5 text-blue-500" />
              Adicionar Material
            </CardTitle>
            <CardDescription className="text-slate-400">
              Suba novas apostilas em PDF para o acervo de estudos. Elas iniciarão automaticamente como Ativas.
            </CardDescription>
          </CardHeader>

          <CardContent>
            <form onSubmit={handleUpload} className="space-y-4">
              <div className="border-2 border-dashed border-slate-800 rounded-xl p-6 text-center hover:bg-slate-900/20 hover:border-blue-500/30 transition-all bg-slate-950/40 cursor-pointer">
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
                  <span className="text-sm font-bold text-slate-300">
                    {files.length > 0 
                      ? `${files.length} arquivo(s) selecionado(s)` 
                      : "Clique para escolher o(s) PDF(s)"}
                  </span>
                  {files.length > 0 && (
                    <div className="mt-2 text-left w-full max-h-[120px] overflow-y-auto bg-slate-950/50 p-2.5 rounded-lg border border-slate-800 space-y-1 text-xs text-slate-400 font-medium">
                      {files.map((f, i) => (
                        <div key={i} className="truncate select-none">
                          • {f.name}
                        </div>
                      ))}
                    </div>
                  )}
                  <span className="text-[10px] text-slate-500 mt-1.5 uppercase">Apenas arquivos .PDF (Múltiplos permitidos)</span>
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
                    <Loader2 className="w-4 h-4 mr-2 animate-spin text-white" />
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
        <Card className="bg-slate-900/40 border-slate-800 shadow-2xl relative overflow-hidden backdrop-blur-sm">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 to-emerald-500"></div>
          <CardHeader className="pb-3 border-b border-slate-800/50 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <CardTitle className="text-lg font-black uppercase tracking-wider text-white flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-indigo-500" />
                Biblioteca de Apostilas ({apostilas.length})
              </CardTitle>
              <CardDescription className="text-slate-400">
                Materiais cadastrados na plataforma. Apostilas marcadas como **Ativas** receberão simulados diários gerados por IA para estudo autônomo dos alunos.
              </CardDescription>
            </div>
            {apostilas.some(a => a.isActive) && (
              <Button
                size="sm"
                onClick={handleGenerateAllDaily}
                disabled={generatingAll}
                className="bg-indigo-600 hover:bg-indigo-500 font-bold uppercase tracking-wider text-[10px] h-9 shrink-0 cursor-pointer text-white"
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
              <div className="p-8 text-center text-slate-500 uppercase tracking-widest text-sm font-bold">
                Nenhuma apostila na biblioteca.
              </div>
            ) : (
              <div className="divide-y divide-slate-800/60">
                {apostilas.map((apo) => (
                  <div 
                    key={apo.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between p-5 gap-4 hover:bg-slate-900/10 transition-colors"
                  >
                    <div className="min-w-0 flex-1 flex gap-3.5 items-start">
                      <div className={`p-2.5 rounded-lg border shrink-0 ${
                        apo.isActive 
                          ? "bg-blue-950/20 border-blue-500/20 text-blue-400"
                          : "bg-slate-950 border-slate-800 text-slate-500"
                      }`}>
                        <FileText className="w-6 h-6" />
                      </div>
                      
                      <div className="min-w-0">
                        <h4 className={`text-base font-bold truncate ${apo.isActive ? "text-white" : "text-slate-400 line-through"}`}>
                          {apo.title}
                        </h4>
                        
                        <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1 text-xs text-slate-500 font-medium">
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3.5 h-3.5 text-slate-600" />
                            {new Date(apo.createdAt).toLocaleDateString()}
                          </span>
                          <span className="flex items-center gap-1.5">
                            <span className={`w-1.5 h-1.5 rounded-full ${apo.isActive ? "bg-emerald-500 animate-pulse" : "bg-slate-600"}`}></span>
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
                          className="h-10 px-3 font-bold text-xs uppercase tracking-wider border border-slate-800 bg-slate-900 hover:bg-slate-800 text-indigo-400 hover:text-indigo-300 rounded-lg transition-all cursor-pointer"
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

                      {/* Toggle Button */}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleToggleStatus(apo.id, apo.isActive)}
                        className={`h-10 px-3 font-bold text-xs uppercase tracking-wider border rounded-lg transition-all ${
                          apo.isActive
                            ? "bg-emerald-950/20 border-emerald-500/30 text-emerald-400 hover:bg-emerald-950/40 hover:text-emerald-300"
                            : "bg-slate-950 border-slate-800 text-slate-400 hover:bg-slate-900 hover:text-white"
                        }`}
                      >
                        {apo.isActive ? (
                          <>
                            <Power className="w-3.5 h-3.5 mr-1.5 text-emerald-400 animate-pulse" />
                            Ativa
                          </>
                        ) : (
                          <>
                            <PowerOff className="w-3.5 h-3.5 mr-1.5 text-slate-500" />
                            Inativa
                          </>
                        )}
                      </Button>

                      {/* Delete Button */}
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(apo.id, apo.title)}
                        className="h-10 w-10 text-slate-500 hover:text-red-400 hover:bg-red-950/30 border border-transparent hover:border-red-900/30 rounded-lg transition-colors"
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
    </div>
  );
}
