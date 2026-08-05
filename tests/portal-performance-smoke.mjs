import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { findChrome, launchChrome, pageSocket } from '../scripts/lib/portal-performance-chrome.mjs';
import { startLocalServer } from '../scripts/lib/portal-performance-server.mjs';

test('smoke real obrigatório: Chrome, CDP, COLD/WARM isolados e cleanup', async () => {
  const bin = await findChrome();
  assert.ok(bin, 'CHROME_REQUIRED: instale Chrome/Chromium ou defina CHROME_BIN para executar performance:portal:smoke');
  const base = await mkdtemp(path.join(os.tmpdir(), 'perf-smoke-'));
  const pub = path.join(base, 'public');
  await mkdir(pub);
  await writeFile(path.join(pub, 'simple.html'), '<!doctype html><title>ok</title><h1>ok</h1>');
  const server = await startLocalServer(pub);
  const chrome = await launchChrome({ timeoutMs: 25000 });
  try {
    for (const scenario of ['COLD', 'WARM']) {
      const cdp = await pageSocket(chrome.port);
      let load = false;
      const off = cdp.on('Page.loadEventFired', () => { load = true; });
      try {
        await cdp.send('Page.enable');
        await cdp.send('Network.enable');
        await cdp.send('Network.setCacheDisabled', { cacheDisabled: scenario === 'COLD' });
        await cdp.send('Page.navigate', { url: `http://127.0.0.1:${server.port}/simple.html` });
        await new Promise((resolve, reject) => {
          const timer = setTimeout(() => reject(new Error(`${scenario} não carregou`)), 10000);
          const done = cdp.on('Page.loadEventFired', () => { done(); clearTimeout(timer); resolve(); });
        });
        assert.equal(load, true);
      } finally {
        off();
        assert.equal(cdp.listenerCount('Page.loadEventFired'), 0);
        await cdp.closeTarget();
      }
    }
  } finally {
    await chrome.close();
    await server.close();
    await rm(base, { recursive: true, force: true });
  }
});
