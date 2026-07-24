import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const premiumPages = [
  'portal.html',
  'portal-login.html',
  'portal-premium-home.html',
  'portal-premium-onboarding.html',
  'portal-checkin.html',
  'portal-plano-alimentar.html',
  'portal-progressao.html',
  'portal-biblioteca.html',
  'portal-premium-nutrition-plan.html',
  'portal-premium-weekly-feedback.html',
  'anamnese-premium.html'
];

test('PWA manifest exposes the Portal LM installation contract and valid PNG icons', async () => {
  const manifest = JSON.parse(await readFile('public/manifest.webmanifest', 'utf8'));
  assert.deepEqual(
    {
      name: manifest.name,
      shortName: manifest.short_name,
      display: manifest.display,
      orientation: manifest.orientation,
      startUrl: manifest.start_url,
      scope: manifest.scope
    },
    { name: 'Portal LM', shortName: 'Portal LM', display: 'standalone', orientation: 'portrait', startUrl: '/portal.html', scope: '/' }
  );

  for (const icon of manifest.icons) {
    const bytes = await readFile(icon.src === '/assets/logo-lm-gold.png' ? `.${icon.src}` : `public${icon.src}`);
    assert.equal(bytes.subarray(1, 4).toString(), 'PNG');
    const expectedSize = Number(icon.sizes.split('x')[0]);
    assert.equal(bytes.readUInt32BE(16), expectedSize);
    assert.equal(bytes.readUInt32BE(20), expectedSize);
  }
});

test('only Premium Portal pages opt into the shared PWA registration and metadata', async () => {
  for (const page of premiumPages) {
    const html = await readFile(`public/${page}`, 'utf8');
    assert.match(html, /rel="manifest" href="\/manifest\.webmanifest"/);
    assert.match(html, /name="theme-color" content="#0d0d0d"/);
    assert.match(html, /name="apple-mobile-web-app-capable" content="yes"/);
    assert.match(html, /name="apple-mobile-web-app-status-bar-style" content="black-translucent"/);
    assert.match(html, /src="\/assets\/js\/pwa-register\.js"/);
  }

  for (const page of ['index.html', 'project-lm-2.html', 'admin.html']) {
    assert.doesNotMatch(await readFile(`public/${page}`, 'utf8'), /pwa-register\.js/);
  }
});

test('service worker only caches static unauthenticated resources and never API responses', async () => {
  const worker = await readFile('public/sw.js', 'utf8');
  const registration = await readFile('public/assets/js/pwa-register.js', 'utf8');
  assert.match(registration, /'serviceWorker' in navigator/);
  assert.match(registration, /register\('\/sw\.js'\)/);
  assert.match(worker, /url\.pathname\.startsWith\('\/api\/'\)/);
  assert.match(worker, /credentials: 'omit'/);
  assert.match(worker, /request\.mode === 'navigate'/);
  assert.match(worker, /caches\.match\(OFFLINE_URL\)/);
  assert.doesNotMatch(worker, /addEventListener\(['"](?:push|sync)['"]|showNotification/i);
  await readFile('public/offline.html', 'utf8');
});
