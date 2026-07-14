export const WEEKLY_FEEDBACK_REMINDER_MESSAGES = Object.freeze({
  FRIDAY_PREPARATION: 'Seu Feedback Semanal já está disponível.\n\nResponda até amanhã de manhã para que sua atualização seja analisada no sábado.',
  SATURDAY_MORNING: 'Lembrete: responda seu Feedback Semanal nesta manhã para que sua atualização entre na revisão de hoje.',
});
export function createWeeklyFeedbackReminderService({ scheduleService }) {
  return Object.freeze({
    getReminderType(now = new Date()) { return scheduleService.getReminderType(now); },
    messageFor(type) { return WEEKLY_FEEDBACK_REMINDER_MESSAGES[type] ?? null; },
    isEnabled(env = {}) { return String(env.PREMIUM_WEEKLY_FEEDBACK_REMINDERS_ENABLED || '').toLowerCase() === 'true'; },
  });
}
