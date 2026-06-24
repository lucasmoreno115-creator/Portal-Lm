export async function logOperationalEvent(db, payload) {
  try {
    if (!db) return;
    const metadata = sanitizeOperationalMetadata(payload?.metadata);
    await db.prepare(
      `INSERT INTO operational_logs (id, created_at, level, area, event, route, method, student_email, admin_context, message, metadata)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      crypto.randomUUID(),
      new Date().toISOString(),
      limitOperationalText(payload?.level || 'error', 20),
      limitOperationalText(payload?.area || 'system', 40),
      limitOperationalText(payload?.event || 'operational_error', 80),
      limitOperationalText(payload?.route, 160),
      limitOperationalText(payload?.method, 10),
      limitOperationalText(payload?.student_email, 160)?.toLowerCase() || null,
      limitOperationalText(payload?.admin_context, 160),
      limitOperationalText(payload?.message, 500),
      JSON.stringify(metadata)
    ).run();
  } catch {
    // Logging operacional nunca deve quebrar o fluxo principal.
  }
}

export function limitOperationalText(value, maxLength) {
  if (value == null) return null;
  const text = String(value).trim();
  if (!text) return null;
  return text.slice(0, maxLength);
}

export function sanitizeOperationalMetadata(metadata) {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return {};

  const blockedKeys = new Set([
    'token',
    'access_token',
    'admin_token',
    'x_admin_token',
    'password',
    'senha',
    'secret',
    'authorization',
    'cookie',
    'set_cookie',
    'bearer',
    'credential',
    'credentials',
    'meal_plan',
    'nutrition_plan',
    'checkin_payload',
    'answers_json',
    'internal_scores_json'
  ]);
  const blockedKeyFragments = ['token', 'password', 'senha', 'secret', 'authorization', 'cookie', 'credential'];
  const sensitiveValuePatterns = [/Bearer\s+/i, /x-admin-token/i, /access_token/i, /password/i, /senha/i];
  const safe = {};

  for (const [key, value] of Object.entries(metadata)) {
    const normalizedKey = String(key || '').toLowerCase();
    if (blockedKeys.has(normalizedKey)) continue;
    if (blockedKeyFragments.some((fragment) => normalizedKey.includes(fragment))) continue;

    if (['string', 'number', 'boolean'].includes(typeof value)) {
      const sanitizedValue = typeof value === 'string' && sensitiveValuePatterns.some((pattern) => pattern.test(value))
        ? '[redacted]'
        : value;
      safe[key] = typeof sanitizedValue === 'string' ? sanitizedValue.slice(0, 200) : sanitizedValue;
    }
  }
  return safe;
}
