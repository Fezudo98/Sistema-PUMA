import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { computeStudentPerformanceStats, getLocalDayString } from "@/lib/stats";
import { sendPushToUser } from "@/lib/push";

// A partir de que hora local (America/Fortaleza) já é "faltam 2h pra virar o dia"
// (o dia vira à meia-noite, então o aviso começa às 22h).
const WARNING_START_HOUR = 22;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const key = searchParams.get("key") || "";

  const authHeader = request.headers.get("authorization") || "";
  const token = authHeader.replace("Bearer ", "").trim();

  const secret = process.env.CRON_SECRET || "";

  if (!secret || (token !== secret && key !== secret)) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  try {
    const now = new Date();
    const localHour = parseInt(
      new Intl.DateTimeFormat("en-US", { timeZone: "America/Fortaleza", hour: "2-digit", hour12: false }).format(now),
      10
    );

    if (localHour < WARNING_START_HOUR) {
      return NextResponse.json({ success: true, skipped: "fora da janela de aviso (antes das 22h)" });
    }

    const todayStr = getLocalDayString(now);

    // Mesmo cálculo de raffle usado no ranking geral, pra não achar que um simulado
    // com sorteio ficou "incompleto" indevidamente.
    const allRaffleAnswers = await prisma.answer.findMany({
      where: { isRaffle: true },
      select: { studentId: true, question: { select: { simuladoId: true } } }
    });
    const totalRaffleInSimulado = new Map<string, number>();
    const studentRaffleInSimulado = new Map<string, number>();
    allRaffleAnswers.forEach((ra) => {
      const sId = ra.question.simuladoId;
      const uId = ra.studentId;
      totalRaffleInSimulado.set(sId, (totalRaffleInSimulado.get(sId) || 0) + 1);
      studentRaffleInSimulado.set(`${uId}_${sId}`, (studentRaffleInSimulado.get(`${uId}_${sId}`) || 0) + 1);
    });

    const students = await prisma.user.findMany({
      where: { role: "STUDENT", isTestUser: false, lastStreakWarningDay: { not: todayStr } },
      select: {
        id: true,
        name: true,
        bonusStreakDays: true,
        answers: {
          select: {
            createdAt: true,
            pontuacao: true,
            tempoGasto: true,
            isCorrect: true,
            question: {
              select: {
                simuladoId: true,
                simulado: {
                  select: { tipo: true, status: true, createdAt: true, _count: { select: { questions: true } } }
                }
              }
            }
          }
        }
      }
    });

    let warned = 0;
    for (const student of students) {
      const stats = computeStudentPerformanceStats(
        student.answers as any,
        student.id,
        totalRaffleInSimulado,
        studentRaffleInSimulado,
        student.bonusStreakDays || 0
      );

      const alreadyDoneToday = stats.completedDaysSet.includes(todayStr);
      const hasStreakAtRisk = !alreadyDoneToday && stats.streakDays > 0;

      if (!hasStreakAtRisk) continue;

      await sendPushToUser(student.id, {
        title: "Sua sequência está em risco!",
        body: `Faltam poucas horas pra virar o dia e você ainda não garantiu hoje. Não perca sua sequência de ${stats.streakDays} dias!`,
        url: "/aluno/painel",
        tag: `streak-warning-${todayStr}`
      });

      await prisma.user.update({ where: { id: student.id }, data: { lastStreakWarningDay: todayStr } });
      warned++;
    }

    return NextResponse.json({ success: true, checked: students.length, warned });
  } catch (err: any) {
    console.error("[CRON streak-warning ERROR]", err);
    return NextResponse.json({ error: err.message || "Erro interno do servidor." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  return GET(request);
}
