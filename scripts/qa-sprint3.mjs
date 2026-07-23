#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { presentPublicNutritionPlan } from '../workers/premium/presenters/nutrition-plan-public-presenter.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const failures = [];
const evidence = [];
const fail = (scope, message, details = {}) => failures.push({ scope, message, ...details });
const pass = (scope, message, details = {}) => evidence.push({ scope, message, ...details });
const assert = (condition, scope, message, details = {}) => condition ? pass(scope, message, details) : fail(scope, message, details);
const read = (relativePath) => readFileSync(path.join(root, relativePath), 'utf8');

function requireFiles() {
  const scope = 'portal-files';
  const files = [
    'public/portal.html',
    'public/portal-login.html',
    'public/portal-shared.js',
    'public/assets/js/lm-access.js',
    'public/portal-plano-alimentar.html',
    'public/assets/js/premium-nutrition-plan-renderer.js',
    'workers/api.js',
    'workers/premium/presenters/nutrition-plan-public-presenter.js',
  ];
  for (const file of files) assert(existsSync(path.join(root, file)), scope, `Arquivo obrigatório presente: ${file}`);
}

function storage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem: (key) => values.has(key) ? values.get(key) : null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key),
  };
}

function auditAuthAndPermissions() {
  const scope = 'portal-auth-permissions';
  const sharedSource = read('public/portal-shared.js');
  const accessSource = read('public/assets/js/lm-access.js');

  const location = { href: '', pathname: '/portal-plano-alimentar.html' };
  const localStorage = storage();
  const sessionStorage = storage();
  const context = {
    localStorage,
    sessionStorage,
    window: { location },
    document: { querySelector: () => null },
    fetch: async () => ({ ok: true, json: async () => ({ ok: true }) }),
    console,
  };
  vm.createContext(context);
  vm.runInContext(sharedSource, context);
  vm.runInContext(accessSource, context);

  context.requireAuth();
  assert(location.href === 'portal-login.html', scope, 'Sessão ausente redireciona para login.', { href: location.href });

  localStorage.setItem('lm_student_email', 'aluno@example.com');
  localStorage.setItem('lm_student_token', 'token-qa');
  localStorage.setItem('lm_student_plan', 'premium');
  location.href = '';
  assert(context.getAuth().email === 'aluno@example.com' && context.getAuth().token === 'token-qa', scope, 'Credenciais do aluno são recuperadas do storage.');
  assert(context.hasAccess('plano-alimentar') === true, scope, 'Aluno Premium possui acesso ao plano alimentar.');

  localStorage.setItem('lm_student_plan', 'projeto_lm');
  location.href = '';
  const allowed = context.redirectIfNoAccess('plano-alimentar');
  assert(allowed === false && location.href === '/projeto-lm/#home', scope, 'Aluno Projeto LM é bloqueado na superfície Premium.', { href: location.href });
  assert(sessionStorage.getItem('lm_access_message') != null, scope, 'Bloqueio de permissão registra mensagem de acesso.');

  const captured = {};
  context.fetch = async (url, options) => {
    captured.url = url;
    captured.options = options;
    return { ok: true, json: async () => ({ data: { ok: true } }) };
  };
  localStorage.setItem('lm_student_plan', 'premium');
  return context.api('/portal/nutrition-plan').then(() => {
    assert(captured.url === '/api/portal/nutrition-plan', scope, 'Cliente chama o endpoint canônico do Portal.', { url: captured.url });
    assert(captured.options?.headers?.['x-student-email'] === 'aluno@example.com', scope, 'Request envia identidade do aluno.');
    assert(captured.options?.headers?.['x-student-token'] === 'token-qa', scope, 'Request envia token do aluno.');
  });
}

function auditPublicPresenter() {
  const scope = 'portal-public-contract';
  const base = {
    title: 'Plano QA', goal: 'Objetivo', strategy: 'Estratégia', status: 'PUBLISHED', is_active: 1,
    meals_json: JSON.stringify([{ name: 'Café', time: '07:00', primary_text: '2 ovos', guidance: 'Preparar na hora', substitutions: ['Iogurte'] }]),
    substitutions_json: JSON.stringify([{ category: 'Proteínas', items: ['Ovos'] }]),
    adherence_rules_json: JSON.stringify(['Seguir horários']), notes: 'Observação', whatsapp_message: 'Mensagem', published_at: '2026-07-22T10:00:00Z',
  };
  const publicPlan = presentPublicNutritionPlan(base);
  assert(publicPlan?.status === 'PUBLISHED', scope, 'Presenter libera plano publicado e ativo.');
  assert(publicPlan?.meals?.[0]?.primary_text === '2 ovos', scope, 'Presenter preserva conteúdo principal da refeição.');
  assert(Array.isArray(publicPlan?.meals?.[0]?.substitutions), scope, 'Presenter preserva substituições por refeição.');
  assert(publicPlan?.observations === 'Observação' && publicPlan?.notes === 'Observação', scope, 'Presenter mantém aliases públicos compatíveis.');
  assert(presentPublicNutritionPlan({ ...base, status: 'DRAFT', is_active: 0 }) === null, scope, 'Rascunho não é exposto ao aluno.');
  assert(presentPublicNutritionPlan({ ...base, status: 'ARCHIVED', is_active: 0 }) === null, scope, 'Versão arquivada não é exposta ao aluno.');
  assert(presentPublicNutritionPlan({ ...base, status: 'PUBLISHED', is_active: 0 }) === null, scope, 'Plano publicado inativo não é exposto ao aluno.');
}

function auditRenderer() {
  const scope = 'portal-rendering';
  const source = read('public/assets/js/premium-nutrition-plan-renderer.js');
  const window = {};
  const context = { window };
  vm.createContext(context);
  vm.runInContext(source, context);
  const renderer = window.PortalNutritionPlanRenderer;
  assert(Boolean(renderer), scope, 'Renderer nutricional é exportado para o Portal.');
  assert(renderer.escapeHtml('<script>') === '&lt;script&gt;', scope, 'Renderer escapa HTML não confiável.');

  const primary = renderer.renderMealContent({ primary_text: '- 2 ovos\n- 1 fruta', substitutions: [{ text: '- Iogurte\n- Whey' }] }, { emptyHtml: 'vazio' });
  assert(primary.primary.source === 'primary_text' && primary.primaryHtml.includes('<li>2 ovos</li>'), scope, 'Renderer apresenta plano textual publicado.');
  assert(primary.substitutionsHtml.includes('Alternativa 1') && primary.substitutionsHtml.includes('Iogurte'), scope, 'Renderer apresenta substituições da refeição.');

  const legacy = renderer.renderMealContent({ items: [{ quantity: 100, unit: 'g', food: 'frango' }] }, { emptyHtml: 'vazio' });
  assert(legacy.primary.source === 'items' && legacy.primaryHtml.includes('100 g de frango'), scope, 'Renderer preserva compatibilidade com refeições estruturadas legadas.');
  const empty = renderer.renderMealContent({}, { emptyHtml: '<p>vazio</p>' });
  assert(empty.primary.source === 'empty' && empty.primaryHtml === '<p>vazio</p>', scope, 'Renderer trata refeição sem conteúdo sem quebrar a tela.');
}

function auditPageStateContracts() {
  const scope = 'portal-page-states';
  const html = read('public/portal-plano-alimentar.html');
  const orderedScripts = [
    '/assets/js/lm-access.js',
    'portal-shared.js',
    '/assets/js/premium-nutrition-plan-renderer.js',
  ].map((item) => html.indexOf(item));
  assert(orderedScripts.every((position) => position >= 0) && orderedScripts[0] < orderedScripts[1] && orderedScripts[1] < orderedScripts[2], scope, 'Dependências do Portal carregam em ordem válida.', { orderedScripts });
  assert(/requireAuth\(\)/.test(html), scope, 'Página exige autenticação antes do carregamento.');
  assert(/redirectIfNoAccess\(['"]plano-alimentar['"]\)/.test(html), scope, 'Página aplica permissão específica do plano alimentar.');
  assert(/api\(['"]\/portal\/nutrition-plan['"]\)/.test(html), scope, 'Página consome endpoint canônico do plano publicado.');
  const emptyStateContract = /renderStatusState\(\s*'empty',\s*'Ainda não existe um planejamento alimentar disponível\.',\s*'Assim que seu consultor publicar a atualização, ela aparecerá aqui\.'\s*\)/;
  const errorStateContract = /renderStatusState\(\s*'error',\s*'Não foi possível carregar seu planejamento\.',\s*'Verifique sua conexão e tente novamente\.',\s*'Tentar novamente'\s*\)/;
  assert(emptyStateContract.test(html), scope, 'Estado sem plano publicado usa o contrato explícito reutilizável.', { contract: 'renderStatusState(empty, título, orientação)' });
  assert(errorStateContract.test(html), scope, 'Falha de carregamento usa o contrato explícito reutilizável com retry.', { contract: 'renderStatusState(error, título, orientação, retry)' });
  assert(/document\.getElementById\('nutritionRetryBtn'\)\?\.addEventListener\('click', loadPlan\)/.test(html), scope, 'Botão de retry reinicia o carregamento do plano.');
  assert(/function renderLoadingState\(\) \{[\s\S]*?contentCard\.setAttribute\('aria-busy', 'true'\)/.test(html), scope, 'Loading marca a região do plano como ocupada.');
  assert(/function renderStatusState\([\s\S]*?contentCard\.setAttribute\('aria-busy', 'false'\)/.test(html), scope, 'Estados finais liberam a região do plano.');
  assert(/renderPlan\([\s\S]*?contentCard\.setAttribute\('aria-busy', 'false'\)/.test(html), scope, 'Sucesso libera a região do plano após renderizar.');
  assert(/if \(!response\?\.data\)/.test(html), scope, 'Resposta sem plano não é tratada como sucesso renderizável.');
  assert(/renderPlan\(response\.data\)/.test(html), scope, 'Resposta publicada é encaminhada para renderização.');
  assert(/pdfActions\.hidden = false/.test(html), scope, 'Ação de impressão só é liberada após plano válido.');
}

function auditWorkerContracts() {
  const scope = 'portal-api-security';
  const worker = read('workers/api.js');
  assert(worker.includes('validateStudent'), scope, 'Worker possui validação de sessão do aluno.');
  assert(worker.includes('getPremiumGate') && worker.includes('premiumLockedResponse'), scope, 'Worker aplica gate do lifecycle Premium.');
  assert(worker.includes('presentPublicNutritionPlan'), scope, 'Worker usa presenter público restritivo.');
  assert(worker.includes('getCurrentNutritionPlanWorkflow'), scope, 'Worker usa o fluxo atual de plano publicado.');
  assert(worker.includes('/portal/nutrition-plan') || (worker.includes('portal') && worker.includes('nutrition-plan')), scope, 'Endpoint do Portal está registrado no Worker.');
  assert(worker.includes('x-student-email') && worker.includes('x-student-token'), scope, 'Worker reconhece cabeçalhos de autenticação estudantil.');
}

requireFiles();
await auditAuthAndPermissions();
auditPublicPresenter();
auditRenderer();
auditPageStateContracts();
auditWorkerContracts();

const report = {
  sprint: 'QA 3',
  status: failures.length === 0 ? 'VALIDATED' : 'FAILED',
  generatedAt: new Date().toISOString(),
  summary: { failures: failures.length, evidence: evidence.length },
  failures,
  evidence,
};
console.log(JSON.stringify(report, null, 2));
process.exitCode = failures.length === 0 ? 0 : 1;
