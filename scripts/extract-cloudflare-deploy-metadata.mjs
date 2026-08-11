#!/usr/bin/env node
import process from 'node:process';
import { pathToFileURL } from 'node:url';

export function extractDeployMetadata(commandOutput, { gitSha, workerName }) {
  const sha = String(gitSha || '').trim();
  const expectedWorker = String(workerName || '').trim();
  const output = String(commandOutput || '');
  if (!sha) throw new Error('Git SHA is required.');
  if (!expectedWorker) throw new Error('Worker name is required.');
  if (!output.trim()) throw new Error('Wrangler command output is required.');

  const versionMatches = [...output.matchAll(/^Current Version ID:\s*([0-9a-f-]{36})\s*$/gim)];
  if (versionMatches.length !== 1) {
    throw new Error(`Expected exactly one Current Version ID in Wrangler command output, got ${versionMatches.length}.`);
  }
  const versionId = versionMatches[0][1].trim();

  const targets = [...output.matchAll(/^\s*(https:\/\/[^\s]+\.workers\.dev)\s*$/gim)]
    .map((match) => match[1].trim());

  return {
    schemaVersion: 1,
    gitSha: sha,
    workerName: expectedWorker,
    versionId,
    targets: [...new Set(targets)],
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [gitSha, workerName] = process.argv.slice(2);
  let commandOutput = '';
  for await (const chunk of process.stdin) commandOutput += chunk;
  try {
    const metadata = extractDeployMetadata(commandOutput, { gitSha, workerName });
    process.stdout.write(`${JSON.stringify(metadata, null, 2)}\n`);
  } catch (error) {
    console.error(`Unable to extract Cloudflare deploy metadata: ${error.message}`);
    process.exitCode = 1;
  }
}
