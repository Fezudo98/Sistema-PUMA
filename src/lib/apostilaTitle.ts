function cleanTitle(value: string): string {
  return value.replace(/\s+/g, " ").replace(/^[\s:–—-]+|[\s:–—-]+$/g, "").trim();
}

function isUsefulTitle(value: string): boolean {
  const title = cleanTitle(value);
  if (title.length < 4 || title.length > 140 || !/[A-Za-zÀ-ÿ]{3}/.test(title)) return false;
  return !/^(?:apostilas?\b|documento?\b|untitled\b|sem título\b|microsoft word\b|página\s+\d+\b|\d+$)/i.test(title);
}

export function titleFromApostilaText(text: string, metadataTitle?: string | null): string | null {
  const lines = text.split(/\r?\n/).map(cleanTitle).filter(Boolean);
  const openingLines = lines.slice(0, 100);

  for (let index = 0; index < openingLines.length; index++) {
    const match = openingLines[index].match(/^(?:DISCIPLINA|DISICPLINA|MAT[ÉE]RIA|T[ÍI]TULO|TEMA)\s*(?::|–|—|-)?\s*(.*)$/i);
    if (!match) continue;
    const title = cleanTitle(match[1] || openingLines[index + 1] || "");
    if (isUsefulTitle(title)) return title;
  }

  // Algumas capas trazem o título em destaque logo após o nome da instituição.
  const heading = openingLines.slice(0, 12).find((line) =>
    isUsefulTitle(line) &&
    line === line.toLocaleUpperCase("pt-BR") &&
    !/^(?:ACADEMIA|GOVERNO|SECRETARIA|CURSO|POL[ÍI]CIA|ESTADO|CENTRO|ESCOLA|FORMA[ÇC][ÃA]O)/i.test(line),
  );
  if (heading) return heading;

  const metadata = cleanTitle(metadataTitle || "");
  return isUsefulTitle(metadata) ? metadata : null;
}

export async function titleFromApostilaPdf(buffer: Buffer): Promise<string | null> {
  const pdfParse = require("pdf-parse/lib/pdf-parse.js");
  const parsed = await pdfParse(buffer, { max: 3 });
  return titleFromApostilaText(parsed.text, parsed.info?.Title);
}
