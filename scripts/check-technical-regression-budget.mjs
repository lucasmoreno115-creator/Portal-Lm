import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const BUDGET_SCHEMA_VERSION = '1.0.0';
const NOT_EXECUTED = 'NOT_EXECUTED';
const FULL_GIT_SHA = /^[0-9a-f]{40}$/i;
const METRICS = {
  ensureSchemaRuntimeReferences: r => sumOccurrences(r.observations.ensureSchemaRuntimeReferences),
  largestPublicAssetBytes: r => r.repository.largestPublicAssets[0]?.bytes,
  publicBytes: r => r.repository.publicBytes,
  publicCssBytes: r => r.repository.publicBytesByType.css,
  publicHtmlBytes: r => r.repository.publicBytesByType.html,
  publicJavaScriptBytes: r => r.repository.publicBytesByType.js,
  selectStarInWorkers: r => sumOccurrences(r.observations.selectStarInWorkers),
  workerApiBytes: r => r.repository.workerApiBytes
};
const BASELINES = {
  approximateWorkerRoutes: r => r.observations.approximateWorkerRoutes,
  migrations: r => r.observations.migrations,
  testsExecuted: r => r.verdicts.testSuite.executed
};
const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const finiteNonnegative = value => typeof value === 'number' && Number.isFinite(value) && value >= 0;
const clean = value => String(value).replace(/[\r\n|<>]/g, ' ').replace(/\s+/g, ' ').trim();
const result = (id, actual, reference, severity, status, detail) => ({ actual, baselineOrMaximum: reference, delta: finiteNonnegative(actual) && finiteNonnegative(reference) ? actual - reference : null, detail: clean(detail), id, severity, status });
const sumOccurrences = entries => Array.isArray(entries) && entries.every(item => isObject(item) && finiteNonnegative(item.occurrences)) ? entries.reduce((total, item) => total + item.occurrences, 0) : undefined;

export function validateBudget(value) {
  const errors = [];
  if (!isObject(value)) return ['configuration must be an object'];
  if (value.schemaVersion !== BUDGET_SCHEMA_VERSION) errors.push('unsupported configuration schemaVersion');
  if (value.reportSchemaVersion !== '1.0.0') errors.push('unsupported reportSchemaVersion');
  if (typeof value.baselineSha !== 'string' || !FULL_GIT_SHA.test(value.baselineSha)) errors.push('baselineSha must be a full 40-character hexadecimal Git SHA');
  if (!Array.isArray(value.requiredCriticalPages)) errors.push('requiredCriticalPages must be an array');
  else {
    if (value.requiredCriticalPages.some(page => typeof page !== 'string' || page.trim() !== page || page.length === 0)) errors.push('requiredCriticalPages must contain non-empty trimmed strings');
    if (new Set(value.requiredCriticalPages).size !== value.requiredCriticalPages.length) errors.push('requiredCriticalPages must not contain duplicates');
  }
  if (!isObject(value.metrics) || Object.keys(value.metrics).sort().join(',') !== Object.keys(METRICS).sort().join(',')) errors.push('metrics must contain exactly the required metric names');
  else for (const [name, item] of Object.entries(value.metrics)) {
    if (!isObject(item) || !finiteNonnegative(item.maximum) || !['error', 'warning'].includes(item.severity) || Object.keys(item).some(key => !['maximum', 'severity'].includes(key))) errors.push(`invalid metric configuration: ${name}`);
  }
  if (!isObject(value.baselines)) errors.push('baselines must be an object');
  else {
    for (const name of Object.keys(BASELINES)) if (!finiteNonnegative(value.baselines[name])) errors.push(`invalid baseline: ${name}`);
    const comparisons = value.baselines.rootPublicComparisons;
    if (!isObject(comparisons) || !finiteNonnegative(comparisons.DUPLICATE) || !finiteNonnegative(comparisons.DIVERGENT)) errors.push('invalid baseline: rootPublicComparisons');
  }
  return errors.sort();
}

export function validateReport(value) {
  const errors = [];
  if (!isObject(value)) return ['report must be an object'];
  if (value.schemaVersion !== '1.0.0') errors.push('unsupported report schemaVersion');
  for (const key of ['source', 'repository', 'observations', 'verdicts']) if (!isObject(value[key])) errors.push(`missing object: ${key}`);
  if (isObject(value.source) && (typeof value.source.sha !== 'string' || !FULL_GIT_SHA.test(value.source.sha))) errors.push('source.sha must be a full 40-character hexadecimal Git SHA');
  if (isObject(value.observations)) {
    if (!Array.isArray(value.observations.criticalPages)) errors.push('observations.criticalPages must be an array');
    else if (value.observations.criticalPages.some(page => !isObject(page) || typeof page.page !== 'string' || page.page.trim() !== page.page || page.page.length === 0 || typeof page.status !== 'string')) errors.push('observations.criticalPages contains an invalid entry');
  }
  return errors.sort();
}

export function compareTechnicalBudget(report, budget) {
  const validation = [...validateBudget(budget).map(detail => `configuration: ${detail}`), ...validateReport(report).map(detail => `report: ${detail}`)];
  const identities = { baselineSha: FULL_GIT_SHA.test(budget?.baselineSha ?? '') ? budget.baselineSha : null, currentSha: FULL_GIT_SHA.test(report?.source?.sha ?? '') ? report.source.sha : null };
  if (validation.length) return finalize(validation.map((detail, index) => result(`validation.${index + 1}`, null, null, 'error', 'ERROR', detail)), identities);
  const results = [];
  if (report.verdicts.requiredCommands !== 'PASSED') results.push(result('requiredCommands', report.verdicts.requiredCommands, 'PASSED', 'error', 'ERROR', 'Required commands must pass'));
  const pages = report.observations.criticalPages;
  const expectedPages = [...budget.requiredCriticalPages].sort();
  const pageCounts = new Map();
  pages.forEach(page => pageCounts.set(page.page, (pageCounts.get(page.page) ?? 0) + 1));
  for (const page of expectedPages) if (!pageCounts.has(page)) results.push(result(`criticalPages.missing.${page}`, 0, 1, 'error', 'ERROR', 'Required critical page is missing'));
  for (const page of [...pageCounts.keys()].sort()) {
    const count = pageCounts.get(page);
    if (!expectedPages.includes(page)) results.push(result(`criticalPages.unexpected.${clean(page)}`, count, 0, 'error', 'ERROR', 'Unexpected critical page'));
    if (count > 1) results.push(result(`criticalPages.duplicate.${clean(page)}`, count, 1, 'error', 'ERROR', 'Critical page is duplicated'));
  }
  pages.forEach(page => {
    if (page.status !== 'OBSERVED' && !results.some(item => item.id === `criticalPage.${clean(page.page)}`)) results.push(result(`criticalPage.${clean(page.page)}`, page.status, 'OBSERVED', 'error', 'ERROR', 'Critical page must be OBSERVED'));
  });
  const sw = report.observations.serviceWorker;
  if (!isObject(sw) || sw.status !== 'OBSERVED') results.push(result('serviceWorker.status', sw?.status, 'OBSERVED', 'error', 'ERROR', 'Service Worker must be OBSERVED'));
  if (!isObject(sw) || !Array.isArray(sw.unresolvedEntries) || sw.unresolvedEntries.length > 0) results.push(result('serviceWorker.unresolvedEntries', Array.isArray(sw?.unresolvedEntries) ? sw.unresolvedEntries.length : null, 0, 'error', 'ERROR', 'Precache must have no unresolved entries'));
  for (const name of Object.keys(METRICS).sort()) {
    let actual;
    try { actual = METRICS[name](report); } catch { actual = undefined; }
    const { maximum, severity } = budget.metrics[name];
    const missing = actual === undefined || actual === NOT_EXECUTED || !finiteNonnegative(actual);
    const exceeded = !missing && actual > maximum;
    results.push(result(name, missing ? actual ?? null : actual, maximum, severity, missing || exceeded && severity === 'error' ? 'ERROR' : exceeded ? 'WARNING' : 'PASSED', missing ? 'Required metric is missing or NOT_EXECUTED' : exceeded ? 'Maximum exceeded' : 'Within maximum'));
  }
  for (const name of Object.keys(BASELINES).sort()) {
    let actual;
    try { actual = BASELINES[name](report); } catch { actual = undefined; }
    const baseline = budget.baselines[name];
    if (!finiteNonnegative(actual)) results.push(result(name, actual ?? null, baseline, 'error', 'ERROR', 'Required metric is missing or NOT_EXECUTED'));
    else if (name === 'testsExecuted' ? actual < baseline : actual !== baseline) results.push(result(name, actual, baseline, 'warning', 'WARNING', name === 'testsExecuted' ? 'Test count was reduced' : 'Inventory count changed'));
    else results.push(result(name, actual, baseline, 'warning', 'PASSED', 'Matches baseline'));
  }
  const counts = { DUPLICATE: 0, DIVERGENT: 0 };
  const comparisons = report.observations.rootPublicComparisons;
  if (!Array.isArray(comparisons) || comparisons.some(item => !isObject(item) || !Object.hasOwn(counts, item.observation))) results.push(result('rootPublicComparisons', null, budget.baselines.rootPublicComparisons, 'error', 'ERROR', 'Comparison inventory is missing or invalid'));
  else {
    comparisons.forEach(item => counts[item.observation]++);
    for (const kind of Object.keys(counts).sort()) results.push(result(`rootPublicComparisons.${kind}`, counts[kind], budget.baselines.rootPublicComparisons[kind], 'warning', counts[kind] === budget.baselines.rootPublicComparisons[kind] ? 'PASSED' : 'WARNING', 'Root/public duplication count'));
  }
  return finalize(results, identities);
}

function finalize(results, { baselineSha = null, currentSha = null } = {}) {
  results.sort((a, b) => a.id.localeCompare(b.id));
  const summary = { errors: results.filter(item => item.status === 'ERROR').length, passed: results.filter(item => item.status === 'PASSED').length, warnings: results.filter(item => item.status === 'WARNING').length };
  return { baselineSha, currentSha, results, schemaVersion: BUDGET_SCHEMA_VERSION, status: summary.errors ? 'FAILED' : 'PASSED', summary };
}

export function renderBudgetMarkdown(output) {
  const cell = value => value === null || value === undefined ? 'N/A' : clean(typeof value === 'object' ? JSON.stringify(value) : value);
  return `# Technical regression budget\n\n- Baseline SHA: ${cell(output.baselineSha)}\n- Current SHA: ${cell(output.currentSha)}\n- Status: **${output.status}**\n\n| Metric | Actual | Baseline / maximum | Delta | Severity | Status | Detail |\n|---|---:|---:|---:|---|---|---|\n${output.results.map(item => `| ${clean(item.id)} | ${cell(item.actual)} | ${cell(item.baselineOrMaximum)} | ${cell(item.delta)} | ${item.severity} | ${item.status} | ${clean(item.detail)} |`).join('\n')}\n`;
}

export function runCli({ argv = process.argv.slice(2), root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..') } = {}) {
  const reportPath = path.resolve(root, argv[0] ?? 'artifacts/baseline/baseline-report.json');
  const budgetPath = path.resolve(root, argv[1] ?? 'config/technical-regression-budget.json');
  let output;
  try { output = compareTechnicalBudget(JSON.parse(readFileSync(reportPath, 'utf8')), JSON.parse(readFileSync(budgetPath, 'utf8'))); }
  catch (error) { output = finalize([result('input', null, null, 'error', 'ERROR', `Invalid input: ${error.message}`)]); }
  const outputDir = path.join(root, 'artifacts', 'baseline');
  mkdirSync(outputDir, { recursive: true });
  writeFileSync(path.join(outputDir, 'regression-budget-report.json'), `${JSON.stringify(output, null, 2)}\n`);
  writeFileSync(path.join(outputDir, 'regression-budget-report.md'), renderBudgetMarkdown(output));
  process.stdout.write(`${JSON.stringify(output.summary)}\n`);
  return output.status === 'PASSED' ? 0 : 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) process.exitCode = runCli();
