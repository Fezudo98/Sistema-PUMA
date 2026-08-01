"use client";

import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { defaultLayoutPlugin } from "@react-pdf-viewer/default-layout";
import { PdfViewer } from "@/components/PdfViewer";

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
      <DialogContent className="max-w-6xl w-full h-[90vh] bg-card border-border p-0 overflow-hidden flex flex-col">
        {/* Adicionando DialogTitle invisível para acessibilidade e parar o aviso do Radix */}
        <DialogTitle className="sr-only">Visualizador de Citação da Apostila</DialogTitle>
        
        <div className="flex-1 overflow-hidden">
          <PdfViewer fileUrl={fileUrl} plugins={[defaultLayoutPluginInstance]} initialPage={initialPage} />
        </div>
      </DialogContent>
    </Dialog>
  );
}
