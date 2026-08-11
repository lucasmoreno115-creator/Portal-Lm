import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { extractDeployMetadata } from '../scripts/extract-cloudflare-deploy-metadata.mjs';

const sha='e819152bded88defea3237e2d1c1b60b7a6abe21';
const worker='lm-system-api';

const output=`Uploaded ${worker} (3.70 sec)\nDeployed ${worker} triggers (0.50 sec)\n  https://${worker}.example.workers.dev\nCurrent Version ID: 11111111-2222-3333-4444-555555555555\n`;

test('extracts version_id from wrangler-action command-output',()=>{
  assert.deepEqual(extractDeployMetadata(output,{gitSha:sha,workerName:worker}),{
    schemaVersion:1,
    gitSha:sha,
    workerName:worker,
    versionId:'11111111-2222-3333-4444-555555555555',
    targets:[`https://${worker}.example.workers.dev`],
  });
});

test('fails closed when command output is missing or has ambiguous version IDs',()=>{
  assert.throws(()=>extractDeployMetadata('',{gitSha:sha,workerName:worker}),/command output is required/);
  assert.throws(()=>extractDeployMetadata(`Uploaded ${worker}\n`,{gitSha:sha,workerName:worker}),/got 0/);
  assert.throws(()=>extractDeployMetadata(`${output}Current Version ID: aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee\n`,{gitSha:sha,workerName:worker}),/got 2/);
});

test('deploy workflow consumes wrangler-action command-output and persists SHA-to-version metadata',()=>{
  const deploy=fs.readFileSync('.github/workflows/cloudflare-deploy.yml','utf8');
  const staging=fs.readFileSync('.github/workflows/qa-lm-staging.yml','utf8');

  assert.match(deploy,/wranglerVersion:\s*4\.65\.0/);
  assert.match(deploy,/command:\s*deploy\s*$/m);
  assert.doesNotMatch(deploy,/--preview-alias/);
  assert.doesNotMatch(deploy,/--tag/);
  assert.doesNotMatch(deploy,/--message/);
  assert.match(deploy,/steps\.deploy-worker\.outputs\.command-output/);
  assert.match(deploy,/WRANGLER_COMMAND_OUTPUT/);
  assert.doesNotMatch(deploy,/WRANGLER_OUTPUT_FILE/);
  assert.match(deploy,/extract-cloudflare-deploy-metadata\.mjs/);
  assert.match(deploy,/cloudflare-worker-version-\$\{\{ github\.sha \}\}/);
  assert.match(deploy,/worker-deploy-metadata\.json/);

  assert.match(staging,/actions:\s*read/);
  assert.match(staging,/cloudflare-deploy\.yml\/runs\?head_sha=\$\{EXPECTED_SHA\}/);
  assert.match(staging,/cloudflare-worker-version-\$\{EXPECTED_SHA\}/);
  assert.match(staging,/actions\/artifacts\/\$\{ARTIFACT_ID\}\/zip/);
  assert.match(staging,/m\.gitSha!==sha/);
  assert.match(staging,/SOURCE="Cloudflare deploy artifact"/);
});
