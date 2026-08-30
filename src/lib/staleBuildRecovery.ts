// Depois de todo deploy, o Next.js troca os IDs internos das Server Actions. Uma
// aba que já estava aberta ANTES do deploy fica com um bundle "preso" que nunca mais
// consegue chamar nenhuma Server Action — nem navegar dentro do app nem fechar/abrir
// a aba resolve, só um reload de verdade busca o bundle novo. Sem essa detecção, o
// erro parece indistinguível de uma queda passageira do VPS, e o fallback offline
// (que existe pra queda de VPS) entra em loop eterno tentando sincronizar uma
// resposta que nunca vai conseguir ser salva sem o reload.
export function isStaleServerActionError(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err);
  return (
    /failed to find server action/i.test(message) ||
    /older or newer deployment/i.test(message)
  );
}

// Recarrega a página pra buscar o build atual. Sempre que uma Server Action falhar
// (seja por build desatualizado, seja por instabilidade real do VPS), reload é a
// ação mais segura: nunca perde progresso — enunciado/resposta/tópico já ficam
// salvos no localStorage antes disso — e corrige os dois casos ao mesmo tempo, sem
// depender do aluno entender o que aconteceu ou saber "recarregar de verdade".
export function reloadForFreshBuild(delayMs = 2500) {
  setTimeout(() => {
    window.location.reload();
  }, delayMs);
}
