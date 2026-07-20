import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import test from 'node:test';
import worker from '../workers/api.js';

function failingDatabase() {
  return new Proxy({}, {
    get() {
      throw new Error('The public health check must not access D1.');
    }
  });
}

async function requestHealth(method = 'GET', headers = {}) {
  return worker.fetch(new Request('https://portal.test/api/health', { method, headers }), { DB: failingDatabase() });
}

test('GET /api/health is public JSON with a minimal non-cacheable payload and no D1 access', async () => {
  const response = await requestHealth();
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-type'), /^application\/json; charset=utf-8$/i);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.deepEqual(payload, { ok: true, service: 'lm-system-api', environment: 'production' });
  assert.equal(typeof payload.environment, 'string');
  assert.doesNotMatch(JSON.stringify(payload), /secret|token|account|database|student|count|stack|binding|hostname|ip/i);
});

test('non-GET /api/health rejects mutations without authentication or D1 access', async () => {
  const response = await requestHealth('POST');

  assert.equal(response.status, 405);
  assert.equal(response.headers.get('allow'), 'GET');
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.deepEqual(await response.json(), { ok: false, error: 'METHOD_NOT_ALLOWED' });
});

test('unknown API routes retain the existing JSON 404 response', async () => {
  const source = await readFile(new URL('../workers/api.js', import.meta.url), 'utf8');

  assert.match(source, /return json\(\{ ok: false, error: 'Not found' \}, 404\);/);
});
