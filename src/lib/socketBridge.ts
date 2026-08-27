// Ponte mínima para que server actions (rodando no mesmo processo Node do
// server.ts, já que é um custom server) notifiquem um aluno específico em tempo
// real, sem duplicar a autenticação/roteamento de sockets já existente em server.ts.
// O polling continua sendo a fonte de verdade — isso é só para reduzir a latência
// percebida (convite de duelo recebido, pareamento na fila).
let ioInstance: any = null;

export function setIoInstance(io: any) {
  ioInstance = io;
}

export function emitToUser(userId: string, event: string, payload: any) {
  if (!ioInstance) return; // no-op durante build ou antes do server.ts subir
  ioInstance.to(`user:${userId}`).emit(event, payload);
}
