const fs = require("fs");
const path = require("path");

const src = path.join(__dirname, "..", "node_modules", "pdfjs-dist", "build", "pdf.worker.min.js");
const destDir = path.join(__dirname, "..", "public", "pdf-worker");
const dest = path.join(destDir, "pdf.worker.min.js");

if (!fs.existsSync(src)) {
  console.warn("[copy_pdf_worker] pdfjs-dist worker não encontrado em node_modules — pulando cópia.");
  process.exit(0);
}

fs.mkdirSync(destDir, { recursive: true });
fs.copyFileSync(src, dest);
console.log(`[copy_pdf_worker] Worker do PDF.js copiado para public/pdf-worker/ (versão instalada de pdfjs-dist).`);
