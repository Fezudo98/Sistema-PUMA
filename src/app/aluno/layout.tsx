import React from "react";

export default function AlunoLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // A interceptação e blindagem do modo manutenção para a área do aluno 
  // é realizada diretamente no nível do servidor HTTP customizado (server.ts),
  // garantindo que o build estático (next build) rode instantaneamente sem erros de NEXT_REDIRECT.
  return <>{children}</>;
}
