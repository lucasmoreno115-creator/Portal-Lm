import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const editorPath = 'public/admin-premium-nutrition-plan.js';
const assetPath = 'public/assets/js/admin-premium-nutrition-plan.js';
const source = fs.readFileSync(editorPath, 'utf8');

function serialize({ model, draft }) {
  const elements = new Map(['status', 'current', 'history', 'draftForm', 'createDraft', 'duplicateDraft', 'saveDraft', 'publishDraft', 'backToRecord'].map(id => [id, { setAttribute() {} }]));
  const context = { URLSearchParams, URL, location: { search: '?student_id=student-1', origin: 'https://admin.example' }, document: { getElementById: id => elements.get(id) }, fetch: async () => { throw new Error('offline'); } };
  vm.runInNewContext(`${source}\nstate.model=${JSON.stringify(model)};state.draft=${JSON.stringify(draft)};globalThis.result=serializeDraft();`, context);
  return JSON.parse(JSON.stringify(context.result));
}

const model = { title: 'Plano de julho', notes: 'Preparar refeições.', substitutions: [{ category: 'Proteínas', icon: '', reference: '', items: ['Frango'] }], meals: [{ uiId: 'ui-1', persistedId: null, name: 'Almoço', customName: '', time: '12:00', notes: 'Comer com calma.', primaryText: 'Arroz\nFrango', legacyItems: [], substitutions: [{ uiId: 'sub-1', persistedId: null, text: 'Batata\nPeixe' }] }] };

test('nutrition editor initial area has only plan name and observations', () => {
  assert.match(source, /inputField\('Nome do plano','title'/);
  assert.match(source, /inputField\('Observações','notes'/);
  assert.doesNotMatch(source, /inputField\('Objetivo'/);
  assert.doesNotMatch(source, /Estratégia atual/);
  assert.doesNotMatch(source, /inputField\('Estratégia'/);
  assert.doesNotMatch(source, /Mensagem de WhatsApp/);
});

test('nutrition editor omits blank legacy goal and strategy values from saves', () => {
  const payload = serialize({ model, draft: { updated_at: '2026-07-24T00:00:00.000Z', goal: '', strategy: '', adherence_rules: [] } });
  assert.equal('goal' in payload, false);
  assert.equal('strategy' in payload, false);
  assert.equal(payload.meals[0].primary_text, 'Arroz\nFrango');
  assert.deepEqual(payload.substitutions, [{ category: 'Proteínas', items: ['Frango'] }]);
});

test('nutrition editor preserves populated legacy goal and strategy for the update contract', () => {
  const payload = serialize({ model, draft: { updated_at: '2026-07-24T00:00:00.000Z', goal: 'Hipertrofia', strategy: 'Superávit controlado', adherence_rules: [] } });
  assert.equal(payload.goal, 'Hipertrofia');
  assert.equal(payload.strategy, 'Superávit controlado');
  assert.equal(payload.meals[0].substitutions[0].text, 'Batata\nPeixe');
});

test('nutrition editor runtime copies stay synchronized', () => {
  assert.equal(source, fs.readFileSync(assetPath, 'utf8'));
});
