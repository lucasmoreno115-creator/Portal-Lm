import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFile, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

const criticalFiles = [
  'assets/js/project-lm-2-app.js',
  'assets/js/project-lm-engine-services.js',
  'assets/css/project-lm-2.css',
  'assets/js/project-lm-runtime/runtime-manifest.json',
  'project-lm-2.html',
];

async function sha256(filePath) {
  const content = await readFile(filePath);
  return createHash('sha256').update(content).digest('hex');
}

test('Pages artifact preserves public Project LM runtime files and legacy portal entrypoints', async () => {
  await execFileAsync('node', ['scripts/prepare-pages-artifact.mjs'], { cwd: process.cwd() });

  for (const relativePath of criticalFiles) {
    const publicPath = join(process.cwd(), 'public', relativePath);
    const artifactPath = join(process.cwd(), 'github-pages-artifact', relativePath);
    assert.equal(await sha256(artifactPath), await sha256(publicPath), `${relativePath} must match public/ exactly`);
  }

  for (const relativePath of ['portal-login.html', 'portal.html']) {
    const artifactPath = join(process.cwd(), 'github-pages-artifact', relativePath);
    assert.equal(existsSync(artifactPath), true, `${relativePath} must exist in artifact`);
    assert.equal((await stat(artifactPath)).isFile(), true, `${relativePath} must be a file`);
  }
});
