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
  for (const text of ['Anamnese ainda não respondida', 'Nenhum plano criado', 'Rascunho em edição', 'Plano publicado', 'Alterações em revisão', 'Nenhum feedback enviado', 'Nenhuma pendência aberta', 'Nenhum registro de evolução']) assert.match(js, new RegExp(text));
  assert.doesNotMatch(html + js, /access_token|x-admin-token'\s*:/);
  assert.match(js, /admin-premium-nutrition-plan\.html/);
  assert.match(js, /searchParams\.set\('student_id'/);
  assert.doesNotMatch(js, /admin-nutrition-plan\.html\?email=/);
  assert.match(js, /searchParams\.set\('return_to'/);
  assert.match(js, /admin-premium-student-record\.html/);
});

test('renderização do prontuário permanece operacional sem o container opcional de status', async () => {
  const html = readFileSync(new URL('../public/admin-premium-student-record.html', import.meta.url), 'utf8');
  const source = readFileSync(new URL('../public/admin-premium-student-record.js', import.meta.url), 'utf8');
  assert.doesNotMatch(html, /careStatusContent/);
  assert.match(source, /const student=data\.student\|\|\{\}, summary=data\.summary\|\|\{\}, root=byId\('careStatusContent'\); if \(!root\) return;/);
  assert.match(source, /renderCareStatus\(data\);[\s\S]*renderPlan\(data\.nutrition_plan \|\| null, student\);/);

  const dom = createFakeDocument({ includeCareStatus: false });
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
});

test('HTML seguro: Prontuário não usa innerHTML nem interpolação HTML dinâmica', () => {
  const publicJs = readFileSync(new URL('../public/admin-premium-student-record.js', import.meta.url), 'utf8');
  const assetJs = readFileSync(new URL('../public/assets/js/admin-premium-student-record.js', import.meta.url), 'utf8');
  assert.equal(publicJs, assetJs);
  assert.doesNotMatch(publicJs, /\.innerHTML\s*=/);
  assert.match(publicJs, /textContent/);
  assert.match(publicJs, /replaceChildren/);
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

function createFakeDocument({ includeCareStatus = true } = {}) {
  const created = [];
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
    append(...nodes) { this.children.push(...nodes.filter(Boolean)); }
    replaceChildren(...nodes) { this.children = nodes.filter(Boolean); this._text = ''; }
    setAttribute(name, value) { this.attributes[name] = String(value); }
    addEventListener() {}
    reset() {}
  }
  const ids = ['state','record','studentName','contact','status','summary','pendingList','planejamento-alimentar','anamnesis','plan','feedbacks','entries','entryForm','adminLogoutBtn','primaryAction', ...(includeCareStatus ? ['careStatusContent'] : [])];
  const elements = new Map(ids.map((id) => [id, new Element(id === 'entryForm' ? 'form' : 'div', id)]));
  const document = {
    getElementById(id) { return elements.get(id) || null; },
    createElement(tagName) { return new Element(tagName); },
    addEventListener() {},
  };
  return { document, elements, created, text: () => [...elements.values()].map((node) => node.textContent).join('\n') };
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
