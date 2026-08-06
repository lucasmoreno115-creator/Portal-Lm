#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { validateProfile, assertLocalUrl, sanitizeUrl, resourceType, aggregateBytes, aggregateRuns, nullable, classifyRun, reportStatus, sortReport, safeWrite, withCleanup, exitCodeForStatus } from './lib/portal-performance-core.mjs';
import { startLocalServer } from './lib/portal-performance-server.mjs';
import { launchChrome, pageSocket, waitForPageLoad, formatChromeLaunchDiagnostic, ChromeLaunchError } from './lib/portal-performance-chrome.mjs';
import { buildPerformanceSource } from './lib/portal-performance-analysis.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, 'artifacts/performance');
const profile = validateProfile(JSON.parse(await readFile(path.join(root, 'config/portal-performance-profile.json'), 'utf8')));
const checkoutSha = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
let chrome;
let server;
const cleanups = [];

export async function measure(cdp, page, scenario, run, port, activeProfile = profile) {
  const resources = [];
  const byId = new Map();
  const failedRequests = [];
  const externalBlocked = [];
  const redirects = [];
  const errors = [];
  const warnings = [];
  const unsubscribers = [];
  let mainDocumentStatus = null;
  let mainDocumentLoaded = false;
  let loadEventFired = false;
  let externalRequestAttempted = false;
  let runtimeEvaluateFailed = false;
  let cdpError = null;

  const safeSend = async (method, params) => {
    try { return await cdp.send(method, params); } catch (error) { cdpError = error.message; errors.push(`cdp:${method}`); throw error; }
  };
  const on = (method, handler) => {
    unsubscribers.push(cdp.on(method, params => Promise.resolve(handler(params)).catch(error => {
      cdpError = error.message;
      errors.push(`handler:${method}`);
    })));
  };

  try {
    on('Fetch.requestPaused', async event => {
      try {
        assertLocalUrl(event.request.url, port);
        await cdp.send('Fetch.continueRequest', { requestId: event.requestId });
      } catch (error) {
        externalRequestAttempted = true;
        externalBlocked.push(sanitizeUrl(event.request.url));
        if (!cdp.closed) await cdp.send('Fetch.failRequest', { requestId: event.requestId, errorReason: 'BlockedByClient' }).catch(err => { cdpError = err.message; });
      }
    });
    on('Network.requestWillBeSent', event => {
      if (event.redirectResponse) redirects.push({ from: sanitizeUrl(event.redirectResponse.url), to: sanitizeUrl(event.request.url), status: event.redirectResponse.status });
      byId.set(event.requestId, { url: sanitizeUrl(event.request.url), type: resourceType(event.type), resourceType: event.type, status: null, protocol: null, fromCache: false, transferBytes: null, encodedBodyBytes: null, decodedBodyBytes: null, failed: false });
    });
    on('Network.responseReceived', event => {
      const item = byId.get(event.requestId);
      if (!item) return;
      item.status = event.response.status;
      item.protocol = event.response.protocol || null;
      item.fromCache = Boolean(event.response.fromDiskCache || event.response.fromPrefetchCache || event.response.fromServiceWorker);
      if (event.type === 'Document') {
        mainDocumentStatus = event.response.status;
        mainDocumentLoaded = event.response.status >= 200 && event.response.status < 300;
      }
      if ((item.url.startsWith('/api/') || item.url.startsWith('/portal/')) && event.response.status >= 400) {
        failedRequests.push({ url: item.url, reason: `HTTP ${event.response.status}`, status: event.response.status, resourceType: event.type, isLocalApi: item.url.startsWith('/api/') || item.url.startsWith('/portal/') });
      }
    });
    on('Network.dataReceived', event => {
      const item = byId.get(event.requestId);
      if (!item) return;
      if (Number.isFinite(event.dataLength)) item.decodedBodyBytes = (item.decodedBodyBytes ?? 0) + event.dataLength;
      if (Number.isFinite(event.encodedDataLength)) item.encodedBodyBytes = (item.encodedBodyBytes ?? 0) + event.encodedDataLength;
    });
    on('Network.loadingFinished', event => {
      const item = byId.get(event.requestId);
      if (item && Number.isFinite(event.encodedDataLength)) item.transferBytes = event.encodedDataLength;
    });
    on('Network.loadingFailed', event => {
      const item = byId.get(event.requestId);
      if (item) item.failed = true;
      failedRequests.push({ url: item?.url || '[unknown]', reason: event.blockedReason || event.errorText, resourceType: item?.resourceType || null, isMainDocument: item?.resourceType === 'Document', isLocalApi: item?.url?.startsWith('/api/') || item?.url?.startsWith('/portal/') || false });
      if (item?.resourceType === 'Document') mainDocumentLoaded = false;
    });
    on('Page.loadEventFired', () => { loadEventFired = true; });

    await Promise.all([safeSend('Page.enable'), safeSend('Network.enable'), safeSend('Performance.enable'), safeSend('Fetch.enable', { patterns: [{ urlPattern: '*' }] })]);
    await safeSend('Emulation.setDeviceMetricsOverride', { width: activeProfile.viewport.width, height: activeProfile.viewport.height, deviceScaleFactor: activeProfile.viewport.deviceScaleFactor, mobile: activeProfile.viewport.mobile });
    await safeSend('Emulation.setCPUThrottlingRate', { rate: activeProfile.cpuSlowdownMultiplier });
    await safeSend('Network.emulateNetworkConditions', { offline: false, latency: activeProfile.network.latencyMs, downloadThroughput: activeProfile.network.downloadBytesPerSecond, uploadThroughput: activeProfile.network.uploadBytesPerSecond });
    await safeSend('Network.setBypassServiceWorker', { bypass: scenario === 'COLD' });
    await safeSend('Network.setCacheDisabled', { cacheDisabled: scenario === 'COLD' });
    if (scenario === 'COLD') {
      await safeSend('Network.clearBrowserCache');
      await safeSend('Storage.clearDataForOrigin', { origin: `http://127.0.0.1:${port}`, storageTypes: 'all' });
    }
    await safeSend('Page.addScriptToEvaluateOnNewDocument', { source: `localStorage.setItem('lm_student_email','student@example.invalid');localStorage.setItem('lm_student_token','LAB_ONLY');localStorage.setItem('lm_student_name','Aluno Fictício');localStorage.setItem('lm_student_plan','premium');window.__perf={lcp:null,cls:0,longTasks:[],layoutShiftEvents:[]};const safePart=v=>String(v||'').replace(/[^a-zA-Z0-9_-]/g,'').slice(0,40);const sensitive=v=>/(email|name|token|auth|password|secret|student|aluno)/i.test(v||'');const selector=n=>{if(!n||!n.tagName)return null;const parts=[];for(let x=n;x&&parts.length<3;x=x.parentElement){let p=safePart(x.tagName).toLowerCase();if(x.id&&!sensitive(x.id))p+='#'+safePart(x.id);p+=[...x.classList].filter(c=>!sensitive(c)).slice(0,2).map(c=>'.'+safePart(c)).join('');parts.unshift(p)}return parts.join('>')};const rect=r=>r?{x:r.x,y:r.y,width:r.width,height:r.height,top:r.top,right:r.right,bottom:r.bottom,left:r.left}:null;try{new PerformanceObserver(x=>{const e=x.getEntries().at(-1);if(e)window.__perf.lcp=e.startTime}).observe({type:'largest-contentful-paint',buffered:true});new PerformanceObserver(x=>{for(const e of x.getEntries()){const sources=e.sources===undefined?null:e.sources.map(s=>({nodeSelector:selector(s.node),previousRect:rect(s.previousRect),currentRect:rect(s.currentRect)}));window.__perf.layoutShiftEvents.push({startTime:e.startTime,value:e.value,hadRecentInput:e.hadRecentInput,sources});if(!e.hadRecentInput)window.__perf.cls+=e.value}}).observe({type:'layout-shift',buffered:true});new PerformanceObserver(x=>window.__perf.longTasks.push(...x.getEntries().map(e=>e.duration))).observe({type:'longtask',buffered:true})}catch{}` });
    const expected = `http://127.0.0.1:${port}${page}`;
    const loaded = waitForPageLoad(cdp, { timeoutMs: 30000, label: `${scenario}:${page}:${run}` });
    unsubscribers.push(loaded.cleanup);
    await safeSend('Page.navigate', { url: expected });
    await loaded.promise;
    await new Promise(resolve => setTimeout(resolve, 500));
    let evalResult;
    try {
      evalResult = await safeSend('Runtime.evaluate', { returnByValue: true, expression: `(()=>{const n=performance.getEntriesByType('navigation')[0],p=performance.getEntriesByType('paint').find(x=>x.name==='first-contentful-paint'),x=window.__perf||{};return{url:location.href,ttfb:n?n.responseStart:null,fcp:p?p.startTime:null,lcp:x.lcp??null,cls:x.cls??null,domContentLoaded:n?n.domContentLoadedEventEnd:null,load:n?n.loadEventEnd:null,longTaskCount:x.longTasks?.length??null,longTaskDuration:x.longTasks?.reduce((a,b)=>a+b,0)??null}})()` });
    } catch (error) {
      runtimeEvaluateFailed = true;
      throw error;
    }
    resources.push(...byId.values());
    resources.sort((a, b) => a.url.localeCompare(b.url));
    const base = evalResult.result.value;
    const transferValues = resources.map(r => r.transferBytes).filter(Number.isFinite);
    const encodedValues = resources.map(r => r.encodedBodyBytes).filter(Number.isFinite);
    const decodedValues = resources.map(r => r.decodedBodyBytes).filter(Number.isFinite);
    const metrics = {
      ...base,
      requestCount: resources.length,
      apiRequestCount: resources.filter(r => r.url.startsWith('/api/') || r.url.startsWith('/portal/')).length,
      failedRequestCount: failedRequests.length,
      transferBytes: transferValues.length ? transferValues.reduce((a, b) => a + b, 0) : null,
      encodedBodyBytes: encodedValues.length ? encodedValues.reduce((a, b) => a + b, 0) : null,
      decodedBodyBytes: decodedValues.length ? decodedValues.reduce((a, b) => a + b, 0) : null
    };
    const finalPath = new URL(base.url).pathname;
    const result = { run, scenario, page, metrics, layoutShiftEvents: (await safeSend('Runtime.evaluate',{returnByValue:true,expression:'window.__perf?.layoutShiftEvents??[]'})).result.value, bytesByType: aggregateBytes(resources), encodedBytesByType: aggregateBytes(resources, 'encodedBodyBytes'), decodedBytesByType: aggregateBytes(resources, 'decodedBodyBytes'), resources, failedRequests, redirects, mainDocumentStatus, mainDocumentLoaded, loadEventFired, externalRequestAttempted, unexpectedRedirect: finalPath !== page ? { expected: page, actual: finalPath } : null, externalBlocked, runtimeEvaluateFailed, cdpError, errors, warnings, error: errors[0] ?? null };
    Object.assign(result, classifyRun(result));
    return result;
  } finally {
    for (const unsubscribe of unsubscribers.splice(0).reverse()) unsubscribe();
  }
}

function buildReport(pages, status = null) {
  const report = sortReport({ schemaVersion: '1.0.0', environment: 'LAB_STUBBED', source: buildPerformanceSource({ checkoutSha, chromeVersion: chrome?.version }), profile, pages, warnings: ['LCP, CLS e sources ficam null quando o navegador não produz entradas elegíveis antes da coleta. O ambiente usa contratos locais mínimos e não representa produção.', 'A S0.5 exige MEASURED; INCOMPLETE e FAILED retornam código diferente de zero.'], status: status ?? 'MEASURED' });
  report.status = status ?? reportStatus(report.pages, false, profile);
  return report;
}

try {
  await withCleanup(async () => {
    server = await startLocalServer(path.join(root, 'public'));
    cleanups.push(() => server.close());
    try {
      chrome = await launchChrome();
    } catch (error) {
      if (error instanceof ChromeLaunchError) console.error(formatChromeLaunchDiagnostic(error));
      throw error;
    }
    cleanups.push(() => chrome.close());
    const pages = [];
    for (const page of profile.pages) {
      const scenarios = { COLD: [], WARM: [] };
      for (let run = 1; run <= profile.runs; run++) {
        for (const scenario of ['COLD', 'WARM']) {
          const cdp = await pageSocket(chrome.port);
          try { scenarios[scenario].push(await measure(cdp, page, scenario, run, server.port)); }
          finally { await cdp.closeTarget(); }
        }
      }
      pages.push({ page, scenarios: ['COLD', 'WARM'].map(s => ({ scenario: s, runs: scenarios[s], aggregate: aggregateRuns(scenarios[s]) })) });
    }
    const report = buildReport(pages);
    await safeWrite(out, 'portal-performance-report.json', JSON.stringify(report, null, 2) + '\n');
    await safeWrite(out, 'portal-performance-report.md', markdown(report));
    process.exitCode = report.status === 'MEASURED' ? 0 : 1;
    if (process.exitCode) console.error(`Falha na medição: status ${report.status}`);
  }, cleanups);
} catch (error) {
  const failed = buildReport([], 'FAILED');
  failed.warnings.push(`Infraestrutura não conseguiu medir: ${error.message}`);
  await safeWrite(out, 'portal-performance-report.json', JSON.stringify(failed, null, 2) + '\n');
  await safeWrite(out, 'portal-performance-report.md', markdown(failed));
  console.error(`Falha na medição: ${error.message}`);
  process.exitCode = 1;
}

export function markdown(r) {
  const lines = ['# Baseline de performance do Portal do Aluno', '', `**Estado:** ${r.status}  `, `**Ambiente:** ${r.environment}  `, `**SHA:** \`${r.source.checkoutSha}\``, '', '> Diagnóstico sintético, sem score, budget, aprovação ou reprovação. LAB_STUBBED não representa produção.', '', ...r.warnings.sort().map(w => `- Aviso: ${w}`), ''];
  for (const p of r.pages) {
    lines.push(`## ${p.page}`);
    for (const s of p.scenarios) {
      lines.push('', `### ${s.scenario}`, '', '| Métrica | Mediana | p75 |', '|---|---:|---:|', ...Object.entries(s.aggregate).map(([k, v]) => `| ${k} | ${v.median ?? 'indisponível'} | ${v.p75 ?? 'indisponível'} |`), '', `Execuções brutas: ${s.runs.length}; falhas: ${s.runs.reduce((n, x) => n + x.failedRequests.length, 0)}; status: ${s.runs.map(x => x.completionStatus).join(', ')}.`);
    }
  }
  return lines.join('\n') + '\n';
}
