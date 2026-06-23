"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useRouter } from "next/navigation";
import { FileUp, Loader2, Settings, ArrowLeft, BookOpen, Save } from "lucide-react";
import Link from "next/link";

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
  const [dificuldade, setDificuldade] = useState("INTERMEDIARIO");
  const [tempo, setTempo] = useState("60");
  const [isRaffleMode, setIsRaffleMode] = useState(false);
  const [topics, setTopics] = useState("");

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

    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        body: formData
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || "Erro ao gerar questões.");
      }

      localStorage.setItem("generated_questions", JSON.stringify(data.questions));
      localStorage.setItem("simulado_config", JSON.stringify({ 
        tempo: parseInt(tempo), 
        isRaffleMode, 
        dificuldade, 
        apostilaName: nameOfApostila, 
        topics 
      }));
      
      router.push("/instructor/simulado/review");
      
    } catch (err: any) {
      alert("Erro: " + err.message);
      setLoading(false);
    }
  };
  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 p-8">
      <div className="max-w-3xl mx-auto">
        <Link href="/instructor">
          <Button variant="ghost" className="mb-6 text-slate-400 hover:text-white hover:bg-slate-900/50 font-bold">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Voltar ao Painel
          </Button>
        </Link>

        <Card className="bg-slate-900/40 border-slate-800 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-600 to-emerald-500"></div>
          <CardHeader className="border-b border-slate-800 bg-slate-900/80 p-6">
            <CardTitle className="text-2xl font-black text-white uppercase tracking-widest flex items-center gap-2 drop-shadow-[0_0_10px_rgba(59,130,246,0.3)]">
              <FileUp className="w-6 h-6 text-blue-500 animate-pulse" />
              Novo Simulado (IA)
            </CardTitle>
            <CardDescription className="text-slate-400 font-medium">
              Escolha uma apostila salva ou faça upload de um novo PDF para gerar as questões.
            </CardDescription>
          </CardHeader>

          <CardContent className="p-8">
            <form onSubmit={handleSubmit} className="space-y-8">
              
              {/* Material Source Selection */}
              <div className="space-y-3">
                <label className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-blue-500" />
                  Fonte do Material Base
                </label>
                
                <Select value={selectedApostilaId} onValueChange={(v) => setSelectedApostilaId(v || "")}>
                  <SelectTrigger className="h-12 text-base bg-slate-950 border-slate-800 text-white focus-visible:ring-blue-500">
                    <SelectValue placeholder="Selecione a origem do PDF" />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-950 border-slate-800 text-slate-200">
                    <SelectItem value="upload" className="font-bold text-blue-500 focus:bg-blue-950/40 focus:text-blue-400">
                      + Fazer Upload de Novo Arquivo PDF
                    </SelectItem>
                    {apostilas.map(apo => (
                      <SelectItem key={apo.id} value={apo.id} className="focus:bg-slate-800 focus:text-white">
                        {apo.title} (Salvo em {new Date(apo.createdAt).toLocaleDateString()})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* PDF Upload Area - Only visible if "upload" is selected */}
              {selectedApostilaId === "upload" && (
                <div className="space-y-3 bg-slate-950/40 p-6 rounded-xl border border-slate-800">
                  <label className="text-xs font-black text-slate-400 uppercase tracking-widest">
                    Arquivo PDF
                  </label>
                  <div className="border-2 border-dashed border-slate-800 rounded-xl p-8 text-center hover:bg-slate-900/40 hover:border-blue-500/50 transition-all bg-slate-950/60 cursor-pointer">
                    <Input 
                      type="file" 
                      accept="application/pdf"
                      onChange={(e) => setFile(e.target.files?.[0] || null)}
                      className="hidden"
                      id="pdf-upload"
                    />
                    <label htmlFor="pdf-upload" className="cursor-pointer flex flex-col items-center">
                      <FileUp className="w-10 h-10 text-blue-500 mb-3 animate-bounce" />
                      <span className="text-base font-bold text-slate-300">
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
                      className="w-4 h-4 text-blue-600 bg-slate-950 border-slate-800 rounded focus:ring-blue-500"
                    />
                    <label htmlFor="save-apostila" className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5 cursor-pointer">
                      <Save className="w-4 h-4 text-slate-500" />
                      Salvar este PDF na biblioteca de Apostilas para uso futuro
                    </label>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Quantidade */}
                <div className="space-y-2">
                  <label className="text-xs font-black text-slate-400 uppercase tracking-widest">Qtd. de Questões</label>
                  <Select value={qtd} onValueChange={(v) => setQtd(v || "")}>
                    <SelectTrigger className="h-12 text-base bg-slate-950 border-slate-800 text-white focus-visible:ring-blue-500">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-950 border-slate-800 text-slate-200">
                      <SelectItem value="3">3 Questões</SelectItem>
                      <SelectItem value="5">5 Questões</SelectItem>
                      <SelectItem value="10">10 Questões</SelectItem>
                      <SelectItem value="15">15 Questões</SelectItem>
                      <SelectItem value="20">20 Questões</SelectItem>
                      <SelectItem value="25">25 Questões</SelectItem>
                      <SelectItem value="30">30 Questões</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Dificuldade */}
                <div className="space-y-2">
                  <label className="text-xs font-black text-slate-400 uppercase tracking-widest">Dificuldade</label>
                  <Select value={dificuldade} onValueChange={(v) => setDificuldade(v || "")}>
                    <SelectTrigger className="h-12 text-base bg-slate-950 border-slate-800 text-white focus-visible:ring-blue-500">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-950 border-slate-800 text-slate-200">
                      <SelectItem value="BASICO">Básico</SelectItem>
                      <SelectItem value="INTERMEDIARIO">Intermediário</SelectItem>
                      <SelectItem value="AVANCADO">Avançado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Tempo */}
                <div className="space-y-2">
                  <label className="text-xs font-black text-slate-400 uppercase tracking-widest">Tempo/Questão</label>
                  <Select value={tempo} onValueChange={(v) => setTempo(v || "")}>
                    <SelectTrigger className="h-12 text-base bg-slate-950 border-slate-800 text-white focus-visible:ring-blue-500">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-950 border-slate-800 text-slate-200">
                      <SelectItem value="15">15 Segundos</SelectItem>
                      <SelectItem value="30">30 Segundos</SelectItem>
                      <SelectItem value="45">45 Segundos</SelectItem>
                      <SelectItem value="60">60 Segundos</SelectItem>
                      <SelectItem value="90">90 Segundos</SelectItem>
                      <SelectItem value="120">2 Minutos (120s)</SelectItem>
                      <SelectItem value="180">3 Minutos (180s)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Tópicos Específicos */}
              <div className="space-y-3 bg-slate-950/40 p-6 rounded-xl border border-slate-800">
                <label className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                  Tópicos Específicos (Opcional)
                </label>
                <Input
                  type="text"
                  placeholder="Ex: Tópico 1 ao 4, Tópico 2, ou Tópico 1, 3 e 5"
                  value={topics}
                  onChange={(e) => setTopics(e.target.value)}
                  className="bg-slate-950 border-slate-800 text-white focus-visible:ring-blue-500 h-12 text-base shadow-sm placeholder:text-slate-700"
                />
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest leading-relaxed">
                  Especifique tópicos ou seções do material para filtrar a geração das questões (ex: <em className="text-blue-500">"Tópico 1 ao 4"</em>, <em className="text-blue-500">"Capítulo 3"</em>). Deixe em branco para considerar todo o PDF.
                </p>
              </div>

              <div className="bg-slate-950/40 p-5 rounded-xl border border-slate-800">
                <label className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2.5 cursor-pointer hover:text-white transition-colors">
                  <input 
                    type="checkbox" 
                    checked={isRaffleMode} 
                    onChange={e => setIsRaffleMode(e.target.checked)} 
                    className="w-5 h-5 rounded border-slate-800 bg-slate-950 text-blue-600 focus:ring-blue-500 cursor-pointer" 
                  />
                  Modo Sorteio (Roleta Tática) 🎲
                </label>
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-2 ml-7.5">
                  Se ativado, todas as questões desse simulado sortearão automaticamente um aluno para responder.
                </p>
              </div>

              <div className="pt-4 border-t border-slate-800/80">
                <Button 
                  type="submit" 
                  className="w-full h-14 text-base font-bold bg-blue-600 hover:bg-blue-500 shadow-lg uppercase tracking-widest disabled:opacity-50 cursor-pointer"
                  disabled={loading || (selectedApostilaId === "upload" && !file)}
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-5 h-5 mr-2 animate-spin text-white" />
                      Analisando Material e Gerando Questões...
                    </>
                  ) : (
                    <>
                      <Settings className="w-5 h-5 mr-2 text-white animate-spin" />
                      Processar e Gerar Questões
                    </>
                  )}
                </Button>
                <p className="text-center text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-4">
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
