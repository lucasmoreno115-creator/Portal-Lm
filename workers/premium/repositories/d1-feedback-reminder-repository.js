function rows(result) { return result?.results ?? []; }
export function createD1FeedbackReminderRepository(db) {
  return Object.freeze({
    async createPending(record) {
      const now = record.created_at ?? new Date().toISOString();
      await db.prepare(`INSERT OR IGNORE INTO premium_feedback_reminders (id, student_id, week_ref, reminder_type, channel, status, scheduled_for, sent_at, failure_reason, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 'PENDING', ?, NULL, NULL, ?, ?)`).bind(record.id, record.student_id, record.week_ref, record.reminder_type, record.channel ?? 'OPERATIONAL_QUEUE', record.scheduled_for, now, now).run();
      return db.prepare(`SELECT * FROM premium_feedback_reminders WHERE student_id=? AND week_ref=? AND reminder_type=? AND channel=? LIMIT 1`).bind(record.student_id, record.week_ref, record.reminder_type, record.channel ?? 'OPERATIONAL_QUEUE').first();
    },
    async markResult(id, { status, sent_at = null, failure_reason = null } = {}) {
      const now = new Date().toISOString();
      await db.prepare(`UPDATE premium_feedback_reminders SET status=?, sent_at=?, failure_reason=?, updated_at=? WHERE id=?`).bind(status, sent_at, failure_reason, now, id).run();
      return db.prepare('SELECT * FROM premium_feedback_reminders WHERE id=? LIMIT 1').bind(id).first();
    },
    async listByWeek(weekRef, { limit = 100 } = {}) { return rows(await db.prepare('SELECT * FROM premium_feedback_reminders WHERE week_ref=? ORDER BY datetime(created_at) DESC LIMIT ?').bind(weekRef, limit).all()); },
  });
}
