import { getUser } from "@/app/actions/auth";
import { redirect } from "next/navigation";
import { PrismaClient } from "@prisma/client";
import StudentInventoryWrapper from "./StudentInventoryWrapper";

const prisma = new PrismaClient();

export default async function AlunoInventoryPage() {
  const user = await getUser();
  
  if (!user || user.role !== "STUDENT") {
    redirect("/aluno");
  }

  const dbUser = await prisma.user.findUnique({ where: { id: user.userId } });
  if (!dbUser) {
    redirect("/api/auth/force-logout");
  }

  const clientUser = {
    id: dbUser.id,
    name: dbUser.name || user.name,
    role: dbUser.role || "STUDENT"
  };

  return <StudentInventoryWrapper user={clientUser} />;
}
