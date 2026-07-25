"use client";

import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Viewer, Worker } from "@react-pdf-viewer/core";
import { defaultLayoutPlugin } from "@react-pdf-viewer/default-layout";
import "@react-pdf-viewer/core/lib/styles/index.css";
import "@react-pdf-viewer/default-layout/lib/styles/index.css";

interface PdfViewerModalProps {
  isOpen: boolean;
  onClose: (open: boolean) => void;
  filePath: string | null;
  initialPage: number;
}

export function PdfViewerModal({ isOpen, onClose, filePath, initialPage }: PdfViewerModalProps) {
  const defaultLayoutPluginInstance = defaultLayoutPlugin();

  if (!filePath) return null;

  const fileUrl = filePath.startsWith("/") ? filePath : `/${filePath}`;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl w-full h-[90vh] bg-slate-900 border-slate-700 p-0 overflow-hidden flex flex-col">
        {/* Adicionando DialogTitle invisível para acessibilidade e parar o aviso do Radix */}
        <DialogTitle className="sr-only">Visualizador de Citação da Apostila</DialogTitle>
        
        <div className="flex-1 overflow-hidden">
          <Worker workerUrl="https://unpkg.com/pdfjs-dist@3.11.174/build/pdf.worker.min.js">
            <Viewer
              fileUrl={fileUrl}
              plugins={[defaultLayoutPluginInstance]}
              initialPage={initialPage}
              theme="dark"
            />
          </Worker>
        </div>
      </DialogContent>
    </Dialog>
  );
}
