import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { extractDeployMetadata } from '../scripts/extract-cloudflare-deploy-metadata.mjs';

const sha='e819152bded88defea3237e2d1c1b60b7a6abe21';
const worker='lm-system-api';

const line=(value)=>JSON.stringify(value);

test('extracts the deployed version_id from Wrangler structured output',()=>{
  const jsonl=[
    line({type:'wrangler-session',version:1}),
    line({type:'deploy',worker_name:worker,version_id:'11111111-2222-3333-4444-555555555555',targets:['https://lm-system-api.example.workers.dev']}),
  ].join('\n');
  assert.deepEqual(extractDeployMetadata(jsonl,{gitSha:sha,workerName:worker}),{
    schemaVersion:1,
    gitSha:sha,
    workerName:worker,
    versionId:'11111111-2222-3333-4444-555555555555',
    targets:['https://lm-system-api.example.workers.dev'],
  });
});

test('uses the last matching deploy event and ignores other workers',()=>{
  const jsonl=[
    line({type:'deploy',worker_name:worker,version_id:'old-version',targets:[]}),
    line({type:'deploy',worker_name:'another-worker',version_id:'other-version',targets:[]}),
    line({type:'deploy',worker_name:worker,version_id:'new-version',targets:[]}),
  ].join('\n');
  assert.equal(extractDeployMetadata(jsonl,{gitSha:sha,workerName:worker}).versionId,'new-version');
});

test('fails closed when Wrangler output is malformed or version_id is absent',()=>{
  assert.throws(()=>extractDeployMetadata('{bad json',{gitSha:sha,workerName:worker}),/invalid JSONL/);
  assert.throws(()=>extractDeployMetadata(line({type:'deploy',worker_name:worker}),{gitSha:sha,workerName:worker}),/missing version_id/);
  assert.throws(()=>extractDeployMetadata(line({type:'deploy',worker_name:'other'}),{gitSha:sha,workerName:worker}),/No deploy event/);
});

test('deploy workflow persists SHA-to-version metadata and staging consumes the matching successful deploy artifact',()=>{
  const deploy=fs.readFileSync('.github/workflows/cloudflare-deploy.yml','utf8');
  const staging=fs.readFileSync('.github/workflows/qa-lm-staging.yml','utf8');

  assert.match(deploy,/WRANGLER_OUTPUT_FILE/);
  assert.match(deploy,/extract-cloudflare-deploy-metadata\.mjs/);
  assert.match(deploy,/cloudflare-worker-version-\$\{\{ github\.sha \}\}/);
  assert.match(deploy,/worker-deploy-metadata\.json/);

  assert.match(staging,/actions:\s*read/);
  assert.match(staging,/cloudflare-deploy\.yml\/runs\?head_sha=\$\{EXPECTED_SHA\}/);
  assert.match(staging,/cloudflare-worker-version-\$\{EXPECTED_SHA\}/);
  assert.match(staging,/actions\/artifacts\/\$\{ARTIFACT_ID\}\/zip/);
  assert.match(staging,/m\.gitSha!==sha/);
  assert.match(staging,/SOURCE="Cloudflare deploy artifact"/);
  assert.doesNotMatch(staging,/resolve-cloudflare-worker-version-by-tag\.mjs/);
  assert.doesNotMatch(staging,/workers\/scripts\/\$\{CF_WORKER_NAME\}\/versions/);
});
