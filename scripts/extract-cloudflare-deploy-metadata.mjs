#!/usr/bin/env node
import fs from 'node:fs';
import process from 'node:process';
import { pathToFileURL } from 'node:url';

export function extractDeployMetadata(jsonl, { gitSha, workerName }) {
  const sha = String(gitSha || '').trim();
  const expectedWorker = String(workerName || '').trim();
  if (!sha) throw new Error('Git SHA is required.');
  if (!expectedWorker) throw new Error('Worker name is required.');

  const entries = String(jsonl || '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      try { return JSON.parse(line); }
      catch { throw new Error('WRANGLER_OUTPUT_FILE contains invalid JSONL.'); }
    });

  const deploys = entries.filter((entry) => entry?.type === 'deploy' && entry?.worker_name === expectedWorker);
  if (deploys.length === 0) throw new Error(`No deploy event found for Worker ${expectedWorker}.`);

  const deploy = deploys.at(-1);
  const versionId = String(deploy?.version_id || '').trim();
  if (!versionId) throw new Error('Cloudflare deploy event is missing version_id.');

  const targets = Array.isArray(deploy?.targets)
    ? deploy.targets.map((target) => String(target || '').trim()).filter(Boolean)
    : [];

  return {
    schemaVersion: 1,
    gitSha: sha,
    workerName: expectedWorker,
    versionId,
    targets,
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [outputFile, gitSha, workerName] = process.argv.slice(2);
  try {
    if (!outputFile) throw new Error('WRANGLER_OUTPUT_FILE path is required.');
    const metadata = extractDeployMetadata(fs.readFileSync(outputFile, 'utf8'), { gitSha, workerName });
    process.stdout.write(`${JSON.stringify(metadata, null, 2)}\n`);
  } catch (error) {
    console.error(`Unable to extract Cloudflare deploy metadata: ${error.message}`);
    process.exitCode = 1;
  }
}
