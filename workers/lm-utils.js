export function nullableTrimmed(value) {
  if (value == null) return null;
  const text = String(value).trim();
  return text ? text : null;
}

export function safeJsonParse(value) {
  if (!value) return null;
  try { return JSON.parse(value); } catch { return null; }
}

export function getWeekRef(date) {
  const target = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const dayNumber = (target.getUTCDay() + 6) % 7;
  target.setUTCDate(target.getUTCDate() - dayNumber + 3);
  const firstThursday = new Date(Date.UTC(target.getUTCFullYear(), 0, 4));
  const firstDayNumber = (firstThursday.getUTCDay() + 6) % 7;
  firstThursday.setUTCDate(firstThursday.getUTCDate() - firstDayNumber + 3);
  const week = 1 + Math.round((target - firstThursday) / 604800000);
  return `${target.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}
