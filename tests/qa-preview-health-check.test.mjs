import assert from 'node:assert/strict';
import { once } from 'node:events';
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import test from 'node:test';

const helper = new URL('../scripts/check-qa-preview-health.sh', import.meta.url);

async function runHealthCheck(url, env = {}) {
  const child = spawn(helper.pathname, [url], {
    env: { ...process.env, ...env },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  let stdout = '';
  let stderr = '';
  child.stdout.setEncoding('utf8').on('data', chunk => { stdout += chunk; });
  child.stderr.setEncoding('utf8').on('data', chunk => { stderr += chunk; });
  const [code] = await once(child, 'close');
  return { code, stdout, stderr };
}

async function withServer(handler, callback) {
  const server = createServer(handler);
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const { port } = server.address();
  try {
    return await callback(`http://127.0.0.1:${port}`);
  } finally {
    server.closeAllConnections();
    server.close();
    await once(server, 'close');
  }
}

test('accepts a direct 200 response', async () => {
  await withServer((_request, response) => response.end('ready'), async baseUrl => {
    const result = await runHealthCheck(`${baseUrl}/portal-login.html`);
    assert.equal(result.code, 0, result.stderr);
    assert.match(result.stdout, /HTTP final 200/);
  });
});

for (const redirectStatus of [307, 302]) {
  test(`follows ${redirectStatus} and accepts the final 200 response`, async () => {
    await withServer((request, response) => {
      if (request.url === '/portal-login.html') {
        response.writeHead(redirectStatus, { location: '/login' }).end();
      } else {
        response.end('ready');
      }
    }, async baseUrl => {
      const result = await runHealthCheck(`${baseUrl}/portal-login.html`);
      assert.equal(result.code, 0, result.stderr);
      assert.match(result.stdout, /HTTP final 200/);
    });
  });
}

test('rejects a redirect whose final destination is 404', async () => {
  await withServer((request, response) => {
    if (request.url === '/portal-login.html') {
      response.writeHead(307, { location: '/missing' }).end();
    } else {
      response.writeHead(404).end('missing');
    }
  }, async baseUrl => {
    const result = await runHealthCheck(`${baseUrl}/portal-login.html`);
    assert.equal(result.code, 1);
    assert.match(result.stderr, /HTTP final 404/);
  });
});

test('rejects a final 5xx response', async () => {
  await withServer((_request, response) => {
    response.writeHead(503).end('unavailable');
  }, async baseUrl => {
    const result = await runHealthCheck(`${baseUrl}/portal-login.html`);
    assert.equal(result.code, 1);
    assert.match(result.stderr, /HTTP final 503/);
  });
});

test('rejects a redirect loop', async () => {
  await withServer((_request, response) => {
    response.writeHead(307, { location: '/loop' }).end();
  }, async baseUrl => {
    const result = await runHealthCheck(`${baseUrl}/loop`, { QA_HEALTH_MAX_REDIRECTS: '2' });
    assert.equal(result.code, 1);
    assert.match(result.stderr, /curl exit 47/);
  });
});

test('rejects a request timeout', async () => {
  await withServer(() => {}, async baseUrl => {
    const result = await runHealthCheck(`${baseUrl}/slow`, { QA_HEALTH_MAX_TIME: '0.1' });
    assert.equal(result.code, 1);
    assert.match(result.stderr, /curl exit 28/);
  });
});

test('rejects a connection failure', async () => {
  const server = createServer();
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const { port } = server.address();
  server.close();
  await once(server, 'close');

  const result = await runHealthCheck(`http://127.0.0.1:${port}/portal-login.html`);
  assert.equal(result.code, 1);
  assert.match(result.stderr, /curl exit 7/);
});

test('rejects an invalid URL', async () => {
  const result = await runHealthCheck('https://[invalid');
  assert.equal(result.code, 1);
  assert.match(result.stderr, /curl exit 3/);
});
