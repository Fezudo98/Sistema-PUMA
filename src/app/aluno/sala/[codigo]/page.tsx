import { getUser } from "@/app/actions/auth";
import { redirect } from "next/navigation";
import { PrismaClient } from "@prisma/client";
import StudentLiveClient from "./StudentLiveClient";

const prisma = new PrismaClient();

export default async function StudentLiveRoom({ params }: { params: Promise<{ codigo: string }> }) {
  const user = await getUser();
  const { codigo } = await params;
  
  if (!user || user.role !== "STUDENT") {
    redirect("/auth/login");
  }

  const codigoSala = codigo.toUpperCase();

  const simulado = await prisma.simulado.findUnique({
    where: { codigoSala }
  });

  if (!simulado) {
    redirect("/aluno/painel?error=sala_nao_encontrada");
  }

  if (simulado.status === "FINISHED") {
    redirect("/aluno/painel?error=simulado_encerrado");
  }

  const dbUser = await prisma.user.findUnique({ where: { id: user.userId } });
  const clientUser = {
    ...user,
    avatarUrl: dbUser?.avatarUrl || null
  };

  return <StudentLiveClient user={clientUser} simulado={simulado} />;
}
