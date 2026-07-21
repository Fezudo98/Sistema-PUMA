import { PrismaClient } from '@prisma/client';
import { computeStudentPerformanceStats } from './src/lib/stats';

const prisma = new PrismaClient();

async function runBadgesBackfill() {
  console.log("=========================================================");
  console.log("🎖️  INICIANDO BACKFILL RETROATIVO DE BREVÊS (INSÍGNIAS)  🎖️");
  console.log("=========================================================\n");

  try {
    const students = await prisma.user.findMany({
      where: { role: { in: ['STUDENT', 'ALUNO'] } },
      include: {
        answers: {
          include: {
            question: {
              include: {
                simulado: {
                  include: {
                    _count: { select: { questions: true } }
                  }
                }
              }
            }
          }
        }
      }
    });

    console.log(`Analisando histórico de ${students.length} recrutas...\n`);

    // Busca todas as respostas de sorteio para exclusão no cálculo de totais
    const allRaffleAnswers = await prisma.answer.findMany({
      where: { isRaffle: true },
      select: {
        studentId: true,
        question: { select: { simuladoId: true } }
      }
    });

    const otherRaffleCounts = new Map<string, number>();
    allRaffleAnswers.forEach(ra => {
      const sId = ra.question.simuladoId;
      otherRaffleCounts.set(sId, (otherRaffleCounts.get(sId) || 0) + 1);
    });

    let totalUpdatedStudents = 0;
    let totalBadgesGranted = 0;

    for (const student of students) {
      if (!student.answers || student.answers.length === 0) continue;

      // Filtra as contagens de sorteio dos outros recrutas para este aluno especificamente
      const studentRaffleMap = new Map<string, number>();
      allRaffleAnswers
        .filter(ra => ra.studentId !== student.id)
        .forEach(ra => {
          const sId = ra.question.simuladoId;
          studentRaffleMap.set(sId, (studentRaffleMap.get(sId) || 0) + 1);
        });

      const sPerf = computeStudentPerformanceStats(student.answers as any, student.id, studentRaffleMap);
      const simuladosCount = sPerf.simuladosCount;
      const accuracy = sPerf.accuracy;
      const totalScore = sPerf.totalScore;

      // Agrupa respostas por simulado para checar dificuldade e tempo médio
      const simuladoGroups: Record<string, typeof student.answers> = {};
      student.answers.forEach(a => {
        if (!simuladoGroups[a.question.simuladoId]) simuladoGroups[a.question.simuladoId] = [];
        simuladoGroups[a.question.simuladoId].push(a);
      });

      let advancedSimuladosCount = 0;
      let hardSimuladosWith70Acc = 0;
      let hardSimuladosWith75Acc = 0;
      let hasSniper = false;
      let hasRaio = false;
      let sniperSimuladoId = "";
      let raioSimuladoId = "";
      let lastAdvancedSimuladoId = "";

      Object.entries(simuladoGroups).forEach(([simId, simAnswers]) => {
        if (simAnswers.length === 0) return;
        const qCount = simAnswers.length;
        const totalQuestionsInSimulado = simAnswers[0].question.simulado._count.questions;
        const corrects = simAnswers.filter(a => a.isCorrect).length;
        
        const acc = Math.round((corrects / totalQuestionsInSimulado) * 100);
        const avgTime = Math.round(simAnswers.reduce((acc, curr) => acc + (curr.tempoGasto || 0), 0) / qCount);
        const difficulty = simAnswers[0].question.simulado.difficulty || "AVANCADO";

        const isCompleteEnough = qCount === totalQuestionsInSimulado || qCount >= 10;

        if (difficulty === "AVANCADO" && isCompleteEnough) {
          advancedSimuladosCount++;
          lastAdvancedSimuladoId = simId;
          if (acc >= 70) hardSimuladosWith70Acc++;
          if (acc >= 75) hardSimuladosWith75Acc++;
          
          if (qCount >= 20 && acc === 100) {
            hasSniper = true;
            sniperSimuladoId = simId;
          }
          if (acc >= 85 && avgTime <= 15) {
            hasRaio = true;
            raioSimuladoId = simId;
          }
        }
      });

      const hasRecruta = simuladosCount >= 3 && totalScore >= 3000;

      // Checagem disciplinar / bem-humorada
      let maxConsecutiveErrors = 0;
      let currentConsecutiveErrors = 0;
      student.answers.forEach(a => {
        if (!a.isCorrect) {
          currentConsecutiveErrors++;
          if (currentConsecutiveErrors > maxConsecutiveErrors) {
            maxConsecutiveErrors = currentConsecutiveErrors;
          }
        } else {
          currentConsecutiveErrors = 0;
        }
      });
      const hasBizonho = maxConsecutiveErrors >= 3;
      const hasAfoito = student.answers.some(a => !a.isCorrect && a.tempoGasto > 0 && a.tempoGasto < 3);
      const hasDorminhoco = student.answers.some(a => a.alternativa === -1);

      let hasPepreto = false;
      Object.values(simuladoGroups).forEach(simAnswers => {
        if (simAnswers.length === 0) return;
        const totalQuestionsInSimulado = simAnswers[0].question.simulado._count.questions;
        const corrects = simAnswers.filter(a => a.isCorrect).length;
        const acc = Math.round((corrects / totalQuestionsInSimulado) * 100);
        
        if (totalQuestionsInSimulado >= 5 && simAnswers.length === totalQuestionsInSimulado) {
          if (acc < 10) {
            hasPepreto = true;
          }
        }
      });

      const badges = [
        { id: 'recruta', name: 'Recruta', earned: hasRecruta, exclusive: false, simId: "" },
        { id: 'guerreiro', name: 'Guerreiro', earned: hardSimuladosWith70Acc >= 10 && totalScore >= 25000, exclusive: false, simId: "" },
        { id: 'veterano', name: 'Veterano', earned: hardSimuladosWith75Acc >= 25 && totalScore >= 60000, exclusive: false, simId: "" },
        { id: 'sniper', name: 'Atirador de Elite', earned: hasSniper && totalScore >= 80000, exclusive: false, simId: sniperSimuladoId },
        { id: 'raio', name: 'Pronto Resposta (Raio)', earned: hasRaio && totalScore >= 50000, exclusive: false, simId: raioSimuladoId },
        { id: 'caveira', name: 'Caveira', earned: advancedSimuladosCount >= 40 && accuracy >= 97 && totalScore >= 100000, exclusive: false, simId: lastAdvancedSimuladoId },
        { id: 'padrao', name: 'Padrão PM', earned: totalScore >= 150000 && accuracy >= 92, exclusive: false, simId: lastAdvancedSimuladoId },
        { id: 'bizonho', name: 'Bizonho', earned: hasBizonho, exclusive: false, simId: "" },
        { id: 'afoito', name: 'Gatilho Afoito', earned: hasAfoito, exclusive: false, simId: "" },
        { id: 'dorminhoco', name: 'Dormiu na Guarita', earned: hasDorminhoco, exclusive: false, simId: "" },
        { id: 'pepreto', name: 'Pé Preto', earned: hasPepreto, exclusive: false, simId: "" }
      ];

      const earnedBadgeIds = badges.filter(b => b.earned).map(b => b.id);
      const previouslyUnlocked = student.unlockedBadges ? student.unlockedBadges.split(',').filter(Boolean) : [];
      const newlyUnlocked = earnedBadgeIds.filter(id => !previouslyUnlocked.includes(id));

      if (newlyUnlocked.length > 0) {
        const newUnlockedBadges = [...previouslyUnlocked, ...newlyUnlocked].join(',');
        await prisma.user.update({
          where: { id: student.id },
          data: { unlockedBadges: newUnlockedBadges }
        });

        const newlyNames = badges.filter(b => newlyUnlocked.includes(b.id)).map(b => b.name).join(", ");
        console.log(`🟢 [RETROATIVO] Recruta: ${student.numero ? `${student.numero} - ` : ''}${student.name} | Destravou: ${newlyNames}`);
        
        totalUpdatedStudents++;
        totalBadgesGranted += newlyUnlocked.length;
      }
    }

    console.log("\n=========================================================");
    console.log(`✅ Backfill de brevês concluído com sucesso!`);
    console.log(`   Recrutas com novas insígnias liberadas: ${totalUpdatedStudents}`);
    console.log(`   Total de brevês concedidos retroativamente: ${totalBadgesGranted}`);
    console.log("=========================================================\n");

  } catch (err: any) {
    console.error("❌ Erro ao rodar backfill de brevês:", err);
  } finally {
    await prisma.$disconnect();
  }
}

runBadgesBackfill();
