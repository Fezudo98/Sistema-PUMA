/**
 * Audita a sequência incremental contra o histórico real de respostas e, com
 * --apply, repara somente os campos relacionados à sequência diária.
 *
 * Por padrão é read-only:
 *   npm run repair:streaks
 *   npm run repair:streaks -- --student TARSO
 *
 * Para aplicar:
 *   npm run repair:streaks -- --apply
 *   npm run repair:streaks -- --apply --student TARSO
 */

import { PrismaClient } from "@prisma/client";
import { computeStudentPerformanceStats } from "../src/lib/stats";

const prisma = new PrismaClient();

function getArg(name: string): string | null {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] || null : null;
}

async function main() {
  const apply = process.argv.includes("--apply");
  const studentQuery = getArg("--student");

  const students = await prisma.user.findMany({
    where: {
      role: "STUDENT",
      ...(studentQuery
        ? { name: { contains: studentQuery } }
        : {})
    },
    include: {
      answers: {
        include: {
          question: {
            include: {
              simulado: { include: { _count: { select: { questions: true } } } }
            }
          }
        }
      },
      stats: true
    },
    orderBy: { name: "asc" }
  });

  if (studentQuery && students.length === 0) {
    throw new Error(`Nenhum aluno encontrado para: ${studentQuery}`);
  }

  const raffleAnswers = await prisma.answer.findMany({
    where: { isRaffle: true },
    select: { studentId: true, question: { select: { simuladoId: true } } }
  });
  const totalRaffleBySimulado = new Map<string, number>();
  const studentRaffleBySimulado = new Map<string, number>();
  for (const answer of raffleAnswers) {
    const simuladoId = answer.question.simuladoId;
    totalRaffleBySimulado.set(simuladoId, (totalRaffleBySimulado.get(simuladoId) || 0) + 1);
    const key = `${answer.studentId}_${simuladoId}`;
    studentRaffleBySimulado.set(key, (studentRaffleBySimulado.get(key) || 0) + 1);
  }

  let divergent = 0;
  let repaired = 0;

  for (const student of students) {
    const historical = computeStudentPerformanceStats(
      student.answers,
      student.id,
      totalRaffleBySimulado,
      studentRaffleBySimulado,
      student.bonusStreakDays || 0
    );
    const expectedRawStreak = Math.max(0, historical.streakDays - (student.bonusStreakDays || 0));
    const expectedLastDay = historical.completedDaysSet.length > 0
      ? [...historical.completedDaysSet].sort().at(-1) || null
      : null;
    const storedRawStreak = student.stats?.currentStreakLength || 0;
    const storedLastDay = student.stats?.lastCompletedDay || null;

    if (storedRawStreak === expectedRawStreak && storedLastDay === expectedLastDay) continue;

    divergent++;
    console.log(
      `${student.name}: sequência ${storedRawStreak} -> ${expectedRawStreak}; ` +
      `último dia ${storedLastDay || "—"} -> ${expectedLastDay || "—"}`
    );

    if (apply) {
      await prisma.studentStats.upsert({
        where: { studentId: student.id },
        create: {
          studentId: student.id,
          currentStreakLength: expectedRawStreak,
          lastCompletedDay: expectedLastDay
        },
        update: {
          currentStreakLength: expectedRawStreak,
          lastCompletedDay: expectedLastDay
        }
      });
      repaired++;
    }
  }

  console.log(
    apply
      ? `\nAuditoria concluída: ${divergent} divergência(s), ${repaired} reparada(s).`
      : `\nAuditoria concluída: ${divergent} divergência(s). Nenhuma alteração aplicada (use --apply).`
  );
}

main()
  .catch((error) => {
    console.error("Falha ao auditar/reparar sequências:", error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
