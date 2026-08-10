import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const maliciousValues = [
  '<img src=x onerror=alert(1)>',
  '</pre><img src=x onerror=alert(1)>',
  '<script>alert(1)</script>',
  'texto com aspas " \' < > &',
  'javascript:alert(1)'
];

test('Prontuário LM renderiza estrutura, empty states e não expõe token', () => {
  const html = readFileSync(new URL('../public/admin-premium-student-record.html', import.meta.url), 'utf8');
  const js = readFileSync(new URL('../public/admin-premium-student-record.js', import.meta.url), 'utf8');
  assert.match(html, /Prontuário LM/);
  assert.match(html, /href="\/admin-premium-workspace\.html">← Voltar ao Workspace/);
  for (const text of ['Pendências', 'Anamnese', 'Planejamento alimentar', 'Feedbacks semanais', 'Evolução do acompanhamento']) assert.match(html, new RegExp(text));
  for (const text of ['Anamnese ainda não respondida', 'Nenhum plano criado', 'Rascunho em edição', 'Plano publicado', 'Alterações em revisão', 'Nenhum check-in enviado.', 'Nenhuma pendência aberta', 'Nenhum registro de evolução']) assert.match(js, new RegExp(text));
  assert.doesNotMatch(html + js, /access_token|x-admin-token'\s*:/);
  assert.match(js, /admin-premium-nutrition-plan\.html/);
  assert.match(js, /searchParams\.set\('student_id'/);
  assert.doesNotMatch(js, /admin-nutrition-plan\.html\?email=/);
  assert.match(js, /searchParams\.set\('return_to'/);
  assert.match(js, /admin-premium-student-record\.html/);
});

test('Copiar acesso usa somente a senha temporária em memória e envia a mensagem canônica exata ao Clipboard', async () => {
  const source = readFileSync(new URL('../public/admin-premium-student-record.js', import.meta.url), 'utf8');
  const dom = createFakeDocument();
  const clipboardWrites = [];
  let active = false;
  const student = { student_id: 'student-1', name: 'Ana Lima', email: 'ana@example.com', consultation_status: 'READY_TO_RELEASE' };
  const record = () => ({ student: { ...student, consultation_status: active ? 'ACTIVE' : student.consultation_status }, summary: {}, nutrition_plan: {}, pending_items: [], feedbacks: [], followup_entries: [] });
  const fetch = async (url, options = {}) => {
    if (url.endsWith('/status')) { active = true; return response({ student_id: student.student_id }); }
    if (url === '/api/admin/student-access/token') return response({ email: student.email, token: 'Temp#5482' });
    return response(record());
  };
  const location = { search: '?student_id=student-1', origin: 'https://admin.example' };
  const context = { document: dom.document, navigator: { clipboard: { writeText: async (value) => clipboardWrites.push(value) } }, window: { LMAdminAuth: { requireAdmin(){}, attachLogout(){}, getAdminAuthHeaders(headers){ return headers; } } }, location, URLSearchParams, URL, FormData: class {}, fetch };
  vm.runInNewContext(source, context);
  await new Promise((resolve) => setTimeout(resolve, 0));
  await dom.listeners.click({ target: dom.created.find((node) => node.dataset.releaseAccess) });
  const copyButton = dom.created.findLast((node) => node.dataset.copyAccess);
  await dom.listeners.click({ target: copyButton });
  assert.deepEqual(clipboardWrites, ['Portal LM\n\nAluno: Ana Lima\nE-mail: ana@example.com\nSenha: Temp#5482\nLink: https://portal.lucasmorenopersonal.com.br/portal-login.html']);
  assert.doesNotMatch(clipboardWrites[0], /undefined|null/);
  assert.equal(dom.document.getElementById('studentAccess').querySelector('[role="status"]').textContent, '✓ Acesso copiado');
});

test('ACTIVE sem senha temporária orienta a rotação e não oferece cópia', async () => {
  const source = readFileSync(new URL('../public/admin-premium-student-record.js', import.meta.url), 'utf8');
  const dom = createFakeDocument();
  const location = { search: '?student_id=student-1', origin: 'https://admin.example' };
  const context = { document: dom.document, navigator: {}, window: { LMAdminAuth: { requireAdmin(){}, attachLogout(){}, getAdminAuthHeaders(headers){ return headers; } } }, location, URLSearchParams, URL, FormData: class {}, fetch: async () => response({ student: { student_id: 'student-1', name: 'Ana', email: 'ana@example.com', consultation_status: 'ACTIVE' }, summary: {}, nutrition_plan: {}, pending_items: [], feedbacks: [], followup_entries: [] }) };
  vm.runInNewContext(source, context);
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(dom.created.find((node) => node.dataset.copyAccess), undefined);
  assert.ok(dom.created.find((node) => node.dataset.resetAccessPassword));
  assert.match(dom.document.getElementById('studentAccess').textContent, /A senha anterior não fica armazenada por segurança\. Gere uma nova senha para enviá-la ao aluno\./);
  assert.doesNotMatch(source, /localStorage|sessionStorage|indexedDB|console\.(?:log|info|warn|error).*temporary/i);
  assert.match(source, /lastStudent\.student_id !== student\.student_id\) temporaryAccessCredentials = null/);
  assert.match(source, /\/api\/admin\/student-access\/token', \{ method: 'POST'/);
  assert.doesNotMatch(source, /\/api\/admin\/student-access\/token', \{ method: 'GET'/);
});

test('rotação ACTIVE confirma, usa o e-mail oficial, renderiza e copia a nova senha somente após cópia real', async () => {
  const source = readFileSync(new URL('../public/admin-premium-student-record.js', import.meta.url), 'utf8');
  const dom = createFakeDocument();
  const requests = [];
  const writes = [];
  let confirmed = false;
  const student = { student_id: 'student-1', name: 'Ana Lima', email: 'ana@example.com', consultation_status: 'ACTIVE' };
  const fetch = async (url, options = {}) => {
    requests.push({ url, options });
    if (url === '/api/admin/student-access/token') return response({ email: student.email, token: 'Nova#9081' });
    return response({ student, summary: {}, nutrition_plan: {}, pending_items: [], feedbacks: [], followup_entries: [] });
  };
  const context = { confirm: () => confirmed, document: dom.document, navigator: { clipboard: { writeText: async (value) => writes.push(value) } }, window: { LMAdminAuth: { requireAdmin(){}, attachLogout(){}, getAdminAuthHeaders(headers){ return headers; } } }, location: { search: '?student_id=student-1', origin: 'https://admin.example' }, URLSearchParams, URL, FormData: class {}, fetch };
  vm.runInNewContext(source, context);
  await new Promise((resolve) => setTimeout(resolve, 0));
  const reset = dom.created.find((node) => node.dataset.resetAccessPassword);
  await dom.listeners.click({ target: reset });
  assert.equal(requests.filter(({ url }) => url === '/api/admin/student-access/token').length, 0);
  confirmed = true;
  await dom.listeners.click({ target: reset });
  const tokenRequest = requests.find(({ url }) => url === '/api/admin/student-access/token');
  assert.deepEqual(JSON.parse(tokenRequest.options.body), { email: student.email });
  assert.match(dom.document.getElementById('studentAccess').textContent, /Nova#9081/);
  assert.equal(writes.length, 0);
  const copy = dom.created.findLast((node) => node.dataset.copyAccess);
  await dom.listeners.click({ target: copy });
  assert.deepEqual(writes, ['Portal LM\n\nAluno: Ana Lima\nE-mail: ana@example.com\nSenha: Nova#9081\nLink: https://portal.lucasmorenopersonal.com.br/portal-login.html']);
  assert.equal(dom.document.getElementById('studentAccess').querySelector('[role="status"]').textContent, '✓ Acesso copiado');
});

test('falha ao gerar senha mantém o card seguro, sem sucesso falso ou senha vazia', async () => {
  const source = readFileSync(new URL('../public/admin-premium-student-record.js', import.meta.url), 'utf8');
  const dom = createFakeDocument();
  const student = { student_id: 'student-1', name: 'Ana', email: 'ana@example.com', consultation_status: 'ACTIVE' };
  let calls = 0;
  const fetch = async (url) => url === '/api/admin/student-access/token'
    ? (calls++, { ok: false, json: async () => ({ ok: false, error: 'Serviço indisponível' }) })
    : response({ student, summary: {}, nutrition_plan: {}, pending_items: [], feedbacks: [], followup_entries: [] });
  const context = { confirm: () => true, document: dom.document, navigator: {}, window: { LMAdminAuth: { requireAdmin(){}, attachLogout(){}, getAdminAuthHeaders(headers){ return headers; } } }, location: { search: '?student_id=student-1', origin: 'https://admin.example' }, URLSearchParams, URL, FormData: class {}, fetch };
  vm.runInNewContext(source, context);
  await new Promise((resolve) => setTimeout(resolve, 0));
  const reset = dom.created.find((node) => node.dataset.resetAccessPassword);
  await assert.doesNotReject(dom.listeners.click({ target: reset }));
  assert.equal(calls, 1);
  assert.match(dom.document.getElementById('studentAccess').textContent, /Serviço indisponível/);
  assert.equal(dom.created.find((node) => node.dataset.copyAccess), undefined);
  assert.doesNotMatch(dom.document.getElementById('studentAccess').textContent, /✓ Acesso copiado|Senha de acesso—/);
});

test('renderização do prontuário permanece operacional sem containers opcionais', async () => {
  const html = readFileSync(new URL('../public/admin-premium-student-record.html', import.meta.url), 'utf8');
  const source = readFileSync(new URL('../public/admin-premium-student-record.js', import.meta.url), 'utf8');
  assert.doesNotMatch(html, /careStatusContent/);
  assert.match(source, /const student=data\.student\|\|\{\}, summary=data\.summary\|\|\{\}, root=byId\('careStatusContent'\); if \(!root\) return;/);
  assert.match(source, /renderCareStatus\(data\);[\s\S]*renderPlan\(data\.nutrition_plan \|\| null, student\);/);

  const dom = createFakeDocument({ includeCareStatus: false, includePlanningObjectives: false });
  const location = { search: '?student_id=student-1', origin: 'https://admin.example', assign(url) { this.assigned = url; } };
  const context = { document: dom.document, window: { location, LMAdminAuth: { requireAdmin(){}, attachLogout(){}, getAdminAuthHeaders(headers){ return headers; } } }, location, URLSearchParams, URL, FormData: class {}, fetch: async () => ({ ok: true, json: async () => ({ ok: true, data: { student: { student_id: 'student-1', name: 'Ana' }, summary: {}, nutrition_plan: { current: null, draft: null }, pending_items: [], feedbacks: [], followup_entries: [] } }) }) };
  vm.runInNewContext(source, context);
  await new Promise((resolve) => setTimeout(resolve, 0));
  const action = dom.created.find((node) => node.attributes.href?.startsWith('/admin-premium-nutrition-plan.html'));
  assert.ok(action, 'renderPlan deve continuar gerando a ação oficial do editor');
  const card = dom.elements.get('planejamento-alimentar');
  assert.equal(card.attributes.role, 'link');
  assert.equal(card.attributes.tabindex, '0');
  card.onclick({ target: { closest: () => null } });
  assert.equal(location.assigned, '/admin-premium-nutrition-plan.html?student_id=student-1&return_to=%2Fadmin-premium-student-record.html%3Fstudent_id%3Dstudent-1%23planejamento-alimentar');
  let prevented = false;
  card.onkeydown({ key: ' ', preventDefault() { prevented = true; } });
  assert.equal(prevented, true);
  assert.match(dom.document.getElementById('plan').textContent, /Nenhum plano criado/);
});

test('card opcional de objetivos recebe descrição e CTA quando seu container existe', async () => {
  const source = readFileSync(new URL('../public/admin-premium-student-record.js', import.meta.url), 'utf8');
  const dom = createFakeDocument({ includePlanningObjectives: true });
  const context = {
    document: dom.document,
    window: { LMAdminAuth: { requireAdmin(){}, attachLogout(){}, getAdminAuthHeaders(headers){ return headers; } } },
    location: { search: '?student_id=student-1', origin: 'https://admin.example' }, URLSearchParams, URL, FormData: class {},
    fetch: async () => ({ ok: true, json: async () => ({ ok: true, data: { student: { student_id: 'student-1', name: 'Ana' }, summary: {}, nutrition_plan: { current: null, draft: null }, pending_items: [], feedbacks: [], followup_entries: [] } }) })
  };
  vm.runInNewContext(source, context);
  await new Promise((resolve) => setTimeout(resolve, 0));
  const objectives = dom.document.getElementById('planningObjectives');
  assert.match(objectives.textContent, /Defina os focos de treino, cardio e alimentação/);
  const action = dom.created.find((node) => node.attributes.href === '/admin-premium-planning-objectives.html?student_id=student-1');
  assert.ok(action, 'CTA de objetivos deve ser criada quando o container existe');
});


test('Objetivos do planejamento expõe main_risk opcional e mantém as cópias JavaScript sincronizadas', () => {
  const html = readFileSync(new URL('../public/admin-premium-planning-objectives.html', import.meta.url), 'utf8');
  const publicJs = readFileSync(new URL('../public/admin-premium-planning-objectives.js', import.meta.url), 'utf8');
  const assetJs = readFileSync(new URL('../public/assets/js/admin-premium-planning-objectives.js', import.meta.url), 'utf8');
  const home = readFileSync(new URL('../public/portal-premium-home.html', import.meta.url), 'utf8');
  assert.match(html, /<label>Objetivo principal<textarea name="main_risk" rows="4"><\/textarea><\/label>/);
  assert.doesNotMatch(html, /<textarea[^>]*required/);
  assert.match(publicJs, /form\.elements\.main_risk\.value=data\.main_risk\|\|''/);
  assert.match(publicJs, /Object\.fromEntries\(new FormData\(form\)\)/);
  assert.doesNotMatch(publicJs, /localStorage/);
  assert.equal(publicJs, assetJs);
  assert.match(home, /weeklyPlan\.main_risk/);
});

test('HTML seguro: Prontuário não usa innerHTML nem interpolação HTML dinâmica', () => {
  const publicJs = readFileSync(new URL('../public/admin-premium-student-record.js', import.meta.url), 'utf8');
  const assetJs = readFileSync(new URL('../public/assets/js/admin-premium-student-record.20260810-2.js', import.meta.url), 'utf8');
  assert.equal(publicJs, assetJs);
  assert.doesNotMatch(publicJs, /\.innerHTML\s*=/);
  assert.match(publicJs, /textContent/);
  assert.match(publicJs, /replaceChildren/);
});

test('check-ins oferecem detalhe canônico completo, validam o aluno e distinguem estados', async () => {
  const source = readFileSync(new URL('../public/admin-premium-student-record.js', import.meta.url), 'utf8');
  const html = readFileSync(new URL('../public/admin-premium-student-record.html', import.meta.url), 'utf8');
  const dom = createFakeDocument();
  const requests = [];
  const feedback = { id: 'feedback/1', student_id: 'student-1', submitted_at: '2026-08-08T12:00:00Z', week_ref: '2026-W32', coach_status: 'pending', training_adherence: 'Boa' };
  const fetch = async (url) => {
    requests.push(url);
    return url.includes('/weekly-feedbacks/') ? response({ feedback }) : response({ student: { student_id: 'student-1', name: 'Ana' }, summary: {}, nutrition_plan: {}, pending_items: [], feedbacks: [feedback], followup_entries: [] });
  };
  vm.runInNewContext(source, { document: dom.document, navigator: {}, window: { LMAdminAuth: { requireAdmin(){}, attachLogout(){}, getAdminAuthHeaders(headers){ return headers; } } }, location: { search: '?student_id=student-1', origin: 'https://admin.example' }, URLSearchParams, URL, FormData: class {}, fetch });
  await new Promise((resolve) => setTimeout(resolve, 0));
  const button = dom.created.find((node) => node.dataset.viewCheckin === 'feedback/1');
  assert.ok(button);
  assert.match(dom.document.getElementById('feedbacks').textContent, /Enviado em.*Semana de referência: 2026-W32.*Status profissional: pending.*Ver check-in/);
  assert.match(button.parentNode?.className || dom.document.getElementById('feedbacks').children[0].className, /pending/);
  await dom.listeners.click({ target: button });
  assert.equal(requests.at(-1), '/api/admin/premium/weekly-feedbacks/feedback%2F1');
  const detail = dom.document.getElementById('checkinDetail').textContent;
  for (const label of ['Adesão ao treino','Adesão alimentar','Cardio','Refeições livres','Fome','Compulsão/beliscos','Sono','Energia','Estresse','Peso semanal','Cintura','Evolução de força','Principal dificuldade','Contexto da rotina','Nota da semana','Suporte solicitado','Resposta do profissional','Datas relevantes']) assert.match(detail, new RegExp(label));
  assert.match(detail, /Boa/);
  assert.match(detail, /Não informado/);
  assert.match(html, /Carregando check-in…/);
  assert.match(source, /Nenhum check-in enviado\./);
  assert.match(source, /Tentar novamente/);
  assert.match(source, /feedback\.student_id !== lastStudent\.student_id/);
  assert.doesNotMatch(source, /\.innerHTML\s*=/);
});

test('XSS: dados maliciosos aparecem como texto sem criar elementos ou atributos perigosos', async () => {
  const source = readFileSync(new URL('../public/admin-premium-student-record.js', import.meta.url), 'utf8');
  const dom = createFakeDocument();
  const payload = maliciousRecord();
  const context = {
    document: dom.document,
    window: { LMAdminAuth: { requireAdmin(){}, attachLogout(){}, getAdminAuthHeaders(headers){ return headers; } } },
    location: { search: '?student_id=student-xss' },
    URLSearchParams,
    URL,
    FormData: class {},
    fetch: async (url) => ({ ok: true, json: async () => ({ ok: true, data: payload, url }) }),
    console,
  };
  vm.runInNewContext(source, context);
  await Promise.resolve();
  await Promise.resolve();
  await new Promise((resolve) => setTimeout(resolve, 0));

  const createdTags = dom.created.map((node) => node.tagName);
  assert.equal(createdTags.includes('img'), false);
  assert.equal(createdTags.includes('script'), false);
  const attrs = dom.created.flatMap((node) => Object.entries(node.attributes));
  assert.equal(attrs.some(([name]) => /^on/i.test(name)), false);
  assert.equal(attrs.some(([name, value]) => name === 'href' && String(value).startsWith('javascript:')), false);
  const allText = dom.text();
  for (const value of maliciousValues) assert.match(allText, new RegExp(escapeRegExp(value)));
});

test('Prontuário mantém a CTA alimentar para todas as combinações e constrói retorno contextual por student_id', async () => {
  const cases = [
    [{ current: null, draft: null }, 'Nenhum plano criado', 'Criar planejamento alimentar'],
    [{ current: null, draft: { id: 'draft-1' } }, 'Rascunho em edição', 'Continuar planejamento'],
    [{ current: { id: 'published-1' }, draft: null }, 'Plano publicado', 'Editar planejamento alimentar'],
    [{ current: { id: 'published-1' }, draft: { id: 'draft-1' } }, 'Alterações em revisão', 'Revisar alterações']
  ];
  for (const [nutrition_plan, label, actionLabel] of cases) {
    const dom = createFakeDocument();
    const context = {
      document: dom.document,
      window: { LMAdminAuth: { requireAdmin(){}, attachLogout(){}, getAdminAuthHeaders(headers){ return headers; } } },
      location: { search: '?student_id=student%20safe', origin: 'https://admin.example' },
      URLSearchParams,
      URL,
      FormData: class {},
      fetch: async () => ({ ok: true, json: async () => ({ ok: true, data: { student: { student_id: 'student safe', name: 'Ana' }, summary: {}, nutrition_plan, pending_items: [], feedbacks: [], followup_entries: [] } }) })
    };
    vm.runInNewContext(readFileSync(new URL('../public/admin-premium-student-record.js', import.meta.url), 'utf8'), context);
    await new Promise((resolve) => setTimeout(resolve, 0));
    const planText = dom.document.getElementById('plan').textContent;
    assert.match(planText, new RegExp(label));
    assert.match(planText, new RegExp(actionLabel));
    const action = dom.created.find((node) => node.attributes.href?.startsWith('/admin-premium-nutrition-plan.html'));
    assert.ok(action, 'CTA alimentar deve permanecer disponível');
    const href = new URL(action.attributes.href, 'https://admin.example');
    assert.equal(href.searchParams.get('student_id'), 'student safe');
    assert.equal(href.searchParams.get('return_to'), '/admin-premium-student-record.html?student_id=student+safe#planejamento-alimentar');
  }
});

test('Student 360 expõe navegação do prontuário apenas com feature flag', () => {
  const html = readFileSync(new URL('../admin-student.html', import.meta.url), 'utf8');
  assert.match(html, /PREMIUM_STUDENT_RECORD_ENABLED/);
  assert.match(html, /admin-premium-student-record\.html\?student_id=/);
});

function maliciousRecord() {
  const [img, preBreak, script, special, jsUrl] = maliciousValues;
  return {
    student: { name: img, email: jsUrl, phone: special, consultation_status: 'ACTIVE', last_activity_at: '2026-07-14T00:00:00.000Z' },
    summary: { open_pending_items_count: 1, next_operational_action: script },
    pending_items: [{ id: 'pending-xss', title: img, priority: special, source: script, created_at: '2026-07-14T00:00:00.000Z' }],
    anamnesis: { status: script, created_at: '2026-07-14T00:00:00.000Z', updated_at: '2026-07-14T00:00:00.000Z', answers: { attack: preBreak, nested: { special } } },
    nutrition_plan: { title: img, goal: script, strategy: special, updated_at: '2026-07-14T00:00:00.000Z' },
    feedbacks: [{ created_at: '2026-07-14T00:00:00.000Z', week_ref: preBreak, training_adherence: img, nutrition_adherence: script, sleep_quality: special, coach_status: jsUrl }],
    followup_entries: [{ title: img, entry_type: 'PROFESSIONAL_NOTE', content: preBreak, created_at: '2026-07-14T00:00:00.000Z' }]
  };
}

function createFakeDocument({ includeCareStatus = true, includePlanningObjectives = false } = {}) {
  const created = [];
  const listeners = {};
  class Element {
    constructor(tagName, id = '') {
      this.tagName = tagName.toLowerCase();
      this.id = id;
      this.children = [];
      this.attributes = {};
      this.dataset = {};
      this.className = '';
      this.hidden = false;
      this.disabled = false;
      this._text = '';
      created.push(this);
    }
    set textContent(value) { this._text = String(value ?? ''); this.children = []; }
    get textContent() { return [this._text, ...this.children.map((child) => child.textContent)].join(''); }
    append(...nodes) { for (const node of nodes.filter(Boolean)) { node.parentNode = this; this.children.push(node); } }
    replaceChildren(...nodes) { this.children = nodes.filter(Boolean); this._text = ''; }
    setAttribute(name, value) { this.attributes[name] = String(value); }
    querySelector(selector) { if (selector === '[role="status"]') return this.children.find((child) => child.attributes?.role === 'status') || null; return null; }
    addEventListener() {}
    showModal() { this.open = true; }
    close() { this.open = false; }
    focus() { this.focused = true; }
    reset() {}
  }
  const ids = ['state','record','studentName','contact','status','summary','pendingList','planejamento-alimentar','anamnesis','plan','feedbacks','entries','entryForm','studentAccess','adminLogoutBtn','primaryAction','checkinDialog','checkinDetail', ...(includeCareStatus ? ['careStatusContent'] : []), ...(includePlanningObjectives ? ['planningObjectives'] : [])];
  const elements = new Map(ids.map((id) => [id, new Element(id === 'entryForm' ? 'form' : 'div', id)]));
  const document = {
    getElementById(id) { return elements.get(id) || null; },
    createElement(tagName) { return new Element(tagName); },
    addEventListener(type, listener) { listeners[type] = listener; },
    execCommand() { return false; },
  };
  return { document, elements, created, listeners, text: () => [...elements.values()].map((node) => node.textContent).join('\n') };
}

function response(data) { return { ok: true, json: async () => ({ ok: true, data }) }; }

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
