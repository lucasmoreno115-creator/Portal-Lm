import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';

const lm2App = await readFile('public/assets/js/project-lm-2-app.js', 'utf8');
const portalLogin = await readFile('portal-login.html', 'utf8');

function loadLm2App({ storage = {}, fetchImpl } = {}) {
  const localStorage = {
    getItem(key) {
      return Object.prototype.hasOwnProperty.call(storage, key) ? storage[key] : null;
    }
  };
  const root = { dataset: {}, addEventListener() {} };
  const window = {
    localStorage,
    location: { href: 'public/project-lm-2.html' },
    fetch: fetchImpl || (() => { throw new Error('fetch should not be called'); }),
    addEventListener() {},
    ProjectLm2Router: {
      getCurrentRoute: () => 'welcome',
      normalizeRoute: route => route,
      navigate: route => route
    },
    ProjectLm2State: {
      getState: () => ({ next_action: 'start_onboarding' }),
      updateState: value => value
    }
  };
  const document = {
    readyState: 'loading',
    addEventListener() {},
    querySelector(selector) {
      return selector === '#project-lm-2-root' ? root : null;
    }
  };
  vm.runInNewContext(lm2App, { window, document });
  return { window, root };
}

test('LM 2.0 reuses the portal student auth headers for API calls', async () => {
  const requests = [];
  const { window } = loadLm2App({
    storage: { lm_student_email: 'student@example.com', lm_student_token: 'token' },
    fetchImpl: async (url, options) => {
      requests.push({ url, options });
      return { ok: true, json: async () => ({ ok: true, data: {} }) };
    }
  });

  const response = await window.ProjectLm2App.requestLm2('/api/project-lm-2/onboarding', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: '{}'
  });

  assert.equal(response.ok, true);
  assert.equal(requests[0].url, '/api/project-lm-2/onboarding');
  assert.equal(requests[0].options.headers['x-student-email'], 'student@example.com');
  assert.equal(requests[0].options.headers['x-student-token'], 'token');
  assert.equal(requests[0].options.headers['content-type'], 'application/json');
});

test('LM 2.0 redirects direct anonymous entry without attempting onboarding or API calls', async () => {
  let fetchCalled = false;
  const { window } = loadLm2App({ fetchImpl: async () => { fetchCalled = true; } });

  window.ProjectLm2App.boot();
  await assert.rejects(() => window.ProjectLm2App.requestLm2('/api/project-lm-2/onboarding', { method: 'POST' }), /auth_required/);

  assert.equal(window.location.href, '/portal-login.html');
  assert.equal(fetchCalled, false);
});

test('student login sends Projeto LM users to LM 2.0 and keeps Premium on portal.html', () => {
  assert.match(portalLogin, /r\.data\.plan==='projeto_lm'\?'\/projeto-lm\/':'portal\.html'/);
  assert.doesNotMatch(portalLogin, /r\.data\.plan==='premium'\?'\/projeto-lm'/);
});
