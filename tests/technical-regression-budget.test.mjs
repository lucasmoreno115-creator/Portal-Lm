import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import budget from '../config/technical-regression-budget.json' with { type: 'json' };
import { compareTechnicalBudget, renderBudgetMarkdown, validateBudget, validateReport } from '../scripts/check-technical-regression-budget.mjs';
import { runTechnicalBaselineCheck } from '../scripts/run-technical-baseline-check.mjs';

const copy = value => structuredClone(value);
function report() {
  return {
    schemaVersion: '1.0.0',
    source: { sha: '3930eb7289b5827740a06a8ee2c994621f3fc9db' },
    repository: { workerApiBytes: 10, publicBytes: 20, publicBytesByType: { css: 3, html: 4, js: 5 }, largestPublicAssets: [{ path: 'public/x', bytes: 6 }] },
    observations: {
      approximateWorkerRoutes: budget.baselines.approximateWorkerRoutes,
      migrations: budget.baselines.migrations,
      criticalPages: budget.requiredCriticalPages.map(page => ({ page, status: 'OBSERVED' })),
      serviceWorker: { status: 'OBSERVED', unresolvedEntries: [] },
      selectStarInWorkers: [], ensureSchemaRuntimeReferences: [{ path: 'workers/api.js', occurrences: 0 }],
      rootPublicComparisons: [
        ...Array.from({ length: budget.baselines.rootPublicComparisons.DUPLICATE }, () => ({ observation: 'DUPLICATE' })),
        ...Array.from({ length: budget.baselines.rootPublicComparisons.DIVERGENT }, () => ({ observation: 'DIVERGENT' }))
      ]
    },
    verdicts: { requiredCommands: 'PASSED', testSuite: { executed: budget.baselines.testsExecuted } }
  };
}
const find = (output, id) => output.results.find(item => item.id === id);

test('accepts values below and equal to an error maximum', () => {
  const first = report(); first.repository.workerApiBytes = budget.metrics.workerApiBytes.maximum - 1;
  assert.equal(find(compareTechnicalBudget(first, budget), 'workerApiBytes').status, 'PASSED');
  first.repository.workerApiBytes++;
  assert.equal(find(compareTechnicalBudget(first, budget), 'workerApiBytes').status, 'PASSED');
});

test('fails above an error maximum but warning excess does not fail', () => {
  const input = report();
  input.repository.workerApiBytes = budget.metrics.workerApiBytes.maximum + 1;
  input.repository.publicBytes = budget.metrics.publicBytes.maximum + 1;
  const output = compareTechnicalBudget(input, budget);
  assert.equal(find(output, 'workerApiBytes').status, 'ERROR');
  assert.equal(find(output, 'publicBytes').status, 'WARNING');
  assert.equal(output.status, 'FAILED');
  input.repository.workerApiBytes = 1;
  assert.equal(compareTechnicalBudget(input, budget).status, 'PASSED');
});

test('fails required NOT_EXECUTED and missing fields', () => {
  const first = report(); first.repository.publicBytes = 'NOT_EXECUTED';
  assert.equal(find(compareTechnicalBudget(first, budget), 'publicBytes').status, 'ERROR');
  const second = report(); delete second.repository.publicBytesByType.css;
  assert.equal(find(compareTechnicalBudget(second, budget), 'publicCssBytes').status, 'ERROR');
});

test('rejects invalid report and configuration schemas', () => {
  assert.deepEqual(validateReport(null), ['report must be an object']);
  assert.ok(validateReport({ schemaVersion: '9' }).length > 0);
  const invalid = copy(budget); invalid.metrics.workerApiBytes.maximum = -1;
  assert.match(validateBudget(invalid).join(' '), /workerApiBytes/);
  assert.equal(compareTechnicalBudget(report(), invalid).status, 'FAILED');
});

test('propagates baseline and current full SHAs without requiring equality', () => {
  const output = compareTechnicalBudget(report(), budget);
  assert.equal(output.baselineSha, budget.baselineSha);
  assert.equal(output.currentSha, report().source.sha);
  assert.match(renderBudgetMarkdown(output), new RegExp(budget.baselineSha));
  assert.match(renderBudgetMarkdown(output), new RegExp(report().source.sha));
});

test('rejects missing, abbreviated, invalid and NOT_EXECUTED baseline SHAs', () => {
  for (const sha of [undefined, 'f7b0ba3', 'x'.repeat(40), 'NOT_EXECUTED']) {
    const input = copy(budget); if (sha === undefined) delete input.baselineSha; else input.baselineSha = sha;
    assert.match(validateBudget(input).join(' '), /baselineSha/);
    assert.equal(compareTechnicalBudget(report(), input).status, 'FAILED');
  }
});

test('rejects absent source and missing, invalid or NOT_EXECUTED current SHAs', () => {
  const absent = report(); delete absent.source;
  assert.match(validateReport(absent).join(' '), /source/);
  for (const sha of [undefined, 'abc123', 'NOT_EXECUTED', 'g'.repeat(40)]) {
    const input = report(); if (sha === undefined) delete input.source.sha; else input.source.sha = sha;
    assert.match(validateReport(input).join(' '), /source\.sha/);
    assert.equal(compareTechnicalBudget(input, budget).currentSha, null);
  }
});

test('blocks failed commands and PARTIAL critical pages', () => {
  const input = report(); input.verdicts.requiredCommands = 'FAILED'; input.observations.criticalPages.find(page => page.page === 'portal-login').status = 'PARTIAL';
  const output = compareTechnicalBudget(input, budget);
  assert.equal(find(output, 'requiredCommands').status, 'ERROR');
  assert.equal(find(output, 'criticalPage.portal-login').status, 'ERROR');
});

test('requires the exact complete critical-page inventory', () => {
  assert.equal(compareTechnicalBudget(report(), budget).status, 'PASSED');
  const missing = report(); missing.observations.criticalPages = missing.observations.criticalPages.filter(page => page.page !== 'portal-login');
  assert.equal(find(compareTechnicalBudget(missing, budget), 'criticalPages.missing.portal-login').status, 'ERROR');
  const duplicate = report(); duplicate.observations.criticalPages.push({ page: 'portal-checkin', status: 'OBSERVED' });
  assert.equal(find(compareTechnicalBudget(duplicate, budget), 'criticalPages.duplicate.portal-checkin').status, 'ERROR');
  const unexpected = report(); unexpected.observations.criticalPages.push({ page: 'unknown-page', status: 'OBSERVED' });
  assert.equal(find(compareTechnicalBudget(unexpected, budget), 'criticalPages.unexpected.unknown-page').status, 'ERROR');
  const empty = report(); empty.observations.criticalPages = [];
  assert.equal(compareTechnicalBudget(empty, budget).results.filter(item => item.id.startsWith('criticalPages.missing.')).length, 9);
});

test('rejects NOT_EXECUTED critical pages and duplicate configured pages', () => {
  const input = report(); input.observations.criticalPages = 'NOT_EXECUTED';
  assert.match(validateReport(input).join(' '), /criticalPages/);
  const configured = copy(budget); configured.requiredCriticalPages.push(configured.requiredCriticalPages[0]);
  assert.match(validateBudget(configured).join(' '), /duplicates/);
});

test('blocks PARTIAL precache and unresolved entries', () => {
  const input = report(); input.observations.serviceWorker = { status: 'PARTIAL', unresolvedEntries: [{ index: 1 }] };
  const output = compareTechnicalBudget(input, budget);
  assert.equal(find(output, 'serviceWorker.status').status, 'ERROR');
  assert.equal(find(output, 'serviceWorker.unresolvedEntries').status, 'ERROR');
});

test('counts SELECT star and ensureSchema occurrences without executing source', () => {
  const input = report();
  input.observations.selectStarInWorkers = [{ path: 'workers/api.js', occurrences: 1 }];
  input.observations.ensureSchemaRuntimeReferences = [{ path: 'workers/api.js', occurrences: 4 }];
  const output = compareTechnicalBudget(input, budget);
  assert.equal(find(output, 'selectStarInWorkers').actual, 1);
  assert.equal(find(output, 'selectStarInWorkers').status, 'ERROR');
  assert.equal(find(output, 'ensureSchemaRuntimeReferences').status, 'ERROR');
});

test('inventory changes are deterministic warnings, not automatic blockers', () => {
  const input = report(); input.observations.approximateWorkerRoutes++; input.observations.migrations++; input.verdicts.testSuite.executed--;
  input.observations.rootPublicComparisons.pop();
  const output = compareTechnicalBudget(input, budget);
  assert.equal(output.status, 'PASSED');
  assert.ok(output.summary.warnings >= 4);
  assert.deepEqual(output.results.map(item => item.id), output.results.map(item => item.id).toSorted());
});

test('Markdown sanitizes table-breaking and markup characters', () => {
  const input = report(); input.observations.criticalPages.push({ page: 'bad|<script>\nname', status: 'PARTIAL' });
  const markdown = renderBudgetMarkdown(compareTechnicalBudget(input, budget));
  assert.doesNotMatch(markdown, /<script>|bad\||\nname/);
});

function orchestratorFixture({ generationStatus = 0, comparisonStatus = 0, validBaseline = true } = {}) {
  const root = mkdtempSync(path.join(os.tmpdir(), 'lm-baseline-check-'));
  mkdirSync(path.join(root, 'scripts'), { recursive: true });
  mkdirSync(path.join(root, 'artifacts', 'baseline'), { recursive: true });
  const calls = [];
  const runner = (_executable, args) => {
    const script = path.basename(args[0]); calls.push(script);
    if (script === 'generate-technical-baseline.mjs' && validBaseline) {
      writeFileSync(path.join(root, 'artifacts/baseline/baseline-report.json'), JSON.stringify({ verdicts: { requiredCommands: generationStatus ? 'FAILED' : 'PASSED' } }));
      writeFileSync(path.join(root, 'artifacts/baseline/baseline-report.md'), 'baseline');
    }
    if (script === 'check-technical-regression-budget.mjs') {
      writeFileSync(path.join(root, 'artifacts/baseline/regression-budget-report.json'), JSON.stringify({ status: comparisonStatus ? 'FAILED' : 'PASSED' }));
      writeFileSync(path.join(root, 'artifacts/baseline/regression-budget-report.md'), 'budget');
    }
    return { status: script === 'generate-technical-baseline.mjs' ? generationStatus : validBaseline ? comparisonStatus : 1 };
  };
  return { root, calls, runner, cleanup: () => rmSync(root, { recursive: true, force: true }) };
}

test('orchestrator succeeds for passed generation and budget, including warnings', () => {
  for (const comparisonStatus of [0, 0]) {
    const fixture = orchestratorFixture({ comparisonStatus });
    try { assert.equal(runTechnicalBaselineCheck(fixture), 0); }
    finally { fixture.cleanup(); }
  }
});

test('orchestrator always compares a valid FAILED baseline and preserves both reports', () => {
  const fixture = orchestratorFixture({ generationStatus: 1 });
  try {
    assert.equal(runTechnicalBaselineCheck(fixture), 1);
    assert.deepEqual(fixture.calls, ['generate-technical-baseline.mjs', 'check-technical-regression-budget.mjs']);
    for (const name of ['baseline-report.json', 'baseline-report.md', 'regression-budget-report.json', 'regression-budget-report.md']) assert.ok(readFileSync(path.join(fixture.root, 'artifacts/baseline', name)));
  } finally { fixture.cleanup(); }
});

test('orchestrator fails for budget errors or an absent/invalid baseline and runs each stage once', () => {
  for (const options of [{ comparisonStatus: 1 }, { validBaseline: false }]) {
    const fixture = orchestratorFixture(options);
    try {
      assert.equal(runTechnicalBaselineCheck(fixture), 1);
      assert.deepEqual(fixture.calls, ['generate-technical-baseline.mjs', 'check-technical-regression-budget.mjs']);
    } finally { fixture.cleanup(); }
  }
});

test('CLI writes JSON and Markdown and exposes success and failure exit codes', () => {
  const root = mkdtempSync(path.join(os.tmpdir(), 'lm-budget-cli-'));
  try {
    const reportPath = path.join(root, 'report.json'); const budgetPath = path.join(root, 'budget.json');
    writeFileSync(reportPath, JSON.stringify(report())); writeFileSync(budgetPath, JSON.stringify(budget));
    const script = path.resolve('scripts/check-technical-regression-budget.mjs');
    assert.equal(spawnSync(process.execPath, [script, reportPath, budgetPath]).status, 0);
    const failing = report(); failing.repository.workerApiBytes = budget.metrics.workerApiBytes.maximum + 1;
    writeFileSync(reportPath, JSON.stringify(failing));
    assert.notEqual(spawnSync(process.execPath, [script, reportPath, budgetPath]).status, 0);
    assert.equal(JSON.parse(readFileSync('artifacts/baseline/regression-budget-report.json')).status, 'FAILED');
    writeFileSync(reportPath, '{');
    assert.notEqual(spawnSync(process.execPath, [script, reportPath, budgetPath]).status, 0);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
