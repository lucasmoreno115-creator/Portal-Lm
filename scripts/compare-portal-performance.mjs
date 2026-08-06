#!/usr/bin/env node
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const base = path.join(root, 'artifacts/performance/s0.6');
export const comparableMetrics = ['cls', 'lcp', 'fcp', 'transferBytes', 'requestCount', 'failedRequestCount'];

export function metricDelta(before, after) {
  if (!Number.isFinite(before) || !Number.isFinite(after)) return { absolute: null, percentage: null };
  return { absolute: after - before, percentage: before === 0 ? null : ((after - before) / before) * 100 };
}

const eventCounts = runs => ({
  total: runs.reduce((n, run) => n + run.layoutShiftEvents.length, 0),
  withSources: runs.reduce((n, run) => n + run.layoutShiftEvents.filter(event => Array.isArray(event.sources) && event.sources.length).length, 0),
  withoutSources: runs.reduce((n, run) => n + run.layoutShiftEvents.filter(event => !Array.isArray(event.sources) || !event.sources.length).length, 0),
});

export function compareReports(before, after) {
  const byPage = report => new Map(report.pages.map(page => [page.page, page]));
  const beforePages = byPage(before), afterPages = byPage(after);
  const pages = [...new Set([...beforePages.keys(), ...afterPages.keys()])].sort().map(page => ({
    page,
    scenarios: ['COLD', 'WARM'].map(scenario => {
      const b = beforePages.get(page)?.scenarios.find(item => item.scenario === scenario);
      const a = afterPages.get(page)?.scenarios.find(item => item.scenario === scenario);
      const metrics = Object.fromEntries(comparableMetrics.map(metric => [metric, {
        before: b?.aggregate?.[metric] ?? { median: null, p75: null },
        after: a?.aggregate?.[metric] ?? { median: null, p75: null },
        medianDelta: metricDelta(b?.aggregate?.[metric]?.median, a?.aggregate?.[metric]?.median),
        p75Delta: metricDelta(b?.aggregate?.[metric]?.p75, a?.aggregate?.[metric]?.p75),
      }]));
      return {
        scenario, beforeStatus: b ? b.runs.map(run => run.completionStatus) : null,
        afterStatus: a ? a.runs.map(run => run.completionStatus) : null,
        rawCls: { before: b?.runs.map(run => run.metrics.cls) ?? null, after: a?.runs.map(run => run.metrics.cls) ?? null },
        events: { before: b ? eventCounts(b.runs) : null, after: a ? eventCounts(a.runs) : null }, metrics,
        requests: {
          externalBefore: b?.runs.reduce((n, run) => n + (run.externalBlocked?.length || 0), 0) ?? null,
          externalAfter: a?.runs.reduce((n, run) => n + (run.externalBlocked?.length || 0), 0) ?? null,
        },
      };
    }),
  }));
  return {
    schemaVersion: '1.0.0', profile: after.profile ?? before.profile ?? null,
    before: { sha: before.source?.checkoutSha ?? null, node: before.source?.nodeVersion ?? null, chrome: before.source?.chromeVersion ?? null, status: before.status ?? null },
    after: { sha: after.source?.checkoutSha ?? null, node: after.source?.nodeVersion ?? null, chrome: after.source?.chromeVersion ?? null, status: after.status ?? null },
    runs: { before: before.pages.flatMap(p => p.scenarios.flatMap(s => s.runs)).length, after: after.pages.flatMap(p => p.scenarios.flatMap(s => s.runs)).length }, pages,
  };
}

export function comparisonMarkdown(comparison) {
  const lines = ['# S0.6 — comparação before/after', '', `- SHA before: \`${comparison.before.sha}\``, `- SHA after: \`${comparison.after.sha}\``, `- Node: before ${comparison.before.node}; after ${comparison.after.node}`, `- Chrome: before ${comparison.before.chrome}; after ${comparison.after.chrome}`, `- Runs: before ${comparison.runs.before}; after ${comparison.runs.after}`, ''];
  for (const page of comparison.pages) for (const scenario of page.scenarios) {
    lines.push(`## ${page.page} — ${scenario.scenario}`, '', '| Métrica | before p75 | after p75 | Δ absoluto | Δ percentual |', '|---|---:|---:|---:|---:|');
    for (const [metric, value] of Object.entries(scenario.metrics)) lines.push(`| ${metric} | ${value.before.p75 ?? 'null'} | ${value.after.p75 ?? 'null'} | ${value.p75Delta.absolute ?? 'null'} | ${value.p75Delta.percentage ?? 'null'} |`);
    lines.push('', `CLS bruto before: ${JSON.stringify(scenario.rawCls.before)}  `, `CLS bruto after: ${JSON.stringify(scenario.rawCls.after)}  `, `Eventos before/after: ${JSON.stringify(scenario.events)}  `, `Status before/after: ${JSON.stringify({ before: scenario.beforeStatus, after: scenario.afterStatus })}`, '');
  }
  return lines.join('\n') + '\n';
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const before = JSON.parse(await readFile(process.argv[2] || path.join(base, 'before/portal-performance-report.json'), 'utf8'));
  const after = JSON.parse(await readFile(process.argv[3] || path.join(base, 'after/portal-performance-report.json'), 'utf8'));
  const comparison = compareReports(before, after);
  await mkdir(base, { recursive: true });
  await writeFile(path.join(base, 'comparison.json'), JSON.stringify(comparison, null, 2) + '\n');
  await writeFile(path.join(base, 'comparison.md'), comparisonMarkdown(comparison));
}
