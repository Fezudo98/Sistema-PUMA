// Limite de brevês que um aluno pode escolher pra exibir ao lado da divisa no ranking.
export const MAX_DISPLAYED_BADGES = 3;

// Hora local (0-23) de uma resposta, no fuso de Fortaleza — usado pelos brevês
// "Madrugador" e "Coruja da Guarita".
export function getFortalezaHour(date: Date): number {
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Fortaleza',
      hour: 'numeric',
      hour12: false
    });
    const hourPart = formatter.formatToParts(date).find((p) => p.type === 'hour');
    // O formatador pode devolver "24" pra meia-noite; normaliza pra 0.
    return hourPart ? parseInt(hourPart.value, 10) % 24 : date.getHours();
  } catch {
    return date.getHours();
  }
}

// Um script de correção histórica (scripts/backfill_answers_createdAt.ts) reescreveu
// o createdAt de respostas antigas para "createdAt do simulado + tempoGasto segundos"
// — uma aproximação sintética, bem diferente do horário real em que o aluno
// respondeu (os simulados diários costumam ser gerados de madrugada, assim que o
// primeiro aluno do dia abre o sistema). Brevês sensíveis à hora do dia (Madrugador,
// Coruja da Guarita) precisam ignorar essas respostas "sintéticas", ou acabam sendo
// concedidos por engano pra quem nunca respondeu de fato naquele horário.
export function isSyntheticBackfilledTimestamp(answerCreatedAt: Date, simuladoCreatedAt: Date, tempoGasto: number): boolean {
  return answerCreatedAt.getTime() === simuladoCreatedAt.getTime() + (tempoGasto || 0) * 1000;
}

// Dia da semana (0=domingo..6=sábado) de uma string "YYYY-MM-DD" (já no fuso de
// Fortaleza, como as que getLocalDayString produz), sem depender do fuso do servidor.
function dayStringToWeekday(dayStr: string): number {
  const [y, m, d] = dayStr.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d, 12)).getUTCDay();
}

// Conta em quantos fins de semana distintos o aluno completou pelo menos um simulado
// tanto no sábado quanto no domingo seguinte — usado pelo brevê "Guerreiro de Fim de Semana".
export function countCompleteWeekends(completedDaysSet: string[]): number {
  const daySet = new Set(completedDaysSet);
  let count = 0;
  daySet.forEach((dayStr) => {
    if (dayStringToWeekday(dayStr) !== 6) return; // só processa a partir do sábado
    const [y, m, d] = dayStr.split('-').map(Number);
    const nextDay = new Date(Date.UTC(y, m - 1, d, 12) + 24 * 60 * 60 * 1000);
    const sunStr = nextDay.toISOString().split('T')[0];
    if (daySet.has(sunStr)) count++;
  });
  return count;
}
