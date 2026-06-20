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
  const [dificuldade, setDificuldade] = useState("MEDIO");
  const [tempo, setTempo] = useState("60");
  const [isRaffleMode, setIsRaffleMode] = useState(false);

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
    
    if (selectedApostilaId === "upload") {
      formData.append("pdf", file as File);
      
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
    }

    formData.append("qtd", qtd);
    formData.append("dificuldade", dificuldade);
    formData.append("tempo", tempo);

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
      localStorage.setItem("simulado_config", JSON.stringify({ tempo: parseInt(tempo), isRaffleMode, dificuldade }));
      
      router.push("/instructor/simulado/review");
      
    } catch (err: any) {
      alert("Erro: " + err.message);
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 p-8">
      <div className="max-w-3xl mx-auto">
        <Link href="/instructor">
          <Button variant="ghost" className="mb-6 text-slate-500 hover:text-slate-800">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Voltar ao Painel
          </Button>
        </Link>

        <Card className="border-slate-200 shadow-xl bg-white">
          <CardHeader className="bg-blue-600 text-white rounded-t-xl">
            <CardTitle className="text-2xl flex items-center gap-2">
              <FileUp className="w-6 h-6" />
              Novo Simulado (IA)
            </CardTitle>
            <CardDescription className="text-blue-100">
              Escolha uma apostila salva ou faça upload de um novo PDF para gerar as questões.
            </CardDescription>
          </CardHeader>

          <CardContent className="p-8">
            <form onSubmit={handleSubmit} className="space-y-8">
              
              {/* Material Source Selection */}
              <div className="space-y-3">
                <label className="text-sm font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-blue-500" />
                  Fonte do Material Base
                </label>
                
                <Select value={selectedApostilaId} onValueChange={(v) => setSelectedApostilaId(v || "")}>
                  <SelectTrigger className="h-12 text-lg">
                    <SelectValue placeholder="Selecione a origem do PDF" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="upload" className="font-bold text-blue-600">
                      + Fazer Upload de Novo Arquivo PDF
                    </SelectItem>
                    {apostilas.map(apo => (
                      <SelectItem key={apo.id} value={apo.id}>
                        {apo.title} (Salvo em {new Date(apo.createdAt).toLocaleDateString()})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* PDF Upload Area - Only visible if "upload" is selected */}
              {selectedApostilaId === "upload" && (
                <div className="space-y-3 bg-slate-50 p-6 rounded-lg border border-slate-200">
                  <label className="text-sm font-bold text-slate-700 uppercase tracking-wider">
                    Arquivo PDF
                  </label>
                  <div className="border-2 border-dashed border-blue-300 rounded-lg p-8 text-center hover:bg-blue-50 transition-colors bg-white">
                    <Input 
                      type="file" 
                      accept="application/pdf"
                      onChange={(e) => setFile(e.target.files?.[0] || null)}
                      className="hidden"
                      id="pdf-upload"
                    />
                    <label htmlFor="pdf-upload" className="cursor-pointer flex flex-col items-center">
                      <FileUp className="w-10 h-10 text-blue-500 mb-3" />
                      <span className="text-base font-medium text-slate-700">
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
                      className="w-4 h-4 text-blue-600 rounded border-slate-300"
                    />
                    <label htmlFor="save-apostila" className="text-sm text-slate-600 flex items-center gap-1 cursor-pointer">
                      <Save className="w-4 h-4" />
                      Salvar este PDF na biblioteca de Apostilas para uso futuro
                    </label>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Quantidade */}
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700">Qtd. de Questões</label>
                  <Select value={qtd} onValueChange={(v) => setQtd(v || "")}>
                    <SelectTrigger className="h-12 text-lg">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
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
                  <label className="text-sm font-bold text-slate-700">Dificuldade</label>
                  <Select value={dificuldade} onValueChange={(v) => setDificuldade(v || "")}>
                    <SelectTrigger className="h-12 text-lg">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="FACIL">Fácil</SelectItem>
                      <SelectItem value="MEDIO">Médio</SelectItem>
                      <SelectItem value="DIFICIL">Difícil</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Tempo */}
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700">Tempo/Questão</label>
                  <Select value={tempo} onValueChange={(v) => setTempo(v || "")}>
                    <SelectTrigger className="h-12 text-lg">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
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

              <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                <label className="text-sm font-bold text-slate-700 flex items-center gap-2 cursor-pointer">
                  <input 
                    type="checkbox" 
                    checked={isRaffleMode} 
                    onChange={e => setIsRaffleMode(e.target.checked)} 
                    className="w-5 h-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500" 
                  />
                  Modo Sorteio (Roleta Tática) 🎲
                </label>
                <p className="text-xs text-slate-500 mt-1 ml-7">
                  Se ativado, todas as questões desse simulado sortearão automaticamente um aluno para responder.
                </p>
              </div>

              <div className="pt-4 border-t border-slate-100">
                <Button 
                  type="submit" 
                  className="w-full h-14 text-lg font-bold bg-blue-600 hover:bg-blue-700 shadow-lg"
                  disabled={loading || (selectedApostilaId === "upload" && !file)}
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                      Analisando Material e Gerando Questões...
                    </>
                  ) : (
                    <>
                      <Settings className="w-5 h-5 mr-2" />
                      Processar e Gerar Questões
                    </>
                  )}
                </Button>
                <p className="text-center text-xs text-slate-500 mt-4">
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
