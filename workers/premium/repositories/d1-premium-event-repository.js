import { isPremiumEvent } from '../domain/premium-events.js';
function rows(result) { return result?.results ?? []; }

export function createD1PremiumEventRepository(db) {
  return Object.freeze({
    async append(event) {
      const eventType = String(event.event_type || '');
      if (!eventType.startsWith('PREMIUM_') && !isPremiumEvent(eventType)) throw new Error(`INVALID_PREMIUM_EVENT:${eventType}`);
      await db.prepare(`INSERT INTO activity_timeline (id, student_id, student_email, event_type, source, title, metadata_json, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).bind(
        event.id, event.student_id ?? null, event.student_email, eventType, event.source ?? 'premium', event.title,
        JSON.stringify(event.metadata ?? {}), event.created_at
      ).run();
      return event;
    },
    async listByStudentId(studentId, { limit = 50 } = {}) {
      return rows(await db.prepare('SELECT * FROM activity_timeline WHERE student_id = ? ORDER BY datetime(created_at) DESC, id DESC LIMIT ?').bind(studentId, limit).all());
    },
    async listByEmail(email, { limit = 50 } = {}) {
      return rows(await db.prepare('SELECT * FROM activity_timeline WHERE lower(student_email) = lower(?) ORDER BY datetime(created_at) DESC, id DESC LIMIT ?').bind(email, limit).all());
    },
  });
}
