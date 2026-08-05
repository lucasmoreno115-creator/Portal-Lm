import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { findChrome, launchChrome, pageSocket, waitForPageLoad } from '../scripts/lib/portal-performance-chrome.mjs';
import { startLocalServer } from '../scripts/lib/portal-performance-server.mjs';

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
    const bin = await findChrome();
    assert.ok(bin, 'CHROME_REQUIRED: instale Chrome/Chromium ou defina CHROME_BIN para executar performance:portal:smoke');
    const base = await mkdtemp(path.join(os.tmpdir(), 'perf-smoke-'));
    const pub = path.join(base, 'public');
    let server;
    let chrome;
    await mkdir(pub);
    await writeFile(path.join(pub, 'simple.html'), '<!doctype html><title>ok</title><h1>ok</h1>');
    try {
      server = await startLocalServer(pub);
      chrome = await launchChrome({ timeoutMs: 25000 });
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
    } finally {
      const cleanupResults = [];
      step = 'chrome_close';
      if (chrome) cleanupResults.push(await Promise.allSettled([chrome.close()]));
      step = 'server_close';
      if (server) cleanupResults.push(await Promise.allSettled([server.close()]));
      await rm(base, { recursive: true, force: true });
      assert.ok(cleanupResults.flat().every(result => result.status === 'fulfilled'), 'cleanup de Chrome/servidor deve concluir');
    }
  }, () => step);
});
