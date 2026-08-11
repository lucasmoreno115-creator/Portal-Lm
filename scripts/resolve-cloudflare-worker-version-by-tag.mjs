#!/usr/bin/env node
import process from 'node:process';
import { pathToFileURL } from 'node:url';

export function versionTag(item) {
  return String(
    item?.annotations?.['workers/tag']
    ?? item?.metadata?.annotations?.['workers/tag']
    ?? item?.metadata?.tag
    ?? item?.tag
    ?? ''
  ).trim();
}

export function resolveWorkerVersionByTag(payload, expectedTag) {
  const tag = String(expectedTag || '').trim();
  if (!tag) throw new Error('Expected Worker version tag is required.');
  if (!payload || payload.success !== true) throw new Error('Cloudflare API did not return success=true.');
  const items = Array.isArray(payload?.result?.items)
    ? payload.result.items
    : Array.isArray(payload?.result)
      ? payload.result
      : null;
  if (!items) throw new Error('Cloudflare API response is missing a versions array.');
  const matches = items.filter((item) => versionTag(item) === tag);
  if (matches.length === 0) return null;
  if (matches.length > 1) throw new Error(`Cloudflare returned multiple Worker versions for tag ${tag}.`);
  const id = String(matches[0]?.id || '').trim();
  if (!id) throw new Error(`Cloudflare Worker version tagged ${tag} has no id.`);
  return { id, tag };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  let response = '';
  for await (const chunk of process.stdin) response += chunk;
  try {
    const payload = JSON.parse(response);
    const resolved = resolveWorkerVersionByTag(payload, process.argv[2]);
    if (!resolved) process.exitCode = 2;
    else process.stdout.write(`${resolved.id}\n`);
  } catch (error) {
    const message = error instanceof SyntaxError ? 'Cloudflare API response is not valid JSON.' : error.message;
    console.error(`Unable to resolve Cloudflare Worker version by tag: ${message}`);
    process.exitCode = 1;
  }
}
