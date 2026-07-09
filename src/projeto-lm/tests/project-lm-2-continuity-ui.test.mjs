import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { adaptContinuityCheckin } from '../adapters/continuityCheckinAdapter.js';
import { renderContinuityCheckin } from '../ui/studentPlanRenderers.js';

const appSource = readFileSync(new URL('../../../public/assets/js/project-lm-2-app.js', import.meta.url), 'utf8');
const forbidden = ['score', 'status', 'completed', 'falhou', 'fracassou', 'compensar', 'cardio extra', 'restrição', 'restricao'];

function visibleText(html) {
  return String(html).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function createFeedbackRoot() {
  const nodes = {
    feedback: { innerHTML: '', textContent: '' },
    error: { textContent: '' }
  };
  return {
    dataset: {},
    innerHTML: '',
    querySelector: (selector) => {
      if (selector === '[data-lm2-feedback]') return nodes.feedback;
      if (selector === '[data-lm2-error]') return nodes.error;
      return null;
    },
    insertAdjacentHTML: (_position, html) => { nodes.modal = html; }
  };
}

function createAppContext({ services, answer = 'on_track', fetch } = {}) {
  const listeners = {};
  const fakeWindow = {
    localStorage: { getItem: () => 'ok', setItem: () => {} },
    location: { href: '', hostname: 'localhost' },
    fetch: fetch || (async () => ({ ok: true, json: async () => ({ data: { continuity_days_count: 1 } }) })),
    addEventListener: (event, handler) => { listeners[event] = handler; },
    ProjectLm2Router: { normalizeRoute: (route) => route, getCurrentRoute: () => 'daily-checkin', navigate: (route) => route },
    ProjectLm2State: {
      state: { daily_checkin_answer: answer },
      getState() { return this.state; },
      updateState(update) { this.state = { ...this.state, ...update }; return this.state; }
    },
    ProjectLmEngineServices: services
  };
  const fakeDocument = {
    readyState: 'loading',
    querySelector: () => null,
    addEventListener: (event, handler) => { listeners[event] = handler; }
  };
  const context = { window: fakeWindow, document: fakeDocument, console, Error };
  vm.runInNewContext(appSource, context);
  return { app: fakeWindow.ProjectLm2App, window: fakeWindow };
}

function services() {
  return {
    resolveContinuityCheckin: (input) => adaptContinuityCheckin(input).student_visible,
    renderContinuityCheckin,
    logPlanError: () => {}
  };
}

for (const [answer, expected] of [
  ['on_track', /Hoje foi um dia forte/],
  ['adapted', /Plano B também é vitória/],
  ['off_track', /Dia difícil identificado/]
]) {
  test(`${answer} renderiza feedback de continuidade sem punição nem campos internos`, () => {
    const { app } = createAppContext({ services: services(), answer });
    const feedback = app.resolveContinuityCheckinFeedback(answer);
    const html = renderContinuityCheckin(feedback);
    const text = visibleText(html);

    assert.match(text, expected);
    assert.match(text, /Próximo passo/);
    for (const word of forbidden) assert.equal(html.toLowerCase().includes(word), false, `não deve conter ${word}`);
  });
}

test('feedback amigável aparece imediatamente após check-in e mantém persistência existente', async () => {
  const calls = [];
  const { app } = createAppContext({
    services: services(),
    answer: 'adapted',
    fetch: async (url, options) => {
      calls.push({ url, options });
      return { ok: true, json: async () => ({ data: { today_checkin_completed: true } }) };
    }
  });
  const root = createFeedbackRoot();

  await app.submitCheckin(root);

  assert.equal(calls.length, 1);
  assert.match(visibleText(root.querySelector('[data-lm2-feedback]').innerHTML), /Plano B também é vitória/);
  for (const word of forbidden) assert.equal(root.querySelector('[data-lm2-feedback]').innerHTML.toLowerCase().includes(word), false, `não deve conter ${word}`);
});

test('fallback funciona sem engine e não quebra a tela', async () => {
  const { app } = createAppContext({ services: undefined, answer: 'off_track' });
  const root = createFeedbackRoot();

  await app.submitCheckin(root);

  const html = root.querySelector('[data-lm2-feedback]').innerHTML;
  assert.match(visibleText(html), /Check-in registrado/);
  assert.match(visibleText(html), /O mais importante agora é continuar no próximo passo/);
});

test('HTML oficial do check-in não referencia Consultoria Premium', () => {
  const { app } = createAppContext({ services: services(), answer: 'on_track' });
  const root = { dataset: {}, innerHTML: '', querySelector: () => null };

  app.render(root, 'daily-checkin');

  assert.equal(root.innerHTML.includes('Consultoria Premium'), false);
});
