"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  BookOpen, 
  ArrowLeft, 
  Copy, 
  Printer, 
  Search, 
  FileText, 
  Sparkles, 
  Check, 
  ChevronRight, 
  AlertTriangle 
} from "lucide-react";
import Link from "next/link";
import HeaderAvatar from "@/components/HeaderAvatar";
import { logout } from "@/app/actions/auth";

interface User {
  name: string;
  avatarUrl: string | null;
}

interface Apostila {
  id: string;
  title: string;
  vadeMecum?: string | null;
  createdAt: Date;
}

export default function VadeMecumClient({
  user,
  initialApostilas
}: {
  user: User;
  initialApostilas: Apostila[];
}) {
  const [apostilas] = useState<Apostila[]>(initialApostilas);
  const [selectedId, setSelectedId] = useState<string | null>(
    initialApostilas.length > 0 ? initialApostilas[0].id : null
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [copied, setCopied] = useState(false);

  const selectedApostila = apostilas.find((a) => a.id === selectedId);

  const handleCopy = () => {
    if (!selectedApostila?.vadeMecum) return;
    navigator.clipboard.writeText(selectedApostila.vadeMecum);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handlePrint = () => {
    window.print();
  };

  // Helper to parse inline bold and code tags
  const parseInline = (text: string) => {
    const parts = [];
    let currentIndex = 0;
    const regex = /(\*\*.*?\*\*|`.*?`)/g;
    let match;

    while ((match = regex.exec(text)) !== null) {
      const matchIndex = match.index;
      if (matchIndex > currentIndex) {
        parts.push(text.slice(currentIndex, matchIndex));
      }

      const matchText = match[0];
      if (matchText.startsWith("**") && matchText.endsWith("**")) {
        parts.push(
          <strong key={matchIndex} className="font-extrabold text-white">
            {matchText.slice(2, -2)}
          </strong>
        );
      } else if (matchText.startsWith("`") && matchText.endsWith("`")) {
        parts.push(
          <code key={matchIndex} className="bg-slate-950 px-1.5 py-0.5 rounded text-blue-400 font-mono text-xs border border-slate-800">
            {matchText.slice(1, -1)}
          </code>
        );
      }

      currentIndex = regex.lastIndex;
    }

    if (currentIndex < text.length) {
      parts.push(text.slice(currentIndex));
    }

    return parts.length > 0 ? parts : text;
  };

  // Lightweight custom markdown parser for booklet summaries
  const renderMarkdown = (text: string) => {
    if (!text) return null;
    
    // Filter lines based on search query (simple line matching or highlight logic)
    const lines = text.split("\n");
    return lines.map((line, i) => {
      // H2 Headers
      if (line.startsWith("## ")) {
        return (
          <h2 key={i} className="text-lg font-black text-blue-400 mt-6 mb-3 uppercase tracking-wider flex items-center border-b border-slate-800 pb-2">
            {line.replace("## ", "")}
          </h2>
        );
      }
      // H3 Headers
      if (line.startsWith("### ")) {
        return (
          <h3 key={i} className="text-sm font-bold text-white mt-4 mb-2 flex items-center">
            {line.replace("### ", "")}
          </h3>
        );
      }
      // Blockquote
      if (line.startsWith("> ")) {
        return (
          <blockquote key={i} className="border-l-4 border-slate-700 bg-slate-800/20 px-4 py-2.5 my-3 text-slate-300 italic rounded-r-lg">
            {parseInline(line.replace("> ", ""))}
          </blockquote>
        );
      }
      // Unordered lists
      if (line.trim().startsWith("- ") || line.trim().startsWith("* ")) {
        return (
          <li key={i} className="ml-6 list-disc text-slate-300 my-1 text-sm leading-relaxed">
            {parseInline(line.trim().replace(/^[\-\*]\s+/, ""))}
          </li>
        );
      }
      // Empty lines
      if (!line.trim()) {
        return <div key={i} className="h-2" />;
      }
      // Standard paragraphs
      return (
        <p key={i} className="text-slate-300 text-sm leading-relaxed my-1.5">
          {parseInline(line)}
        </p>
      );
    });
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* Printable Style Tag (forces print formatting on select elements) */}
      <style jsx global>{`
        @media print {
          body {
            background-color: white !important;
            color: black !important;
          }
          .no-print {
            display: none !important;
          }
          .print-content {
            width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            box-shadow: none !important;
            background: transparent !important;
            color: black !important;
          }
          h2 {
            color: #1e3a8a !important;
            border-bottom: 2px solid #ddd !important;
          }
          h3, strong {
            color: black !important;
          }
          p, li {
            color: #333 !important;
          }
        }
      `}</style>

      {/* Header (no-print) */}
      <header className="no-print bg-slate-900/60 border-b border-slate-800/80 px-6 py-4 flex items-center justify-between backdrop-blur-md sticky top-0 z-50">
        <div className="flex items-center gap-4">
          <Link href="/aluno/painel">
            <Button variant="ghost" size="icon" className="text-slate-400 hover:text-white border border-slate-800 bg-slate-950/40 hover:bg-slate-900 rounded-lg cursor-pointer">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-blue-500/15 border border-blue-400/30 text-blue-400">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-lg font-black uppercase tracking-wider text-white">Vade Mecum PUMA</h1>
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Resumo Temático & Doutrina de Estudos</p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <HeaderAvatar initials={user.name.substring(0, 2).toUpperCase()} avatarUrl={user.avatarUrl} />
          <form action={logout}>
            <Button type="submit" variant="ghost" className="text-slate-400 hover:text-red-400 text-xs font-bold uppercase tracking-wider border border-slate-800 bg-slate-950/40 hover:bg-red-950/20 rounded-lg h-10 px-3 cursor-pointer">
              Sair
            </Button>
          </form>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-6 grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Left Booklet List Sidebar (no-print) */}
        <section className="no-print lg:col-span-1 flex flex-col gap-4">
          <Card className="bg-slate-900/40 border-slate-800 shadow-xl relative overflow-hidden backdrop-blur-sm h-full flex flex-col">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-600 to-indigo-500"></div>
            <CardHeader className="pb-3 border-b border-slate-800/40">
              <CardTitle className="text-sm font-black uppercase tracking-wider text-white">Materiais Disponíveis</CardTitle>
              <CardDescription className="text-xs text-slate-400">Selecione uma apostila para carregar o resumo doutrinário.</CardDescription>
            </CardHeader>
            <CardContent className="p-2 flex-1 overflow-y-auto space-y-1">
              {apostilas.length === 0 ? (
                <div className="p-4 text-center text-xs text-slate-500 font-bold uppercase tracking-wider">
                  Nenhuma apostila ativa.
                </div>
              ) : (
                apostilas.map((apo) => (
                  <button
                    key={apo.id}
                    onClick={() => {
                      setSelectedId(apo.id);
                      setSearchQuery("");
                    }}
                    className={`w-full text-left p-3.5 rounded-xl border font-bold flex items-center justify-between transition-all group cursor-pointer ${
                      selectedId === apo.id
                        ? "bg-blue-600/10 border-blue-500/30 text-blue-300"
                        : "bg-slate-950/40 border-slate-900 hover:border-slate-800 text-slate-400 hover:text-slate-300 hover:bg-slate-900/30"
                    }`}
                  >
                    <div className="min-w-0 flex items-center gap-2.5">
                      <FileText className={`w-4 h-4 shrink-0 ${selectedId === apo.id ? "text-blue-400" : "text-slate-500 group-hover:text-slate-400"}`} />
                      <span className="text-xs truncate block pr-2">{apo.title}</span>
                    </div>
                    <ChevronRight className={`w-3.5 h-3.5 shrink-0 transition-transform ${selectedId === apo.id ? "translate-x-0.5 text-blue-400" : "text-slate-600 group-hover:text-slate-500"}`} />
                  </button>
                ))
              )}
            </CardContent>
          </Card>
        </section>

        {/* Right Content Area (print-content) */}
        <section className="print-content lg:col-span-3 flex flex-col gap-4">
          {selectedApostila ? (
            <Card className="bg-slate-900/40 border-slate-800 shadow-2xl relative overflow-hidden backdrop-blur-sm h-full flex flex-col">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-indigo-500"></div>
              
              {/* Controls bar (no-print) */}
              <div className="no-print p-4 border-b border-slate-800/40 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="relative flex-1 max-w-md">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <Input
                    type="text"
                    placeholder="Pesquisar termo neste resumo..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10 h-10 bg-slate-950 border-slate-850 focus:border-blue-500/50 rounded-xl text-xs placeholder:text-slate-600 text-white font-bold"
                  />
                </div>

                {selectedApostila.vadeMecum && (
                  <div className="flex items-center gap-2.5 shrink-0">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleCopy}
                      className="h-10 px-3 bg-slate-950 hover:bg-slate-900 border border-slate-800 text-xs text-slate-300 hover:text-white rounded-xl font-bold flex items-center gap-1.5 cursor-pointer"
                    >
                      {copied ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                          Copiado
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          Copiar Texto
                        </>
                      )}
                    </Button>

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handlePrint}
                      className="h-10 px-3 bg-slate-950 hover:bg-slate-900 border border-slate-800 text-xs text-slate-300 hover:text-white rounded-xl font-bold flex items-center gap-1.5 cursor-pointer"
                    >
                      <Printer className="w-3.5 h-3.5" />
                      Imprimir / PDF
                    </Button>
                  </div>
                )}
              </div>

              {/* Title Section (printed nicely) */}
              <div className="p-6 border-b border-slate-800/40 bg-slate-950/10">
                <div className="text-[10px] text-blue-500 font-black tracking-widest uppercase mb-1">VADE MECUM DO ALUNO</div>
                <h2 className="text-xl font-black text-white">{selectedApostila.title}</h2>
              </div>

              {/* Markdown Content Area */}
              <CardContent className="flex-1 overflow-y-auto p-6 md:p-8 font-medium">
                {selectedApostila.vadeMecum ? (
                  <div className="prose prose-invert max-w-none">
                    {renderMarkdown(selectedApostila.vadeMecum)}
                  </div>
                ) : (
                  <div className="no-print h-full flex flex-col items-center justify-center text-center p-8">
                    <div className="p-4 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-500 mb-4">
                      <AlertTriangle className="w-8 h-8 animate-pulse" />
                    </div>
                    <h3 className="text-base font-black uppercase text-white tracking-wider mb-2">Vade Mecum Pendente</h3>
                    <p className="text-slate-400 text-xs max-w-md leading-relaxed font-medium">
                      O instrutor ainda não solicitou a geração do Vade Mecum para este material. Peça ao seu comandante de curso para criá-lo pelo painel administrativo.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-center p-8 bg-slate-900/20 border border-slate-850 rounded-2xl">
              <BookOpen className="w-12 h-12 text-slate-700 mb-4 animate-pulse" />
              <h3 className="text-base font-black uppercase text-white tracking-wider mb-1">Nenhum Material Selecionado</h3>
              <p className="text-slate-500 text-xs max-w-xs font-bold uppercase tracking-wider">
                Selecione uma das apostilas ativas na barra lateral para carregar seus estudos.
              </p>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
