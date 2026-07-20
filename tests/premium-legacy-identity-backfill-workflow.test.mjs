import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const workflow = fs.readFileSync('.github/workflows/premium-legacy-identity-backfill.yml', 'utf8');

test('legacy identity backfill workflow is manual and production protected', () => {
  assert.match(workflow, /^name: Premium Legacy Identity Backfill/m);
  assert.match(workflow, /^\s+workflow_dispatch:/m);
  assert.doesNotMatch(workflow, /^\s+(push|pull_request|schedule):/m);
  assert.match(workflow, /environment: production/);
  assert.match(workflow, /timeout-minutes: 20/);
  assert.match(workflow, /CLOUDFLARE_D1_DATABASE_ID: \$\{\{ vars\.CLOUDFLARE_D1_DATABASE_ID \}\}/);
  assert.match(workflow, /CLOUDFLARE_ACCOUNT_ID: \$\{\{ secrets\.CLOUDFLARE_ACCOUNT_ID \}\}/);
  assert.match(workflow, /CLOUDFLARE_API_TOKEN: \$\{\{ secrets\.CLOUDFLARE_API_TOKEN \}\}/);
  assert.match(workflow, /BACKFILL_MODE: \$\{\{ inputs\.mode \}\}/);
  assert.match(workflow, /BACKFILL_BATCH_ID: \$\{\{ inputs\.batch_id \}\}/);
  const runLines = workflow.split('\n').filter((line) => /^\s+run:/.test(line));
  assert(runLines.every((line) => !line.includes('inputs.batch_id')));
  assert(runLines.every((line) => !line.includes('inputs.mode')));
  assert.doesNotMatch(workflow, /wrangler/i);
});
