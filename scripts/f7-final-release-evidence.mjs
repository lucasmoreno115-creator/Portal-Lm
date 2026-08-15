#!/usr/bin/env node
import { appendFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';

export const REQUIRED_WORKFLOWS = Object.freeze([
  ['Project LM Quality Gate', 'project-lm-quality.yml'],
  ['Agente QA LM', 'qa-lm.yml'],
  ['Portal performance baseline', 'portal-performance-baseline.yml'],
]);
export const DEPLOY_WORKFLOW = Object.freeze(['Deploy Cloudflare Worker', 'cloudflare-deploy.yml']);

export function normalizeReleaseSha(value) {
  const sha = String(value || '').trim().toLowerCase();
  if (!/^[0-9a-f]{40}$/.test(sha)) throw new Error('release_sha must be a complete 40-character Git SHA');
  return sha;
}

export function selectSuccessfulRun(runs, sha, workflowName, requestedRunId = '') {
  const candidates = (runs || []).filter(run => run.head_sha?.toLowerCase() === sha &&
    (!requestedRunId || String(run.id) === String(requestedRunId)));
  const run = candidates.find(item => item.status === 'completed' && item.conclusion === 'success');
  if (!run) throw new Error(`${workflowName} is not completed + success for ${sha}`);
  return {
    workflow: workflowName, runId: run.id, headSha: run.head_sha, status: run.status,
    conclusion: run.conclusion, createdAt: run.created_at, updatedAt: run.updated_at,
    startedAt: run.run_started_at || null, htmlUrl: run.html_url,
  };
}

async function github(pathname, { token, repository, binary = false } = {}) {
  if (!token) throw new Error('GITHUB_TOKEN is required');
  if (!repository) throw new Error('GITHUB_REPOSITORY is required');
  const response = await fetch(`https://api.github.com/repos/${repository}${pathname}`, {
    headers: {
      authorization: `Bearer ${token}`,
      accept: binary ? 'application/octet-stream' : 'application/vnd.github+json',
      'x-github-api-version': '2022-11-28',
      'user-agent': 'portal-lm-final-release-evidence',
    },
    redirect: 'follow',
  });
  if (!response.ok) throw new Error(`GitHub API ${pathname} failed with HTTP ${response.status}`);
  return binary ? Buffer.from(await response.arrayBuffer()) : response.json();
}

async function runsFor(workflowFile, sha, context) {
  const query = new URLSearchParams({ head_sha: sha, per_page: '100' });
  return (await github(`/actions/workflows/${workflowFile}/runs?${query}`, context)).workflow_runs || [];
}

export function validateDeployMetadata(metadata, { sha, workerName }) {
  if (metadata?.schemaVersion !== 1) throw new Error('worker-deploy-metadata.json schemaVersion must be 1');
  if (String(metadata.gitSha).toLowerCase() !== sha) throw new Error('deploy artifact gitSha does not match release_sha');
  if (!String(metadata.workerName || '').trim()) throw new Error('deploy artifact workerName is missing');
  if (workerName && metadata.workerName !== workerName) throw new Error('deploy artifact workerName does not match CF_WORKER_NAME');
  if (!String(metadata.versionId || '').trim()) throw new Error('deploy artifact versionId is missing');
  return metadata;
}

export function buildVersionedTarget({ versionId, workerName, workersSubdomain }) {
  const id = String(versionId || '').trim();
  const worker = String(workerName || '').trim();
  const subdomain = String(workersSubdomain || '').trim();
  if (!id || !worker || !subdomain) throw new Error('Worker version ID, worker name, and CF_WORKERS_SUBDOMAIN are required');
  const host = `${id.slice(0, 8)}-${worker}.${subdomain}.workers.dev`;
  return `https://${host}`;
}

async function writeGithubOutput(values) {
  if (!process.env.GITHUB_OUTPUT) return;
  await appendFile(process.env.GITHUB_OUTPUT, Object.entries(values).map(([key, value]) => `${key}=${value}\n`).join(''));
}

export async function collectEvidence({ env = process.env } = {}) {
  const sha = normalizeReleaseSha(env.RELEASE_SHA);
  const context = { token: env.GITHUB_TOKEN, repository: env.GITHUB_REPOSITORY };
  const evidence = { schemaVersion: 1, releaseSha: sha, collectedAt: new Date().toISOString(), requiredRuns: [] };

  for (const [name, file] of REQUIRED_WORKFLOWS) {
    evidence.requiredRuns.push(selectSuccessfulRun(await runsFor(file, sha, context), sha, name));
  }
  const [deployName, deployFile] = DEPLOY_WORKFLOW;
  const deploy = selectSuccessfulRun(await runsFor(deployFile, sha, context), sha, deployName, env.DEPLOY_RUN_ID);
  evidence.deployRun = deploy;

  const artifactName = `cloudflare-worker-version-${sha}`;
  const artifacts = (await github(`/actions/runs/${deploy.runId}/artifacts?per_page=100`, context)).artifacts || [];
  const matches = artifacts.filter(item => item.name === artifactName && !item.expired);
  if (matches.length !== 1) throw new Error(`expected exactly one non-expired artifact ${artifactName}; found ${matches.length}`);

  const temp = process.env.RUNNER_TEMP || process.cwd();
  const artifactDirectory = path.join(temp, `f7-worker-metadata-${process.pid}`);
  const archive = path.join(temp, `f7-worker-metadata-${process.pid}.zip`);
  await mkdir(artifactDirectory, { recursive: true });
  await writeFile(archive, await github(`/actions/artifacts/${matches[0].id}/zip`, { ...context, binary: true }));
  execFileSync('unzip', ['-q', '-o', archive, '-d', artifactDirectory], { stdio: 'inherit' });
  const metadata = validateDeployMetadata(JSON.parse(await readFile(path.join(artifactDirectory, 'worker-deploy-metadata.json'), 'utf8')), {
    sha, workerName: env.CF_WORKER_NAME,
  });
  evidence.deployArtifact = { name: artifactName, artifactId: matches[0].id, ...metadata };
  evidence.runtimeTarget = buildVersionedTarget({
    versionId: metadata.versionId, workerName: metadata.workerName, workersSubdomain: env.CF_WORKERS_SUBDOMAIN,
  });
  evidence.allowRedeploySameSha = env.ALLOW_REDEPLOY_SAME_SHA === 'true';

  const outputDirectory = env.EVIDENCE_DIRECTORY || path.join(process.cwd(), 'artifacts', 'f7-final-release-evidence');
  await mkdir(outputDirectory, { recursive: true });
  await writeFile(path.join(outputDirectory, 'github-and-deploy-evidence.json'), `${JSON.stringify(evidence, null, 2)}\n`);
  await writeGithubOutput({
    deploy_run_id: deploy.runId, worker_name: metadata.workerName, worker_version_id: metadata.versionId,
    runtime_target: evidence.runtimeTarget, evidence_file: path.join(outputDirectory, 'github-and-deploy-evidence.json'),
  });
  return evidence;
}

async function main() {
  const evidence = await collectEvidence();
  console.log(JSON.stringify({ releaseSha: evidence.releaseSha, deployRunId: evidence.deployRun.runId,
    workerVersionId: evidence.deployArtifact.versionId, runtimeTarget: evidence.runtimeTarget }, null, 2));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(error => { console.error(`FINAL_RELEASE_BLOCKER: ${error.message}`); process.exitCode = 1; });
}
