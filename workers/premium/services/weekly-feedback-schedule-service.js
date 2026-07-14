const TIME_ZONE = 'America/Sao_Paulo';
const WEEKDAYS = Object.freeze(['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']);

function parts(date, timeZone = TIME_ZONE) {
  const formatter = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit', weekday: 'short', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' });
  const data = Object.fromEntries(formatter.formatToParts(date).filter((p) => p.type !== 'literal').map((p) => [p.type, p.value]));
  return { year: Number(data.year), month: Number(data.month), day: Number(data.day), weekday: data.weekday, hour: Number(data.hour), minute: Number(data.minute), second: Number(data.second) };
}
function utcDateFromLocal(p, hour = 0, minute = 0, second = 0) { return new Date(Date.UTC(p.year, p.month - 1, p.day, hour, minute, second)); }
function zonedLocalToUtc(local, timeZone = TIME_ZONE) {
  const desired = Date.UTC(local.year, local.month - 1, local.day, local.hour || 0, local.minute || 0, local.second || 0);
  const guess = new Date(desired);
  const actual = parts(guess, timeZone);
  const actualAsUtc = Date.UTC(actual.year, actual.month - 1, actual.day, actual.hour, actual.minute, actual.second);
  return new Date(guess.getTime() + (desired - actualAsUtc));
}
function addDays(d, n) { const x = new Date(d); x.setUTCDate(x.getUTCDate() + n); return x; }
function isoWeek(date) { const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())); const day = d.getUTCDay() || 7; d.setUTCDate(d.getUTCDate() + 4 - day); const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1)); const week = Math.ceil((((d - yearStart) / 86400000) + 1) / 7); return `${d.getUTCFullYear()}-W${String(week).padStart(2, '0')}`; }
function localMidday(date, timeZone = TIME_ZONE) { const p = parts(date, timeZone); return utcDateFromLocal(p, 12); }
function cycleDelta(dow, targetDow) { if (dow === 0 && targetDow >= 5) return targetDow - 7; return targetDow - dow; }
function localIsoForCycleWeekday(date, targetDow, hour, minute, timeZone = TIME_ZONE) { const p = parts(date, timeZone); const dow = WEEKDAYS.indexOf(p.weekday); const localDate = addDays(utcDateFromLocal(p, 0, 0, 0), cycleDelta(dow, targetDow)); const target = { year: localDate.getUTCFullYear(), month: localDate.getUTCMonth() + 1, day: localDate.getUTCDate(), hour, minute, second: 0 }; return zonedLocalToUtc(target, timeZone).toISOString(); }
export function createWeeklyFeedbackScheduleService({ timeZone = TIME_ZONE, deadlineHour = 12 } = {}) {
  return Object.freeze({
    timeZone,
    getWeekRef(now = new Date()) { return isoWeek(localMidday(now, timeZone)); },
    getAvailability(now = new Date()) { return { weekRef: this.getWeekRef(now), availableAt: localIsoForCycleWeekday(now, 5, 0, 0, timeZone), recommendedDeadline: localIsoForCycleWeekday(now, 6, deadlineHour, 0, timeZone) }; },
    isAvailable(now = new Date()) { const dow = WEEKDAYS.indexOf(parts(now, timeZone).weekday); return dow === 5 || dow === 6 || dow === 0; },
    isAfterRecommendedDeadline(now = new Date()) { return now.getTime() > new Date(this.getAvailability(now).recommendedDeadline).getTime(); },
    isSubmittedLate(submittedAt, ref = new Date(submittedAt)) { if (!submittedAt) return false; return new Date(submittedAt).getTime() > new Date(this.getAvailability(ref).recommendedDeadline).getTime(); },
    getReminderType(now = new Date()) { const p = parts(now, timeZone); if (p.weekday === 'Fri') return 'FRIDAY_PREPARATION'; if (p.weekday === 'Sat' && p.hour < deadlineHour) return 'SATURDAY_MORNING'; return null; },
  });
}
export const weeklyFeedbackSchedule = createWeeklyFeedbackScheduleService();
