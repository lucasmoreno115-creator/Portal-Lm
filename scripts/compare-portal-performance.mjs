#!/usr/bin/env node
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { EXPECTED_PAGES } from './lib/portal-performance-analysis.mjs';
import { clsConsistency } from './lib/portal-layout-stability.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outputDirectory = path.join(root, 'artifacts/performance/s0.6');
const SHA = /^[0-9a-f]{40}$/;
const SCENARIOS = ['COLD', 'WARM'];
export const REQUIRED_METRICS = ['cls', 'lcp', 'fcp', 'transferBytes', 'requestCount', 'failedRequestCount'];
// Approved F2.3.2 architecture: the state-aware Home adds one canonical current request.
export const HOME_COLD_REQUEST_CONTRACT = Object.freeze({ baseline: 15, maximum: 16 });

export function metricDelta(before, after) {
  if (!Number.isFinite(before) || !Number.isFinite(after)) throw new Error('DELTA_OPERAND_INVALID: operandos obrigatórios devem ser números finitos');
  return { absolute: after - before, percentage: before === 0 ? null : ((after - before) / before) * 100 };
}

function requireSha(value, label) {
  if (!SHA.test(value || '') || value === 'NOT_EXECUTED') throw new Error(`${label}_INVALID: SHA completo obrigatório`);
  return value;
}

function validateSource(source, label) {
  if (!source || typeof source !== 'object') throw new Error(`${label}_SOURCE_INVALID`);
  requireSha(source.checkoutSha, `${label}_CHECKOUT_SHA`);
  if (!source.nodeVersion || !source.chromeVersion) throw new Error(`${label}_RUNTIME_PROVENANCE_INVALID`);
}

function validateReport(report, label) {
  if (!report || typeof report !== 'object') throw new Error(`${label}_REPORT_INVALID`);
  if (report.status !== 'MEASURED') throw new Error(`${label}_STATUS_${report.status || 'MISSING'}`);
  validateSource(report.source, label);
  if (!Array.isArray(report.pages) || report.pages.length !== EXPECTED_PAGES.length) throw new Error(`${label}_PAGE_COUNT_INVALID`);
  const names = report.pages.map(page => page.page).sort();
  if (JSON.stringify(names) !== JSON.stringify([...EXPECTED_PAGES].sort())) throw new Error(`${label}_PAGES_INVALID`);
  let totalRuns = 0;
  for (const page of report.pages) {
    if (!Array.isArray(page.scenarios) || page.scenarios.length !== 2 || JSON.stringify(page.scenarios.map(x => x.scenario).sort()) !== JSON.stringify(SCENARIOS)) throw new Error(`${label}_${page.page}_SCENARIOS_INVALID`);
    for (const scenario of page.scenarios) {
      if (!Array.isArray(scenario.runs) || scenario.runs.length !== 5) throw new Error(`${label}_${page.page}_${scenario.scenario}_RUN_COUNT_INVALID`);
      totalRuns += scenario.runs.length;
      for (const [index, run] of scenario.runs.entries()) {
        const prefix = `${label}_${page.page}_${scenario.scenario}_RUN_${index + 1}`;
        if (run.run !== index + 1 || run.page !== page.page || run.scenario !== scenario.scenario || run.completionStatus !== 'MEASURED') throw new Error(`${prefix}_NOT_MEASURED`);
        if (!run.metrics || REQUIRED_METRICS.some(metric => !Number.isFinite(run.metrics[metric]))) throw new Error(`${prefix}_REQUIRED_METRIC_INVALID`);
        if (run.metrics.failedRequestCount !== 0) throw new Error(`${prefix}_FAILED_REQUEST_COUNT`);
        if (!Array.isArray(run.layoutShiftEvents)) throw new Error(`${prefix}_LAYOUT_EVENTS_INVALID`);
        if (!clsConsistency(run.metrics.cls, run.layoutShiftEvents).valid) throw new Error(`${prefix}_CLS_EVENT_MISMATCH`);
        if (!Array.isArray(run.failedRequests) || run.failedRequests.length || !Array.isArray(run.resources) || run.resources.some(resource => Number.isFinite(resource.status) && resource.status >= 400)) throw new Error(`${prefix}_HTTP_FAILURE`);
        if (run.resources.some(resource => typeof resource.url !== 'string' || !resource.url.startsWith('/'))) throw new Error(`${prefix}_EXTERNAL_RESOURCE`);
        if (run.externalRequestAttempted || (run.externalBlocked?.length || 0)) throw new Error(`${prefix}_EXTERNAL_REQUEST`);
        if (run.unexpectedRedirect || run.mainDocumentLoaded !== true || !Number.isFinite(run.mainDocumentStatus) || run.mainDocumentStatus < 200 || run.mainDocumentStatus >= 300) throw new Error(`${prefix}_PAGE_NOT_OBSERVED`);
        if (page.page === '/portal-premium-home.html' && !run.resources.some(resource => resource.url === '/api/portal/notifications/unread-count' && resource.status === 200)) throw new Error(`${prefix}_NOTIFICATIONS_NOT_200`);
      }
      for (const metric of REQUIRED_METRICS) if (!Number.isFinite(scenario.aggregate?.[metric]?.median) || !Number.isFinite(scenario.aggregate?.[metric]?.p75)) throw new Error(`${label}_${page.page}_${scenario.scenario}_${metric}_AGGREGATE_INVALID`);
    }
  }
  if (totalRuns !== 50) throw new Error(`${label}_TOTAL_RUNS_INVALID`);
  return report;
}

const counts = runs => ({ total: runs.reduce((n, run) => n + run.layoutShiftEvents.length, 0), withSources: runs.reduce((n, run) => n + run.layoutShiftEvents.filter(event => Array.isArray(event.sources) && event.sources.length).length, 0), withoutSources: runs.reduce((n, run) => n + run.layoutShiftEvents.filter(event => !Array.isArray(event.sources) || !event.sources.length).length, 0) });

function comparisonEntry(metric, before, after, criterion) {
  return { metric, criterion, actualBefore: before, actualAfter: after, delta: metricDelta(before, after) };
}

export function compareReports(beforeInput, afterInput, provenance) {
  const baselineSha = requireSha(provenance?.baselineSha, 'BASELINE_SHA');
  const headSha = requireSha(provenance?.headSha, 'HEAD_SHA');
  const checkoutSha = requireSha(provenance?.checkoutSha, 'CHECKOUT_SHA');
  const workflowSha = requireSha(provenance?.workflowSha, 'WORKFLOW_SHA');
  if (baselineSha === headSha) throw new Error('SAME_SHA_FORBIDDEN');
  const before = validateReport(beforeInput, 'BEFORE'), after = validateReport(afterInput, 'AFTER');
  if (before.source.checkoutSha !== baselineSha) throw new Error('BEFORE_SHA_MISMATCH');
  if (after.source.checkoutSha !== checkoutSha) throw new Error('AFTER_CHECKOUT_SHA_MISMATCH');
  if (after.source.headSha !== headSha) throw new Error('AFTER_HEAD_SHA_MISMATCH');
  if (after.source.workflowSha !== workflowSha || after.source.eventName !== provenance.eventName || after.source.ref !== provenance.ref) throw new Error('AFTER_WORKFLOW_PROVENANCE_MISMATCH');
  if (provenance.eventName === 'pull_request' && !provenance.ref?.startsWith('refs/pull/')) throw new Error('PULL_REQUEST_REF_INVALID');
  const errors = [], warnings = [];
  if (before.source.nodeVersion !== after.source.nodeVersion) errors.push('RUNTIME_NODE_MISMATCH');
  if (before.source.chromeVersion !== after.source.chromeVersion) errors.push('RUNTIME_CHROME_MISMATCH');
  if (JSON.stringify(before.profile) !== JSON.stringify(after.profile)) errors.push('PROFILE_MISMATCH');
  const beforePages = new Map(before.pages.map(page => [page.page, page])), afterPages = new Map(after.pages.map(page => [page.page, page]));
  const pages = [...EXPECTED_PAGES].sort().map(pageName => ({ page: pageName, scenarios: SCENARIOS.map(scenarioName => {
    const b = beforePages.get(pageName).scenarios.find(x => x.scenario === scenarioName), a = afterPages.get(pageName).scenarios.find(x => x.scenario === scenarioName);
    const comparisons = REQUIRED_METRICS.map(metric => comparisonEntry(metric, b.aggregate[metric].p75, a.aggregate[metric].p75, metric === 'cls' ? 'p75 <= 0.10' : pageName === '/portal-premium-home.html' && scenarioName === 'COLD' && metric === 'requestCount' ? 'baseline 15; maximum 16 (Weekly Feedback state)' : 'observação operacional'));
    if (a.aggregate.cls.p75 > 0.10) errors.push(`${pageName}:${scenarioName}:CLS_P75_LIMIT`);
    if (pageName === '/portal-premium-home.html' && scenarioName === 'COLD') {
      const values = Object.fromEntries(comparisons.map(item => [item.metric, item]));
      if (values.cls.actualAfter >= values.cls.actualBefore || values.cls.delta.absolute >= 0) errors.push('HOME_COLD_CLS_NOT_REDUCED');
      if (values.lcp.delta.percentage !== null && values.lcp.delta.percentage > 10) errors.push('HOME_COLD_LCP_REGRESSION');
      if (values.transferBytes.delta.percentage !== null && values.transferBytes.delta.percentage > 5) errors.push('HOME_COLD_TRANSFER_REGRESSION');
      if (values.requestCount.actualBefore !== HOME_COLD_REQUEST_CONTRACT.baseline) errors.push('HOME_COLD_REQUEST_BASELINE_MISMATCH');
      if (values.requestCount.actualAfter > HOME_COLD_REQUEST_CONTRACT.maximum) errors.push('HOME_COLD_REQUEST_REGRESSION');
    }
    return { scenario: scenarioName, rawCls: { before: b.runs.map(run => run.metrics.cls), after: a.runs.map(run => run.metrics.cls) }, events: { before: counts(b.runs), after: counts(a.runs) }, comparisons };
  }) }));
  return { schemaVersion: '2.0.0', status: errors.length ? 'FAILED' : 'PASSED', errors: [...new Set(errors)].sort(), warnings, baselineSha, headSha, checkoutSha, workflowSha, eventName: provenance.eventName, ref: provenance.ref, before: { sha: before.source.checkoutSha, source: before.source, status: before.status }, after: { sha: headSha, source: after.source, status: after.status }, runtime: { node: after.source.nodeVersion, chrome: after.source.chromeVersion }, profile: after.profile, runs: { before: 50, after: 50 }, pages };
}

export function comparisonMarkdown(c) {
  const lines = ['# S0.6 — comparação before/after', '', `**Status:** ${c.status}`, '', `- baselineSha: \`${c.baselineSha ?? 'null'}\``, `- headSha: \`${c.headSha ?? 'null'}\``, `- checkoutSha: \`${c.checkoutSha ?? 'null'}\``, `- workflowSha: \`${c.workflowSha ?? 'null'}\``, `- eventName: \`${c.eventName ?? 'null'}\``, `- ref: \`${c.ref ?? 'null'}\``, '', `Erros: ${JSON.stringify(c.errors || [])}`, `Avisos: ${JSON.stringify(c.warnings || [])}`, ''];
  for (const page of c.pages || []) for (const scenario of page.scenarios) {
    lines.push(`## ${page.page} — ${scenario.scenario}`, '', '| Métrica | Critério | Actual before | Actual after | Δ absoluto | Δ percentual |', '|---|---|---:|---:|---:|---:|');
    for (const item of scenario.comparisons) lines.push(`| ${item.metric} | ${item.criterion} | ${item.actualBefore} | ${item.actualAfter} | ${item.delta.absolute} | ${item.delta.percentage ?? 'null'} |`);
    lines.push('', `CLS bruto: ${JSON.stringify(scenario.rawCls)}`, `Eventos: ${JSON.stringify(scenario.events)}`, '');
  }
  return lines.join('\n') + '\n';
}

export const exitCodeForComparison = status => status === 'PASSED' ? 0 : 1;

async function readReport(filename, stage) {
  try { return JSON.parse(await readFile(filename, 'utf8')); }
  catch (error) { throw new Error(`${stage}_REPORT_UNAVAILABLE: ${error.code === 'ENOENT' ? filename : 'JSON_INVALID'}`); }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await mkdir(outputDirectory, { recursive: true });
  let result;
  try {
    const before = await readReport(process.argv[2] || path.join(outputDirectory, 'before/portal-performance-report.json'), 'BEFORE');
    const after = await readReport(process.argv[3] || path.join(outputDirectory, 'after/portal-performance-report.json'), 'AFTER');
    result = compareReports(before, after, { baselineSha: process.env.PERFORMANCE_BASELINE_SHA, headSha: process.env.PERFORMANCE_HEAD_SHA, checkoutSha: process.env.PERFORMANCE_CHECKOUT_SHA, workflowSha: process.env.GITHUB_SHA || process.env.PERFORMANCE_WORKFLOW_SHA, eventName: process.env.PERFORMANCE_EVENT_NAME, ref: process.env.PERFORMANCE_REF });
  } catch (error) {
    result = { schemaVersion: '2.0.0', status: 'FAILED', errors: [error.message], warnings: [], baselineSha: process.env.PERFORMANCE_BASELINE_SHA ?? null, headSha: process.env.PERFORMANCE_HEAD_SHA ?? null, checkoutSha: process.env.PERFORMANCE_CHECKOUT_SHA ?? null, workflowSha: process.env.GITHUB_SHA || process.env.PERFORMANCE_WORKFLOW_SHA || null, eventName: process.env.PERFORMANCE_EVENT_NAME ?? null, ref: process.env.PERFORMANCE_REF ?? null, pages: [] };
  }
  await writeFile(path.join(outputDirectory, 'comparison.json'), JSON.stringify(result, null, 2) + '\n');
  await writeFile(path.join(outputDirectory, 'comparison.md'), comparisonMarkdown(result));
  if (result.status !== 'PASSED') console.error(result.errors.join('\n'));
  process.exitCode = exitCodeForComparison(result.status);
}
