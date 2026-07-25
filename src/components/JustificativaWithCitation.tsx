"use client";

import React, { useState } from "react";
import { BookOpen } from "lucide-react";
import { PdfViewerModal } from "./PdfViewerModal";

interface JustificativaWithCitationProps {
  text: string;
  apostilaFilePath: string | null;
}

export function JustificativaWithCitation({ text, apostilaFilePath }: JustificativaWithCitationProps) {
  const [modalOpen, setModalOpen] = useState(false);
  const [pageToOpen, setPageToOpen] = useState(0);

  if (!text) return null;

  // Regex para achar "[Página: X]" de forma flexível com ou sem espaços
  const regex = /\[Página:\s*(\d+)\]/gi;
  
  const parts = [];
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.substring(lastIndex, match.index));
    }

    const pageNumber = parseInt(match[1], 10);
    
    parts.push(
      <button
        key={match.index}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          // initialPage is 0-indexed, so we subtract 1
          setPageToOpen(Math.max(0, pageNumber - 1));
          setModalOpen(true);
        }}
        disabled={!apostilaFilePath}
        className={`inline-flex items-center gap-1.5 px-2 py-0.5 mx-1 rounded-md text-xs font-bold uppercase tracking-wider transition-all
          ${apostilaFilePath 
            ? "bg-blue-600 hover:bg-blue-500 text-white shadow-sm hover:shadow-[0_0_10px_rgba(37,99,235,0.4)]" 
            : "bg-slate-800 text-slate-500 cursor-not-allowed"
          }`}
        title={apostilaFilePath ? `Abrir PDF na página ${pageNumber}` : "Apostila PDF não encontrada no sistema"}
      >
        <BookOpen className="w-3.5 h-3.5" />
        Página {pageNumber}
      </button>
    );

    lastIndex = regex.lastIndex;
  }

  if (lastIndex < text.length) {
    parts.push(text.substring(lastIndex));
  }

  // Se não tem partes além do próprio texto (nenhuma citação encontrada), só mostra o texto
  if (parts.length === 0) {
    return <span className="leading-relaxed text-slate-300">{text}</span>;
  }

  return (
    <>
      <span className="leading-relaxed text-slate-300">
        {parts.map((part, index) => (
          <React.Fragment key={index}>{part}</React.Fragment>
        ))}
      </span>

      {/* Renderiza o modal (fora do fluxo normal do span para não quebrar estilos) */}
      <PdfViewerModal 
        isOpen={modalOpen} 
        onClose={setModalOpen} 
        filePath={apostilaFilePath} 
        initialPage={pageToOpen} 
      />
    </>
  );
}
