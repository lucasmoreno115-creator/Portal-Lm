import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';

const source = await readFile(new URL('../public/assets/js/pwa-install.js', import.meta.url), 'utf8');

function harness({ userAgent = 'Mozilla/5.0 (Linux; Android 14) Chrome/125 Safari/537.36', standalone = false, dismissedAt } = {}) {
  const listeners = new Map();
  const storage = new Map(dismissedAt === undefined ? [] : [['lm_pwa_install_dismissed_at', String(dismissedAt)]]);
  const element = (hidden = true) => ({
    hidden,
    listeners: new Map(),
    addEventListener(type, listener) { this.listeners.set(type, listener); },
    click() { return this.listeners.get('click')?.({}); },
    querySelectorAll() { return []; }
  });
  const card = element();
  const install = element(false);
  const dismiss = element(false);
  const modal = element();
  const elements = { pwaInstallCard: card, pwaInstallButton: install, pwaInstallDismiss: dismiss, pwaIosModal: modal };
  const window = {
    navigator: { userAgent, standalone },
    matchMedia: () => ({ matches: standalone }),
    localStorage: {
      getItem: (key) => storage.get(key) ?? null,
      setItem: (key, value) => storage.set(key, value),
      removeItem: (key) => storage.delete(key)
    },
    addEventListener(type, listener) { listeners.set(type, listener); }
  };
  const document = {
    body: { classList: { add() {}, remove() {} } },
    getElementById: (id) => elements[id]
  };
  vm.runInNewContext(source, { window, document, Date, Number, String });
  return { card, install, dismiss, modal, storage, dispatch: (type, event = {}) => listeners.get(type)?.(event) };
}

test('Android only shows after beforeinstallprompt and prompts from the button', async () => {
  const app = harness();
  assert.equal(app.card.hidden, true);
  let promptCalls = 0;
  let prevented = false;
  app.dispatch('beforeinstallprompt', {
    preventDefault() { prevented = true; },
    prompt() { promptCalls += 1; },
    userChoice: Promise.resolve({ outcome: 'accepted' })
  });
  assert.equal(prevented, true);
  assert.equal(app.card.hidden, false);
  assert.equal(promptCalls, 0);
  await app.install.click();
  assert.equal(promptCalls, 1);
  assert.equal(app.card.hidden, true);
});

test('iPhone Safari shows the eligible card and opens guided instructions', async () => {
  const app = harness({ userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1' });
  assert.equal(app.card.hidden, false);
  await app.install.click();
  assert.equal(app.modal.hidden, false);
});

test('installed and recently dismissed portals stay hidden', () => {
  assert.equal(harness({ standalone: true }).card.hidden, true);
  assert.equal(harness({ userAgent: 'iPhone Safari', dismissedAt: Date.now() - 6 * 86400000 }).card.hidden, true);
  assert.equal(harness({ userAgent: 'iPhone Safari', dismissedAt: Date.now() - 8 * 86400000 }).card.hidden, false);
});

test('dismissal lasts seven days and appinstalled hides the card', () => {
  const app = harness({ userAgent: 'iPhone Safari' });
  app.dismiss.click();
  assert.ok(Number(app.storage.get('lm_pwa_install_dismissed_at')) > 0);
  assert.equal(app.card.hidden, true);
  app.card.hidden = false;
  app.dispatch('appinstalled');
  assert.equal(app.card.hidden, true);
  assert.equal(app.storage.has('lm_pwa_install_dismissed_at'), false);
});
