import { getUser } from "@/app/actions/auth";
import { redirect } from "next/navigation";
import { PrismaClient } from "@prisma/client";
import VadeMecumClient from "./VadeMecumClient";

const prisma = new PrismaClient();

export default async function AlunoVadeMecumPage() {
  const user = await getUser();
  
  if (!user || user.role !== "STUDENT") {
    redirect("/aluno");
  }

  const dbUser = await prisma.user.findUnique({ where: { id: user.userId } });
  if (!dbUser) {
    redirect("/api/auth/force-logout");
  }

  const clientUser = {
    ...user,
    name: dbUser.name || user.name,
    avatarUrl: dbUser.avatarUrl || null,
  };

  // Fetch active booklets containing Vade Mecum text
  const apostilas = await prisma.apostila.findMany({
    where: { isActive: true },
    select: {
      id: true,
      title: true,
      vadeMecum: true,
      createdAt: true
    },
    orderBy: { createdAt: "desc" }
  });

  return (
    <VadeMecumClient 
      user={clientUser} 
      initialApostilas={apostilas as any[]} 
    />
  );
}
