import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import budget from '../config/technical-regression-budget.json' with { type: 'json' };
import { compareTechnicalBudget, renderBudgetMarkdown, validateBudget, validateReport } from '../scripts/check-technical-regression-budget.mjs';

const copy = value => structuredClone(value);
function report() {
  return {
    schemaVersion: '1.0.0',
    repository: { workerApiBytes: 10, publicBytes: 20, publicBytesByType: { css: 3, html: 4, js: 5 }, largestPublicAssets: [{ path: 'public/x', bytes: 6 }] },
    observations: {
      approximateWorkerRoutes: budget.baselines.approximateWorkerRoutes,
      migrations: budget.baselines.migrations,
      criticalPages: [{ page: 'portal-login', status: 'OBSERVED' }],
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

test('blocks failed commands and PARTIAL critical pages', () => {
  const input = report(); input.verdicts.requiredCommands = 'FAILED'; input.observations.criticalPages[0].status = 'PARTIAL';
  const output = compareTechnicalBudget(input, budget);
  assert.equal(find(output, 'requiredCommands').status, 'ERROR');
  assert.equal(find(output, 'criticalPage.portal-login').status, 'ERROR');
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
  const input = report(); input.observations.criticalPages[0] = { page: 'bad|<script>\nname', status: 'PARTIAL' };
  const markdown = renderBudgetMarkdown(compareTechnicalBudget(input, budget));
  assert.doesNotMatch(markdown, /<script>|bad\||\nname/);
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
