import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

const js = readFileSync('public/admin-premium-workspace.js', 'utf8');
const html = readFileSync('public/admin-premium-workspace.html', 'utf8');
const css = readFileSync('public/assets/css/admin-premium-workspace.css', 'utf8');

test('Ver resumo aguarda renderização para fazer scroll e foco acessível', () => {
  assert.match(js, /renderRecord\(await api\([\s\S]*?state\.loadedRecordId = id; highlightAndFocusRecord\(\)/);
  assert.match(js, /record\.scrollIntoView\?\.\(\{ behavior: prefersReducedMotion\(\) \? 'auto' : 'smooth', block: 'start' \}\)/);
  assert.match(js, /if \(!isFullyVisible\(record\)\)/);
  assert.match(js, /\$\('recordHeading'\)\?\.focus\?\.\(\{ preventScroll: true \}\)/);
  assert.match(html, /id="recordHeading" tabindex="-1"/);
});

test('Ver resumo aplica feedback de loading, seleção e destaque temporário', () => {
  assert.match(js, /📋 Carregando prontuário/);
  assert.match(js, /button\.disabled = loading; button\.textContent = loading \? 'Abrindo\.{3}'/);
  assert.match(js, /className = `item student-item\$\{selected \? ' is-selected' : ''\}`/);
  assert.match(js, /setTimeout\(\(\) => record\.classList\?\.remove\('record-highlight'\), 1000\)/);
  assert.match(css, /\.student-item\.is-selected/);
  assert.match(css, /\.record-highlight/);
});

test('Abrir Prontuário navega para o prontuário Premium com student_id codificado', () => {
  assert.match(js, /function premiumRecordUrl\(studentId\) \{ if \(!studentId\) return null; const url = new URL\('\/admin-premium-student-record\.html', window\.location\.origin\); url\.searchParams\.set\('student_id', studentId\); return `\$\{url\.pathname\}\$\{url\.search\}`; \}/);
  assert.match(js, /function recordButton\(id\) \{ const button = node\('button', 'Abrir Prontuário'\); const target = premiumRecordUrl\(id\);/);
  assert.match(js, /button\.onclick = \(\) => window\.location\.assign\(target\)/);
  assert.doesNotMatch(js, /admin-premium-student-record\.html\?email=/);
});

test('aluno sem student_id não gera URL quebrada e o resumo permanece separado', () => {
  assert.match(js, /if \(!target\) \{ button\.disabled = true; button\.dataset\.unavailable = 'true'; button\.title = 'Aluno sem identificador oficial\.'; return button; \}/);
  assert.match(js, /function summaryButton\(id\) \{ const button = node\('button', 'Ver resumo'\);/);
  assert.match(js, /function recordActions\(id\) \{ const actions = node\('div', null, 'record-actions'\);/);
  assert.match(js, /button\.onclick = \(\) => \{ state\.recordTrigger = button; openRecord\(id\); \}/);
});

test('reabrir o mesmo resumo reutiliza os dados já carregados sem nova chamada', () => {
  assert.match(js, /if \(state\.loadedRecordId === id\) return highlightAndFocusRecord\(\);/);
  assert.match(js, /state\.loadingRecordId = id/);
  assert.match(js, /finally \{ state\.loadingRecordId = null; setRecordButtonState\(id, false\); \}/);
});
