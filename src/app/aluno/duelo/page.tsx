import { getUser } from "@/app/actions/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import DueloLobbyClient from "./DueloLobbyClient";

export default async function DueloLobbyPage() {
  const user = await getUser();
  if (!user || user.role !== "STUDENT") {
    redirect("/aluno");
  }

  const [students, apostilas] = await Promise.all([
    prisma.user.findMany({
      where: { role: "STUDENT", id: { not: user.userId }, isTestUser: false },
      select: { id: true, name: true, numero: true },
      orderBy: { numero: "asc" }
    }),
    prisma.apostila.findMany({
      where: { isActive: true },
      select: { id: true, title: true },
      orderBy: { title: "asc" }
    })
  ]);

  return <DueloLobbyClient user={user} students={students} apostilas={apostilas} />;
}
