import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

const isNewClient = !globalForPrisma.prisma;

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

// WAL permite leituras concorrentes durante uma escrita (o modo padrão do SQLite,
// "rollback journal", bloqueia o banco inteiro pra qualquer leitor durante uma
// escrita) — reduz os erros de "Socket timeout" sob carga concorrente (salas Ao
// Vivo/Duelo com vários alunos respondendo ao mesmo tempo). Roda uma vez por
// processo real (não a cada hot-reload em dev); falha aqui não deve derrubar o
// boot do servidor.
if (isNewClient) {
  // PRAGMA journal_mode devolve uma linha com o modo resultante — precisa de
  // $queryRawUnsafe (não $executeRawUnsafe, que rejeita statements com resultado).
  prisma.$queryRawUnsafe("PRAGMA journal_mode=WAL;").catch((err) => {
    console.error("Falha ao ativar WAL mode no SQLite:", err);
  });
}
