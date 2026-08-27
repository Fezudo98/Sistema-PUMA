import { getUser } from "@/app/actions/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import DuelBattleClient from "./DuelBattleClient";

export default async function DuelBattlePage({ params }: { params: Promise<{ codigo: string }> }) {
  const user = await getUser();
  const { codigo } = await params;

  if (!user || user.role !== "STUDENT") {
    redirect("/auth/login");
  }

  const codigoSala = codigo.toUpperCase();

  const simulado = await prisma.simulado.findUnique({ where: { codigoSala } });

  if (!simulado || simulado.tipo !== "DUELO") {
    redirect("/aluno/duelo?error=duelo_nao_encontrado");
  }

  const duelo = await prisma.duelo.findUnique({ where: { simuladoId: simulado.id } });
  if (!duelo || (duelo.challengerId !== user.userId && duelo.challengedId !== user.userId)) {
    redirect("/aluno/duelo?error=sem_acesso");
  }

  const opponentId = duelo.challengerId === user.userId ? duelo.challengedId! : duelo.challengerId;
  const [dbUser, opponent] = await Promise.all([
    prisma.user.findUnique({ where: { id: user.userId } }),
    prisma.user.findUnique({ where: { id: opponentId } })
  ]);

  const clientUser = { ...user, avatarUrl: dbUser?.avatarUrl || null };

  return (
    <DuelBattleClient
      user={clientUser}
      simulado={simulado}
      duelo={{ flexoesAposta: duelo.flexoesAposta, questionCount: duelo.questionCount }}
      opponentName={opponent?.name || "Combatente"}
    />
  );
}
