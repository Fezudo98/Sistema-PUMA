import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getLocalDayString } from "@/lib/stats";
import { deriveEffectiveStats } from "@/lib/studentStatsRead";
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

    // Estatísticas pré-agregadas (StudentStats) — O(1) por aluno, não recarrega o
    // histórico completo de respostas de ninguém.
    const students = await prisma.user.findMany({
      where: { role: "STUDENT", isTestUser: false, lastStreakWarningDay: { not: todayStr } },
      select: { id: true, name: true, bonusStreakDays: true }
    });

    const statsRows = await prisma.studentStats.findMany({
      where: { studentId: { in: students.map((s) => s.id) } }
    });
    const statsByStudent = new Map(statsRows.map((s) => [s.studentId, s]));

    let warned = 0;
    for (const student of students) {
      const rawStats = statsByStudent.get(student.id) || null;
      if (!rawStats) continue; // sem histórico ainda — nada a avisar

      const perf = deriveEffectiveStats(rawStats, student.bonusStreakDays || 0);
      const alreadyDoneToday = rawStats.lastCompletedDay === todayStr;
      const hasStreakAtRisk = !alreadyDoneToday && perf.streakDays > 0;

      if (!hasStreakAtRisk) continue;

      await sendPushToUser(student.id, {
        title: "Sua sequência está em risco!",
        body: `Faltam poucas horas pra virar o dia e você ainda não garantiu hoje. Não perca sua sequência de ${perf.streakDays} dias!`,
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
