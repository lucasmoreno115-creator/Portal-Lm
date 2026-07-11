#!/usr/bin/env node
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { buildRuntime, listFilesRecursive, PUBLIC_ROOT } from './project-lm-runtime-lib.mjs';

try {
  const tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'project-lm-runtime-'));
  const tmpRuntime = path.join(tmpRoot, 'project-lm-runtime');
  await buildRuntime({ destinationRoot: tmpRuntime, generatedAt: 'CHECK_STABLE_TIMESTAMP' });

  const currentFiles = await listFilesRecursive(PUBLIC_ROOT);
  const generatedFiles = await listFilesRecursive(tmpRuntime);
  const allFiles = [...new Set([...currentFiles, ...generatedFiles])].sort();
  const divergent = [];

  for (const file of allFiles) {
    const currentPath = path.join(PUBLIC_ROOT, file);
    const generatedPath = path.join(tmpRuntime, file);
    const [current, generated] = await Promise.all([
      fs.readFile(currentPath).catch(() => null),
      fs.readFile(generatedPath).catch(() => null),
    ]);
    if (file === 'runtime-manifest.json' && current && generated) {
      const currentManifest = JSON.parse(current.toString('utf8'));
      const generatedManifest = JSON.parse(generated.toString('utf8'));
      currentManifest.generated_at = 'CHECK_STABLE_TIMESTAMP';
      generatedManifest.generated_at = 'CHECK_STABLE_TIMESTAMP';
      generatedManifest.public_root = currentManifest.public_root;
      generatedManifest.files = generatedManifest.files.map((entry) => ({
        ...entry,
        public: `${PUBLIC_ROOT}/${entry.source.replace('src/projeto-lm/', '')}`,
      }));
      if (JSON.stringify(currentManifest) !== JSON.stringify(generatedManifest)) divergent.push(file);
    } else if (!current || !generated || !current.equals(generated)) {
      divergent.push(file);
    }
  }

  await fs.rm(tmpRoot, { recursive: true, force: true });
  if (divergent.length) {
    console.error(`Runtime desatualizado:\n\n- ${divergent.join('\n- ')}`);
    process.exitCode = 1;
  } else {
    console.log('Project LM runtime is up to date.');
  }
} catch (error) {
  console.error(error.stack || error.message);
  process.exitCode = 1;
}
