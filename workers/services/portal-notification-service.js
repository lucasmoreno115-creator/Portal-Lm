export const PORTAL_NOTIFICATION_TYPES = Object.freeze({
  WEEKLY_CHECKIN_REMINDER: 'WEEKLY_CHECKIN_REMINDER',
  ANAMNESIS_REQUIRED: 'ANAMNESIS_REQUIRED',
  PLANNING_PUBLISHED: 'PLANNING_PUBLISHED',
  WORKOUT_UPDATED: 'WORKOUT_UPDATED',
  COACH_REPLY: 'COACH_REPLY',
  ACCOUNT_RELEASED: 'ACCOUNT_RELEASED',
  CUSTOM: 'CUSTOM',
});

const VALID_TYPES = new Set(Object.values(PORTAL_NOTIFICATION_TYPES));

export class PortalNotificationValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'PortalNotificationValidationError';
  }
}

function requiredText(value, field, maxLength) {
  const normalized = String(value ?? '').trim();
  if (!normalized) throw new PortalNotificationValidationError(`${field} é obrigatório.`);
  if (normalized.length > maxLength) throw new PortalNotificationValidationError(`${field} excede o tamanho permitido.`);
  return normalized;
}

export function normalizePortalActionUrl(value) {
  if (value == null || String(value).trim() === '') return null;
  const normalized = String(value).trim();
  if (normalized.length > 2048 || !normalized.startsWith('/') || normalized.startsWith('//') || normalized.includes('\\') || /[\u0000-\u001f]/.test(normalized)) {
    throw new PortalNotificationValidationError('action_url deve ser uma rota interna válida.');
  }
  return normalized;
}

function normalizeInput(input = {}) {
  const type = String(input.type ?? '').trim().toUpperCase();
  if (!VALID_TYPES.has(type)) throw new PortalNotificationValidationError('type inválido.');
  return {
    studentId: requiredText(input.student_id, 'student_id', 128),
    studentEmail: requiredText(input.student_email, 'student_email', 320).toLowerCase(),
    type,
    title: requiredText(input.title, 'title', 160),
    body: requiredText(input.body, 'body', 2000),
    actionUrl: normalizePortalActionUrl(input.action_url),
    referenceKey: input.reference_key == null || String(input.reference_key).trim() === ''
      ? null
      : requiredText(input.reference_key, 'reference_key', 255),
  };
}

export async function createPortalNotification(env, input) {
  return (await createPortalNotificationResult(env, input)).notification;
}

export async function createPortalNotificationResult(env, input) {
  if (!env?.DB) throw new Error('DB binding is required.');
  const value = normalizeInput(input);

  if (value.referenceKey) {
    const existing = await env.DB.prepare(`SELECT * FROM portal_notifications
      WHERE student_id=? AND type=? AND reference_key=? LIMIT 1`)
      .bind(value.studentId, value.type, value.referenceKey).first();
    if (existing) return { notification: existing, created: false };
  }

  const now = new Date().toISOString();
  const id = crypto.randomUUID();
  await env.DB.prepare(`INSERT OR IGNORE INTO portal_notifications
    (id, student_id, student_email, type, title, body, action_url, reference_key, status, created_at, read_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'UNREAD', ?, NULL, ?)`)
    .bind(id, value.studentId, value.studentEmail, value.type, value.title, value.body,
      value.actionUrl, value.referenceKey, now, now).run();

  if (value.referenceKey) {
    const notification = await env.DB.prepare(`SELECT * FROM portal_notifications
      WHERE student_id=? AND type=? AND reference_key=? LIMIT 1`)
      .bind(value.studentId, value.type, value.referenceKey).first();
    return { notification, created: notification?.id === id };
  }
  const notification = await env.DB.prepare('SELECT * FROM portal_notifications WHERE id=? AND student_id=? LIMIT 1')
    .bind(id, value.studentId).first();
  return { notification, created: true };
}
