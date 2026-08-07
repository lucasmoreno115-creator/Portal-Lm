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
    this.attributes = {};
    this.className = '';
    this.style = {};
    this.classList = {
      toggle: () => {},
      remove: () => {},
      add: () => {}
    };
  }
  append(...nodes) { this.children.push(...nodes); this.textContent += nodes.map((node) => node?.textContent || '').join(''); }
  replaceChildren(...nodes) { this.children = [...nodes]; this.textContent = nodes.map((node) => node?.textContent || '').join(''); }
  addEventListener(type, handler) { this.listeners[type] = handler; }
  setAttribute(name, value) { this.attributes[name] = String(value); }
  removeAttribute(name) { delete this.attributes[name]; }
  closest() { return null; }
  focus() { this.focused = true; }
  select() { this.selected = true; }
  remove() { this.removed = true; }
}

async function runWorkspace({ sessionId = 'session-123', fetchImpl, auth = {}, clipboard, execCommand } = {}) {
  const source = await readFile('public/admin-premium-workspace.js', 'utf8');
  const nodes = new Map();
  for (const id of ['studentList', 'errorText', 'error', 'loadMore', 'search', 'clearSearch', 'retry', 'adminLogoutBtn', 'contextBody', 'anamnesisDashboard', 'anamnesisItems', 'checkinDashboard', 'checkinItems', 'record', 'openCreate', 'createPanel', 'studentsNav', 'students', 'overview', 'closeRecord', 'createForm', 'createSubmit', 'createResult']) nodes.set(id, new FakeNode(id));
  const document = {
    getElementById(id) { return nodes.get(id) || null; },
    createElement(tag) { return new FakeNode('', tag); },
    createTextNode(text) { const node = new FakeNode('', '#text'); node.textContent = String(text); return node; },
    addEventListener() {},
    body: new FakeNode('body', 'body'),
    execCommand
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
    navigator: { clipboard },
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
    Promise,
    FormData: class FormData { constructor(form) { this.values = form.values || {}; } *[Symbol.iterator]() { yield* Object.entries(this.values); } }
  };
  sandbox.window.window = sandbox.window;
  vm.runInNewContext(source, sandbox);
  await new Promise((resolve) => setImmediate(resolve));
  return { calls, nodes, location, clearCalls, document };
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

test('busca filtra alunos carregados sem novo fetch e restaura a seleção ao limpar', async () => {
  const students = [
    { studentId: 'ana', name: 'Ana Maria', email: 'ana@example.test', operationalStatusLabel: 'Ativo', anamnesisStatusLabel: 'Respondida', weeklyFeedbackStatusLabel: 'Em dia' },
    { studentId: 'bruno', name: 'Bruno', email: 'bruno@example.test', operationalStatusLabel: 'Ativo', anamnesisStatusLabel: 'Respondida', weeklyFeedbackStatusLabel: 'Em dia' }
  ];
  const result = await runWorkspace({
    fetchImpl: async (url) => {
      if (String(url).includes('/summary')) return new Response(JSON.stringify({ ok: false, error: 'SERVER_ERROR' }), { status: 500 });
      if (String(url).endsWith('/ana')) return new Response(JSON.stringify({ ok: true, data: { identity: students[0], operationalStatus: { label: 'Ativo' }, nextAction: { title: 'Próxima', description: '—', label: 'Abrir Prontuário', action: 'open-student' }, anamnesis: null, checkins: { latest: null, history: [] } } }), { status: 200 });
      return new Response(JSON.stringify({ ok: true, data: { items: students, nextCursor: null } }), { status: 200 });
    }
  });
  const ana = result.nodes.get('studentList').children[0];
  const summary = ana.children.flatMap((child) => child.children || []).find((child) => child.textContent === 'Ver resumo');
  summary.onclick();
  await new Promise((resolve) => setImmediate(resolve));
  const callsBeforeSearch = result.calls.length;

  const search = result.nodes.get('search');
  search.value = 'bruno@example';
  search.oninput();
  assert.equal(result.calls.length, callsBeforeSearch);
  assert.match(result.nodes.get('studentList').textContent, /Bruno/);
  assert.doesNotMatch(result.nodes.get('studentList').textContent, /Ana Maria/);

  result.nodes.get('clearSearch').onclick();
  assert.equal(search.focused, true);
  assert.equal(result.calls.length, callsBeforeSearch);
  assert.equal(result.nodes.get('studentList').children[0].className, 'item student-item is-selected');
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


test('cadastro desabilita o envio duplicado, anuncia processamento e restaura o formulário após sucesso', async () => {
  let postCalls = 0;
  let resolveCreate;
  const result = await runWorkspace({
    fetchImpl: async (url, options = {}) => {
      if (options.method === 'POST') {
        postCalls += 1;
        return new Promise((resolve) => { resolveCreate = resolve; });
      }
      if (String(url).includes('/summary')) return new Response(JSON.stringify({ ok: false, error: 'SERVER_ERROR' }), { status: 500 });
      return new Response(JSON.stringify({ ok: true, data: { items: [], nextCursor: null } }), { status: 200 });
    }
  });
  const form = result.nodes.get('createForm');
  const button = result.nodes.get('createSubmit');
  form.values = { name: 'Ana', email: 'ana@example.test', whatsapp: '11999990000' };
  const event = { target: form, preventDefault() { this.prevented = true; } };
  const submission = form.onsubmit(event);

  assert.equal(event.prevented, true);
  assert.equal(postCalls, 1);
  assert.equal(button.disabled, true);
  assert.equal(button.textContent, 'Cadastrando...');
  assert.equal(form.attributes['aria-busy'], 'true');
  await form.onsubmit({ target: form, preventDefault() {} });
  assert.equal(postCalls, 1);

  resolveCreate(new Response(JSON.stringify({ ok: true, data: { studentId: 'ana', name: 'Ana', accessLink: 'https://portal.test/portal-login.html', token: 'codigo-ana' } }), { status: 201 }));
  await submission;
  await new Promise((resolve) => setImmediate(resolve));

  assert.equal(button.disabled, false);
  assert.equal(button.textContent, 'Cadastrar aluno');
  assert.equal(form.attributes['aria-busy'], 'false');
  assert.match(result.nodes.get('createResult').textContent, /Aluno cadastrado\. O acesso está pronto para envio/);
  assert.match(result.nodes.get('createResult').textContent, /https:\/\/portal\.test\/portal-login\.html/);
  assert.match(result.nodes.get('createResult').textContent, /codigo-ana/);
  assert.match(result.nodes.get('createResult').textContent, /Copiar mensagem de acesso/);
  const heading = result.nodes.get('createResult').children[0];
  assert.equal(heading.tabIndex, -1);
  assert.equal(heading.focused, true);
  assert.equal(result.nodes.get('errorText').textContent, 'Aluno cadastrado. O acesso está pronto para envio.');
  assert.notEqual(result.nodes.get('errorText').textContent, 'Mensagem de acesso copiada com sucesso.');
});

test('cadastro preserva o acesso e só confirma sucesso depois que a mensagem é copiada', async () => {
  const copied = [];
  const result = await runWorkspace({
    clipboard: { writeText: async (value) => copied.push(value) },
    fetchImpl: async (url, options = {}) => {
      if (options.method === 'POST') return new Response(JSON.stringify({ ok: true, data: { studentId: 'bia', name: 'Bia', accessLink: 'https://portal.test/portal-login.html', token: 'codigo-bia' } }), { status: 201 });
      if (String(url).includes('/summary')) return new Response(JSON.stringify({ ok: false, error: 'SERVER_ERROR' }), { status: 500 });
      return new Response(JSON.stringify({ ok: true, data: { items: [], nextCursor: null } }), { status: 200 });
    }
  });
  const form = result.nodes.get('createForm');
  form.values = { name: 'Bia', email: 'bia@example.test', whatsapp: '' };
  await form.onsubmit({ target: form, preventDefault() {} });
  const copy = result.nodes.get('createResult').children.find((child) => child.textContent === 'Copiar mensagem de acesso');
  assert.ok(copy);
  assert.equal(copied.length, 0);
  await copy.onclick();
  assert.equal(copied.length, 1);
  assert.match(copied[0], /Olá, Bia!/);
  assert.match(copied[0], /Acesse: https:\/\/portal\.test\/portal-login\.html/);
  assert.match(copied[0], /Seu código de acesso: codigo-bia/);
  assert.equal(result.nodes.get('errorText').textContent, 'Mensagem de acesso copiada com sucesso.');
});

test('cópia do acesso usa fallback sem Clipboard API e não anuncia sucesso quando ele falha', async () => {
  for (const [fallbackResult, expected] of [[true, 'Mensagem de acesso copiada com sucesso.'], [false, 'Não foi possível copiar automaticamente. Selecione a mensagem exibida e copie manualmente.']]) {
    const result = await runWorkspace({
      execCommand: (command) => command === 'copy' && fallbackResult,
      fetchImpl: async (url, options = {}) => {
        if (options.method === 'POST') return new Response(JSON.stringify({ ok: true, data: { name: 'Caio', accessLink: 'https://portal.test/portal-login.html', token: 'codigo-caio' } }), { status: 201 });
        if (String(url).includes('/summary')) return new Response(JSON.stringify({ ok: false, error: 'SERVER_ERROR' }), { status: 500 });
        return new Response(JSON.stringify({ ok: true, data: { items: [], nextCursor: null } }), { status: 200 });
      }
    });
    const form = result.nodes.get('createForm'); form.values = { name: 'Caio', email: 'caio@example.test' };
    await form.onsubmit({ target: form, preventDefault() {} });
    const copy = result.nodes.get('createResult').children.find((child) => child.textContent === 'Copiar mensagem de acesso');
    await copy.onclick();
    assert.equal(result.nodes.get('errorText').textContent, expected);
    assert.equal(result.document.body.children.at(-1).removed, true);
  }
});

test('fallback remove o textarea temporário mesmo quando execCommand lança', async () => {
  const result = await runWorkspace({
    execCommand: () => { throw new Error('copy blocked'); },
    fetchImpl: async (url, options = {}) => {
      if (options.method === 'POST') return new Response(JSON.stringify({ ok: true, data: { name: 'Duda', accessLink: 'https://portal.test/portal-login.html', token: 'codigo-duda' } }), { status: 201 });
      if (String(url).includes('/summary')) return new Response(JSON.stringify({ ok: false, error: 'SERVER_ERROR' }), { status: 500 });
      return new Response(JSON.stringify({ ok: true, data: { items: [], nextCursor: null } }), { status: 200 });
    }
  });
  const form = result.nodes.get('createForm'); form.values = { name: 'Duda', email: 'duda@example.test' };
  await form.onsubmit({ target: form, preventDefault() {} });
  const copy = result.nodes.get('createResult').children.find((child) => child.textContent === 'Copiar mensagem de acesso');
  await copy.onclick();
  assert.equal(result.document.body.children.at(-1).removed, true);
  assert.match(result.nodes.get('errorText').textContent, /Não foi possível copiar automaticamente/);
});

test('cadastro renderiza dados da API como texto e não ativa URL fora de HTTP ou HTTPS', async () => {
  const result = await runWorkspace({
    fetchImpl: async (url, options = {}) => {
      if (options.method === 'POST') return new Response(JSON.stringify({ ok: true, data: { name: '<img src=x onerror=alert(1)>', accessLink: 'javascript:alert(1)', token: '<script>token</script>' } }), { status: 201 });
      if (String(url).includes('/summary')) return new Response(JSON.stringify({ ok: false, error: 'SERVER_ERROR' }), { status: 500 });
      return new Response(JSON.stringify({ ok: true, data: { items: [], nextCursor: null } }), { status: 200 });
    }
  });
  const form = result.nodes.get('createForm'); form.values = { name: 'Teste', email: 'teste@example.test' };
  await form.onsubmit({ target: form, preventDefault() {} });
  const output = result.nodes.get('createResult');
  const renderedUrl = output.children.find((child) => child.textContent === 'javascript:alert(1)');
  assert.equal(renderedUrl.tag, 'span');
  assert.equal(renderedUrl.href, undefined);
  assert.match(output.textContent, /<script>token<\/script>/);
  assert.equal(output.children.some((child) => child.tag === 'img' || child.tag === 'script'), false);
});

test('cadastro ativa HTTP e HTTPS normais, mas rejeita credenciais na URL', async () => {
  for (const [accessLink, expectedTag] of [['http://portal.test/acesso', 'a'], ['https://portal.test/acesso', 'a'], ['https://user@portal.test/acesso', 'span'], ['https://user:secret@portal.test/acesso', 'span']]) {
    const result = await runWorkspace({
      fetchImpl: async (url, options = {}) => {
        if (options.method === 'POST') return new Response(JSON.stringify({ ok: true, data: { name: 'Eva', accessLink, token: 'codigo-eva' } }), { status: 201 });
        if (String(url).includes('/summary')) return new Response(JSON.stringify({ ok: false, error: 'SERVER_ERROR' }), { status: 500 });
        return new Response(JSON.stringify({ ok: true, data: { items: [], nextCursor: null } }), { status: 200 });
      }
    });
    const form = result.nodes.get('createForm'); form.values = { name: 'Eva', email: 'eva@example.test' };
    await form.onsubmit({ target: form, preventDefault() {} });
    const renderedUrl = result.nodes.get('createResult').children.find((child) => child.textContent === accessLink);
    assert.equal(renderedUrl.tag, expectedTag);
    assert.equal(Boolean(renderedUrl.href), expectedTag === 'a');
  }
});

test('cadastro restaura o botão, preserva os dados e comunica erro padronizado', async () => {
  const result = await runWorkspace({
    fetchImpl: async (url, options = {}) => {
      if (options.method === 'POST') return new Response(JSON.stringify({ ok: false, error: 'Erro interno' }), { status: 500 });
      if (String(url).includes('/summary')) return new Response(JSON.stringify({ ok: false, error: 'SERVER_ERROR' }), { status: 500 });
      return new Response(JSON.stringify({ ok: true, data: { items: [], nextCursor: null } }), { status: 200 });
    }
  });
  const form = result.nodes.get('createForm');
  const button = result.nodes.get('createSubmit');
  form.values = { name: 'Ana', email: 'ana@example.test', whatsapp: '11999990000' };

  await form.onsubmit({ target: form, preventDefault() {} });

  assert.equal(button.disabled, false);
  assert.equal(button.textContent, 'Cadastrar aluno');
  assert.equal(form.attributes['aria-busy'], 'false');
  assert.deepEqual(form.values, { name: 'Ana', email: 'ana@example.test', whatsapp: '11999990000' });
  assert.equal(result.nodes.get('errorText').textContent, 'Não foi possível cadastrar o aluno.');
});
