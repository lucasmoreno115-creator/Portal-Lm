export function createPrepareWeeklyFeedbackRemindersUseCase({ studentRepository, weeklyFeedbackRepository, reminderRepository, reminderService, scheduleService, randomUUID = crypto.randomUUID }) {
  return async function prepareWeeklyFeedbackReminders({ now = new Date(), env = {} } = {}) {
    if (!reminderService.isEnabled(env)) return { ok: true, data: { prepared: [], skipped: true, reason: 'FEATURE_FLAG_DISABLED' } };
    const reminderType = reminderService.getReminderType(now);
    if (!reminderType) return { ok: true, data: { prepared: [], skipped: true, reason: 'NO_REMINDER_WINDOW' } };
    const { weekRef, availableAt } = scheduleService.getAvailability(now);
    const students = await studentRepository.list({ status: 'ACTIVE', limit: 200 });
    const prepared = [];
    for (const student of students.filter((s) => s.access_status === 'ACTIVE' && s.consultation_status === 'ACTIVE')) {
      const existing = await weeklyFeedbackRepository.findByStudentAndWeek(student.student_id, weekRef);
      if (existing?.submitted_at || existing?.created_at) continue;
      prepared.push(await reminderRepository.createPending({ id: randomUUID(), student_id: student.student_id, week_ref: weekRef, reminder_type: reminderType, scheduled_for: availableAt }));
    }
    return { ok: true, data: { weekRef, reminderType, channel: 'OPERATIONAL_QUEUE', prepared } };
  };
}
