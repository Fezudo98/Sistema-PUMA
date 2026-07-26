"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useRouter } from "next/navigation";
import { FileUp, Loader2, Settings, ArrowLeft, BookOpen, Save } from "lucide-react";
import Link from "next/link";
import { formatApostilaTitle } from "@/lib/utils";

interface Apostila {
  id: string;
  title: string;
  createdAt: string;
}

export default function NovoSimulado() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  
  // Apostilas State
  const [apostilas, setApostilas] = useState<Apostila[]>([]);
  const [selectedApostilaId, setSelectedApostilaId] = useState<string>("upload");
  const [file, setFile] = useState<File | null>(null);
  const [saveApostila, setSaveApostila] = useState(true);

  // Settings State
  const [qtd, setQtd] = useState("5");
  const [dificuldade, setDificuldade] = useState("AVANCADO");
  const [tempo, setTempo] = useState("60");
  const [isRaffleMode, setIsRaffleMode] = useState(false);
  const [topics, setTopics] = useState("");

  // Team Competition State
  const [isTeamCompetition, setIsTeamCompetition] = useState(false);
  const [teamCount, setTeamCount] = useState(2);
  const [teamNames, setTeamNames] = useState<string[]>(["Equipe Alpha", "Equipe Bravo"]);

  const handleTeamCountChange = (count: number) => {
    setTeamCount(count);
    const defaultNames = ["Equipe Alpha", "Equipe Bravo", "Equipe Charlie", "Equipe Delta", "Equipe Echo", "Equipe Foxtrot", "Equipe Golf", "Equipe Hotel"];
    const newNames = teamNames.map((name, idx) => {
      if (name === `Equipe ${idx + 1}` && defaultNames[idx]) {
        return defaultNames[idx];
      }
      return name;
    });
    while (newNames.length < count) {
      newNames.push(defaultNames[newNames.length] || `Equipe ${newNames.length + 1}`);
    }
    setTeamNames(newNames.slice(0, count));
  };

  useEffect(() => {
    fetch("/api/apostilas")
      .then(res => res.json())
      .then(data => {
        if (data.apostilas) {
          setApostilas(data.apostilas);
        }
      })
      .catch(console.error);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedApostilaId === "upload" && !file) return alert("Selecione um arquivo PDF.");

    setLoading(true);
    try {
      const formData = new FormData();
      let nameOfApostila = "";
      
      if (selectedApostilaId === "upload") {
        formData.append("pdf", file as File);
        nameOfApostila = file ? file.name : "Upload";
        
        // Se for um novo arquivo e marcou para salvar
        if (saveApostila) {
          try {
            const uploadData = new FormData();
            uploadData.append("pdf", file as File);
            await fetch("/api/apostilas", { method: "POST", body: uploadData });
          } catch (err) {
            console.error("Erro ao salvar apostila:", err);
          }
        }
      } else {
        formData.append("apostilaId", selectedApostilaId);
        const apoObj = apostilas.find(a => a.id === selectedApostilaId);
        nameOfApostila = apoObj ? apoObj.title : "Apostila";
      }

      formData.append("qtd", qtd);
      formData.append("dificuldade", dificuldade);
      formData.append("tempo", tempo);
      formData.append("topics", topics);

      const response = await fetch("/api/generate", {
        method: "POST",
        body: formData
      });

      let data;
      try {
        data = await response.json();
      } catch (e) {
        throw new Error(`Erro do servidor (${response.status}): o processamento demorou muito ou retornou resposta inválida.`);
      }
      
      if (!response.ok) {
        throw new Error(data?.error || "Erro ao gerar questões.");
      }

      localStorage.setItem("generated_questions", JSON.stringify(data.questions));
      localStorage.setItem("simulado_config", JSON.stringify({ 
        tempo: parseInt(tempo), 
        isRaffleMode, 
        dificuldade, 
        apostilaName: nameOfApostila, 
        topics,
        isTeamCompetition,
        teamNames: isTeamCompetition ? teamNames.slice(0, teamCount) : undefined
      }));
      
      router.push("/instructor/simulado/review");
    } catch (err: any) {
      setLoading(false);
      alert("Erro ao gerar questões: " + (err.message || "Falha desconhecida."));
    }
  };
  return (
    <div className="min-h-screen bg-background text-foreground p-8">
      <div className="max-w-3xl mx-auto">
        <Link href="/instructor">
          <Button variant="ghost" className="mb-6 text-muted-foreground hover:text-heading hover:bg-card/50 font-bold">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Voltar ao Painel
          </Button>
        </Link>

        <Card className="bg-card/40 border-border shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-600 to-emerald-500"></div>
          <CardHeader className="border-b border-border bg-card/80 p-6">
            <CardTitle className="text-2xl font-black text-heading uppercase tracking-widest flex items-center gap-2 drop-shadow-[0_0_10px_rgba(59,130,246,0.3)]">
              <FileUp className="w-6 h-6 text-blue-500 animate-pulse" />
              Novo Simulado (IA)
            </CardTitle>
            <CardDescription className="text-muted-foreground font-medium">
              Escolha uma apostila salva ou faça upload de um novo PDF para gerar as questões.
            </CardDescription>
          </CardHeader>

          <CardContent className="p-8">
            <form onSubmit={handleSubmit} className="space-y-8">
              
              {/* Material Source Selection */}
              <div className="space-y-3">
                <label className="text-xs font-black text-muted-foreground uppercase tracking-widest flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-blue-500" />
                  Fonte do Material Base
                </label>
                
                <Select value={selectedApostilaId} onValueChange={(v) => setSelectedApostilaId(v || "")}>
                  <SelectTrigger className="h-12 text-base bg-background border-border text-heading focus-visible:ring-blue-500">
                    <SelectValue placeholder="Selecione a origem do PDF" />
                  </SelectTrigger>
                  <SelectContent className="bg-background border-border text-foreground">
                    <SelectItem value="upload" className="font-bold text-blue-500 focus:bg-blue-950/40 focus:text-blue-400">
                      + Fazer Upload de Novo Arquivo PDF
                    </SelectItem>
                    {apostilas.map(apo => (
                      <SelectItem key={apo.id} value={apo.id} className="focus:bg-muted focus:text-heading">
                        {formatApostilaTitle(apo.title)} (Salvo em {new Date(apo.createdAt).toLocaleDateString()})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* PDF Upload Area - Only visible if "upload" is selected */}
              {selectedApostilaId === "upload" && (
                <div className="space-y-3 bg-background/40 p-6 rounded-xl border border-border">
                  <label className="text-xs font-black text-muted-foreground uppercase tracking-widest">
                    Arquivo PDF
                  </label>
                  <div className="border-2 border-dashed border-border rounded-xl p-8 text-center hover:bg-card/40 hover:border-blue-500/50 transition-all bg-background/60 cursor-pointer">
                    <Input 
                      type="file" 
                      accept="application/pdf"
                      onChange={(e) => setFile(e.target.files?.[0] || null)}
                      className="hidden"
                      id="pdf-upload"
                    />
                    <label htmlFor="pdf-upload" className="cursor-pointer flex flex-col items-center">
                      <FileUp className="w-10 h-10 text-blue-500 mb-3 animate-bounce" />
                      <span className="text-base font-bold text-muted-foreground">
                        {file ? file.name : "Clique para selecionar ou arraste o PDF aqui"}
                      </span>
                    </label>
                  </div>
                  
                  <div className="flex items-center gap-2 pt-2">
                    <input 
                      type="checkbox" 
                      id="save-apostila" 
                      checked={saveApostila} 
                      onChange={e => setSaveApostila(e.target.checked)} 
                      className="w-4 h-4 text-blue-600 bg-background border-border rounded focus:ring-blue-500"
                    />
                    <label htmlFor="save-apostila" className="text-xs font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-1.5 cursor-pointer">
                      <Save className="w-4 h-4 text-muted-foreground" />
                      Salvar este PDF na biblioteca de Apostilas para uso futuro
                    </label>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Quantidade */}
                <div className="space-y-2">
                  <label className="text-xs font-black text-muted-foreground uppercase tracking-widest">Qtd. de Questões</label>
                  <Input 
                    type="number"
                    min="1"
                    max="100"
                    value={qtd}
                    onChange={(e) => setQtd(e.target.value)}
                    className="h-12 text-base bg-background border-border text-heading focus-visible:ring-blue-500 font-mono font-bold"
                    placeholder="Ex: 5"
                  />
                </div>

                {/* Tempo */}
                <div className="space-y-2">
                  <label className="text-xs font-black text-muted-foreground uppercase tracking-widest">Tempo/Questão (Segundos)</label>
                  <Input 
                    type="number"
                    min="5"
                    max="600"
                    value={tempo}
                    onChange={(e) => setTempo(e.target.value)}
                    className="h-12 text-base bg-background border-border text-heading focus-visible:ring-blue-500 font-mono font-bold"
                    placeholder="Ex: 60"
                  />
                </div>
              </div>

              {/* Tópicos Específicos */}
              <div className="space-y-3 bg-background/40 p-6 rounded-xl border border-border">
                <label className="text-xs font-black text-muted-foreground uppercase tracking-widest flex items-center gap-2">
                  Tópicos Específicos (Opcional)
                </label>
                <Input
                  type="text"
                  placeholder="Ex: Tópico 1 ao 4, Tópico 2, ou Tópico 1, 3 e 5"
                  value={topics}
                  onChange={(e) => setTopics(e.target.value)}
                  className="bg-background border-border text-heading focus-visible:ring-blue-500 h-12 text-base shadow-sm placeholder:text-muted-foreground"
                />
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest leading-relaxed">
                  Especifique tópicos ou seções do material para filtrar a geração das questões (ex: <em className="text-blue-500">"Tópico 1 ao 4"</em>, <em className="text-blue-500">"Capítulo 3"</em>). Deixe em branco para considerar todo o PDF.
                </p>
              </div>

              <div className="bg-background/40 p-5 rounded-xl border border-border">
                <label className="text-xs font-black text-muted-foreground uppercase tracking-widest flex items-center gap-2.5 cursor-pointer hover:text-heading transition-colors">
                  <input 
                    type="checkbox" 
                    checked={isRaffleMode} 
                    onChange={e => setIsRaffleMode(e.target.checked)} 
                    className="w-5 h-5 rounded border-border bg-background text-blue-600 focus:ring-blue-500 cursor-pointer" 
                  />
                  Modo Sorteio (Roleta Tática) 🎲
                </label>
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mt-2 ml-7.5">
                  Se ativado, todas as questões desse simulado sortearão automaticamente um aluno para responder.
                </p>
              </div>

              {/* Modo Competição em Equipes */}
              <div className="bg-background/40 p-5 rounded-xl border border-border space-y-4">
                <label className="text-xs font-black text-muted-foreground uppercase tracking-widest flex items-center gap-2.5 cursor-pointer hover:text-heading transition-colors">
                  <input 
                    type="checkbox" 
                    checked={isTeamCompetition} 
                    onChange={e => setIsTeamCompetition(e.target.checked)} 
                    className="w-5 h-5 rounded border-border bg-background text-emerald-600 focus:ring-emerald-500 cursor-pointer" 
                  />
                  Modo Competição em Equipes 🛡️
                </label>
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest ml-7.5">
                  Se ativado, os alunos que entrarem na sala serão distribuídos aleatória e proporcionalmente em equipes para disputar o ranking coletivo.
                </p>

                {isTeamCompetition && (
                  <div className="pt-3 border-t border-border/80 space-y-4 ml-7.5 animate-in fade-in slide-in-from-top-2">
                    <div className="space-y-2">
                      <label className="text-xs font-black text-muted-foreground uppercase tracking-widest">Quantidade de Equipes</label>
                      <Select value={teamCount.toString()} onValueChange={(v) => handleTeamCountChange(parseInt(v || "2"))}>
                        <SelectTrigger className="h-11 bg-background border-border text-heading font-bold w-full md:w-48">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-background border-border text-foreground">
                          {[2, 3, 4, 5, 6, 8].map(num => (
                            <SelectItem key={num} value={num.toString()} className="font-bold">
                              {num} Equipes
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-3">
                      <label className="text-xs font-black text-muted-foreground uppercase tracking-widest">Nomes das Equipes</label>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {Array.from({ length: teamCount }).map((_, idx) => (
                          <div key={idx} className="space-y-1">
                            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Equipe {idx + 1}</span>
                            <Input
                              type="text"
                              value={teamNames[idx] || ""}
                              onChange={(e) => {
                                const copy = [...teamNames];
                                copy[idx] = e.target.value;
                                setTeamNames(copy);
                              }}
                              placeholder={`Ex: Equipe ${idx + 1}`}
                              className="bg-background border-border text-heading font-bold h-10"
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="pt-4 border-t border-border/80">
                <Button 
                  type="submit" 
                  className="w-full h-14 text-base font-bold bg-blue-600 hover:bg-blue-500 shadow-lg uppercase tracking-widest disabled:opacity-50 cursor-pointer"
                  disabled={loading || (selectedApostilaId === "upload" && !file)}
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-5 h-5 mr-2 animate-spin text-heading" />
                      Analisando Material e Gerando Questões...
                    </>
                  ) : (
                    <>
                      <Settings className="w-5 h-5 mr-2 text-heading" />
                      Processar e Gerar Questões
                    </>
                  )}
                </Button>
                <p className="text-center text-[10px] font-bold text-muted-foreground uppercase tracking-widest mt-4">
                  O tempo de processamento varia conforme o tamanho do Material (aprox. 10 a 30 segundos).
                </p>
              </div>

            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
