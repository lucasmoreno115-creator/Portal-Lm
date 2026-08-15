import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((onResolve, onReject) => {
    resolve = onResolve;
    reject = onReject;
  });
  return { promise, resolve, reject };
}

async function progressionHarness(postResponses) {
  const html = await readFile(new URL('../public/portal-progressao.html', import.meta.url), 'utf8');
  const scripts = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)].map((match) => match[1]).filter(Boolean);
  const ids = ['nav', 'zone', 'reps', 'calc', 'out', 'save', 'saveStatus', 'exercise', 'load', 'hist', 'executionQuality'];
  const elements = new Map(ids.map((id) => [id, {
    id,
    value: '',
    style: {},
    disabled: false,
    textContent: '',
    innerHTML: '',
    children: [],
    replaceChildren() { this.children = []; },
    append(child) { this.children.push(child); },
  }]));
  Object.assign(elements.get('zone'), { value: '8–10' });
  Object.assign(elements.get('executionQuality'), { value: 'Sim' });

  let postCount = 0;
  let historyCount = 0;
  const api = (path, options = {}) => {
    assert.equal(path, '/portal/progression');
    if (options.method === 'POST') {
      const response = postResponses[postCount];
      postCount += 1;
      return response.promise;
    }
    historyCount += 1;
    return Promise.resolve({ data: [] });
  };
  const context = {
    api,
    document: {
      getElementById: (id) => elements.get(id),
      createElement: () => ({ className: '', textContent: '' }),
    },
    requireAuth() {},
    redirectIfNoAccess() {},
    nav: () => '',
  };
  vm.runInNewContext(scripts.at(-1), context, { filename: 'public/portal-progressao.html' });
  await Promise.resolve();

  Object.assign(elements.get('exercise'), { value: 'Supino reto' });
  Object.assign(elements.get('load'), { value: '80.5' });
  Object.assign(elements.get('reps'), { value: '10' });
  elements.get('calc').onclick();

  return { elements, postCount: () => postCount, historyCount: () => historyCount };
}

test('F6.2 rapid double activation keeps one POST and exposes pending then success feedback', async () => {
  const pendingPost = deferred();
  const harness = await progressionHarness([pendingPost]);
  const save = harness.elements.get('save');
  const status = harness.elements.get('saveStatus');

  const firstActivation = save.onclick();
  const secondActivation = save.onclick();

  assert.equal(harness.postCount(), 1);
  assert.equal(save.disabled, true);
  assert.equal(save.textContent, 'Salvando...');
  assert.match(status.textContent, /Salvando/);

  pendingPost.resolve({ data: { id: 'progression-1' } });
  await Promise.all([firstActivation, secondActivation]);

  assert.equal(harness.postCount(), 1);
  assert.equal(harness.historyCount(), 2, 'initial history and post-save refresh are preserved');
  assert.equal(save.disabled, false);
  assert.equal(save.textContent, 'Salvar progressão');
  assert.equal(status.textContent, 'Progressão salva com sucesso.');
  assert.match(status.textContent, /sucesso/);
});

test('F6.2 failed save restores the CTA, releases the guard, and permits retry', async () => {
  const failedPost = deferred();
  const retryPost = deferred();
  const harness = await progressionHarness([failedPost, retryPost]);
  const save = harness.elements.get('save');
  const status = harness.elements.get('saveStatus');

  const firstActivation = save.onclick();
  const duplicateActivation = save.onclick();
  assert.equal(harness.postCount(), 1);

  failedPost.reject(new Error('network unavailable'));
  await Promise.all([firstActivation, duplicateActivation]);

  assert.equal(save.disabled, false);
  assert.equal(save.textContent, 'Salvar progressão');
  assert.match(status.textContent, /Não foi possível salvar.*Tente novamente/);

  const retry = save.onclick();
  assert.equal(harness.postCount(), 2);
  assert.equal(save.disabled, true);
  retryPost.resolve({ data: { id: 'progression-2' } });
  await retry;
  assert.equal(save.disabled, false);
  assert.equal(status.textContent, 'Progressão salva com sucesso.');
});

test('F6.2 save feedback uses an accessible live status region on root and public surfaces', async () => {
  for (const path of ['../portal-progressao.html', '../public/portal-progressao.html']) {
    const html = await readFile(new URL(path, import.meta.url), 'utf8');
    assert.match(html, /id=['"]saveStatus['"][^>]*role=['"]status['"][^>]*aria-live=['"]polite['"]/);
    assert.match(html, /let isSaving = false/);
    assert.match(html, /if \(!current \|\| isSaving\) return/);
  }
});
