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
  if (simulado.tipo !== "DAILY" && simulado.tipo !== "SPECIAL" && simulado.tipo !== "BLOCO_PROVA") {
    redirect("/aluno/painel");
  }

  // Se for especial, checar expiração
  if (simulado.tipo === "SPECIAL" && simulado.expiresAt) {
    if (new Date(simulado.expiresAt) < new Date()) {
      redirect("/aluno/painel");
    }
  }

  // 2. Verificar quais questões o aluno já respondeu. Usamos os IDs reais (não só
  // uma contagem) porque, no Bloco de Provas, novas questões são inseridas com UUID
  // aleatório a cada dia — a ordem "id asc" não é cronológica, então um índice
  // numérico simples não identifica corretamente quais já foram respondidas.
  const questionIds = simulado.questions.map((q) => q.id);
  let answeredQuestionIds: string[] = [];

  if (questionIds.length > 0) {
    const answered = await prisma.answer.findMany({
      where: {
        studentId: user.userId,
        questionId: { in: questionIds }
      },
      select: { questionId: true }
    });
    answeredQuestionIds = answered.map((a) => a.questionId);

    // Se já respondeu todas as questões deste simulado, manda direto para a revisão
    if (answeredQuestionIds.length >= questionIds.length) {
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
      tempoLimite: q.tempoLimite,
      topico: q.topico
    }))
  };

  return (
    <StudentSelfPacedClient
      simulado={safeSimulado}
      studentId={user.userId}
      answeredQuestionIds={answeredQuestionIds}
      apostilaFilePath={apostilaFilePath}
    />
  );
}
