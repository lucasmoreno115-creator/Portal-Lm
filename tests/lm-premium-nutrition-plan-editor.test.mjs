import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const editorPath = 'public/admin-premium-nutrition-plan.js';
const assetPath = 'public/assets/js/admin-premium-nutrition-plan.20260809-2.js';
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

test('smart action bar derives every visual mode from one state', () => {
  assert.match(source, /const actionBarState = \{ dirty:false, saving:false, savedAt:null, version:null, published:false/);
  assert.match(source, /'● Alterações não salvas'/);
  assert.match(source, /'⏳ Salvando\.\.\.'/);
  assert.match(source, /`✓ Alterações salvas às \$\{formatSavedTime\(actionBarState\.savedAt\)\}`/);
  assert.match(source, /'✓ Tudo salvo'/);
  assert.match(source, /textContent:'Salvar alterações'/);
  assert.match(source, /textContent:'Cancelar'/);
  assert.match(source, /textContent:'Publicar'/);
  assert.match(source, /`Versão \$\{actionBarState\.version\?\?'—'\}\$\{actionBarState\.published\?'':' \(Rascunho\)'\}`/);
});

test('smart save reuses persistDraft and returns to the clean state after three seconds', () => {
  const saveFlow = source.match(/async function saveDraft\(\)[\s\S]*?\n\}/)[0];
  assert.match(saveFlow, /persistDraft\(\)/);
  assert.match(saveFlow, /setTimeout\(\(\)=>\{actionBarState\.recentlySaved=false/);
  assert.match(saveFlow, /,3000\)/);
  assert.doesNotMatch(saveFlow, /location\.(reload|assign|replace)/);
});

test('smart save keeps the editing surface mounted and preserves UI context', () => {
  const saveFlow = source.match(/async function saveDraft\(\)[\s\S]*?\n\}/)[0];
  for (const renderer of ['renderDirectionForm', 'renderMealsEditor', 'renderEquivalenceEditor']) assert.doesNotMatch(saveFlow, new RegExp(renderer));
  assert.match(source, /function reconcileSavedModel\(saved\)/);
  assert.match(source, /Object\.assign\(existing,meal,\{uiId,substitutions\}\)/);
});

test('smart save keeps existing update and publish contracts', () => {
  assert.match(source, /nutrition-plans\/\$\{encodeURIComponent\(draftId\)\}\/draft`,\{method:'PATCH',body:JSON\.stringify\(payload\)\}/);
  assert.match(source, /if\(state\.isDirty\)await persistDraft\(\)/);
  assert.match(source, /nutrition-plans\/\$\{encodeURIComponent\(reviewedDraftId\)\}\/publish`,\{method:'POST',body:JSON\.stringify\(\{student_id:studentId\}\)\}/);
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

test('new nutrition plan starts with independent default equivalence categories', async () => {
  const elements = new Map(['status', 'current', 'history', 'draftForm', 'createDraft', 'duplicateDraft', 'saveDraft', 'publishDraft', 'backToRecord'].map(id => [id, { className: '', setAttribute() {} }]));
  const context = {
    URLSearchParams,
    URL,
    location: { search: '?student_id=student-1', origin: 'https://admin.example' },
    document: { getElementById: id => elements.get(id) },
    fetch: async () => { throw new Error('offline'); }
  };
  vm.runInNewContext(`${source}\napi=async(path,options)=>{globalThis.request={path,options};return {id:'draft-1',updated_at:'2026-07-31',...JSON.parse(options.body).plan};};adoptDraft=draft=>{globalThis.adopted=draft;};`, context);

  const defaults = JSON.parse(JSON.stringify(vm.runInNewContext('defaultEquivalenceCategories()', context)));
  assert.deepEqual(defaults, [
    { id: null, category: 'Proteínas', icon: '🥩', reference: '', items: [] },
    { id: null, category: 'Carboidratos', icon: '🍚', reference: '', items: [] },
    { id: null, category: 'Frutas', icon: '🍎', reference: '', items: [] }
  ]);
  assert.equal(vm.runInNewContext('const a=defaultEquivalenceCategories(),b=defaultEquivalenceCategories();a!==b&&a.every((entry,index)=>entry!==b[index]&&entry.items!==b[index].items)', context), true);

  await vm.runInNewContext('createDraft()', context);
  const request = context.request;
  assert.equal(request.options.method, 'POST');
  assert.deepEqual(JSON.parse(request.options.body).plan.substitutions, defaults);
});

test('hydration preserves old empty plans and version duplication does not apply defaults', () => {
  const elements = new Map(['status', 'current', 'history', 'draftForm', 'createDraft', 'duplicateDraft', 'saveDraft', 'publishDraft', 'backToRecord'].map(id => [id, { className: '', setAttribute() {} }]));
  const context = { URLSearchParams, URL, location: { search: '?student_id=student-1', origin: 'https://admin.example' }, document: { getElementById: id => elements.get(id) }, fetch: async () => { throw new Error('offline'); } };
  vm.runInNewContext(source, context);
  assert.deepEqual(JSON.parse(JSON.stringify(vm.runInNewContext("hydrateDraft({title:'Legado',meals:[],substitutions:[]}).substitutions", context))), []);
  assert.match(source, /duplicate-as-draft/);
  assert.doesNotMatch(source.match(/async function duplicatePublished[\s\S]*?async function replaceDraftFromConflict/)[0], /defaultEquivalenceCategories/);
});

test('default equivalences keep using existing add, delete, save and reopen flows', () => {
  assert.match(source, /function addEquivalenceCategory\(\)\{state\.model\.substitutions\.push\(blankEquivalence\(\)\)/);
  assert.match(source, /state\.model\.substitutions\.splice\(index,1\)/);
  assert.match(source, /substitutions:m\.substitutions\.map\(serializeEquivalence\)\.filter\(Boolean\)/);
  assert.match(source, /reconcileSavedModel\(saved\)/);
});

class MealSelectorElement {
  constructor(tag = 'div', id = '') { this.tagName = tag.toUpperCase(); this.id = id; this.children = []; this.listeners = new Map(); this.attributes = {}; this.className = ''; this.open = false; this.textContent = ''; this.focusCount = 0; }
  setAttribute(name, value) { this.attributes[name] = String(value); }
  getAttribute(name) { return this.attributes[name]; }
  addEventListener(type, listener) { const list = this.listeners.get(type) || []; list.push(listener); this.listeners.set(type, list); }
  removeEventListener(type, listener) { this.listeners.set(type, (this.listeners.get(type) || []).filter(item => item !== listener)); }
  append(...children) { this.children.push(...children); }
  replaceChildren(...children) { this.children = children; }
  querySelector(selector) {
    if (selector === 'button') return this.children.find(child => child.tagName === 'BUTTON') || null;
    if (selector === '[data-close-meal-selector]') return this.closeButton || null;
    return null;
  }
  querySelectorAll() { return []; }
  showModal() { this.open = true; this.showModalCount = (this.showModalCount || 0) + 1; }
  close() { this.open = false; }
  focus() { this.focusCount += 1; }
  dispatch(type, init = {}) { const event = { target: this, preventDefault() { this.defaultPrevented = true; }, ...init }; return Promise.all((this.listeners.get(type) || []).map(listener => listener(event))); }
}

function realMealSelectorHarness({ includeDialog = true } = {}) {
  const status = new MealSelectorElement('p', 'status');
  const options = new MealSelectorElement('div', 'mealSelectorOptions');
  const dialog = new MealSelectorElement('dialog', 'mealSelectorModal');
  const close = new MealSelectorElement('button');
  dialog.closeButton = close;
  const addButtons = [new MealSelectorElement('button'), new MealSelectorElement('button')];
  const opener = new MealSelectorElement('button');
  const elements = new Map(['current', 'history', 'draftForm', 'createDraft', 'duplicateDraft', 'saveDraft', 'publishDraft', 'backToRecord'].map(id => [id, new MealSelectorElement('div', id)]));
  elements.set('status', status);
  if (includeDialog) { elements.set('mealSelectorModal', dialog); elements.set('mealSelectorOptions', options); }
  const document = {
    activeElement: opener,
    getElementById: id => elements.get(id) || null,
    querySelectorAll: selector => selector === '[data-add-meal]' ? addButtons : [],
    createElement: tag => new MealSelectorElement(tag)
  };
  const context = { URLSearchParams, URL, location: { search: '?student_id=student-1', origin: 'https://admin.example' }, document, LMAdminAuth: { getAdminAuthHeaders: headers => headers }, fetch: () => new Promise(() => {}) };
  vm.runInNewContext(`${source}\nstate.model=blankModel();markDirty=()=>{};renderMealsEditor=()=>{globalThis.renderCount=(globalThis.renderCount||0)+1;};`, context);
  return { context, status, options, dialog, close, addButtons, opener };
}

function openFrom(button, dialog) {
  const click = button.dispatch('click');
  assert.equal(dialog.open, true);
  return click;
}

async function closeAndWait(dialog, pending, mode, close) {
  if (mode === 'cancel') await dialog.dispatch('cancel');
  if (mode === 'button') await close.dispatch('click');
  if (mode === 'backdrop') await dialog.dispatch('click', { target: dialog });
  await pending;
  assert.equal(dialog.open, false);
}

test('real meal-selector runtime opens from both actions, creates a meal, and preserves every close path', async () => {
  const harness = realMealSelectorHarness();
  let pending = openFrom(harness.addButtons[0], harness.dialog);
  assert.equal(harness.options.children.filter(child => child.tagName === 'BUTTON').length, 9);
  await closeAndWait(harness.dialog, pending, 'cancel', harness.close);

  pending = openFrom(harness.addButtons[1], harness.dialog);
  const lunch = harness.options.children.find(child => child.getAttribute('data-meal-name') === 'Almoço');
  assert.ok(lunch);
  await lunch.dispatch('click');
  await pending;
  assert.equal(vm.runInNewContext('state.model.meals.length', harness.context), 1);
  assert.equal(vm.runInNewContext('state.model.meals[0].name', harness.context), 'Almoço');

  for (const mode of ['button', 'backdrop']) {
    pending = openFrom(harness.addButtons[0], harness.dialog);
    await closeAndWait(harness.dialog, pending, mode, harness.close);
  }
  assert.ok(harness.opener.focusCount >= 3);
});

test('meal selector reports a visible error when its dialog is absent', async () => {
  const { addButtons, status } = realMealSelectorHarness({ includeDialog: false });
  await addButtons[0].dispatch('click');
  assert.match(status.textContent, /Não foi possível abrir o seletor de refeições/);
  assert.equal(status.className, 'notice error');
});

test('published editor cache-busts deterministic assets and keeps canonical copies synchronized', () => {
  assert.match(html, /admin-premium-nutrition-plan\.css\?v=20260809-1/);
  assert.match(html, /admin-premium-nutrition-plan\.20260809-2\.js/);
  assert.equal(source, fs.readFileSync(assetPath, 'utf8'));
  assert.equal(fs.existsSync('public/assets/js/admin-premium-nutrition-plan.js'), false);
  assert.equal(fs.readFileSync('public/admin-premium-nutrition-plan.css', 'utf8'), fs.readFileSync('public/assets/css/admin-premium-nutrition-plan.css', 'utf8'));
});

const serviceWorkerSource = fs.readFileSync('public/sw.js', 'utf8');
const oldRuntimeUrl = 'https://portal.example/assets/js/admin-premium-nutrition-plan.js';
const queryVersionedRuntimeUrl = `${oldRuntimeUrl}?v=20260809-2`;
const fingerprintedRuntimeUrl = 'https://portal.example/assets/js/admin-premium-nutrition-plan.20260809-2.js';

function cachedUrlFor(requestUrl, cachedUrls, { ignoreSearch }) {
  const requested = new URL(requestUrl);
  return cachedUrls.find(candidate => {
    const cached = new URL(candidate);
    return cached.origin === requested.origin
      && cached.pathname === requested.pathname
      && (ignoreSearch || cached.search === requested.search);
  }) || null;
}

test('version-aware cache lookup reproduces and blocks the stale query-string runtime', () => {
  const cache = [oldRuntimeUrl];
  assert.equal(cachedUrlFor(queryVersionedRuntimeUrl, cache, { ignoreSearch: true }), oldRuntimeUrl);
  assert.equal(cachedUrlFor(queryVersionedRuntimeUrl, cache, { ignoreSearch: false }), null);
  assert.match(serviceWorkerSource, /const versioned = url\.searchParams\.has\('v'\)/);
  assert.match(serviceWorkerSource, /caches\.match\(request, \{ ignoreSearch: !versioned \}\)/);
});

test('fingerprinted runtime pathname cannot match the stale canonical pathname', () => {
  assert.equal(cachedUrlFor(fingerprintedRuntimeUrl, [oldRuntimeUrl], { ignoreSearch: true }), null);
  assert.notEqual(new URL(fingerprintedRuntimeUrl).pathname, new URL(oldRuntimeUrl).pathname);
});

test('service-worker hotfix preserves API bypass, navigation, offline fallback and cache safety', () => {
  assert.match(serviceWorkerSource, /url\.pathname\.startsWith\('\/api\/'\)/);
  assert.match(serviceWorkerSource, /request\.mode === 'navigate'/);
  assert.match(serviceWorkerSource, /fetch\(request\)\.catch\(\(\) => caches\.match\(OFFLINE_URL\)\)/);
  assert.match(serviceWorkerSource, /request\.headers\.has\('authorization'\)/);
  assert.ok(serviceWorkerSource.includes('!/(?:private|no-store)/i.test(cacheControl)'));
  assert.match(serviceWorkerSource, /cache\.put\(request, response\.clone\(\)\)/);
});

test('real Editar planejamento click duplicates the published id and handles invalid plans and API failures', async () => {
  const elements = new Map(['status', 'current', 'currentSection', 'history', 'draftForm', 'createDraft', 'duplicateDraft', 'saveDraft', 'publishDraft', 'backToRecord'].map(id => [id, new MealSelectorElement('div', id)]));
  const findById = (root, id) => root?.id === id || root?.getAttribute?.('id') === id ? root : root?.children?.map(child => findById(child, id)).find(Boolean) || null;
  const document = {
    getElementById: id => elements.get(id) || [...elements.values()].map(root => findById(root, id)).find(Boolean) || null,
    querySelectorAll: () => [],
    createElement: tag => new MealSelectorElement(tag)
  };
  const context = { URLSearchParams, URL, location: { search: '?student_id=student-1', origin: 'https://admin.example' }, document, LMAdminAuth: { getAdminAuthHeaders: headers => headers }, fetch: () => new Promise(() => {}) };
  vm.runInNewContext(`${source}\nglobalThis.requestUrls=[];state.current={id:'published-42',title:'Plano publicado',version_number:7,meals:[]};api=async path=>{requestUrls.push(path);return {id:'draft-8',title:'Rascunho',meals:[],updated_at:'2026-08-09'};};adoptDraft=draft=>{globalThis.openedDraft=draft;};renderCurrent();`, context);

  const editButton = elements.get('current').children[0].children.find(child => child.getAttribute('id') === 'editPublished');
  assert.ok(editButton, 'the rendered Editar planejamento button must exist');
  await editButton.dispatch('click');
  await new Promise(resolve => setImmediate(resolve));
  const requests = JSON.parse(JSON.stringify(context.requestUrls));
  assert.deepEqual(requests, ['/api/admin/premium/nutrition-plans/published-42/duplicate-as-draft']);
  assert.ok(requests.every(url => !url.includes('undefined')));
  assert.equal(context.openedDraft.id, 'draft-8');

  vm.runInNewContext("state.current={title:'Sem id',meals:[]};renderCurrent();", context);
  const invalidButton = elements.get('current').children[0].children.find(child => child.getAttribute('id') === 'editPublished');
  await invalidButton.dispatch('click');
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(context.requestUrls.length, 1, 'an invalid plan must not call the API');
  assert.match(elements.get('status').textContent, /identificador válido/);
  assert.equal(elements.get('status').className, 'notice error');

  vm.runInNewContext("state.current={id:'published-failure',title:'Plano',meals:[]};api=async()=>{throw new Error('Falha controlada');};renderCurrent();", context);
  const failingButton = elements.get('current').children[0].children.find(child => child.getAttribute('id') === 'editPublished');
  await assert.doesNotReject(() => failingButton.dispatch('click'));
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(elements.get('status').textContent, 'Falha controlada');
  assert.equal(elements.get('status').className, 'notice error');
});
