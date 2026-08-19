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

  // Este fluxo self-paced só existe para simulados DAILY e SPECIAL — LIVE e
  // PRESENTATION têm seus próprios fluxos (sala em tempo real / condução do
  // instrutor) e não devem ser respondíveis por aqui.
  if (simulado.tipo !== "DAILY" && simulado.tipo !== "SPECIAL") {
    redirect("/aluno/painel");
  }

  // Se for especial, checar expiração
  if (simulado.tipo === "SPECIAL" && simulado.expiresAt) {
    if (new Date(simulado.expiresAt) < new Date()) {
      redirect("/aluno/painel");
    }
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

  // Nunca envia o gabarito (correta/justificativa) pro cliente antes de o aluno
  // responder — StudentSelfPacedClient só precisa desses campos, e a correção vem
  // da resposta de saveSelfPacedAnswer no momento em que a questão é respondida.
  const safeSimulado = {
    id: simulado.id,
    apostilaName: simulado.apostilaName,
    questions: simulado.questions.map((q) => ({
      id: q.id,
      enunciado: q.enunciado,
      alternativas: q.alternativas,
      tempoLimite: q.tempoLimite
    }))
  };

  return (
    <StudentSelfPacedClient
      simulado={safeSimulado}
      studentId={user.userId}
      initialProgress={studentAnswersCount}
      apostilaFilePath={apostilaFilePath}
    />
  );
}
