import { getUser } from "@/app/actions/auth";
import { redirect } from "next/navigation";
import { PrismaClient } from "@prisma/client";
import InstructorLiveClient from "./InstructorLiveClient";

const prisma = new PrismaClient();

export default async function InstructorLivePanel({ params }: { params: Promise<{ id: string }> }) {
  const user = await getUser();
  const { id } = await params;

  if (!user || user.role !== "INSTRUCTOR") {
    redirect("/auth/login");
  }

  const simulado = await prisma.simulado.findUnique({
    where: { id },
    include: {
      questions: {
        orderBy: { id: "asc" }
      }
    }
  });

  if (!simulado) {
    redirect("/instructor");
  }

  // Ensure this instructor owns the simulado
  if (simulado.instructorId !== user.userId) {
    redirect("/instructor");
  }

  // Parse alternativas since they are JSON stringified in DB
  const questionsParsed = simulado.questions.map(q => ({
    ...q,
    alternativas: JSON.parse(q.alternativas)
  }));

  const simuladoParsed = {
    ...simulado,
    questions: questionsParsed
  };

  return <InstructorLiveClient user={user} simulado={simuladoParsed} />;
}
