// Ferramenta de auditoria (Fase 6 do plano — ver
// C:\Users\Sergio\.claude\plans\eager-pondering-puddle.md): compara, pra cada
// aluno, o que a leitura O(1) de StudentStats (deriveEffectiveStats) devolve
// contra o recálculo O(histórico completo) de sempre (computeStudentPerformanceStats).
// Só leitura — não grava nada. Seguro de rodar a qualquer momento em produção
// como checagem periódica de desvio entre os dois caminhos.
//
// Uso: npx tsx scripts/audit_student_stats_parity.ts

import { prisma } from "../src/lib/prisma";
import { computeStudentPerformanceStats } from "../src/lib/stats";
import { deriveEffectiveStats } from "../src/lib/studentStatsRead";

async function main() {
  const students = await prisma.user.findMany({ where: { role: "STUDENT" } });
  console.log(`Comparando ${students.length} alunos...\n`);

  const allRaffleAnswers = await prisma.answer.findMany({
    where: { isRaffle: true },
    select: { studentId: true, question: { select: { simuladoId: true } } }
  });

  let mismatches = 0;
  for (const student of students) {
    const answers = await prisma.answer.findMany({
      where: { studentId: student.id },
      include: { question: { include: { simulado: { include: { _count: { select: { questions: true } } } } } } }
    });
    if (answers.length === 0) continue;

    const studentRaffleMap = new Map<string, number>();
    allRaffleAnswers.filter(ra => ra.studentId !== student.id).forEach(ra => {
      const sId = ra.question.simuladoId;
      studentRaffleMap.set(sId, (studentRaffleMap.get(sId) || 0) + 1);
    });

    const bonusStreakDays = (student as any).bonusStreakDays || 0;
    const old = computeStudentPerformanceStats(answers as any, student.id, studentRaffleMap, undefined, bonusStreakDays);

    const stats = await prisma.studentStats.findUnique({ where: { studentId: student.id } });
    const derived = deriveEffectiveStats(stats, bonusStreakDays);

    const diffs: string[] = [];
    if (old.simuladosCount !== derived.simuladosCount) diffs.push(`simuladosCount: ${old.simuladosCount} vs ${derived.simuladosCount}`);
    if (old.totalAnswers !== derived.totalAnswers) diffs.push(`totalAnswers: ${old.totalAnswers} vs ${derived.totalAnswers}`);
    if (old.accuracy !== derived.accuracy) diffs.push(`accuracy: ${old.accuracy} vs ${derived.accuracy}`);
    if (old.avgTime !== derived.avgTime) diffs.push(`avgTime: ${old.avgTime} vs ${derived.avgTime}`);
    if (old.totalScore !== derived.totalScore) diffs.push(`totalScore: ${old.totalScore} vs ${derived.totalScore}`);
    if (old.streakDays !== derived.streakDays) diffs.push(`streakDays: ${old.streakDays} vs ${derived.streakDays}`);
    if (old.todayPoints !== derived.todayPoints) diffs.push(`todayPoints: ${old.todayPoints} vs ${derived.todayPoints}`);

    if (diffs.length > 0) {
      mismatches++;
      console.warn(`⚠️  ${student.name}: ${diffs.join(" | ")}`);
    }
  }

  console.log(mismatches === 0 ? "\n✅ ZERO DIVERGÊNCIAS — deriveEffectiveStats bate exatamente com computeStudentPerformanceStats" : `\n❌ ${mismatches} aluno(s) com divergência`);
  await prisma.$disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
