// Helper to get YYYY-MM-DD string adjusted for Ceará/Local time (America/Fortaleza)
export function getLocalDayString(date: Date): string {
  try {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Fortaleza',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
    return formatter.format(date); // Returns YYYY-MM-DD
  } catch (e) {
    const d = new Date(date.getTime() - 3 * 60 * 60 * 1000);
    return d.toISOString().split('T')[0];
  }
}

export interface StudentPerformanceStats {
  simuladosCount: number;
  totalAnswers: number;
  accuracy: number;
  avgTime: number;
  totalScore: number;
  streakDays: number;
  todayPoints: number;
  completedDaysSet: string[];
}

export function computeStudentPerformanceStats(
  answers: any[],
  studentId: string,
  totalRaffleInSimulado: Map<string, number> = new Map(),
  studentRaffleInSimulado: Map<string, number> = new Map()
): StudentPerformanceStats {
  const totalAnswers = answers.length;

  // Group answers by simuladoId to verify 100% completion
  const simuladoStatsMap = new Map<string, {
    expectedQ: number;
    answeredCount: number;
    correctAnswers: number;
    tipo: string;
    status: string;
    completionDate: Date;
    answers: any[];
  }>();

  answers.forEach(a => {
    if (!a.question || !a.question.simulado) return;
    const simuladoId = a.question.simuladoId;
    if (!simuladoStatsMap.has(simuladoId)) {
      const totalQ = a.question.simulado._count?.questions || 0;
      const totalRaffle = totalRaffleInSimulado.get(simuladoId) || 0;
      const studentRaffle = studentRaffleInSimulado.get(`${studentId}_${simuladoId}`) || 0;
      const otherRaffle = totalRaffle - studentRaffle;
      const expectedQ = Math.max(0, totalQ - otherRaffle);

      simuladoStatsMap.set(simuladoId, {
        expectedQ,
        answeredCount: 0,
        correctAnswers: 0,
        tipo: a.question.simulado.tipo || "STUDY",
        status: a.question.simulado.status || "FINISHED",
        completionDate: a.createdAt || a.question.simulado.createdAt || new Date(),
        answers: []
      });
    }
    const s = simuladoStatsMap.get(simuladoId)!;
    s.answeredCount++;
    if (a.isCorrect) s.correctAnswers++;
    s.answers.push(a);
    const ansDate = a.createdAt || a.question.simulado.createdAt || new Date();
    if (ansDate > s.completionDate) {
      s.completionDate = ansDate;
    }
  });

  let completedTotalQuestions = 0;
  let completedCorrectAnswers = 0;
  let simuladosCount = 0;
  const completedDaysSet = new Set<string>();

  simuladoStatsMap.forEach(s => {
    const isFinished = s.tipo === "LIVE" ? s.status === "FINISHED" : true;
    const isCompleted = isFinished && s.answeredCount >= s.expectedQ && s.expectedQ > 0;
    if (isCompleted) {
      simuladosCount++;
      completedTotalQuestions += s.expectedQ;
      completedCorrectAnswers += s.correctAnswers;
      completedDaysSet.add(getLocalDayString(s.completionDate));
    }
  });

  const accuracy = completedTotalQuestions > 0
    ? Math.round((completedCorrectAnswers / completedTotalQuestions) * 100)
    : 0;

  // Calculate Streak (Sequência 🔥)
  const todayStr = getLocalDayString(new Date());
  const yesterdayDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const yesterdayStr = getLocalDayString(yesterdayDate);

  let streakDays = 0;
  if (completedDaysSet.has(todayStr) || completedDaysSet.has(yesterdayStr)) {
    let checkDate = completedDaysSet.has(todayStr) ? new Date() : yesterdayDate;
    while (completedDaysSet.has(getLocalDayString(checkDate))) {
      streakDays++;
      checkDate = new Date(checkDate.getTime() - 24 * 60 * 60 * 1000);
      if (streakDays > 3650) break; // limit to 10 years safety
    }
  }

  // Question points (from answers)
  const questionPoints = answers.reduce((acc, curr) => acc + (curr.pontuacao || 0), 0);

  // Streak points bonus: A diária da sequência valerá 100 pontos
  const streakBonus = streakDays * 100;
  const totalScore = questionPoints + streakBonus;

  // Today points: Pontos ao dia (hoje)
  const todayQuestionPoints = answers.reduce((acc, curr) => {
    const ansDate = curr.createdAt || (curr.question?.simulado?.createdAt) || new Date();
    if (getLocalDayString(ansDate) === todayStr) {
      return acc + (curr.pontuacao || 0);
    }
    return acc;
  }, 0);
  const todayPoints = todayQuestionPoints + (completedDaysSet.has(todayStr) ? 100 : 0);

  const avgTime = totalAnswers > 0
    ? Math.round(answers.reduce((acc, curr) => acc + (curr.tempoGasto || 0), 0) / totalAnswers)
    : 0;

  return {
    simuladosCount,
    totalAnswers,
    accuracy,
    avgTime,
    totalScore,
    streakDays,
    todayPoints,
    completedDaysSet: Array.from(completedDaysSet)
  };
}
