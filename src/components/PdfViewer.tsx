"use client";

import { Viewer, Worker, type Plugin } from "@react-pdf-viewer/core";

import "@react-pdf-viewer/core/lib/styles/index.css";
import "@react-pdf-viewer/default-layout/lib/styles/index.css";
import "@react-pdf-viewer/highlight/lib/styles/index.css";

import { cn } from "@/lib/utils";

// Servido localmente (ver scripts/copy_pdf_worker.js) para não depender de um CDN
// externo e para nunca ficar com uma versão diferente da instalada em pdfjs-dist.
const PDF_WORKER_URL = "/pdf-worker/pdf.worker.min.js";

interface PdfViewerProps {
  fileUrl: string;
  plugins: Plugin[];
  initialPage?: number;
  className?: string;
}

export function PdfViewer({ fileUrl, plugins, initialPage, className }: PdfViewerProps) {
  return (
    <div className={cn("puma-pdf-viewer h-full w-full", className)}>
      <Worker workerUrl={PDF_WORKER_URL}>
        <Viewer fileUrl={fileUrl} plugins={plugins} initialPage={initialPage} theme="dark" />
      </Worker>
    </div>
  );
}
