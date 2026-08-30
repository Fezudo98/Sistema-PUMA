import { Fragment, type ReactNode } from "react";

// Questões de "significação de palavras" (parônimos, regência, crase etc.) pedem pro
// aluno julgar o emprego de um termo específico dentro de cada alternativa. A IA marca
// esse termo com **dois asteriscos** no texto gerado (ver prompt em dailySimulado.ts e
// api/generate/route.ts) — esta função converte isso em destaque visual real.
export function renderHighlightedText(text: string): ReactNode {
  if (!text || !text.includes("**")) return text;

  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  if (parts.length === 1) return text;

  return parts.map((part, i) => {
    const match = part.match(/^\*\*([^*]+)\*\*$/);
    if (!match) return <Fragment key={i}>{part}</Fragment>;
    return (
      <mark key={i} className="bg-amber-400/25 text-inherit font-bold rounded px-0.5">
        {match[1]}
      </mark>
    );
  });
}
