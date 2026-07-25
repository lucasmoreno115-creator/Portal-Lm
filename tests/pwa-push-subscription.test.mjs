import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';

const source = await readFile('public/assets/js/pwa-push-subscription.js', 'utf8');
const worker = await readFile('workers/api.js', 'utf8');
const migration = await readFile('migrations/0038_create_portal_push_subscriptions.sql', 'utf8');
const home = await readFile('public/portal-premium-home.html', 'utf8');

function browserHarness({ permission = 'default', supported = true, iphone = false, standalone = true, subscription = null } = {}) {
  const elements = new Map(['pwaPushCard', 'pwaPushButton', 'pwaPushMessage'].map((id) => [id, {
    dataset: {}, disabled: false, textContent: '', listeners: new Map(),
    addEventListener(type, listener) { this.listeners.set(type, listener); }
  }]));
  let requestPermissionCalls = 0;
  const registration = { pushManager: { getSubscription: async () => subscription } };
  const navigator = { userAgent: iphone ? 'iPhone Safari' : 'Chrome', standalone, serviceWorker: { ready: Promise.resolve(registration) } };
  const calls = [];
  const window = { matchMedia: () => ({ matches: standalone }), Notification: { permission, async requestPermission() { requestPermissionCalls += 1; return 'granted'; } } };
  if (supported) window.PushManager = function PushManager() {};
  else delete navigator.serviceWorker;
  vm.runInNewContext(source, { window, document: { getElementById: (id) => elements.get(id) }, navigator, Notification: window.Notification, Uint8Array, atob, api: async (path, options) => { calls.push([path, options]); return { data: {} }; } });
  return { button: elements.get('pwaPushButton'), card: elements.get('pwaPushCard'), permissionCalls: () => requestPermissionCalls, apiCalls: calls, window };
}

test('Premium Home contains the compact opt-in UI and isolated module', () => {
  assert.match(home, /Ative os lembretes/);
  assert.match(home, /Receba avisos importantes sobre check-in/);
  assert.match(home, /pwa-push-subscription\.js/);
});

test('permission is never requested during initialization and only follows a click', async () => {
  const app = browserHarness();
  await Promise.resolve();
  assert.equal(app.permissionCalls(), 0);
  await app.button.listeners.get('click')();
  assert.equal(app.permissionCalls(), 1);
});

test('subscription ativa oculta o card e a desativação compartilhada o reapresenta', async () => {
  const subscription = { endpoint: 'https://push.test/device', toJSON: () => ({ endpoint: 'https://push.test/device', keys: { p256dh: 'key', auth: 'auth' } }), unsubscribe: async () => true };
  const app = browserHarness({ permission: 'granted', subscription });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(app.card.dataset.state, 'enabled');
  assert.equal(app.card.hidden, true);
  await app.window.PortalPushNotifications.disableCurrent();
  assert.equal(app.card.dataset.state, 'waiting');
  assert.equal(app.card.hidden, false);
  assert.ok(app.apiCalls.some(([path, options]) => path === '/portal/push/subscriptions/current' && options.method === 'DELETE'));
});

test('unsupported browsers and non-installed iPhones receive safe fallbacks', () => {
  assert.equal(browserHarness({ supported: false }).card.dataset.state, 'unsupported');
  assert.equal(browserHarness({ iphone: true, standalone: false }).card.dataset.state, 'install');
});

test('backend contract authenticates, validates, upserts multiple devices, redacts status and revokes by authenticated student', () => {
  assert.match(worker, /startsWith\('\/api\/portal\/push\/'\)/);
  assert.match(worker, /ON CONFLICT\(endpoint\) DO UPDATE/);
  assert.match(worker, /WHERE student_id=\? AND endpoint=\? AND status='ACTIVE'/);
  assert.match(worker, /endpointHost/);
  assert.doesNotMatch(worker.match(/presentPushSubscriptionStatus[\s\S]*?\n}/)?.[0] || '', /p256dh|auth:/);
  assert.match(migration, /endpoint TEXT NOT NULL UNIQUE/);
  assert.match(migration, /ON portal_push_subscriptions\(student_id, status\)/);
});

test('Sprint N2.0 has no Push sending or service-worker notification listeners', async () => {
  const serviceWorker = await readFile('public/sw.js', 'utf8');
  assert.doesNotMatch(serviceWorker, /addEventListener\(['"](?:push|notificationclick|sync)['"]|showNotification/i);
  assert.doesNotMatch(worker, /webpush|sendNotification|showNotification/i);
  assert.doesNotMatch(worker, /VAPID_PRIVATE_KEY/);
});

test('hotfix N2.2.1 oculta o card sem reservar espaço nas cópias de CSS', async () => {
  const [canonicalCss, publicCss] = await Promise.all([
    readFile('portal.css', 'utf8'),
    readFile('public/portal.css', 'utf8'),
  ]);
  const hiddenRule = /\.pwa-push-card\[hidden\]\{display:none !important\}/;
  assert.match(canonicalCss, hiddenRule);
  assert.match(publicCss, hiddenRule);
  assert.equal(canonicalCss.match(hiddenRule)?.[0], publicCss.match(hiddenRule)?.[0]);
});
