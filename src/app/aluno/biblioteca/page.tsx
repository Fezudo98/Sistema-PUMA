import { prisma } from '@/lib/prisma';
import { getUser } from "@/app/actions/auth";
import { redirect } from "next/navigation";
import BibliotecaClient from "./BibliotecaClient";
export default async function BibliotecaPage() {
  const user = await getUser();
  if (!user || user.role !== "STUDENT") {
    redirect("/");
  }

  // Busca todas as apostilas ativas
  const apostilas = await prisma.apostila.findMany({
    where: { isActive: true },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      title: true,
      createdAt: true
    }
  });

  // Busca estatísticas de anotações desse usuário para exibir na listagem (opcional)
  const annotationsCounts = await prisma.apostilaAnnotation.groupBy({
    by: ['apostilaId'],
    where: { userId: user.userId },
    _count: {
      id: true
    }
  });

  const countMap = new Map();
  annotationsCounts.forEach(c => {
    countMap.set(c.apostilaId, c._count.id);
  });

  const apostilasWithCounts = apostilas.map(ap => ({
    ...ap,
    annotationsCount: countMap.get(ap.id) || 0
  }));

  return <BibliotecaClient user={user} apostilas={apostilasWithCounts} />;
}
