import { getUser } from "@/app/actions/auth";
import StudentDashboardClient from "./DashboardClient";
import { redirect } from "next/navigation";

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export default async function AlunoPainel() {
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
    avatarUrl: dbUser?.avatarUrl || null,
    unlockedBadges: (dbUser as any)?.unlockedBadges ? (dbUser as any).unlockedBadges.split(',').filter(Boolean) : [],
    numero: (dbUser as any)?.numero || null
  };

  const answers = await prisma.answer.findMany({
    where: { studentId: user.userId },
    include: {
      question: {
        include: {
          simulado: true
        }
      }
    },
    orderBy: { id: "desc" }
  });

  const totalAnswers = answers.length;
  const correctAnswers = answers.filter(a => a.isCorrect).length;
  const accuracy = totalAnswers > 0 ? Math.round((correctAnswers / totalAnswers) * 100) : 0;
  const totalScore = answers.reduce((acc, curr) => acc + curr.pontuacao, 0);
  const avgTime = totalAnswers > 0 ? Math.round(answers.reduce((acc, curr) => acc + curr.tempoGasto, 0) / totalAnswers) : 0;

  // History grouped by simulado
  const historyMap = new Map();
  for (const a of answers) {
    const sId = a.question.simuladoId;
    if (!historyMap.has(sId)) {
      historyMap.set(sId, {
        id: sId,
        codigoSala: a.question.simulado.codigoSala,
        totalQuestions: 0,
        correctAnswers: 0,
        score: 0,
      });
    }
    const sStats = historyMap.get(sId);
    sStats.totalQuestions++;
    if (a.isCorrect) sStats.correctAnswers++;
    sStats.score += a.pontuacao;
  }
  
  const history = Array.from(historyMap.values()).map(h => ({
    ...h,
    accuracy: Math.round((h.correctAnswers / h.totalQuestions) * 100)
  }));

  const stats = {
    simuladosCount: history.length,
    totalAnswers,
    accuracy,
    avgTime,
    totalScore,
    history
  };

  return <StudentDashboardClient user={clientUser} stats={stats} />;
}
