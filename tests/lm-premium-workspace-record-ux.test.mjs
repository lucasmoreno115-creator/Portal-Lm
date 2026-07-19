import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

const js = readFileSync('public/admin-premium-workspace.js', 'utf8');
const html = readFileSync('public/admin-premium-workspace.html', 'utf8');
const css = readFileSync('public/assets/css/admin-premium-workspace.css', 'utf8');

test('Prontuário LM aguarda renderização para fazer scroll e foco acessível', () => {
  assert.match(js, /renderRecord\(await api\([\s\S]*?state\.loadedRecordId = id; highlightAndFocusRecord\(\)/);
  assert.match(js, /record\.scrollIntoView\?\.\(\{ behavior: 'smooth', block: 'start' \}\)/);
  assert.match(js, /if \(!isFullyVisible\(record\)\)/);
  assert.match(js, /\$\('recordHeading'\)\?\.focus\?\.\(\{ preventScroll: true \}\)/);
  assert.match(html, /id="recordHeading" tabindex="-1"/);
});

test('Prontuário LM aplica feedback de loading, seleção e destaque temporário', () => {
  assert.match(js, /📋 Carregando prontuário/);
  assert.match(js, /button\.disabled = loading; button\.textContent = loading \? 'Abrindo\.{3}'/);
  assert.match(js, /className = `item student-item\$\{selected \? ' is-selected' : ''\}`/);
  assert.match(js, /setTimeout\(\(\) => record\.classList\?\.remove\('record-highlight'\), 1000\)/);
  assert.match(css, /\.student-item\.is-selected/);
  assert.match(css, /\.record-highlight/);
});

test('reabrir o mesmo aluno reutiliza os dados já carregados sem nova chamada', () => {
  assert.match(js, /if \(state\.loadedRecordId === id\) return highlightAndFocusRecord\(\);/);
  assert.match(js, /state\.loadingRecordId = id/);
  assert.match(js, /finally \{ state\.loadingRecordId = null; setRecordButtonState\(id, false\); \}/);
});
