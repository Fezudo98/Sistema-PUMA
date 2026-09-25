const FORTALEZA_TIME_ZONE = "America/Fortaleza";

const dayFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: FORTALEZA_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

export function getFortalezaDay(date: Date = new Date()): string {
  const parts = dayFormatter.formatToParts(date);
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;
  if (!year || !month || !day) throw new Error("Não foi possível calcular a data de Fortaleza.");
  return `${year}-${month}-${day}`;
}

export function getIsoWeekKey(date: Date = new Date()): string {
  const day = getFortalezaDay(date);
  const utc = new Date(`${day}T12:00:00.000Z`);
  const weekday = utc.getUTCDay() || 7;
  utc.setUTCDate(utc.getUTCDate() + 4 - weekday);
  const yearStart = new Date(Date.UTC(utc.getUTCFullYear(), 0, 1));
  const week = Math.ceil((((utc.getTime() - yearStart.getTime()) / 86_400_000) + 1) / 7);
  return `${utc.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}
