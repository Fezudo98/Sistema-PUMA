import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Remove prefixos redundantes de apostilas (como "Apostilas CFSd PM 2026 - T01 - ") e extensão .pdf
 * para exibir apenas o título/matéria principal nos menus e barras laterais.
 */
export function formatApostilaTitle(title: string | null | undefined): string {
  if (!title) return "";
  
  // Remove a extensão .pdf final
  let clean = title.replace(/\.pdf$/i, "").trim();

  // Se estiver dividido por hífens " - ", verifica se o início é prefixo padrão do curso
  // Ex: "Apostilas CFSd PM 2026 - T01 - Deontologia Historia PMCE"
  const parts = clean.split(" - ");
  if (parts.length >= 3 && parts[0].toLowerCase().includes("apostila") && parts[1].match(/^T\d+/i)) {
    return parts.slice(2).join(" - ").trim();
  }
  if (parts.length >= 2 && parts[0].toLowerCase().includes("apostila")) {
    return parts.slice(1).join(" - ").trim();
  }

  // Remoção de prefixos genéricos por regex caso não tenha sido pego pelo split
  clean = clean.replace(/^Apostilas?\s+(CFSd\s+)?(PM\s+)?(\d+\s*-\s*)?(T\d+\s*-\s*)?/i, "").trim();
  clean = clean.replace(/^Apostilas?\s+-\s*/i, "").trim();

  return clean || title.replace(/\.pdf$/i, "").trim();
}
