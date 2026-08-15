import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  REQUIRED_MAIN_WORKFLOWS,
  loadDeployMetadata,
  selectDeployArtifact,
  validateHistoricalCi,
} from '../scripts/f7-final-release-evidence.mjs';

const sha = '100bdbaf3aa8ebcfd47ec153a29434f88dede93f';
const success = (id, name) => ({ id, name, head_sha: sha, status: 'completed', conclusion: 'success' });
const successfulJobs = () => [
  success(201, 'Runtime sync and tests'),
  success(202, 'Deploy production Worker and assets'),
];
const workerName = 'lm-system-api';
const validMetadata = { schemaVersion: 1, gitSha: sha, workerName, versionId: 'version-123' };

async function withMetadataFile(metadata, callback) {
  const directory = await mkdtemp(path.join(tmpdir(), 'f7-deploy-metadata-'));
  const metadataFile = path.join(directory, 'worker-deploy-metadata.json');
  if (metadata !== undefined) {
    await writeFile(metadataFile, typeof metadata === 'string' ? metadata : JSON.stringify(metadata));
  }
  try {
    return await callback(metadataFile);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

test('valid main release SHA validates without PR-only quality or dispatch-only performance runs', () => {
  assert.deepEqual(REQUIRED_MAIN_WORKFLOWS, [['Agente QA LM', 'qa-lm.yml']]);
  const evidence = validateHistoricalCi({
    qaRuns: [success(101, 'Agente QA LM')],
    deployRuns: [success(102, 'Deploy Cloudflare Worker')],
    deployJobs: successfulJobs(),
    sha,
  });
  assert.equal(evidence.status, 'VALIDATED');
  assert.equal(evidence.deployJobs.length, 2);
});

test('missing Agente QA LM blocks historical CI', () => {
  assert.throws(() => validateHistoricalCi({ qaRuns: [], deployRuns: [success(102)], deployJobs: successfulJobs(), sha }), /Agente QA LM is not completed \+ success/);
});

test('failed deploy workflow blocks historical CI', () => {
  assert.throws(() => validateHistoricalCi({ qaRuns: [success(101)], deployRuns: [{ ...success(102), conclusion: 'failure' }], deployJobs: successfulJobs(), sha }), /Deploy Cloudflare Worker is not completed \+ success/);
});

test('valid downloaded artifact metadata is validated', async () => {
  const artifact = selectDeployArtifact([{ id: 301, name: `cloudflare-worker-version-${sha}`, expired: false }], `cloudflare-worker-version-${sha}`);
  assert.equal(artifact.id, 301);
  const metadata = await withMetadataFile(validMetadata, file => loadDeployMetadata(file, { sha, workerName }));
  assert.deepEqual(metadata, validMetadata);
});

test('expired deploy artifact blocks validation', () => {
  assert.throws(
    () => selectDeployArtifact([{ id: 301, name: `cloudflare-worker-version-${sha}`, expired: true }], `cloudflare-worker-version-${sha}`),
    /artifact .* is expired/,
  );
});

for (const [description, metadata, message] of [
  ['divergent metadata gitSha', { ...validMetadata, gitSha: 'a'.repeat(40) }, /gitSha does not match/],
  ['divergent metadata workerName', { ...validMetadata, workerName: 'another-worker' }, /workerName does not match/],
  ['missing metadata versionId', { ...validMetadata, versionId: '' }, /versionId is missing/],
]) {
  test(`${description} blocks validation`, async () => {
    await assert.rejects(
      withMetadataFile(metadata, file => loadDeployMetadata(file, { sha, workerName })),
      message,
    );
  });
}

test('downloaded artifact without worker-deploy-metadata.json blocks validation', async () => {
  await assert.rejects(
    withMetadataFile(undefined, file => loadDeployMetadata(file, { sha, workerName })),
    /worker-deploy-metadata\.json is missing/,
  );
});

for (const name of ['Runtime sync and tests', 'Deploy production Worker and assets']) {
  test(`failed ${name} job blocks historical CI`, () => {
    const jobs = successfulJobs().map(job => job.name === name ? { ...job, conclusion: 'failure' } : job);
    assert.throws(() => validateHistoricalCi({ qaRuns: [success(101)], deployRuns: [success(102)], deployJobs: jobs, sha }), new RegExp(`${name} job is not completed \\+ success`));
  });
}

test('F7 preserves all final gates and only finalizes equivalence after browser smoke', async () => {
  const workflow = await readFile(fileURLToPath(new URL('../.github/workflows/f7-final-release-evidence.yml', import.meta.url)), 'utf8');
  for (const command of [
    'npm test', 'npm run check:project-lm-runtime', 'npm run db:expected',
    'npm run qa:lm:security-closure', 'npm run qa:lm:stability-closure',
    'npm run qa:lm:student-ux-audit', 'npm run baseline:check',
    'npm run performance:portal:smoke', 'npm run qa:lm:sprint7', 'npm run db:audit:staging',
  ]) assert.ok(workflow.includes(command), command);
  assert.ok(workflow.indexOf('npm run performance:portal:smoke') < workflow.indexOf('--finalize-release-gates'));
  assert.match(workflow, /uses: actions\/download-artifact@v4/);
  assert.match(workflow, /run-id: \$\{\{ steps\.deploy-artifact\.outputs\.deploy_run_id \}\}/);
  assert.doesNotMatch(workflow, /actions\/artifacts\/.*\/zip/);
  const collector = await readFile(fileURLToPath(new URL('../scripts/f7-final-release-evidence.mjs', import.meta.url)), 'utf8');
  assert.match(collector, /evidence\.deployMetadata = 'VALIDATED'/);
  assert.doesNotMatch(collector, /actions\/artifacts\/.*\/zip/);
  assert.doesNotMatch(collector, /arrayBuffer\s*\(/);
});
