import { prisma } from "./prisma";

export function generateRoomCode() {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let result = "";
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

export async function generateUniqueRoomCode() {
  let codigoSala = generateRoomCode();
  let codeExists = await prisma.simulado.findUnique({ where: { codigoSala } });
  while (codeExists) {
    codigoSala = generateRoomCode();
    codeExists = await prisma.simulado.findUnique({ where: { codigoSala } });
  }
  return codigoSala;
}
