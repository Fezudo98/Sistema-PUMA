import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getLocalDayString } from "@/lib/stats";
import { deriveEffectiveStats } from "@/lib/studentStatsRead";
import { sendPushToUser } from "@/lib/push";

// A partir de que hora local (America/Fortaleza) já é "faltam 2h pra virar o dia"
// (o dia vira à meia-noite, então o aviso começa às 22h).
const WARNING_START_HOUR = 22;

// Variações engraçadas do aviso de sequência em risco — uma é sorteada por aluno a
// cada disparo, pra não cansar quem recebe o mesmo aviso todo dia às 22h.
const STREAK_WARNING_VARIANTS: Array<(name: string, streakDays: number) => { title: string; body: string }> = [
  (name, streakDays) => ({
    title: "O simulado não se resolve sozinho",
    body: `Sabe, ${name}, o simulado de hoje não vai se resolver sozinho. Faltam poucas horas e sua sequência de ${streakDays} dias tá te olhando.`
  }),
  (name, streakDays) => ({
    title: "Sua sequência está pedindo arrego",
    body: `${name}, sua sequência de ${streakDays} dias está pendurada por um fio. Ela confia em você — não deixa cair hoje.`
  }),
  (name, streakDays) => ({
    title: "O Comando está de olho",
    body: `Recruta ${name}, faltam poucas horas pro dia virar e a missão de hoje ainda não foi cumprida. O Sargento tá contando.`
  }),
  (name) => ({
    title: "Psiu, recruta",
    body: `Psiu, ${name}. Aquele simulado aí não vai clicar em "responder" sozinho. Bora resolver isso antes da meia-noite.`
  }),
  (name, streakDays) => ({
    title: "Alerta vermelho de sequência",
    body: `Alerta, ${name}: menos de 2h pro dia virar e sua sequência de ${streakDays} dias ainda não foi garantida hoje.`
  }),
  (name) => ({
    title: "Treino duro hoje, choro evitado amanhã",
    body: `${name}, treino duro hoje evita choro amanhã. Resolve logo esse simulado e volta pra cama tranquilo.`
  }),
  (name, streakDays) => ({
    title: "Faltam poucas horas, soldado",
    body: `${name}, o relógio não para e sua sequência de ${streakDays} dias também não devia. Ainda dá tempo de garantir hoje.`
  }),
  (name) => ({
    title: "O inimigo não descansa",
    body: `${name}, a prova não tira folga, você também não deveria hoje. Falta pouco tempo pro dia virar — vai lá.`
  })
];

function pickStreakWarningMessage(name: string, streakDays: number) {
  const variant = STREAK_WARNING_VARIANTS[Math.floor(Math.random() * STREAK_WARNING_VARIANTS.length)];
  return variant(name, streakDays);
}

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

      const firstName = (student.name || "recruta").trim().split(/\s+/)[0];
      const { title, body } = pickStreakWarningMessage(firstName, perf.streakDays);
      await sendPushToUser(student.id, {
        title,
        body,
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
