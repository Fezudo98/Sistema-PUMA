"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Printer, Loader2 } from "lucide-react";

export default function RelatorioPrintPage() {
  const router = useRouter();
  const [report, setReport] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const payloadStr = localStorage.getItem("ai_report_payload");
    if (!payloadStr) {
      setError("Nenhum dado de relatório encontrado.");
      setLoading(false);
      return;
    }

    const payload = JSON.parse(payloadStr);

    const generateReport = async () => {
      try {
        const res = await fetch("/api/instructor/generate-report", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });

        const data = await res.json();
        if (data.error) throw new Error(data.error);

        setReport(data.report);
      } catch (err: any) {
        setError(err.message || "Falha ao gerar relatório.");
      } finally {
        setLoading(false);
      }
    };

    generateReport();
  }, []);

  const handlePrint = () => {
    window.print();
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background text-foreground">
        <Loader2 className="w-12 h-12 text-blue-500 animate-spin mb-4" />
        <h2 className="text-xl font-black uppercase tracking-widest text-heading animate-pulse">A Inteligência Artificial está redigindo o relatório...</h2>
        <p className="text-muted-foreground mt-2">Isso pode levar alguns segundos. Analisando desempenho da tropa.</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background text-foreground p-4 text-center">
        <h2 className="text-xl font-black uppercase tracking-widest text-red-500 mb-4">Falha Operacional</h2>
        <p className="text-muted-foreground mb-6">{error}</p>
        <Button onClick={() => router.push("/instructor")} variant="outline">
          <ArrowLeft className="w-4 h-4 mr-2" /> Voltar ao Centro de Comando
        </Button>
      </div>
    );
  }

  // Convert simple markdown to HTML (basic implementation since we can't use complex markdown renderers on print easily without bringing large libs)
  // Or we just render it simply.
  const formatMarkdown = (md: string) => {
    let html = md;
    
    // Headers
    html = html.replace(/^### (.*$)/gim, '<h3 class="text-lg font-bold mt-6 mb-2 text-slate-800">$1</h3>');
    html = html.replace(/^## (.*$)/gim, '<h2 class="text-xl font-black uppercase tracking-widest mt-8 mb-4 border-b-2 border-slate-200 pb-2 text-slate-900">$1</h2>');
    html = html.replace(/^# (.*$)/gim, '<h1 class="text-3xl font-black uppercase tracking-widest mb-8 text-center text-slate-900">$1</h1>');
    
    // Bold
    html = html.replace(/\*\*(.*?)\*\*/gim, '<strong>$1</strong>');
    
    // Italic
    html = html.replace(/\*(.*?)\*/gim, '<em>$1</em>');
    
    // Lists
    html = html.replace(/^\* (.*$)/gim, '<li class="ml-6 list-disc mb-1">$1</li>');
    html = html.replace(/^- (.*$)/gim, '<li class="ml-6 list-disc mb-1">$1</li>');
    
    // Paragraphs
    html = html.replace(/^\s*(\n)?(.+)/gim, function(m) {
      if (/<(\/)?(h1|h2|h3|li|ul|ol|strong|em)>/.test(m)) return m;
      return '<p class="mb-4 leading-relaxed text-slate-700 text-justify">' + m + '</p>';
    });

    return html;
  };

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 p-4 sm:p-8 font-sans">
      <style dangerouslySetInnerHTML={{__html: `
        @media print {
          body { background: white !important; color: black !important; }
          .no-print { display: none !important; }
          .print-container { max-width: 100% !important; margin: 0 !important; padding: 0 !important; box-shadow: none !important; }
          h1, h2, h3, p, li { color: black !important; }
          @page { margin: 2cm; }
        }
      `}} />

      {/* Floating Action Bar (Hidden on Print) */}
      <div className="no-print max-w-4xl mx-auto flex justify-between items-center mb-6 bg-white p-4 rounded-xl shadow-lg border border-slate-200">
        <Button onClick={() => router.push("/instructor")} variant="outline" className="border-slate-300 text-slate-700 hover:bg-slate-100 font-bold uppercase text-xs tracking-wider">
          <ArrowLeft className="w-4 h-4 mr-2" /> Centro de Comando
        </Button>
        <div className="flex gap-3">
          <Button onClick={handlePrint} className="bg-blue-600 hover:bg-blue-700 text-white font-black uppercase text-xs tracking-wider shadow-md">
            <Printer className="w-4 h-4 mr-2" /> Imprimir Relatório (PDF)
          </Button>
        </div>
      </div>

      {/* Document A4 Container */}
      <div className="print-container max-w-4xl mx-auto bg-white p-8 sm:p-16 rounded-sm shadow-xl min-h-[29.7cm]">
        
        {/* Official Header */}
        <div className="flex flex-col items-center justify-center border-b-4 border-slate-900 pb-6 mb-10 text-center">
          <img src="/logo.png" alt="Logo PUMA" className="w-24 h-24 mb-4 object-contain" />
          <h2 className="text-xl font-black uppercase tracking-widest text-slate-900">Sistema PUMA</h2>
          <p className="text-sm font-bold uppercase tracking-wider text-slate-600">Plataforma Unificada de Missões e Aprendizado</p>
          <p className="text-xs font-semibold text-slate-500 mt-2">Documento Oficial Gerado por Inteligência Artificial</p>
        </div>

        {/* Content */}
        <div 
          className="prose prose-slate max-w-none"
          dangerouslySetInnerHTML={{ __html: formatMarkdown(report) }}
        />

        {/* Footer */}
        <div className="mt-16 pt-8 border-t border-slate-300 text-center flex flex-col items-center">
          <div className="w-48 border-b border-slate-400 mb-2"></div>
          <p className="text-xs font-bold uppercase tracking-wider text-slate-600">Comando do Sistema PUMA</p>
          <p className="text-[10px] text-slate-400 mt-1">Gerado em: {new Date().toLocaleString('pt-BR')}</p>
        </div>
      </div>
    </div>
  );
}
