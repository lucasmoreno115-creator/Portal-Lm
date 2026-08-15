import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

async function harness(historyResponse) {
  const html = await readFile(new URL('../public/portal-progressao.html', import.meta.url), 'utf8');
  const script = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)].map(m => m[1]).filter(Boolean).at(-1);
  const ids = ['nav', 'zone', 'reps', 'calc', 'out', 'save', 'saveStatus', 'exercise', 'load', 'hist', 'executionQuality'];
  const elements = new Map(ids.map(id => [id, {
    value: '', style: {}, disabled: false, textContent: '', innerHTML: '', children: [],
    replaceChildren() { this.children = []; this.textContent = ''; },
    append(child) { this.children.push(child); },
  }]));
  elements.get('hist').textContent = 'Carregando histórico...';
  elements.get('zone').value = '8–10';
  elements.get('executionQuality').value = 'Sim';
  const context = {
    api(path, options = {}) {
      assert.equal(path, '/portal/progression');
      return options.method === 'POST' ? Promise.resolve({ data: {} }) : historyResponse.promise;
    },
    document: {
      getElementById: id => elements.get(id),
      createElement: () => ({ className: '', textContent: '' }),
    },
    requireAuth() {}, redirectIfNoAccess() {}, nav: () => '', alert() {},
  };
  vm.runInNewContext(script, context, { filename: 'public/portal-progressao.html' });
  await Promise.resolve();
  return { elements, html };
}

test('F6.3 delayed history keeps an accessible loading state until GET settles', async () => {
  const pending = deferred();
  const { elements, html } = await harness(pending);
  assert.match(html, /id='hist'[^>]*role=status[^>]*aria-live=polite[^>]*>Carregando histórico\.\.\./);
  assert.equal(elements.get('hist').textContent, 'Carregando histórico...');
  assert.equal(elements.get('hist').children.length, 0);
  pending.resolve({ data: [] });
  await pending.promise;
  await Promise.resolve();
  assert.equal(elements.get('hist').textContent, 'Sem histórico');
});

test('F6.3 empty and populated histories replace loading without changing fallbacks', async (t) => {
  await t.test('empty', async () => {
    const response = deferred();
    const { elements } = await harness(response);
    response.resolve({ data: [] });
    await response.promise; await Promise.resolve();
    assert.equal(elements.get('hist').textContent, 'Sem histórico');
  });
  await t.test('populated', async () => {
    const response = deferred();
    const { elements } = await harness(response);
    response.resolve({ data: [{ created_at: '2026-08-15', exercise: 'Supino', targetZone: '8–10', loadUsed: 80, repsDone: 10, decision: 'Manter', rir: 2 }] });
    await response.promise; await Promise.resolve();
    assert.equal(elements.get('hist').textContent, '');
    assert.equal(elements.get('hist').children.length, 1);
    assert.match(elements.get('hist').children[0].textContent, /Supino.*Manter.*RIR legado: 2/);
  });
});

test('F6.3 rejected history is handled with friendly feedback and calculator remains usable', async () => {
  const response = deferred();
  const { elements } = await harness(response);
  response.reject(new Error('raw network details'));
  await response.promise.catch(() => {}); await Promise.resolve();
  assert.equal(elements.get('hist').textContent, 'Não foi possível carregar seu histórico agora. Tente novamente mais tarde.');
  assert.doesNotMatch(elements.get('hist').textContent, /raw network details|Error/);

  elements.get('exercise').value = 'Agachamento';
  elements.get('load').value = '60';
  elements.get('reps').value = '9';
  assert.doesNotThrow(() => elements.get('calc').onclick());
  assert.equal(elements.get('save').style.display, 'block');
});

test('F6.3 root and public history states remain functionally equivalent', async () => {
  for (const path of ['../portal-progressao.html', '../public/portal-progressao.html']) {
    const html = await readFile(new URL(path, import.meta.url), 'utf8');
    assert.match(html, /Carregando histórico\.\.\./);
    assert.match(html, /hist\.textContent = 'Sem histórico'/);
    assert.match(html, /Não foi possível carregar seu histórico agora\. Tente novamente mais tarde\./);
    assert.match(html, /async function loadHist\(\)\s*\{\s*try/);
  }
});
