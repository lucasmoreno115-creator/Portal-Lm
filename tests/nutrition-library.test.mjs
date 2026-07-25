import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createNutritionLibrary } from '../workers/premium/application/nutrition-library.js';

function fakeDb({ list = [], total = list.length, detail = null } = {}) {
  const calls = [];
  return {
    calls,
    prepare(sql) {
      const call = { sql, values: [] }; calls.push(call);
      return {
        bind(...values) { call.values = values; return this; },
        all: async () => ({ results: list }),
        first: async () => sql.includes('COUNT(*)') ? { total } : detail,
      };
    },
  };
}

test('listagem pesquisa metadados, aceita múltiplos planos e limita paginação a 50', async () => {
  const plans = [{ id: 'one' }, { id: 'two' }];
  const db = fakeDb({ list: plans, total: 2 });
  const result = await createNutritionLibrary({ db }).list({ q: 'Maria', limit: '999', offset: '4' });
  assert.deepEqual(result.data.items, plans);
  assert.deepEqual({ total: result.data.total, limit: result.data.limit, offset: result.data.offset }, { total: 2, limit: 50, offset: 4 });
  assert.match(db.calls[0].sql, /student_email/); assert.match(db.calls[0].sql, /np\.title/); assert.match(db.calls[0].sql, /student_name/);
  assert.doesNotMatch(db.calls[0].sql, /meals_json|substitutions_json|adherence_rules_json|private_notes|access_token/);
  assert.deepEqual(db.calls[0].values.slice(0, 3), ['%maria%', '%maria%', '%maria%']);
});

test('filtros distinguem legado, Premium e status normalizado', async () => {
  const legacyDb = fakeDb(); await createNutritionLibrary({ db: legacyDb }).list({ type: 'LEGACY', status: 'PUBLISHED' });
  assert.match(legacyDb.calls[0].sql, /np\.student_id IS NULL/); assert.match(legacyDb.calls[0].sql, /is_active=1 THEN 'PUBLISHED'/);
  assert.ok(legacyDb.calls[0].values.includes('PUBLISHED'));
  const premiumDb = fakeDb(); await createNutritionLibrary({ db: premiumDb }).list({ type: 'PREMIUM', status: 'DRAFT' });
  assert.match(premiumDb.calls[0].sql, /np\.student_id IS NOT NULL/); assert.ok(premiumDb.calls[0].values.includes('DRAFT'));
  assert.equal((await createNutritionLibrary({ db: fakeDb() }).list({ type: 'OTHER' })).status, 400);
  assert.equal((await createNutritionLibrary({ db: fakeDb() }).list({ status: 'DELETED' })).status, 400);
});

test('detalhe retorna ID legado ou Premium, faz parser seguro e não expõe dados sensíveis', async () => {
  const db = fakeDb({ detail: { id: 'plan/1', student_name: 'Ana', meals_json: '[{"name":"Almoço"}]', substitutions_json: 'inválido', adherence_rules_json: null } });
  const result = await createNutritionLibrary({ db }).detail('plan/1');
  assert.equal(result.ok, true); assert.deepEqual(result.data.meals, [{ name: 'Almoço' }]); assert.deepEqual(result.data.substitutions, []); assert.deepEqual(result.data.adherence_rules, []);
  assert.equal('meals_json' in result.data, false); assert.equal('private_notes' in result.data, false); assert.equal('access_token' in result.data, false); assert.equal('whatsapp_message' in result.data, false);
  assert.match(db.calls[0].sql, /WHERE np\.id=\? LIMIT 1/); assert.deepEqual(db.calls[0].values, ['plan/1']);
  for (const sensitive of ['private_notes', 'access_token', 'token', 'password']) assert.doesNotMatch(db.calls[0].sql, new RegExp(sensitive, 'i'));
  assert.equal((await createNutritionLibrary({ db: fakeDb() }).detail('missing')).status, 404);
});

test('rotas da biblioteca ficam sob autenticação admin e não implementam métodos de escrita', () => {
  const api = readFileSync('workers/api.js', 'utf8');
  const gate = api.indexOf("if (url.pathname.startsWith('/api/admin/'))"); const list = api.indexOf("url.pathname === '/api/admin/premium/nutrition-library'");
  assert.ok(gate >= 0 && list > gate); assert.match(api.slice(gate, list), /validateAdminAuthorization\(request, env\)/);
  const libraryRoutes = api.match(/[^\n]*nutrition-library[^\n]*/g)?.join('\n') || '';
  assert.doesNotMatch(libraryRoutes, /POST|PUT|PATCH|DELETE/); assert.match(libraryRoutes, /method === 'GET'/);
});

test('interface é somente leitura, reutiliza renderer e oferece impressão sem editor', () => {
  const html = readFileSync('public/admin-premium-nutrition-library.html', 'utf8');
  const js = readFileSync('public/assets/js/admin-premium-nutrition-library.js', 'utf8');
  const css = readFileSync('public/assets/css/admin-premium-nutrition-library.css', 'utf8');
  for (const text of ['Biblioteca de Planejamentos Alimentares', 'Consulte planejamentos anteriores e atuais em modo somente leitura.', 'Buscar por nome, e-mail ou plano', 'Somente leitura', 'Imprimir / Salvar em PDF']) assert.match(html, new RegExp(text));
  assert.match(html, /premium-nutrition-plan-renderer\.js/); assert.doesNotMatch(html, /admin-premium-nutrition-plan\.js/);
  assert.match(js, /PortalNutritionPlanRenderer/); assert.match(js, /window\.print\(\)/); assert.match(js, /method: 'GET'/); assert.doesNotMatch(js, /method:\s*['"](?:POST|PUT|PATCH|DELETE)/);
  assert.match(css, /@media print/); assert.match(css, /\.screen-only[^}]*display:none!important/);
});

test('artefatos da biblioteca são espelhados sem tocar superfícies congeladas', () => {
  for (const htmlPath of ['admin-premium-nutrition-library.html', 'public/admin-premium-nutrition-library.html']) assert.match(readFileSync(htmlPath, 'utf8'), /Biblioteca de Planejamentos Alimentares/);
  assert.equal(readFileSync('admin-premium-nutrition-library.js', 'utf8'), readFileSync('public/admin-premium-nutrition-library.js', 'utf8'));
  assert.equal(readFileSync('public/admin-premium-nutrition-library.js', 'utf8'), readFileSync('public/assets/js/admin-premium-nutrition-library.js', 'utf8'));
  assert.equal(readFileSync('admin-premium-nutrition-library.css', 'utf8'), readFileSync('public/assets/css/admin-premium-nutrition-library.css', 'utf8'));
  const source = readFileSync('public/assets/js/admin-premium-nutrition-library.js', 'utf8');
  for (const forbidden of ['portal-plano-alimentar', 'project-lm', 'notification', 'push', 'import-legacy', '/publish', '/archive']) assert.doesNotMatch(source, new RegExp(forbidden, 'i'));
});
