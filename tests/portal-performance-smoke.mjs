import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { findChrome, launchChrome, pageSocket, waitForPageLoad, formatChromeLaunchDiagnostic, ChromeLaunchError } from '../scripts/lib/portal-performance-chrome.mjs';
import { startLocalServer } from '../scripts/lib/portal-performance-server.mjs';
import { runLabeledCleanup, throwPreservingPrimary } from '../scripts/lib/portal-performance-core.mjs';

async function withGlobalSmokeTimeout(work, getStep, timeoutMs = 60000) {
  let timer;
  try {
    await Promise.race([
      work(),
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error(`SMOKE_GLOBAL_TIMEOUT: etapa=${getStep()} timeoutMs=${timeoutMs}`)), timeoutMs);
      })
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

test('smoke real obrigatório: Chrome, CDP, COLD/WARM isolados e cleanup', { timeout: 65000 }, async () => {
  let step = 'chrome_start';
  await withGlobalSmokeTimeout(async () => {
    let bin;
    try {
      bin = await findChrome();
    } catch (error) {
      if (error instanceof ChromeLaunchError) console.error(formatChromeLaunchDiagnostic(error));
      throw error;
    }
    assert.ok(bin, 'CHROME_REQUIRED: instale Chrome/Chromium ou defina CHROME_BIN para executar performance:portal:smoke');
    const base = await mkdtemp(path.join(os.tmpdir(), 'perf-smoke-'));
    const pub = path.join(base, 'public');
    let server;
    let chrome;
    await mkdir(pub);
    await writeFile(path.join(pub, 'simple.html'), '<!doctype html><title>ok</title><h1>ok</h1>');
    await writeFile(path.join(pub, 'home-stability.html'), `<!doctype html><meta name="viewport" content="width=device-width"><style>body{margin:0}.card{box-sizing:border-box;padding:14px;min-block-size:230px}.card[hidden]{display:none}#after{height:44px}</style><script>window.shifts=0;new PerformanceObserver(list=>list.getEntries().forEach(e=>{if(!e.hadRecentInput)shifts+=e.value})).observe({type:'layout-shift',buffered:true})</script><aside id="card" class="card" data-state="loading"><button id="action">Ativar</button><p id="copy">Carregando</p></aside><script>try{if(localStorage.getItem('lm_portal_push_enabled')==='true')card.hidden=true}catch{}</script><main id="after"><button id="next">Continuar</button></main><script>window.setCardState=s=>{card.dataset.state=s;copy.textContent={loading:'Carregando',waiting:'Disponível',blocked:'Bloqueadas nas configurações',unsupported:'Navegador sem suporte',install:'Instale o aplicativo',error:'Tente novamente'}[s]||s}</script>`);
    let primaryError = null;
    let cleanupResults = [];
    try {
      server = await startLocalServer(pub);
      try {
        chrome = await launchChrome({ timeoutMs: 25000 });
      } catch (error) {
        if (error instanceof ChromeLaunchError) console.error(formatChromeLaunchDiagnostic(error));
        throw error;
      }
      for (const scenario of ['COLD', 'WARM']) {
        const lower = scenario.toLowerCase();
        step = `target_create_${lower}`;
        const cdp = await pageSocket(chrome.port, { timeoutMs: 5000 });
        try {
          await cdp.send('Page.enable');
          await cdp.send('Network.enable');
          await cdp.send('Network.setCacheDisabled', { cacheDisabled: scenario === 'COLD' });
          step = `navigate_${lower}`;
          const load = waitForPageLoad(cdp, { timeoutMs: 10000, label: `smoke_${lower}` });
          try {
            await cdp.send('Page.navigate', { url: `http://127.0.0.1:${server.port}/simple.html` });
            await load.promise;
          } finally {
            load.cleanup();
          }
          assert.equal(cdp.listenerCount('Page.loadEventFired'), 0);
        } finally {
          step = `target_close_${lower}`;
          const closeResult = await cdp.closeTarget();
          assert.notEqual(closeResult.error?.code, 'TARGET_CLOSE_TIMEOUT');
        }
      }
      step = 'home_mobile_geometry';
      const cdp = await pageSocket(chrome.port, { timeoutMs: 5000 });
      try {
        await cdp.send('Page.enable'); await cdp.send('Runtime.enable');
        await cdp.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
        let load = waitForPageLoad(cdp, { timeoutMs: 10000, label: 'home_geometry' });
        await cdp.send('Page.navigate', { url: `http://127.0.0.1:${server.port}/home-stability.html` }); await load.promise; load.cleanup();
        const geometry = await cdp.send('Runtime.evaluate', { returnByValue: true, expression: `(()=>{const states=['loading','waiting','blocked','unsupported','install','error'],tops=[];for(const state of states){setCardState(state);tops.push(after.getBoundingClientRect().top)};action.focus();return{tops,cardHeight:card.getBoundingClientRect().height,focus:document.activeElement.id}})()` });
        assert.deepEqual(new Set(geometry.result.value.tops).size, 1); assert.equal(geometry.result.value.cardHeight, 230); assert.equal(geometry.result.value.focus, 'action');
        await cdp.send('Runtime.evaluate', { expression: `localStorage.setItem('lm_portal_push_enabled','true')` });
        load = waitForPageLoad(cdp, { timeoutMs: 10000, label: 'home_enabled' }); await cdp.send('Page.reload'); await load.promise; load.cleanup();
        await new Promise(resolve => setTimeout(resolve, 100));
        const enabled = await cdp.send('Runtime.evaluate', { returnByValue: true, expression: `({hidden:card.hidden,cardHeight:card.getBoundingClientRect().height,afterTop:after.getBoundingClientRect().top,shifts})` });
        assert.deepEqual(enabled.result.value, { hidden: true, cardHeight: 0, afterTop: 0, shifts: 0 });
      } finally { await cdp.closeTarget(); }
    } catch (error) {
      primaryError = error;
    } finally {
      cleanupResults = await runLabeledCleanup([
        ['chrome_close', chrome ? () => chrome.close() : null],
        ['server_close', server ? () => server.close() : null],
        ['temp_dir_remove', () => rm(base, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 })]
      ]);
      const rejected = cleanupResults.filter(result => result.status === 'rejected');
      for (const result of rejected) console.error(JSON.stringify(result));
    }
    throwPreservingPrimary(primaryError, cleanupResults);
  }, () => step);
});
