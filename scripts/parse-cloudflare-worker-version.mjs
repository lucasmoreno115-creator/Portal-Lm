import { parseLatestWorkerVersionId } from './lib/cloudflare-worker-version.mjs';

let response = '';
for await (const chunk of process.stdin) {
  response += chunk;
}

try {
  const payload = JSON.parse(response);
  process.stdout.write(`${parseLatestWorkerVersionId(payload)}\n`);
} catch (error) {
  // Do not echo the response: it may contain sensitive Cloudflare metadata.
  const message = error instanceof SyntaxError
    ? 'Cloudflare API response is not valid JSON.'
    : error.message;
  console.error(`Unable to resolve the Cloudflare Worker version: ${message}`);
  process.exitCode = 1;
}
