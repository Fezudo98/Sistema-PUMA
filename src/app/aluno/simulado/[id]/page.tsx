import { prisma } from "@/lib/prisma";
import { getUser } from "@/app/actions/auth";
import { redirect } from "next/navigation";
import StudentSelfPacedClient from "./StudentSelfPacedClient";

export default async function StudentSelfPacedPage({
  params
}: {
  params: { id: string };
}) {
  const user = await getUser();
  if (!user || user.role !== "STUDENT") {
    redirect("/aluno");
  }

  const { id } = await params;

  // 1. Buscar o simulado
  const simulado = await prisma.simulado.findUnique({
    where: { id },
    include: {
      questions: {
        orderBy: { id: "asc" }
      }
    }
  });

  if (!simulado) {
    redirect("/aluno/painel");
  }

  // 2. Verificar se o aluno já completou este simulado
  const questionIds = simulado.questions.map((q) => q.id);
  let studentAnswersCount = 0;
  
  if (questionIds.length > 0) {
    studentAnswersCount = await prisma.answer.count({
      where: {
        studentId: user.userId,
        questionId: { in: questionIds }
      }
    });

    // Se já respondeu todas as questões deste simulado, manda direto para a revisão
    if (studentAnswersCount >= questionIds.length) {
      redirect(`/aluno/simulado/${id}/review`);
    }
  }

  // 3. Buscar o filePath da apostila para o visualizador de PDF
  let apostilaFilePath = null;
  if (simulado.apostilaName) {
    const apostila = await prisma.apostila.findFirst({
      where: { title: simulado.apostilaName }
    });
    if (apostila) {
      apostilaFilePath = apostila.filePath;
    }
  }

  return (
    <StudentSelfPacedClient 
      simulado={simulado} 
      studentId={user.userId} 
      initialProgress={studentAnswersCount}
      apostilaFilePath={apostilaFilePath}
    />
  );
}
