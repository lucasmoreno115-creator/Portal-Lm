import test from 'node:test';import assert from 'node:assert/strict';import {mkdtemp,writeFile,readFile,rm,mkdir} from 'node:fs/promises';import os from 'node:os';import path from 'node:path';
import {AUTHORIZED_PAGES,validateProfile,median,p75,nullable,sanitizeUrl,assertLocalUrl,aggregateBytes,aggregateRuns,reportStatus,sortReport,safeWrite,withCleanup} from '../scripts/lib/portal-performance-core.mjs';
import {resolvePublicPath,mimeType,startLocalServer} from '../scripts/lib/portal-performance-server.mjs';
const profile={schemaVersion:'1.0.0',runs:5,viewport:{width:390,height:844,deviceScaleFactor:2,mobile:true},network:{latencyMs:150,downloadBytesPerSecond:200000,uploadBytesPerSecond:93750},cpuSlowdownMultiplier:4,scenarios:['COLD','WARM'],pages:[...AUTHORIZED_PAGES]};
test('valida estritamente o perfil versionado',()=>{assert.deepEqual(validateProfile(structuredClone(profile)),profile);for(const mutation of [p=>p.runs=2,p=>p.network.latencyMs=-1,p=>p.pages[0]='https://example.com',p=>p.pages.push(p.pages[0]),p=>p.extra=true]){const p=structuredClone(profile);mutation(p);assert.throws(()=>validateProfile(p))}});
test('mediana e p75 são determinísticos; ausência é null',()=>{assert.equal(median([9,1,3]),3);assert.equal(median([4,2]),3);assert.equal(p75([4,1,3,2]),3);assert.equal(median([]),null);assert.equal(nullable(undefined),null);assert.equal(nullable(0),0)});
test('sanitiza queries e bloqueia URL externa',()=>{assert.equal(sanitizeUrl('http://127.0.0.1:80/x?token=secret&email=a'),'/x?token=%5BREDACTED%5D&email=%5BREDACTED%5D');assert.throws(()=>assertLocalUrl('https://production.example/x',80),/externo bloqueado/);assert.doesNotThrow(()=>assertLocalUrl('http://127.0.0.1:80/x',80))});
test('bloqueia traversal e resolve somente public',()=>{const root=path.resolve('/tmp/public');assert.equal(resolvePublicPath(root,'/x.js'),path.join(root,'x.js'));for(const p of ['/../secret','/%2e%2e/secret','/x\\secret'])assert.throws(()=>resolvePublicPath(root,p))});
test('MIME types corretos',()=>{assert.equal(mimeType('x.html'),'text/html; charset=utf-8');assert.equal(mimeType('x.css'),'text/css; charset=utf-8');assert.equal(mimeType('x.woff2'),'font/woff2')});
test('servidor fica em loopback, serve public, registra status/bytes e não vaza arquivo',async()=>{const base=await mkdtemp(path.join(os.tmpdir(),'perf-server-'));const pub=path.join(base,'public');await mkdir(pub);await writeFile(path.join(pub,'ok.html'),'ok');await writeFile(path.join(base,'secret'),'secret');const s=await startLocalServer(pub);try{assert.equal(s.server.address().address,'127.0.0.1');const r=await fetch(`http://127.0.0.1:${s.port}/ok.html`);assert.equal(await r.text(),'ok');assert.equal(r.headers.get('cache-control'),'public, max-age=60');const bad=await fetch(`http://127.0.0.1:${s.port}/%2e%2e/secret`);assert.notEqual(await bad.text(),'secret');assert.equal(s.requests[0].bytes,2)}finally{await s.close();await rm(base,{recursive:true,force:true})}});
test('agrega bytes por tipo, sem perder outros',()=>assert.deepEqual(aggregateBytes([{type:'Script',transferBytes:3},{type:'XHR',transferBytes:4}]),{document:0,script:3,stylesheet:0,image:0,font:0,other:4}));
test('agregação não mistura COLD/WARM e ordenação é estável',()=>{const run=n=>({metrics:{ttfb:n},resources:[{url:'/z'},{url:'/a'}]});const report={pages:[{page:'/z',scenarios:[{scenario:'WARM',runs:[run(5)]},{scenario:'COLD',runs:[run(1)]}]},{page:'/a',scenarios:[]}],warnings:['z','a']};sortReport(report);assert.deepEqual(report.pages.map(x=>x.page),['/a','/z']);assert.deepEqual(report.pages[1].scenarios.map(x=>x.scenario),['COLD','WARM']);assert.equal(aggregateRuns([run(1),run(9)]).ttfb.median,5)});
test('estados MEASURED, INCOMPLETE e FAILED e redirect inesperado',()=>{const run={completionStatus:'MEASURED',metrics:{},resources:[],failedRequests:[],mainDocumentStatus:200,mainDocumentLoaded:true,loadEventFired:true};const ok=[{scenarios:[{runs:[run]}]}];assert.equal(reportStatus(ok),'MEASURED');assert.equal(reportStatus([{scenarios:[{runs:[{...run,completionStatus:'INCOMPLETE'}]}]}]),'INCOMPLETE');assert.equal(reportStatus([],true),'FAILED')});
test('escrita limitada ao diretório canônico',async()=>{const d=await mkdtemp(path.join(os.tmpdir(),'perf-out-'));try{await safeWrite(d,'ok.json','{}');assert.equal(await readFile(path.join(d,'ok.json'),'utf8'),'{}');await assert.rejects(safeWrite(d,'../no.json','{}'),/fora/)}finally{await rm(d,{recursive:true,force:true})}});
test('cleanup ocorre em sucesso e falha',async()=>{for(const fail of [false,true]){const calls=[];const p=withCleanup(async()=>{calls.push('work');if(fail)throw Error('x')},[async()=>calls.push('clean')]);fail?await assert.rejects(p):await p;assert.deepEqual(calls,['work','clean'])}});
test('request externo bloqueado é evidência explícita',()=>assert.throws(()=>assertLocalUrl('http://example.com/resource',1234),/Request externo bloqueado/));
test('smoke real de Chrome fica fora da suíte unitária',()=>{assert.equal(JSON.parse('{"script":"performance:portal:smoke"}').script,'performance:portal:smoke')});
import { EventEmitter } from 'node:events';
import { chmod } from 'node:fs/promises';
import { validateChromeBinary, waitForDevToolsPort, sanitizeChromeStderr, readChromeVersion, CDP, waitForPageLoad, createPageTarget, closePageTarget, findChrome, formatChromeLaunchDiagnostic, ChromeLaunchError } from '../scripts/lib/portal-performance-chrome.mjs';
import { classifyRun, exitCodeForStatus } from '../scripts/lib/portal-performance-core.mjs';

function fakeChild() { const c = new EventEmitter(); c.exitCode = null; c.signalCode = null; c.kill = () => { c.exitCode = 0; c.emit('exit', 0, null); }; return c; }

test('launcher aguarda DevToolsActivePort com timeout configurável e além do polling antigo', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'perf-cdp-'));
  const child = fakeChild();
  setTimeout(() => writeFile(path.join(dir, 'DevToolsActivePort'), '12345\n'), 80);
  try {
    const result = await waitForDevToolsPort({ child, dir, binary: '/bin/chrome', timeoutMs: 300, pollMs: 5, stderrChunks: [] });
    assert.equal(result.port, 12345);
    assert.ok(result.waitedMs >= 50);
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test('launcher distingue encerramento antes da porta e timeout, com stderr sanitizado/limitado', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'perf-cdp-'));
  try {
    const exited = fakeChild();
    setTimeout(() => { exited.exitCode = 9; exited.emit('exit', 9, null); }, 10);
    await assert.rejects(waitForDevToolsPort({ child: exited, dir, binary: '/bin/chrome', timeoutMs: 200, pollMs: 5, stderrChunks: ['token=abc user@example.com fatal'] }), error => {
      assert.equal(error.code, 'CHROME_EXITED_BEFORE_CDP');
      assert.equal(error.exitCode, 9);
      assert.match(error.stderr, /\[REDACTED\]/);
      assert.match(error.stderr, /\[REDACTED_EMAIL\]/);
      return true;
    });
    const timed = fakeChild();
    await assert.rejects(waitForDevToolsPort({ child: timed, dir, binary: '/bin/chrome', timeoutMs: 20, pollMs: 5, stderrChunks: ['x'.repeat(3000)] }), error => {
      assert.equal(error.code, 'CHROME_CDP_TIMEOUT');
      assert.ok(error.waitedMs >= 20);
      assert.ok(error.stderr.length <= 1600);
      return true;
    });
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test('CHROME_BIN inválido distingue inexistente e sem permissão de execução', async () => {
  await assert.rejects(validateChromeBinary('/definitivamente/inexistente/chrome'), error => error.code === 'CHROME_NOT_FOUND');
  const dir = await mkdtemp(path.join(os.tmpdir(), 'perf-bin-'));
  const file = path.join(dir, 'chrome');
  try {
    await writeFile(file, '#!/bin/sh\n');
    await chmod(file, 0o600);
    await assert.rejects(validateChromeBinary(file), error => error.code === 'CHROME_NOT_EXECUTABLE');
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test('endpoint CDP inválido e WebSocket ausente são diferenciados', async () => {
  const http = await import('node:http');
  const server = http.createServer((req, res) => {
    if (req.url === '/bad') { res.writeHead(404); res.end('no'); return; }
    res.setHeader('content-type', 'application/json'); res.end(JSON.stringify({ Browser: 'Chrome/0' }));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  try { await assert.rejects(readChromeVersion(port), error => error.code === 'CHROME_CDP_WEBSOCKET_MISSING'); }
  finally { await new Promise(resolve => server.close(resolve)); }
});

test('CDP remove listeners, captura handler assíncrono e rejeita comandos pendentes no close', async () => {
  const cdp = Object.create(CDP.prototype);
  cdp.listeners = new Map(); cdp.pending = new Map(); cdp.closed = false;
  const errors = [];
  const offError = cdp.on('CDP.handlerError', e => errors.push(e.method));
  const off = cdp.on('Fetch.requestPaused', async () => { throw new Error('boom'); });
  assert.equal(cdp.listenerCount('Fetch.requestPaused'), 1);
  cdp.emitHandlerError('Fetch.requestPaused', new Error('boom'));
  assert.deepEqual(errors, ['Fetch.requestPaused']);
  off(); offError();
  assert.equal(cdp.listenerCount('Fetch.requestPaused'), 0);
  let rejected = false;
  cdp.pending.set(1, { reject: () => { rejected = true; } });
  cdp.ws = { close() {} };
  cdp.close();
  assert.equal(rejected, true);
  assert.equal(cdp.pending.size, 0);
});

test('cinco runs não acumulam handlers quando unsubscribe é chamado', () => {
  const cdp = Object.create(CDP.prototype); cdp.listeners = new Map();
  for (let i = 0; i < 5; i++) {
    const off = cdp.on('Fetch.requestPaused', () => {});
    assert.equal(cdp.listenerCount('Fetch.requestPaused'), 1);
    off();
    assert.equal(cdp.listenerCount('Fetch.requestPaused'), 0);
  }
});

test('classificação impede falso MEASURED e cobre contratos de execução', () => {
  const ok = { metrics: {}, resources: [], failedRequests: [], mainDocumentStatus: 200, mainDocumentLoaded: true, loadEventFired: true, externalRequestAttempted: false, errors: [], warnings: [] };
  assert.equal(classifyRun(ok).completionStatus, 'MEASURED');
  assert.equal(classifyRun({ ...ok, mainDocumentStatus: 404 }).completionStatus, 'FAILED');
  assert.equal(classifyRun({ ...ok, failedRequests: [{ resourceType: 'Document', isMainDocument: true }] }).completionStatus, 'FAILED');
  assert.equal(classifyRun({ ...ok, failedRequests: [{ url: '/x.js', resourceType: 'Script' }] }).completionStatus, 'INCOMPLETE');
  assert.equal(classifyRun({ ...ok, failedRequests: [{ url: '/api/x', isLocalApi: true, resourceType: 'XHR' }] }).completionStatus, 'INCOMPLETE');
  assert.equal(classifyRun({ ...ok, unexpectedRedirect: { actual: '/login' } }).completionStatus, 'FAILED');
  assert.equal(classifyRun({ ...ok, externalRequestAttempted: true }).completionStatus, 'FAILED');
  assert.equal(classifyRun({ ...ok, runtimeEvaluateFailed: true }).completionStatus, 'FAILED');
  assert.equal(exitCodeForStatus('MEASURED'), 0);
  assert.equal(exitCodeForStatus('INCOMPLETE'), 0);
  assert.equal(exitCodeForStatus('FAILED'), 1);
});

test('status do relatório valida páginas, cenários e runs exatos', () => {
  const run = { metrics: {}, resources: [], failedRequests: [], mainDocumentStatus: 200, mainDocumentLoaded: true, loadEventFired: true, externalRequestAttempted: false };
  const pages = profile.pages.map(page => ({ page, scenarios: profile.scenarios.map(scenario => ({ scenario, runs: Array.from({ length: profile.runs }, () => ({ ...run, completionStatus: 'MEASURED' })) })) }));
  assert.equal(reportStatus(pages, false, profile), 'MEASURED');
  assert.equal(reportStatus(pages.slice(1), false, profile), 'FAILED');
  const missingScenario = structuredClone(pages); missingScenario[0].scenarios.pop();
  assert.equal(reportStatus(missingScenario, false, profile), 'FAILED');
  const incompleteRuns = structuredClone(pages); incompleteRuns[0].scenarios[0].runs.pop();
  assert.equal(reportStatus(incompleteRuns, false, profile), 'FAILED');
  const partial = structuredClone(pages); partial[0].scenarios[0].runs[0].completionStatus = 'INCOMPLETE';
  assert.equal(reportStatus(partial, false, profile), 'INCOMPLETE');
});

test('bytes de transferência, encoded e decoded preservam null e zero real', () => {
  const resources = [
    { type: 'Script', transferBytes: 10, encodedBodyBytes: 7, decodedBodyBytes: 20 },
    { type: 'Script', transferBytes: null, encodedBodyBytes: null, decodedBodyBytes: null },
    { type: 'Image', transferBytes: 0, encodedBodyBytes: 0, decodedBodyBytes: 0 }
  ];
  assert.deepEqual(aggregateBytes(resources), { document: 0, script: 10, stylesheet: 0, image: 0, font: 0, other: 0 });
  assert.deepEqual(aggregateBytes(resources, 'decodedBodyBytes'), { document: 0, script: 20, stylesheet: 0, image: 0, font: 0, other: 0 });
  const agg = aggregateRuns([{ metrics: { decodedBodyBytes: null } }, { metrics: { decodedBodyBytes: 0 } }, { metrics: { decodedBodyBytes: 30 } }]);
  assert.equal(agg.decodedBodyBytes.median, 15);
  assert.equal(agg.decodedBodyBytes.p75, 30);
});

function fakeCdpForLoad() {
  const cdp = Object.create(CDP.prototype);
  cdp.listeners = new Map();
  cdp.closed = false;
  cdp.send = async method => {
    if (method === 'Page.navigate') {
      for (const handler of [...(cdp.listeners.get('Page.loadEventFired') || [])]) handler({});
    }
    return {};
  };
  return cdp;
}

test('waitForPageLoad registra antes da navegação e resolve evento imediato', async () => {
  const cdp = fakeCdpForLoad();
  const load = waitForPageLoad(cdp, { timeoutMs: 100, label: 'immediate' });
  await cdp.send('Page.navigate');
  await load.promise;
  assert.equal(cdp.listenerCount('Page.loadEventFired'), 0);
  load.cleanup();
  assert.equal(cdp.listenerCount('Page.loadEventFired'), 0);
});

test('waitForPageLoad cobre evento antes do await de Page.navigate retornar', async () => {
  const cdp = fakeCdpForLoad();
  const load = waitForPageLoad(cdp, { timeoutMs: 100, label: 'before_await' });
  const navigation = cdp.send('Page.navigate');
  await load.promise;
  await navigation;
  assert.equal(cdp.listenerCount('Page.loadEventFired'), 0);
});

test('waitForPageLoad rejeita determinístico e limpa listener/timer no timeout', async () => {
  const cdp = Object.create(CDP.prototype); cdp.listeners = new Map();
  const load = waitForPageLoad(cdp, { timeoutMs: 10, label: 'no_event' });
  await assert.rejects(load.promise, error => error.code === 'PAGE_LOAD_TIMEOUT' && error.label === 'no_event');
  assert.equal(cdp.listenerCount('Page.loadEventFired'), 0);
  load.cleanup();
  assert.equal(cdp.listenerCount('Page.loadEventFired'), 0);
});

async function withTargetServer(handler, work) {
  const http = await import('node:http');
  const server = http.createServer(handler);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try { return await work(server.address().port, server); }
  finally {
    server.closeAllConnections?.();
    await new Promise(resolve => server.close(resolve));
  }
}

test('/json/new responde, timeout e payload inválido são classificados', async () => {
  await withTargetServer((req, res) => { res.setHeader('content-type', 'application/json'); res.end(JSON.stringify({ id: 'target-1', webSocketDebuggerUrl: 'ws://127.0.0.1/devtools/page/1' })); }, async port => {
    assert.deepEqual(await createPageTarget(port, { timeoutMs: 100 }), { id: 'target-1', webSocketDebuggerUrl: 'ws://127.0.0.1/devtools/page/1' });
  });
  await withTargetServer((req, res) => { res.setHeader('content-type', 'application/json'); res.end(JSON.stringify({ id: 'target-1' })); }, async port => {
    await assert.rejects(createPageTarget(port, { timeoutMs: 100 }), error => error.code === 'TARGET_CREATE_INVALID');
  });
  await withTargetServer(() => {}, async (port, server) => {
    await assert.rejects(createPageTarget(port, { timeoutMs: 20 }), error => error.code === 'TARGET_CREATE_TIMEOUT');
    server.closeAllConnections?.();
  });
});

test('/json/close responde, timeout é classificado e cleanup continua', async () => {
  await withTargetServer((req, res) => { res.end('Target is closing'); }, async port => {
    assert.deepEqual(await closePageTarget(port, 'target-1', { timeoutMs: 100 }), { closed: true });
  });
  await withTargetServer(() => {}, async (port, server) => {
    await assert.rejects(closePageTarget(port, 'target-1', { timeoutMs: 20 }), error => error.code === 'TARGET_CLOSE_TIMEOUT');
    const calls = [];
    const cdp = { close() { calls.push('ws'); }, async closeTarget() { this.close(); try { await closePageTarget(port, 'target-1', { timeoutMs: 20 }); } catch (error) { calls.push(error.code); return { closed: false, error }; } } };
    const result = await cdp.closeTarget();
    calls.push('chrome_close', 'server_close');
    assert.equal(result.error.code, 'TARGET_CLOSE_TIMEOUT');
    assert.deepEqual(calls, ['ws', 'TARGET_CLOSE_TIMEOUT', 'chrome_close', 'server_close']);
    server.closeAllConnections?.();
  });
});

test('cleanup subsequente roda quando cada etapa do smoke falha', async () => {
  for (const failAt of ['target_create_cold', 'navigate_cold', 'target_close_cold', 'target_create_warm', 'navigate_warm', 'target_close_warm']) {
    const calls = [];
    try {
      for (const step of ['target_create_cold', 'navigate_cold', 'target_close_cold', 'target_create_warm', 'navigate_warm', 'target_close_warm']) {
        calls.push(step);
        if (step === failAt) throw new Error(step);
      }
    } catch {
      calls.push('chrome_close', 'server_close', 'tmp_rm');
    }
    assert.ok(calls.includes('chrome_close'), failAt);
    assert.ok(calls.includes('server_close'), failAt);
    assert.ok(calls.includes('tmp_rm'), failAt);
  }
});

test('diagnóstico de ChromeLaunchError é estruturado, sanitizado e limitado', () => {
  const error = new ChromeLaunchError('CHROME_EXITED_BEFORE_CDP', 'x', {
    binary: '/opt/chrome', waitedMs: 1200, exitCode: 1, signal: null,
    stderr: `token=secret user@example.com ${'x'.repeat(3000)}`
  });
  const parsed = JSON.parse(formatChromeLaunchDiagnostic(error));
  assert.equal(parsed.code, 'CHROME_EXITED_BEFORE_CDP');
  assert.equal(parsed.binary, '/opt/chrome');
  assert.equal(parsed.waitedMs, 1200);
  assert.equal(parsed.exitCode, 1);
  assert.equal(parsed.signal, null);
  assert.ok(parsed.stderr.length <= 1600);
  assert.doesNotMatch(parsed.stderr, /secret|user@example\.com/i);
});

test('findChrome respeita CHROME_BIN explícito e só faz fallback quando ausente', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'perf-findchrome-'));
  const executable = path.join(dir, 'chrome-ok');
  const noexec = path.join(dir, 'chrome-noexec');
  try {
    await writeFile(executable, '#!/bin/sh\necho ok\n');
    await chmod(executable, 0o700);
    await writeFile(noexec, '#!/bin/sh\necho no\n');
    await chmod(noexec, 0o600);
    assert.equal(await findChrome([], { CHROME_BIN: executable }), executable);
    await assert.rejects(findChrome([executable], { CHROME_BIN: path.join(dir, 'missing') }), error => error.code === 'CHROME_NOT_FOUND');
    await assert.rejects(findChrome([executable], { CHROME_BIN: noexec }), error => error.code === 'CHROME_NOT_EXECUTABLE');
    assert.equal(await findChrome([path.join(dir, 'missing'), executable], {}), executable);
    assert.equal(await findChrome([path.join(dir, 'missing')], {}), null);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
