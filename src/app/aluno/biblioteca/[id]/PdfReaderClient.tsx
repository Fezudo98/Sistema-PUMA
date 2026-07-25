"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { ArrowLeft, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

// PDF Viewer imports
import { Viewer, Worker } from "@react-pdf-viewer/core";
import { defaultLayoutPlugin } from "@react-pdf-viewer/default-layout";
import { 
  highlightPlugin, 
  MessageIcon, 
  RenderHighlightTargetProps, 
  RenderHighlightContentProps,
  RenderHighlightsProps
} from "@react-pdf-viewer/highlight";

import "@react-pdf-viewer/core/lib/styles/index.css";
import "@react-pdf-viewer/default-layout/lib/styles/index.css";
import "@react-pdf-viewer/highlight/lib/styles/index.css";

interface Apostila {
  id: string;
  title: string;
  filePath: string;
}

const HighlightContentEditor = ({ props, addAnnotation }: { props: RenderHighlightContentProps, addAnnotation: (content: string, areas: any[]) => void }) => {
  const [message, setMessage] = useState("");

  return (
    <div className="bg-white border border-gray-300 rounded-md p-3 shadow-lg flex flex-col gap-2 w-64 absolute z-50 text-slate-800"
      style={{
        left: `${props.selectionRegion.left}%`,
        top: `${props.selectionRegion.top + props.selectionRegion.height}%`,
      }}
    >
      <textarea
        rows={3}
        className="border p-2 rounded text-sm w-full outline-none focus:border-blue-500"
        placeholder="Escreva sua anotação aqui..."
        value={message}
        onChange={(e) => setMessage(e.target.value)}
      />
      <div className="flex gap-2 justify-end mt-1">
        <Button variant="ghost" size="sm" onClick={props.cancel} className="text-slate-500">
          Cancelar
        </Button>
        <Button 
          size="sm" 
          className="bg-blue-600 hover:bg-blue-700 text-white"
          onClick={() => {
            addAnnotation(message, props.highlightAreas);
            props.cancel();
          }}
        >
          Salvar
        </Button>
      </div>
    </div>
  );
};

export default function PdfReaderClient({ apostila, userId }: { apostila: Apostila; userId: string }) {
  const [annotations, setAnnotations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/apostilas/${apostila.id}/annotations`)
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          setAnnotations(data.map(ann => ({
            id: ann.id,
            content: ann.content,
            highlightAreas: JSON.parse(ann.highlightData),
            quote: JSON.parse(ann.highlightData)[0]?.quote || "",
          })));
        }
        setLoading(false);
      })
      .catch(err => {
        console.error("Failed to load annotations", err);
        setLoading(false);
      });
  }, [apostila.id]);

  const addAnnotation = async (content: string, highlightAreas: any[]) => {
    try {
      const res = await fetch(`/api/apostilas/${apostila.id}/annotations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content,
          highlightData: JSON.stringify(highlightAreas),
          color: "yellow"
        })
      });
      const data = await res.json();
      setAnnotations(prev => [...prev, {
        id: data.id,
        content: data.content,
        highlightAreas: JSON.parse(data.highlightData),
        quote: highlightAreas[0]?.quote || ""
      }]);
    } catch (error) {
      console.error("Error adding annotation:", error);
    }
  };

  const deleteAnnotation = async (id: string) => {
    try {
      await fetch(`/api/apostilas/${apostila.id}/annotations?annotationId=${id}`, {
        method: "DELETE"
      });
      setAnnotations(prev => prev.filter(a => a.id !== id));
    } catch (error) {
      console.error("Error deleting annotation:", error);
    }
  };

  const renderHighlightTarget = (props: RenderHighlightTargetProps) => (
    <div
      style={{
        background: "#eee",
        display: "flex",
        position: "absolute",
        left: `${props.selectionRegion.left}%`,
        top: `${props.selectionRegion.top + props.selectionRegion.height}%`,
        transform: "translate(0, 8px)",
        zIndex: 1,
      }}
    >
      <Button 
        size="sm" 
        onClick={props.toggle} 
        className="bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-2"
      >
        <MessageIcon />
        Adicionar Anotação
      </Button>
    </div>
  );

  const renderHighlightContent = (props: RenderHighlightContentProps) => {
    return <HighlightContentEditor props={props} addAnnotation={addAnnotation} />;
  };

  const renderHighlights = (props: RenderHighlightsProps) => (
    <div>
      {annotations.map((note) => (
        <React.Fragment key={note.id}>
          {note.highlightAreas
            .filter((area: any) => area.pageIndex === props.pageIndex)
            .map((area: any, idx: number) => (
              <div
                key={idx}
                className="group relative cursor-pointer"
                style={Object.assign(
                  {},
                  {
                    background: "rgba(253, 224, 71, 0.4)", // yellow-300 with opacity
                    position: "absolute" as const,
                    left: `${area.left}%`,
                    top: `${area.top}%`,
                    height: `${area.height}%`,
                    width: `${area.width}%`,
                  }
                )}
              >
                {/* Tooltip for existing annotation */}
                <div className="hidden group-hover:block absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 bg-slate-900 text-white text-xs p-2 rounded shadow-xl border border-slate-700 z-50">
                  <p className="font-semibold text-blue-300 mb-1">Sua anotação:</p>
                  <p>{note.content}</p>
                  <button 
                    onClick={() => deleteAnnotation(note.id)}
                    className="mt-2 text-red-400 hover:text-red-300 underline"
                  >
                    Excluir
                  </button>
                </div>
              </div>
            ))}
        </React.Fragment>
      ))}
    </div>
  );

  const highlightPluginInstance = highlightPlugin({
    renderHighlightTarget,
    renderHighlightContent,
    renderHighlights,
  });

  const defaultLayoutPluginInstance = defaultLayoutPlugin();

  const fileUrl = apostila.filePath.startsWith("/") ? apostila.filePath : `/${apostila.filePath}`;

  return (
    <div className="flex flex-col h-screen bg-slate-900">
      <header className="bg-slate-950 border-b border-slate-800 p-4 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-4">
          <Link href="/aluno/biblioteca">
            <Button variant="ghost" size="icon" className="text-slate-400 hover:text-white">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          <h1 className="text-xl font-bold text-white max-w-xl truncate">
            {apostila.title}
          </h1>
        </div>
      </header>

      <main className="flex-1 overflow-hidden relative">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-full text-slate-400">
            <Loader2 className="w-8 h-8 animate-spin mb-4" />
            <p>Carregando anotações...</p>
          </div>
        ) : (
          <Worker workerUrl={`https://unpkg.com/pdfjs-dist@3.11.174/build/pdf.worker.min.js`}>
            <Viewer
              fileUrl={fileUrl}
              plugins={[defaultLayoutPluginInstance, highlightPluginInstance]}
              theme="dark"
            />
          </Worker>
        )}
      </main>
    </div>
  );
}
