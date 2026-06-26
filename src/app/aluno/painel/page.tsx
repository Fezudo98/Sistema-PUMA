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
    name: dbUser?.name || user.name,
    avatarUrl: dbUser?.avatarUrl || null,
    unlockedBadges: (dbUser as any)?.unlockedBadges ? (dbUser as any).unlockedBadges.split(',').filter(Boolean) : [],
    numero: (dbUser as any)?.numero || null
  };

  const answers = await prisma.answer.findMany({
    where: { studentId: user.userId },
    include: {
      question: {
        include: {
          simulado: {
            include: {
              _count: {
                select: { questions: true }
              }
            }
          }
        }
      }
    },
    orderBy: { id: "desc" }
  });

  const totalAnswers = answers.length;
  const correctAnswers = answers.filter(a => a.isCorrect).length;

  // Buscar todas as respostas de sorteio vencidas por outros alunos nesses simulados
  const simuladoIds = Array.from(new Set(answers.map(a => a.question.simuladoId)));
  const otherRaffleAnswers = await prisma.answer.findMany({
    where: {
      question: { simuladoId: { in: simuladoIds } },
      isRaffle: true,
      studentId: { not: user.userId }
    },
    select: {
      question: { select: { simuladoId: true } }
    }
  });

  const otherRaffleCounts = new Map<string, number>();
  otherRaffleAnswers.forEach(ora => {
    const sId = ora.question.simuladoId;
    otherRaffleCounts.set(sId, (otherRaffleCounts.get(sId) || 0) + 1);
  });

  const participatedSimulados = new Map<string, number>();
  answers.forEach(a => {
    const simuladoId = a.question.simuladoId;
    const totalQ = (a.question.simulado as any)._count?.questions || 0;
    const otherRaffleCount = otherRaffleCounts.get(simuladoId) || 0;
    const expectedQ = Math.max(0, totalQ - otherRaffleCount);
    participatedSimulados.set(simuladoId, expectedQ);
  });

  const totalQuestions = Array.from(participatedSimulados.values()).reduce((sum, count) => sum + count, 0);
  const accuracy = totalQuestions > 0 ? Math.round((correctAnswers / totalQuestions) * 100) : 0;
  const totalScore = answers.reduce((acc, curr) => acc + curr.pontuacao, 0);
  const avgTime = totalAnswers > 0 ? Math.round(answers.reduce((acc, curr) => acc + curr.tempoGasto, 0) / totalAnswers) : 0;

  // History grouped by simulado
  const historyMap = new Map();
  for (const a of answers) {
    const sId = a.question.simuladoId;
    if (!historyMap.has(sId)) {
      const totalQ = (a.question.simulado as any)._count?.questions || 0;
      const otherRaffleCount = otherRaffleCounts.get(sId) || 0;
      const expectedQ = Math.max(0, totalQ - otherRaffleCount);
      historyMap.set(sId, {
        id: sId,
        codigoSala: a.question.simulado.codigoSala,
        totalQuestions: expectedQ,
        correctAnswers: 0,
        score: 0,
      });
    }
    const sStats = historyMap.get(sId);
    if (a.isCorrect) sStats.correctAnswers++;
    sStats.score += a.pontuacao;
  }
  
  const history = Array.from(historyMap.values()).map(h => ({
    ...h,
    accuracy: h.totalQuestions > 0 ? Math.round((h.correctAnswers / h.totalQuestions) * 100) : 0
  }));

  const stats = {
    simuladosCount: history.length,
    totalAnswers,
    accuracy,
    avgTime,
    totalScore,
    history
  };

  // Buscar ranking geral da sala (todos os alunos e suas somas de score)
  const dbStudents = await prisma.user.findMany({
    where: { role: "STUDENT" },
    include: {
      answers: {
        select: {
          pontuacao: true
        }
      }
    }
  });

  const generalRanking = dbStudents.map(student => {
    const totalScore = student.answers.reduce((acc, curr) => acc + (curr.pontuacao || 0), 0);
    return {
      id: student.id,
      name: student.name,
      numero: (student as any).numero || null,
      avatarUrl: student.avatarUrl,
      totalScore
    };
  }).sort((a, b) => b.totalScore - a.totalScore);

  // Buscar simulados ativos (WAITING ou ACTIVE)
  const activeRooms = await prisma.simulado.findMany({
    where: {
      status: {
        in: ["WAITING", "ACTIVE"]
      }
    },
    select: {
      id: true,
      codigoSala: true,
      status: true,
      createdAt: true,
      apostilaName: true,
      difficulty: true
    },
    orderBy: {
      createdAt: "desc"
    }
  });

  return (
    <StudentDashboardClient 
      user={clientUser} 
      stats={stats} 
      generalRanking={generalRanking} 
      activeRooms={activeRooms} 
    />
  );
}
