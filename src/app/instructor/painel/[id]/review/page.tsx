import { PrismaClient } from "@prisma/client";
import { getUser } from "@/app/actions/auth";
import { redirect } from "next/navigation";
import ReviewClient from "./ReviewClient";

const prisma = new PrismaClient();

export default async function SimuladoReviewPage({ params }: { params: { id: string } }) {
  const user = await getUser();
  if (!user || user.role !== "INSTRUCTOR") redirect("/auth/login");

  const { id } = await params;

  const simulado = await prisma.simulado.findUnique({
    where: { id },
    include: {
      questions: {
        include: {
          answers: {
            include: { student: true }
          }
        },
        orderBy: { id: "asc" }
      }
    }
  });

  if (!simulado) redirect("/instructor");

  // Calculate student scores for Podium
  const studentScores: Record<string, { name: string; score: number; answers: number; avgTime: number; totalTime: number }> = {};
  let totalAnswers = 0;
  let correctAnswers = 0;

  simulado.questions.forEach(q => {
    q.answers.forEach(a => {
      totalAnswers++;
      if (a.isCorrect) correctAnswers++;

      if (!studentScores[a.studentId]) {
        studentScores[a.studentId] = { name: a.student.name, score: 0, answers: 0, totalTime: 0, avgTime: 0 };
      }
      studentScores[a.studentId].score += a.pontuacao;
      studentScores[a.studentId].answers += 1;
      studentScores[a.studentId].totalTime += a.tempoGasto;
    });
  });

  const ranking = Object.values(studentScores).map(s => ({
    ...s,
    avgTime: s.answers > 0 ? Math.round(s.totalTime / s.answers) : 0
  })).sort((a, b) => b.score - a.score);

  const globalAccuracy = totalAnswers > 0 ? Math.round((correctAnswers / totalAnswers) * 100) : 0;

  return (
    <ReviewClient 
      simulado={simulado} 
      ranking={ranking} 
      globalAccuracy={globalAccuracy} 
    />
  );
}
