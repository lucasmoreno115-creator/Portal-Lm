import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

class FakeNode {
  constructor(id = '', tag = 'div') {
    this.id = id;
    this.tag = tag;
    this.hidden = false;
    this.textContent = '';
    this.children = [];
    this.dataset = {};
    this.listeners = {};
    this.className = '';
    this.classList = {
      toggle: () => {},
      remove: () => {},
      add: () => {}
    };
  }
  append(...nodes) { this.children.push(...nodes); this.textContent += nodes.map((node) => node?.textContent || '').join(''); }
  replaceChildren(...nodes) { this.children = [...nodes]; this.textContent = nodes.map((node) => node?.textContent || '').join(''); }
  addEventListener(type, handler) { this.listeners[type] = handler; }
  closest() { return null; }
}

async function runWorkspace({ sessionId = 'session-123', fetchImpl, auth = {} } = {}) {
  const source = await readFile('public/admin-premium-workspace.js', 'utf8');
  const nodes = new Map();
  for (const id of ['studentList', 'errorText', 'error', 'loadMore', 'search', 'retry', 'adminLogoutBtn', 'contextBody', 'anamnesisDashboard', 'anamnesisItems', 'checkinDashboard', 'checkinItems', 'record', 'openCreate', 'createPanel', 'studentsNav', 'students', 'overview', 'closeRecord', 'createForm', 'createResult']) nodes.set(id, new FakeNode(id));
  const document = {
    getElementById(id) { return nodes.get(id) || null; },
    createElement(tag) { return new FakeNode('', tag); },
    addEventListener() {}
  };
  const location = { origin: 'https://portal.test', pathname: '/admin-premium-workspace.html', search: '', hash: '', assigned: null, assign(url) { this.assigned = url; } };
  const calls = [];
  const clearCalls = [];
  const sandbox = {
    window: {
      location,
      LMAdminAuth: {
        requireAdmin() { if (!sessionId) { location.assigned = '/admin-login.html?returnTo=%2Fadmin-premium-workspace.html'; return ''; } return sessionId; },
        attachLogout: auth.attachLogout || (() => {}),
        getAdminLoginUrl: () => '/admin-login.html?returnTo=%2Fadmin-premium-workspace.html',
        getAdminAuthHeaders: () => ({ 'Content-Type': 'application/json', 'x-admin-session': sessionId }),
        clearAdminSession() { clearCalls.push(true); }
      }
    },
    document,
    fetch: async (url, opts) => { calls.push({ url, opts }); return fetchImpl(url, opts); },
    URL,
    URLSearchParams,
    console: { info() {} },
    setTimeout: (fn) => { fn(); return 1; },
    clearTimeout() {},
    encodeURIComponent,
    Number,
    String,
    Boolean,
    Array,
    RegExp,
    Promise
  };
  sandbox.window.window = sandbox.window;
  vm.runInNewContext(source, sandbox);
  await new Promise((resolve) => setImmediate(resolve));
  return { calls, nodes, location, clearCalls };
}

test('workspace bootstrap without session redirects and performs zero Workspace fetches', async () => {
  const result = await runWorkspace({
    sessionId: '',
    fetchImpl: async () => new Response(JSON.stringify({ ok: true, data: { items: [] } }), { status: 200 })
  });

  assert.match(result.location.assigned, /admin-login\.html/);
  assert.equal(result.calls.length, 0);
});

test('partial Dashboard DOM handles summary failure without unhandled rejections and keeps students available', async () => {
  const unhandled = [];
  const onUnhandled = (error) => unhandled.push(error);
  process.on('unhandledRejection', onUnhandled);
  try {
    const result = await runWorkspace({
      fetchImpl: async (url) => {
        if (String(url).includes('/summary')) return new Response(JSON.stringify({ ok: false, error: 'SERVER_ERROR' }), { status: 500 });
        return new Response(JSON.stringify({ ok: true, data: { items: [{ studentId: 's1', name: 'Aluno Teste', email: 'aluno@example.test', consultationStatusLabel: 'Ativo', accessStatusLabel: 'Acesso ativo' }], nextCursor: null } }), { status: 200 });
      }
    });
    await new Promise((resolve) => setImmediate(resolve));

    assert.equal(result.calls.some((call) => String(call.url).includes('/summary')), true);
    assert.equal(result.calls.some((call) => String(call.url).includes('/students')), true);
    assert.match(result.nodes.get('studentList').textContent, /Aluno Teste/);
    assert.equal(result.location.assigned, null);
    assert.equal(result.clearCalls.length, 0);
    assert.deepEqual(unhandled, []);
  } finally {
    process.off('unhandledRejection', onUnhandled);
  }
});

test('Abrir Prontuário navega para o record Premium com o student_id oficial codificado', async () => {
  const result = await runWorkspace({
    fetchImpl: async (url) => {
      if (String(url).includes('/summary')) return new Response(JSON.stringify({ ok: false, error: 'SERVER_ERROR' }), { status: 500 });
      return new Response(JSON.stringify({ ok: true, data: { items: [{ studentId: 'aluno / seguro', name: 'Ana', email: 'ana@example.test', operationalStatusLabel: 'Ativo', anamnesisStatusLabel: 'Respondida', weeklyFeedbackStatusLabel: 'Em dia' }], nextCursor: null } }), { status: 200 });
    }
  });
  const student = result.nodes.get('studentList').children[0];
  const openRecord = student.children.flatMap((child) => child.children || [child]).find((child) => child.textContent === 'Abrir Prontuário');
  assert.ok(openRecord);
  openRecord.onclick();
  assert.equal(result.location.assigned, '/admin-premium-student-record.html?student_id=aluno+%2F+seguro');
});

test('aluno sem student_id mantém Abrir Prontuário desabilitado sem URL quebrada', async () => {
  const result = await runWorkspace({
    fetchImpl: async (url) => {
      if (String(url).includes('/summary')) return new Response(JSON.stringify({ ok: false, error: 'SERVER_ERROR' }), { status: 500 });
      return new Response(JSON.stringify({ ok: true, data: { items: [{ name: 'Sem ID', email: 'sem-id@example.test', operationalStatusLabel: 'Ativo', anamnesisStatusLabel: '—', weeklyFeedbackStatusLabel: '—' }], nextCursor: null } }), { status: 200 });
    }
  });
  const student = result.nodes.get('studentList').children[0];
  const openRecord = student.children.flatMap((child) => child.children || [child]).find((child) => child.textContent === 'Abrir Prontuário');
  assert.ok(openRecord);
  assert.equal(openRecord.disabled, true);
  assert.equal(openRecord.onclick, undefined);
  assert.equal(result.location.assigned, null);
});

test('workspace keeps session on 500, 403 and network errors', async () => {
  for (const response of [
    () => new Response(JSON.stringify({ ok: false, error: 'SERVER_ERROR' }), { status: 500 }),
    () => new Response(JSON.stringify({ ok: false, error: 'FEATURE_DISABLED' }), { status: 403 }),
    () => Promise.reject(new Error('network down'))
  ]) {
    const result = await runWorkspace({ fetchImpl: async () => response() });
    assert.equal(result.clearCalls.length, 0);
    assert.equal(result.location.assigned, null);
  }
});

test('workspace clears session only on explicit invalid or expired session 401', async () => {
  const invalid = await runWorkspace({ fetchImpl: async () => new Response(JSON.stringify({ ok: false, code: 'ADMIN_SESSION_EXPIRED' }), { status: 401 }) });
  assert.equal(invalid.clearCalls.length, 1);
  assert.match(invalid.location.assigned, /admin-login\.html/);

  const generic = await runWorkspace({ fetchImpl: async () => new Response(JSON.stringify({ ok: false, error: 'TOKEN_REQUIRED' }), { status: 401 }) });
  assert.equal(generic.clearCalls.length, 0);
  assert.equal(generic.location.assigned, null);
});
