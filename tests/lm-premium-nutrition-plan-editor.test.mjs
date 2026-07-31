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

const htmlPath = 'public/admin-premium-nutrition-plan.html';
const html = fs.readFileSync(htmlPath, 'utf8');

function addMealButtonHarness(mealName = 'Almoço') {
  const listeners = [{}, {}];
  const buttons = listeners.map(events => ({ addEventListener(type, listener) { events[type] = listener; } }));
  const elements = new Map(['status', 'current', 'history', 'draftForm', 'createDraft', 'duplicateDraft', 'saveDraft', 'publishDraft', 'backToRecord'].map(id => [id, { className: '', setAttribute() {} }]));
  const context = {
    URLSearchParams,
    URL,
    location: { search: '?student_id=student-1', origin: 'https://admin.example' },
    document: {
      getElementById: id => elements.get(id),
      querySelectorAll: selector => selector === '[data-add-meal]' ? buttons : []
    },
    fetch: async () => { throw new Error('offline'); }
  };
  vm.runInNewContext(`${source}\nstate.model=blankModel();openMealSelector=async()=>${JSON.stringify(mealName)};markDirty=()=>{};renderMealsEditor=()=>{globalThis.renderCount=(globalThis.renderCount||0)+1;};`, context);
  return { context, listeners };
}

test('nutrition editor renders matching meal actions above and below the meal list', () => {
  const matches = [...html.matchAll(/<button\b[^>]*data-add-meal[^>]*>\+ Adicionar refeição<\/button>/g)];
  assert.equal(matches.length, 2);
  for (const match of matches) assert.match(match[0], /type="button"/);
  const listPosition = html.indexOf('id="mealsEditor"');
  assert.ok(matches[0].index < listPosition);
  assert.ok(matches[1].index > listPosition);
  assert.match(html.slice(listPosition, matches[1].index), /<footer class="meals-footer">/);
  assert.doesNotMatch(matches.map(match => match[0]).join(''), /\bid=/);
});

test('both meal actions share the handler and add through the same state flow', async () => {
  const { context, listeners } = addMealButtonHarness();
  assert.equal(listeners[0].click, listeners[1].click);

  await listeners[0].click();
  assert.equal(context.renderCount, 1);
  assert.equal(vm.runInNewContext('state.model.meals.length', context), 1);
  assert.equal(vm.runInNewContext('state.model.meals[0].name', context), 'Almoço');

  await listeners[1].click();
  assert.equal(context.renderCount, 2);
  assert.equal(vm.runInNewContext('state.model.meals.length', context), 2);
  assert.equal(vm.runInNewContext('state.model.meals[1].name', context), 'Almoço');
});

test('meal selector exposes the nine choices in the natural meal-plan order', () => {
  assert.match(source, /const MEAL_NAMES = \['Café da manhã','Lanche da manhã','Almoço','Lanche da tarde','Jantar','Ceia','Pré-treino','Pós-treino','Refeição personalizada'\]/);
  assert.match(source, /MEAL_NAMES\.map\(\(name,index\)=>/);
  assert.match(source, /options\.querySelector\('button'\)\?\.focus\(\)/);
});

test('selector is a keyboard-accessible modal that supports cancel, backdrop and focus restoration', () => {
  assert.match(html, /id="mealSelectorModal"[^>]*role="dialog"[^>]*aria-modal="true"/);
  assert.match(source, /dialog\.addEventListener\('cancel',cancel\)/);
  assert.match(source, /if\(event\.target===dialog\)cancel\(event\)/);
  assert.match(source, /opener\?\.focus\?\.\(\)/);
  assert.match(source, /const mealName=await openMealSelector\(\);if\(!mealName\)return;createMeal\(mealName\)/);
});

test('custom meal uses a small named form and keeps creation centralized', () => {
  assert.match(html, /<form id="customMealForm">/);
  assert.match(html, /<label for="customMealName">Nome da refeição<\/label>/);
  assert.match(source, /form\.addEventListener\('submit',submit\)/);
  assert.match(source, /const meal=blankMeal\(name\)/);
  assert.match(source, /meal\.customName=mealName/);
  assert.doesNotMatch(source, /\bprompt\(/);
});

test('bottom meal action is static outside the rendered list and survives empty or refreshed lists', () => {
  const listStart = html.indexOf('<div id="mealsEditor"></div>');
  const footerStart = html.indexOf('<footer class="meals-footer">');
  assert.ok(listStart >= 0 && footerStart > listStart);
  assert.match(source, /function renderMealsEditor\(\)\{\$\('mealsEditor'\)\.replaceChildren\(/);
  assert.doesNotMatch(source, /meals-footer/);
});
