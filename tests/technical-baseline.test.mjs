import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { collectBaseline, NOT_EXECUTED, renderMarkdown, sanitize, writeBaseline } from '../scripts/generate-technical-baseline.mjs';

function fixture() {
  const root = mkdtempSync(path.join(os.tmpdir(), 'lm-baseline-'));
  for (const dir of ['workers', 'public', 'migrations', 'tests']) mkdirSync(path.join(root, dir), { recursive: true });
  writeFileSync(path.join(root, 'workers/api.js'), "if (url.pathname === '/api/ping') return 1; SELECT *; ensureSchema();\n");
  writeFileSync(path.join(root, 'public/portal-premium-home.html'), '<link rel="stylesheet" href="home.css"><script src="home.js"></script><script>fetch("/api/home")</script>');
  writeFileSync(path.join(root, 'public/sw.js'), "const CACHE_NAME='lm-v1'; const PRECACHE_URLS=['/','/home.js'];");
  writeFileSync(path.join(root, 'migrations/0001.sql'), 'CREATE TABLE sample(id);');
  writeFileSync(path.join(root, 'tests/sample.test.mjs'), '');
  const runner = (command, args) => {
    if (command === 'git' && args[0] === 'rev-parse') return 'abc123\n';
    if (command === 'git') return '';
    if (command === process.execPath) return '# tests 3\n# pass 2\n# fail 0\n# skipped 1\n# duration_ms 12.5\n';
    if (command === 'npm') return 'Project LM runtime is synchronized\n';
    throw new Error('unexpected command');
  };
  return { root, runner, cleanup: () => rmSync(root, { recursive: true, force: true }) };
}

test('generates the canonical JSON structure and Markdown contract', () => {
  const f = fixture();
  try {
    const report = writeBaseline({ root: f.root, runner: f.runner, now: () => new Date('2026-01-01T00:00:00.000Z') });
    assert.equal(JSON.parse(readFileSync(path.join(f.root, 'artifacts/baseline/baseline-report.json'))).schemaVersion, '1.0.0');
    const markdown = readFileSync(path.join(f.root, 'artifacts/baseline/baseline-report.md'), 'utf8');
    assert.match(markdown, /## Observations/); assert.match(markdown, /## Verdicts/); assert.match(markdown, /3 run; 2 passed/);
    assert.equal(report.verdicts.requiredCommands, 'PASSED');
  } finally { f.cleanup(); }
});

test('technical fields are deterministic while volatile fields remain explicit', () => {
  const f = fixture();
  try {
    const first = collectBaseline({ root: f.root, runner: f.runner, now: () => new Date('2026-01-01') });
    const second = collectBaseline({ root: f.root, runner: f.runner, now: () => new Date('2026-02-01') });
    assert.deepEqual(first.repository, second.repository); assert.deepEqual(first.observations, second.observations); assert.deepEqual(first.verdicts, second.verdicts);
    assert.notEqual(first.generatedAt, second.generatedAt);
  } finally { f.cleanup(); }
});

test('sanitizes personal and credential-like values without copying content', () => {
  const value = JSON.stringify(sanitize({ value: 'person@example.test', detail: 'authorization: Bearer abc.def' }));
  assert.doesNotMatch(value, /person@example|abc\.def/); assert.match(value, /REDACTED/);
});

test('unavailable metrics are NOT_EXECUTED', () => {
  const f = fixture();
  try { rmSync(path.join(f.root, 'workers/api.js')); assert.equal(collectBaseline({ root: f.root, runner: f.runner }).repository.workerApiBytes, NOT_EXECUTED); }
  finally { f.cleanup(); }
});

test('a mandatory command failure is an explicit failing verdict', () => {
  const f = fixture();
  try {
    const runner = (command, args, options) => { if (command === 'npm') { const error = new Error('failed'); error.status = 2; throw error; } return f.runner(command, args, options); };
    const report = collectBaseline({ root: f.root, runner });
    assert.equal(report.verdicts.projectLmRuntimeCheck.status, 'FAILED'); assert.equal(report.verdicts.requiredCommands, 'FAILED');
  } finally { f.cleanup(); }
});

test('a failing test command preserves aggregate TAP counts when available', () => {
  const f = fixture();
  try {
    const runner = (command, args, options) => {
      if (command === process.execPath) { const error = new Error('failed'); error.status = 1; error.stdout = '# tests 4\n# pass 3\n# fail 1\n# skipped 0\n# duration_ms 9\n'; throw error; }
      return f.runner(command, args, options);
    };
    const result = collectBaseline({ root: f.root, runner }).verdicts.testSuite;
    assert.deepEqual(result, { status: 'FAILED', executed: 4, passed: 3, failed: 1, skipped: 0, durationMs: 9 });
  } finally { f.cleanup(); }
});

test('refuses to write outside the canonical artifact directory', () => {
  const f = fixture();
  try { assert.throws(() => writeBaseline({ root: f.root, outputDir: path.join(f.root, 'elsewhere'), runner: f.runner }), /artifacts\/baseline/); }
  finally { f.cleanup(); }
});

test('Markdown renders unavailable values honestly', () => {
  const f = fixture();
  try { const report = collectBaseline({ root: f.root, runner: f.runner }); report.verdicts.testSuite.executed = NOT_EXECUTED; assert.match(renderMarkdown(report), /NOT_EXECUTED run/); }
  finally { f.cleanup(); }
});
