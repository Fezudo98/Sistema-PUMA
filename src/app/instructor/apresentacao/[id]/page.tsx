import { prisma } from "@/lib/prisma";
import { getUser } from "@/app/actions/auth";
import { redirect } from "next/navigation";
import InstructorPresentationClient from "./InstructorPresentationClient";

export default async function InstructorPresentationPage({
  params
}: {
  params: { id: string };
}) {
  const user = await getUser();
  if (!user || user.role !== "INSTRUCTOR") {
    redirect("/auth/login");
  }

  const { id } = await params;

  const simulado = await prisma.simulado.findUnique({
    where: { id },
    include: {
      questions: { orderBy: { id: "asc" } }
    }
  });

  if (!simulado || simulado.tipo !== "PRESENTATION" || simulado.instructorId !== user.userId) {
    redirect("/instructor");
  }

  if (simulado.status === "FINISHED") {
    redirect(`/instructor/apresentacao/${id}/review`);
  }

  return <InstructorPresentationClient simulado={simulado} />;
}
