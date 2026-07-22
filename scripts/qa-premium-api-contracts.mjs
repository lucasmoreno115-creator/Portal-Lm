#!/usr/bin/env node
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const workerPath = path.join(root, 'workers', 'api.js');
const publicRoot = path.join(root, 'public');
const failures = [];
const evidence = [];

function walk(dir) {
  if (!existsSync(dir)) return [];
  const files = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const child = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...walk(child));
    else files.push(child);
  }
  return files;
}

if (!existsSync(workerPath)) {
  failures.push({ scope: 'api-contracts', message: 'Worker principal ausente.', path: 'workers/api.js' });
} else {
  const worker = readFileSync(workerPath, 'utf8');
  const refs = new Map();
  const apiRegex = /["'`](\/api\/[A-Za-z0-9_\-./${}:[\]()]+)/g;
  for (const file of walk(publicRoot).filter((file) => /\.(?:html|js|mjs|ts)$/.test(file))) {
    const relative = path.relative(root, file).split(path.sep).join('/');
    if (/(?:project-lm|projeto-lm)/i.test(relative)) continue;
    const source = readFileSync(file, 'utf8');
    for (const match of source.matchAll(apiRegex)) {
      const route = match[1].split('?')[0];
      if (/^\/api\/project-lm(?:-2)?(?:\/|$)/.test(route)) continue;
      const stablePrefix = route.split('${')[0].replace(/\/$/, '');
      if (!refs.has(stablePrefix)) refs.set(stablePrefix, []);
      refs.get(stablePrefix).push(relative);
    }
  }

  const unresolved = [];
  for (const [prefix, files] of refs) {
    if (!worker.includes(prefix)) unresolved.push({ routePrefix: prefix, files: [...new Set(files)] });
  }

  if (unresolved.length) failures.push({ scope: 'api-contracts', message: 'Rotas Premium consumidas sem contrato localizado no Worker.', unresolved });
  else evidence.push({ scope: 'api-contracts', message: 'Rotas Premium consumidas possuem contrato localizado no Worker.', routeCount: refs.size });
  evidence.push({ scope: 'api-contracts', message: 'Worker monolítico auditado.', path: 'workers/api.js' });
}

const report = {
  audit: 'Premium API contracts',
  status: failures.length ? 'FAILED' : 'VALIDATED',
  generatedAt: new Date().toISOString(),
  failures,
  evidence,
};
console.log(JSON.stringify(report, null, 2));
process.exitCode = failures.length ? 1 : 0;
