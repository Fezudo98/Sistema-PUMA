"use server";

import { prisma } from "@/lib/prisma";
import { getUser } from "./auth";

export async function getInstructorReports(startDateIso: string, endDateIso: string) {
  const user = await getUser();
  if (!user || user.role !== "INSTRUCTOR") {
    return { error: "Não autorizado." };
  }

  try {
    // Força o fuso horário de Brasília (UTC-3) para garantir que as estatísticas do dia local sejam capturadas perfeitamente
    const startDate = new Date(startDateIso + "T00:00:00.000-03:00");
    const endDate = new Date(endDateIso + "T23:59:59.999-03:00");

    const dateFilter = {
      gte: startDate,
      lte: endDate,
    };

    // Buscamos todas as respostas que aconteceram no período
    // Opcional: Filtrar apenas respostas para simulados criados por este instrutor?
    // Como é um sistema de pelotão, geralmente o instrutor quer ver os dados globais ou de seus simulados.
    // Vamos buscar os dados globais para mostrar o engajamento da tropa.
    const answers = await prisma.answer.findMany({
      where: {
        createdAt: dateFilter,
      },
      include: {
        question: {
          include: {
            simulado: true
          }
        },
        student: {
          select: { id: true, name: true }
        }
      }
    });

    const totalAnswers = answers.length;
    const correctAnswers = answers.filter((a) => a.isCorrect).length;
    const accuracy = totalAnswers > 0 ? Math.round((correctAnswers / totalAnswers) * 100) : 0;
    const uniqueStudents = new Set(answers.map((a) => a.studentId)).size;

    // Engagement Chart Data (Answers per day)
    const engagementMap = new Map<string, number>();
    
    // Initialize map with all days in range to ensure empty days show 0
    let curr = new Date(startDate);
    while (curr <= endDate) {
      const dateStr = curr.toISOString().split("T")[0];
      engagementMap.set(dateStr, 0);
      curr.setUTCDate(curr.getUTCDate() + 1);
    }

    answers.forEach(a => {
      const dateStr = a.createdAt.toISOString().split("T")[0];
      if (engagementMap.has(dateStr)) {
        engagementMap.set(dateStr, engagementMap.get(dateStr)! + 1);
      }
    });

    const engagementData = Array.from(engagementMap.entries())
      .map(([date, count]) => ({ date, respostas: count }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // Performance per Apostila (Module)
    const apostilaMap = new Map<string, { total: number; corrects: number }>();

    answers.forEach(a => {
      const apostilaName = a.question.simulado.apostilaName || "Missões Avulsas";
      if (!apostilaMap.has(apostilaName)) {
        apostilaMap.set(apostilaName, { total: 0, corrects: 0 });
      }
      const st = apostilaMap.get(apostilaName)!;
      st.total += 1;
      if (a.isCorrect) st.corrects += 1;
    });

    const apostilaData = Array.from(apostilaMap.entries()).map(([name, st]) => ({
      name,
      respostas: st.total,
      acerto: Math.round((st.corrects / st.total) * 100)
    })).sort((a, b) => b.respostas - a.respostas);

    // Get Top 3 active students
    const studentCount = new Map<string, { name: string; count: number }>();
    answers.forEach(a => {
      if (!studentCount.has(a.studentId)) {
        studentCount.set(a.studentId, { name: a.student.name, count: 0 });
      }
      studentCount.get(a.studentId)!.count += 1;
    });

    const topStudents = Array.from(studentCount.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 3);

    return {
      success: true,
      data: {
        totalAnswers,
        accuracy,
        uniqueStudents,
        engagementData,
        apostilaData,
        topStudents
      }
    };
  } catch (error: any) {
    console.error("Erro ao buscar relatórios:", error);
    return { error: error.message || "Erro desconhecido." };
  }
}
