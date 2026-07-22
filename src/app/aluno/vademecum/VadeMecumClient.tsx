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
import { formatApostilaTitle } from "@/lib/utils";

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

  // Helper to parse inline HTML tags (<br>, <br/>), bold (**bold**), italics (*italics*), and code (`code`)
  const parseInline = (text: string) => {
    if (!text) return null;
    
    // First, split by <br> or <br/> or <br /> to handle line breaks within table cells or paragraphs
    const lines = text.split(/<br\s*\/?>/i);
    
    return lines.map((segment, lineIndex) => {
      const parts: React.ReactNode[] = [];
      let currentIndex = 0;
      // Match **bold**, *italic*, or `code`
      const regex = /(\*\*.*?\*\*|\*[^\*]+\*|`.*?`)/g;
      let match;

      while ((match = regex.exec(segment)) !== null) {
        const matchIndex = match.index;
        if (matchIndex > currentIndex) {
          parts.push(segment.slice(currentIndex, matchIndex));
        }

        const matchText = match[0];
        if (matchText.startsWith("**") && matchText.endsWith("**")) {
          parts.push(
            <strong key={`${lineIndex}-${matchIndex}`} className="font-extrabold text-white sm:text-slate-100 print:text-black">
              {matchText.slice(2, -2)}
            </strong>
          );
        } else if (matchText.startsWith("`") && matchText.endsWith("`")) {
          parts.push(
            <code key={`${lineIndex}-${matchIndex}`} className="bg-slate-900/90 px-1.5 py-0.5 rounded text-blue-400 font-mono text-xs border border-slate-800 print:border-slate-300 print:bg-slate-100 print:text-black">
              {matchText.slice(1, -1)}
            </code>
          );
        } else if (matchText.startsWith("*") && matchText.endsWith("*") && matchText.length > 2) {
          parts.push(
            <em key={`${lineIndex}-${matchIndex}`} className="italic text-slate-400 font-medium print:text-slate-700">
              {matchText.slice(1, -1)}
            </em>
          );
        }

        currentIndex = regex.lastIndex;
      }

      if (currentIndex < segment.length) {
        parts.push(segment.slice(currentIndex));
      }

      return (
        <span key={lineIndex}>
          {parts.length > 0 ? parts : segment}
          {lineIndex < lines.length - 1 && <br className="my-1" />}
        </span>
      );
    });
  };

  // Advanced custom markdown parser for booklet summaries (Tables, Organograms, Headings, Lists, Blockquotes)
  const renderMarkdown = (text: string) => {
    if (!text) return null;

    const lines = text.split("\n");
    const blocks: React.ReactNode[] = [];
    let i = 0;

    while (i < lines.length) {
      const line = lines[i];
      const trimmed = line.trim();

      // 1. Table Blocks (lines starting and ending with | or containing at least two | separators)
      if (trimmed.startsWith("|") && trimmed.includes("|", 1)) {
        const tableLines: string[] = [];
        while (i < lines.length && lines[i].trim().startsWith("|") && lines[i].trim().includes("|", 1)) {
          tableLines.push(lines[i].trim());
          i++;
        }

        // Filter out markdown table separator lines like |:---|:---| or |---|---|
        const contentRows = tableLines.filter((l) => !l.match(/^\|\s*:?[-=]+\s*(\|\s*:?[-=]+\s*)*\|?$/));

        if (contentRows.length > 0) {
          // Parse cells of the first row as the table header (thead)
          const headerCells = contentRows[0]
            .replace(/^\|/, "")
            .replace(/\|$/, "")
            .split("|")
            .map((c) => c.trim());

          // Parse remaining rows as tbody
          const bodyRows = contentRows.slice(1).map((rowStr) =>
            rowStr
              .replace(/^\|/, "")
              .replace(/\|$/, "")
              .split("|")
              .map((c) => c.trim())
          );

          blocks.push(
            <div key={`table-${blocks.length}`} className="my-6 overflow-x-auto rounded-2xl border border-slate-800/80 shadow-2xl bg-slate-950/90 backdrop-blur-md print:border-none print:shadow-none print:bg-transparent print:overflow-visible print:my-4">
              <table className="w-full text-left border-collapse text-xs sm:text-sm print:text-xs">
                <thead>
                  <tr className="bg-slate-900/95 border-b border-slate-800 text-blue-400 font-black uppercase tracking-wider print:bg-slate-100 print:text-slate-900 print:border-slate-400">
                    {headerCells.map((headerText, hIdx) => (
                      <th key={hIdx} className="p-3.5 sm:p-4 border-r border-slate-800/60 last:border-r-0 print:border-slate-400 print:p-2.5 print:text-xs">
                        {parseInline(headerText)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 print:divide-slate-300">
                  {bodyRows.map((rowCells, rIdx) => (
                    <tr key={rIdx} className="hover:bg-slate-900/40 transition-colors print:hover:bg-transparent">
                      {rowCells.map((cellText, cIdx) => (
                        <td key={cIdx} className="p-3.5 sm:p-4 text-slate-300 leading-relaxed border-r border-slate-800/40 last:border-r-0 align-top print:text-black print:border-slate-300 print:p-2.5 print:text-xs">
                          {parseInline(cellText)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        }
        continue;
      }

      // 2. ASCII Diagrams / Organograms / Preformatted Blocks
      const isAsciiTree = trimmed.match(/[└├│▼►▲◄_┌┐┼─]/) || trimmed.startsWith("___") || (trimmed.startsWith("▼") && trimmed.includes("▼"));
      if (isAsciiTree || trimmed.startsWith("```")) {
        const asciiLines: string[] = [];
        if (trimmed.startsWith("```")) {
          i++; // skip opening ```
          while (i < lines.length && !lines[i].trim().startsWith("```")) {
            asciiLines.push(lines[i]);
            i++;
          }
          if (i < lines.length) i++; // skip closing ```
        } else {
          // Group consecutive lines that look like organogram / diagram / labels right next to tree lines
          while (
            i < lines.length &&
            (lines[i].trim().match(/[└├│▼►▲◄_┌┐┼─]/) ||
              lines[i].trim().startsWith("___") ||
              (lines[i].trim().length > 0 && lines[i].trim().length < 70 && !lines[i].trim().startsWith("#") && !lines[i].trim().startsWith("- ") && !lines[i].trim().startsWith("* ") && (i + 1 < lines.length && lines[i + 1].trim().match(/[└├│▼►▲◄_┌┐┼─]/))))
          ) {
            asciiLines.push(lines[i]);
            i++;
          }
        }

        if (asciiLines.length > 0) {
          blocks.push(
            <div key={`ascii-${blocks.length}`} className="my-5 p-4 sm:p-5 bg-slate-950 border border-blue-500/30 rounded-2xl font-mono text-xs sm:text-sm text-blue-300 overflow-x-auto whitespace-pre leading-relaxed shadow-inner print-diagram print:border-slate-400 print:bg-slate-50 print:text-black print:overflow-visible print:whitespace-pre-wrap">
              {asciiLines.join("\n")}
            </div>
          );
        }
        continue;
      }

      // 3. Headings
      if (trimmed.startsWith("# ")) {
        blocks.push(
          <h1 key={`h1-${blocks.length}`} className="text-xl sm:text-2xl font-black text-white mt-8 mb-4 uppercase tracking-wider border-b-2 border-blue-600 pb-3 print:text-black print:border-black">
            {parseInline(trimmed.replace(/^#\s+/, ""))}
          </h1>
        );
        i++;
        continue;
      }
      if (trimmed.startsWith("## ")) {
        blocks.push(
          <h2 key={`h2-${blocks.length}`} className="text-base sm:text-lg font-black text-blue-400 mt-7 mb-3.5 uppercase tracking-wider flex items-center border-b border-slate-800/80 pb-2.5 print:text-blue-900 print:border-slate-400">
            {parseInline(trimmed.replace(/^##\s+/, ""))}
          </h2>
        );
        i++;
        continue;
      }
      if (trimmed.startsWith("### ")) {
        blocks.push(
          <h3 key={`h3-${blocks.length}`} className="text-sm sm:text-base font-bold text-indigo-300 mt-5 mb-2 flex items-center print:text-black">
            {parseInline(trimmed.replace(/^###\s+/, ""))}
          </h3>
        );
        i++;
        continue;
      }
      if (trimmed.startsWith("#### ")) {
        blocks.push(
          <h4 key={`h4-${blocks.length}`} className="text-xs sm:text-sm font-bold text-slate-200 mt-4 mb-2 uppercase tracking-wide print:text-black">
            {parseInline(trimmed.replace(/^####\s+/, ""))}
          </h4>
        );
        i++;
        continue;
      }

      // 4. Horizontal Rules
      if (trimmed === "---" || trimmed === "***" || trimmed === "___") {
        blocks.push(<hr key={`hr-${blocks.length}`} className="my-8 border-slate-800/80 print:border-slate-400" />);
        i++;
        continue;
      }

      // 5. Blockquotes
      if (trimmed.startsWith("> ")) {
        blocks.push(
          <blockquote key={`quote-${blocks.length}`} className="border-l-4 border-blue-500 bg-slate-900/50 px-4 py-3 my-4 text-slate-300 text-xs sm:text-sm italic rounded-r-xl shadow-sm print:bg-slate-100 print:border-slate-600 print:text-black">
            {parseInline(trimmed.replace(/^>\s*/, ""))}
          </blockquote>
        );
        i++;
        continue;
      }

      // 6. Unordered and Ordered Lists (grouping consecutive list items)
      if (trimmed.match(/^[\-\*]\s+/) || trimmed.match(/^\d+\.\s+/)) {
        const listItems: { isOrdered: boolean; text: string }[] = [];
        while (i < lines.length && (lines[i].trim().match(/^[\-\*]\s+/) || lines[i].trim().match(/^\d+\.\s+/))) {
          const l = lines[i].trim();
          if (l.match(/^[\-\*]\s+/)) {
            listItems.push({ isOrdered: false, text: l.replace(/^[\-\*]\s+/, "") });
          } else {
            listItems.push({ isOrdered: true, text: l.replace(/^\d+\.\s+/, "") });
          }
          i++;
        }

        blocks.push(
          <ul key={`list-${blocks.length}`} className="my-3 space-y-2 pl-2 sm:pl-4">
            {listItems.map((item, idx) => (
              <li key={idx} className="flex items-start gap-2.5 text-slate-300 text-xs sm:text-sm leading-relaxed print:text-black">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-2 shrink-0 print:bg-black" />
                <span className="flex-1">{parseInline(item.text)}</span>
              </li>
            ))}
          </ul>
        );
        continue;
      }

      // 7. Empty lines
      if (!trimmed) {
        blocks.push(<div key={`empty-${blocks.length}`} className="h-3" />);
        i++;
        continue;
      }

      // 8. Standard paragraphs
      blocks.push(
        <p key={`p-${blocks.length}`} className="text-slate-300 text-xs sm:text-sm leading-relaxed my-2.5 text-justify print:text-black">
          {parseInline(line)}
        </p>
      );
      i++;
    }

    return blocks;
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* Printable Style Tag (forces ultra-clean textbook print formatting without scrollbars or card borders) */}
      <style jsx global>{`
        @media print {
          @page {
            size: A4;
            margin: 1.5cm 1.5cm 2cm 1.5cm;
          }
          * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          html, body, div, main, section, article {
            background-color: white !important;
            color: black !important;
            height: auto !important;
            min-height: auto !important;
            max-height: none !important;
            overflow: visible !important;
            position: static !important;
            box-shadow: none !important;
          }
          .no-print {
            display: none !important;
          }
          main {
            display: block !important;
            width: 100% !important;
            max-width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          .print-content {
            display: block !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          /* Remove all card backgrounds, borders, and scrollable constraints during print */
          .print-content > div, .print-content [class*="bg-slate-"], .print-content [class*="border"] {
            border: none !important;
            background: transparent !important;
            box-shadow: none !important;
            overflow: visible !important;
          }
          .print-header {
            border-bottom: 3px solid #1e3a8a !important;
            padding-bottom: 12pt !important;
            margin-bottom: 20pt !important;
          }
          h1 {
            color: #0f172a !important;
            font-size: 20pt !important;
            margin-top: 24pt !important;
            margin-bottom: 12pt !important;
            page-break-after: avoid !important;
            break-after: avoid !important;
          }
          h2 {
            color: #1e3a8a !important;
            font-size: 15pt !important;
            margin-top: 20pt !important;
            margin-bottom: 10pt !important;
            border-bottom: 1.5px solid #cbd5e1 !important;
            padding-bottom: 6pt !important;
            page-break-after: avoid !important;
            break-after: avoid !important;
          }
          h3 {
            color: #1e293b !important;
            font-size: 12pt !important;
            margin-top: 14pt !important;
            margin-bottom: 6pt !important;
            page-break-after: avoid !important;
            break-after: avoid !important;
          }
          h4 {
            color: #334155 !important;
            font-size: 11pt !important;
            margin-top: 10pt !important;
            page-break-after: avoid !important;
            break-after: avoid !important;
          }
          p, li, td, th {
            color: #1e293b !important;
            font-size: 10.5pt !important;
            line-height: 1.6 !important;
          }
          table {
            width: 100% !important;
            border-collapse: collapse !important;
            margin: 16pt 0 !important;
            page-break-inside: auto !important;
            break-inside: auto !important;
          }
          tr {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
            page-break-after: auto !important;
          }
          thead {
            display: table-header-group !important;
          }
          th {
            background-color: #f1f5f9 !important;
            color: #0f172a !important;
            font-weight: bold !important;
            border: 1px solid #94a3b8 !important;
            padding: 8pt !important;
          }
          td {
            border: 1px solid #cbd5e1 !important;
            padding: 8pt !important;
          }
          blockquote {
            border-left: 4px solid #2563eb !important;
            background-color: #f8fafc !important;
            padding: 10pt 14pt !important;
            margin: 14pt 0 !important;
            border-radius: 4px !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
            color: #0f172a !important;
          }
          .print-diagram {
            border: 1px solid #94a3b8 !important;
            background-color: #f8fafc !important;
            padding: 12pt !important;
            border-radius: 6px !important;
            margin: 14pt 0 !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
            font-size: 9pt !important;
            color: #0f172a !important;
            overflow: visible !important;
            white-space: pre-wrap !important;
          }
          li {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
        }
      `}</style>

      {/* Header (no-print) */}
      <header className="no-print bg-slate-900/60 border-b border-slate-800/80 px-4 sm:px-6 py-3.5 sm:py-4 flex items-center justify-between backdrop-blur-md sticky top-0 z-50">
        <div className="flex items-center gap-2 sm:gap-4">
          <Link href="/aluno/painel">
            <Button variant="ghost" size="icon" className="text-slate-400 hover:text-white border border-slate-800 bg-slate-950/40 hover:bg-slate-900 rounded-lg cursor-pointer h-9 w-9 sm:h-10 sm:w-10">
              <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5" />
            </Button>
          </Link>
          <div className="flex items-center gap-2 sm:gap-2.5">
            <div className="p-1.5 sm:p-2 rounded-xl bg-blue-500/15 border border-blue-400/30 text-blue-400">
              <BookOpen className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div>
              <h1 className="text-sm sm:text-lg font-black uppercase tracking-wider text-white">Vade Mecum PUMA</h1>
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest hidden sm:block">Resumo Temático & Doutrina de Estudos</p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-4">
          <HeaderAvatar initials={user.name.substring(0, 2).toUpperCase()} avatarUrl={user.avatarUrl} />
          <form action={logout}>
            <Button type="submit" variant="ghost" className="text-slate-400 hover:text-red-400 text-xs font-bold uppercase tracking-wider border border-slate-800 bg-slate-950/40 hover:bg-red-950/20 rounded-lg h-9 sm:h-10 px-2.5 sm:px-3 cursor-pointer">
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
                    <div className="min-w-0 flex items-start gap-2.5 flex-1 pr-2" title={apo.title}>
                      <FileText className={`w-4 h-4 mt-0.5 shrink-0 ${selectedId === apo.id ? "text-blue-400" : "text-slate-500 group-hover:text-slate-400"}`} />
                      <span className="text-xs font-bold leading-snug line-clamp-2">{formatApostilaTitle(apo.title)}</span>
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
            <Card className="bg-slate-900/40 border-slate-800 shadow-2xl relative overflow-hidden backdrop-blur-sm h-full flex flex-col print:border-none print:shadow-none print:bg-transparent print:overflow-visible print:h-auto print:block">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-indigo-500 no-print"></div>
              
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
              <div className="p-6 border-b border-slate-800/40 bg-slate-950/10 print-header print:p-0 print:border-none print:bg-transparent">
                <div className="text-[10px] text-blue-500 font-black tracking-widest uppercase mb-1 print:text-blue-900 print:text-xs">VADE MECUM DO ALUNO - PMCE</div>
                <h2 className="text-xl sm:text-2xl font-black text-white print:text-black print:text-2xl print:font-extrabold print:border-b-2 print:border-slate-800 print:pb-2 print:mb-6">{formatApostilaTitle(selectedApostila.title)}</h2>
              </div>

              {/* Markdown Content Area */}
              <CardContent className="flex-1 overflow-y-auto p-6 md:p-8 font-medium print:overflow-visible print:h-auto print:p-0 print:block">
                {selectedApostila.vadeMecum ? (
                  <div className="prose prose-invert max-w-none print:max-w-full print:block">
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
