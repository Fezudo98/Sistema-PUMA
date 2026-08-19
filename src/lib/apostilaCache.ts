import fs from "fs/promises";
import path from "path";

// Helper to polyfill DOMMatrix, ImageData, Path2D required by pdfjs-dist in Node environment
function ensureNodeCanvasPolyfills() {
  if (typeof globalThis.DOMMatrix === "undefined") {
    (globalThis as any).DOMMatrix = class DOMMatrix {
      a = 1; b = 0; c = 0; d = 1; e = 0; f = 0;
      m11 = 1; m12 = 0; m21 = 0; m22 = 1; m41 = 0; m42 = 0;
      constructor(args?: any[]) {
        if (Array.isArray(args) && args.length >= 6) {
          this.a = this.m11 = args[0];
          this.b = this.m12 = args[1];
          this.c = this.m21 = args[2];
          this.d = this.m22 = args[3];
          this.e = this.m41 = args[4];
          this.f = this.m42 = args[5];
        }
      }
      multiply() { return new (globalThis as any).DOMMatrix(); }
      translate() { return new (globalThis as any).DOMMatrix(); }
      scale() { return new (globalThis as any).DOMMatrix(); }
      transformPoint(pt: any) { return pt; }
    };
  }
  if (typeof globalThis.ImageData === "undefined") {
    (globalThis as any).ImageData = class ImageData {
      width = 0;
      height = 0;
      data = new Uint8ClampedArray(0);
    };
  }
  if (typeof globalThis.Path2D === "undefined") {
    (globalThis as any).Path2D = class Path2D {};
  }
}

// Cacheia (em disco) o texto extraído de uma apostila. NÃO é um server action —
// só recebe apostila.filePath de chamadores internos que já buscaram o registro
// via Prisma (nunca diretamente do cliente), pra evitar path traversal.
export async function getCachedApostilaText(apostila: { id: string; title: string; filePath: string }) {
  const uploadsDir = path.join(process.cwd(), "public", "uploads");
  const cacheDir = path.join(uploadsDir, "cache");
  await fs.mkdir(cacheDir, { recursive: true });

  const cachePath = path.join(cacheDir, `${apostila.id}.txt`);
  const filePath = path.join(uploadsDir, path.basename(apostila.filePath));

  if (!filePath.startsWith(uploadsDir) || !cachePath.startsWith(cacheDir)) {
    throw new Error("Caminho de apostila inválido.");
  }

  try {
    return await fs.readFile(cachePath, "utf-8");
  } catch (e) {
    console.log(`[PDF PARSE] Cache miss para "${apostila.title}". Extraindo texto...`);
    ensureNodeCanvasPolyfills();
    try {
      const pdfParse = require("pdf-parse/lib/pdf-parse.js");
      const buffer = await fs.readFile(filePath);
      const parsed = await pdfParse(buffer);

      // Save to cache
      await fs.writeFile(cachePath, parsed.text, "utf-8");
      return parsed.text;
    } catch (parseError: any) {
      console.error(`[PDF PARSE ERROR] Falha ao extrair texto do PDF "${apostila.title}":`, parseError.message);
      return `Conteúdo textual indisponível para leitura da apostila: ${apostila.title}`;
    }
  }
}
