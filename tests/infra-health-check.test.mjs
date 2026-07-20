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

test('post-deploy smoke retries API and asset checks while retaining health payload validation', async () => {
  const workflow = await readFile(new URL('../.github/workflows/cloudflare-deploy.yml', import.meta.url), 'utf8');

  assert.match(workflow, /for attempt in 1 2 3 4 5; do/);
  assert.match(workflow, /--max-time 10/);
  assert.match(workflow, /request \/api\/health 200 'application\/json'/);
  assert.match(workflow, /node -e 'const fs=require/);
  assert.match(workflow, /request \/admin-premium-student-record\.html 200 'text\/html' 'Planejamento alimentar'/);
  assert.match(workflow, /sleep 5/);
  assert.match(workflow, /exit 1/);
});

test('database fixtures initialize their schemas explicitly instead of calling the public health endpoint', async () => {
  const fixturePaths = [
    '../tests/admin-workspace-durable-session-integration.test.mjs',
    '../tests/lm-premium-legacy-contracts.test.mjs',
    '../tests/lm-premium-student-record-endpoints.test.mjs'
  ];

  for (const fixturePath of fixturePaths) {
    const fixture = await readFile(new URL(fixturePath, import.meta.url), 'utf8');
    assert.match(fixture, /initializeSchemaForTests/);
    assert.doesNotMatch(fixture, /portal\.test\/api\/health/);
  }
});
