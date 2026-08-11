import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

const runtimes = [
  'admin-premium-workspace.js',
  'public/admin-premium-workspace.js',
  'public/assets/js/admin-premium-workspace.js'
];
const js = readFileSync(runtimes[0], 'utf8');
const html = readFileSync('public/admin-premium-workspace.html', 'utf8');

test('F3.2 exposes only the canonical student record action', () => {
  assert.doesNotMatch(js, /Ver resumo|function summaryButton\b/);
  assert.match(js, /function recordActions\(id\) \{ const actions = node\('div', null, 'record-actions'\); actions\.append\(recordButton\(id\)\); return actions; \}/);
  assert.match(js, /function recordButton\(id\) \{ const button = node\('button', 'Abrir Prontuário'\);/);
});

test('F3.2 preserves the canonical record URL and safely handles a missing student_id', () => {
  assert.match(js, /new URL\('\/admin-premium-student-record\.html', window\.location\.origin\)/);
  assert.match(js, /url\.searchParams\.set\('student_id', studentId\)/);
  assert.match(js, /button\.onclick = \(\) => window\.location\.assign\(target\)/);
  assert.match(js, /if \(!target\) \{ button\.disabled = true; button\.dataset\.unavailable = 'true';/);
  assert.doesNotMatch(js, /admin-premium-student-record\.html\?email=/);
});

test('F3.2 removes the embedded record and its exclusive runtime flow', () => {
  assert.doesNotMatch(html, /<section id="record"\b/);
  for (const name of ['openRecord', 'loadRecord', 'renderRecord', 'renderAnamnesis', 'setRecordButtonState', 'recordTrigger', 'recordButtons']) {
    assert.doesNotMatch(js, new RegExp(`\\b${name}\\b`));
  }
});

test('F3.2 preserves workspace endpoints and byte-identical runtime copies', () => {
  for (const endpoint of ['/api/admin/premium/workspace/summary', '/api/admin/premium/workspace/students', '/api/admin/premium/workspace/pending-items']) {
    assert.match(js, new RegExp(endpoint.replaceAll('/', '\\/')));
  }
  for (const runtime of runtimes.slice(1)) assert.equal(readFileSync(runtime, 'utf8'), js);
});
