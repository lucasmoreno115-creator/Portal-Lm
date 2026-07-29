const encoder = new TextEncoder();
const MAX_PAYLOAD_BYTES = 3072;
const PUSH_TIMEOUT_MS = 10_000;

function fromBase64Url(value) {
  const normalized = String(value || '').replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '='));
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function toBase64Url(value) {
  let binary = '';
  for (const byte of new Uint8Array(value)) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function concat(...values) {
  const arrays = values.map((value) => value instanceof Uint8Array ? value : new Uint8Array(value));
  const result = new Uint8Array(arrays.reduce((total, value) => total + value.length, 0));
  let offset = 0;
  for (const value of arrays) { result.set(value, offset); offset += value.length; }
  return result;
}

async function hmac(key, value) {
  const imported = await crypto.subtle.importKey('raw', key, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return new Uint8Array(await crypto.subtle.sign('HMAC', imported, value));
}

async function hkdfExtract(salt, input) { return hmac(salt, input); }
async function hkdfExpand(key, info, length) {
  return (await hmac(key, concat(info, Uint8Array.of(1)))).slice(0, length);
}

async function vapidHeaders(endpoint, env) {
  const publicKey = fromBase64Url(env.VAPID_PUBLIC_KEY);
  const privateKey = fromBase64Url(env.VAPID_PRIVATE_KEY);
  if (publicKey.length !== 65 || privateKey.length !== 32 || !String(env.VAPID_SUBJECT || '').trim()) {
    throw new Error('VAPID_CONFIG_INVALID');
  }
  const key = await crypto.subtle.importKey('jwk', {
    kty: 'EC', crv: 'P-256', x: toBase64Url(publicKey.slice(1, 33)), y: toBase64Url(publicKey.slice(33)),
    d: toBase64Url(privateKey), ext: true,
  }, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  const now = Math.floor(Date.now() / 1000);
  const header = toBase64Url(encoder.encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
  const claims = toBase64Url(encoder.encode(JSON.stringify({ aud: new URL(endpoint).origin, exp: now + 43_200, sub: String(env.VAPID_SUBJECT).trim() })));
  const token = `${header}.${claims}`;
  const signature = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, encoder.encode(token));
  return { Authorization: `vapid t=${token}.${toBase64Url(signature)}, k=${toBase64Url(publicKey)}`, TTL: '86400' };
}

async function encryptPayload(payload, subscription) {
  const clientPublic = fromBase64Url(subscription.p256dh);
  const auth = fromBase64Url(subscription.auth);
  const serverKeys = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  const serverPublic = new Uint8Array(await crypto.subtle.exportKey('raw', serverKeys.publicKey));
  const clientKey = await crypto.subtle.importKey('raw', clientPublic, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const shared = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: clientKey }, serverKeys.privateKey, 256));
  const authPrk = await hkdfExtract(auth, shared);
  const ikm = await hkdfExpand(authPrk, concat(encoder.encode('WebPush: info\0'), clientPublic, serverPublic), 32);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const prk = await hkdfExtract(salt, ikm);
  const cek = await hkdfExpand(prk, encoder.encode('Content-Encoding: aes128gcm\0'), 16);
  const nonce = await hkdfExpand(prk, encoder.encode('Content-Encoding: nonce\0'), 12);
  const key = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['encrypt']);
  const ciphertext = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, key, concat(payload, Uint8Array.of(2))));
  const recordSize = new Uint8Array(4);
  new DataView(recordSize.buffer).setUint32(0, 4096);
  return concat(salt, recordSize, Uint8Array.of(serverPublic.length), serverPublic, ciphertext);
}

export function isInternalPortalUrl(value) {
  return typeof value === 'string' && value.startsWith('/') && !value.startsWith('//') && !value.includes('\\') && !/[\u0000-\u001f]/.test(value);
}

async function reserveDelivery(db, notificationId, subscriptionId) {
  const now = new Date().toISOString();
  const result = await db.prepare(`INSERT OR IGNORE INTO portal_push_deliveries
    (id, notification_id, subscription_id, status, provider_status, error_code, created_at, updated_at)
    VALUES (?, ?, ?, 'PENDING', NULL, NULL, ?, ?)`).bind(crypto.randomUUID(), notificationId, subscriptionId, now, now).run();
  return Number(result?.meta?.changes ?? result?.changes ?? 0) > 0;
}

async function updateDelivery(db, notificationId, subscriptionId, status, providerStatus, errorCode) {
  await db.prepare(`UPDATE portal_push_deliveries SET status=?, provider_status=?, error_code=?, updated_at=?
    WHERE notification_id=? AND subscription_id=?`).bind(status, providerStatus, errorCode, new Date().toISOString(), notificationId, subscriptionId).run();
}

export async function deliverPortalPush(env, notification, options = {}) {
  if (!env?.DB || !notification?.id || !notification?.student_id) throw new Error('PUSH_DELIVERY_INPUT_INVALID');
  const actionUrl = notification.action_url || '/portal-premium-home.html';
  if (!isInternalPortalUrl(actionUrl)) throw new Error('PUSH_ACTION_URL_INVALID');
  const payload = encoder.encode(JSON.stringify({ notification_id: notification.id, type: notification.type, title: notification.title, body: notification.body, action_url: actionUrl }));
  if (payload.byteLength > MAX_PAYLOAD_BYTES) throw new Error('PUSH_PAYLOAD_TOO_LARGE');
  const { results = [] } = await env.DB.prepare(`SELECT id, endpoint, p256dh, auth FROM portal_push_subscriptions
    WHERE student_id=? AND status='ACTIVE' ORDER BY created_at`).bind(notification.student_id).all();
  const summary = { subscriptions: results.length, sent: 0, failed: 0, expired: 0, deduplicated: 0 };
  const send = options.fetch || fetch;
  for (const subscription of results) {
    if (!await reserveDelivery(env.DB, notification.id, subscription.id)) { summary.deduplicated += 1; continue; }
    let response;
    try {
      const [body, headers] = await Promise.all([encryptPayload(payload, subscription), vapidHeaders(subscription.endpoint, env)]);
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), options.timeoutMs || PUSH_TIMEOUT_MS);
      try { response = await send(subscription.endpoint, { method: 'POST', headers: { ...headers, 'Content-Encoding': 'aes128gcm', 'Content-Type': 'application/octet-stream' }, body, signal: controller.signal }); }
      finally { clearTimeout(timeout); }
      if (response.ok) {
        summary.sent += 1;
        await updateDelivery(env.DB, notification.id, subscription.id, 'SENT', response.status, null);
        await env.DB.prepare(`UPDATE portal_push_subscriptions SET last_success_at=?, failure_count=0, updated_at=? WHERE id=?`).bind(new Date().toISOString(), new Date().toISOString(), subscription.id).run();
      } else if (response.status === 404 || response.status === 410) {
        summary.expired += 1;
        await updateDelivery(env.DB, notification.id, subscription.id, 'EXPIRED', response.status, 'SUBSCRIPTION_EXPIRED');
        const now = new Date().toISOString();
        await env.DB.prepare(`UPDATE portal_push_subscriptions SET status='REVOKED', revoked_at=?, updated_at=?, failure_count=failure_count+1 WHERE id=?`).bind(now, now, subscription.id).run();
      } else {
        summary.failed += 1;
        await updateDelivery(env.DB, notification.id, subscription.id, 'FAILED', response.status, 'PROVIDER_ERROR');
        await env.DB.prepare('UPDATE portal_push_subscriptions SET failure_count=failure_count+1, updated_at=? WHERE id=?').bind(new Date().toISOString(), subscription.id).run();
      }
    } catch (error) {
      summary.failed += 1;
      await updateDelivery(env.DB, notification.id, subscription.id, 'FAILED', null, error?.name === 'AbortError' ? 'TIMEOUT' : 'DELIVERY_ERROR');
      await env.DB.prepare('UPDATE portal_push_subscriptions SET failure_count=failure_count+1, updated_at=? WHERE id=?').bind(new Date().toISOString(), subscription.id).run();
    }
  }
  return summary;
}
