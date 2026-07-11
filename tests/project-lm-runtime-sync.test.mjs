import test from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { parseRelativeImports, PUBLIC_ROOT, SOURCE_ROOT, validateRuntime } from '../scripts/project-lm-runtime-lib.mjs';

function stripGeneratedHeader(contents) {
  return contents.replace(/^\/\/ AUTO-GENERATED FROM src\/projeto-lm — DO NOT EDIT DIRECTLY\n/, '');
}

test('Project LM public runtime manifest matches source files and checksums', async () => {
  const manifest = await validateRuntime(PUBLIC_ROOT);
  assert.equal(manifest.source_root, SOURCE_ROOT);
  assert.ok(manifest.files.length > 1, 'manifest must validate every runtime file, not only exercises.json');

  const manifestSources = manifest.files.map((file) => file.source);
  assert.ok(manifestSources.includes('src/projeto-lm/engines/training/exercises.json'));

  for (const file of manifest.files) {
    const source = await fs.readFile(file.source);
    const publicFile = await fs.readFile(file.public, path.extname(file.public) === '.js' ? 'utf8' : undefined);
    const publicComparable = path.extname(file.public) === '.js' ? Buffer.from(stripGeneratedHeader(publicFile)) : publicFile;
    assert.deepEqual(publicComparable, source, `${file.public} must be generated from ${file.source}`);
    assert.equal(crypto.createHash('sha256').update(source).digest('hex'), file.sha256);
  }
});

test('Project LM browser bridge imports only public runtime modules', async () => {
  const bridge = await fs.readFile('public/assets/js/project-lm-engine-services.js', 'utf8');
  assert.match(bridge, /\.\/project-lm-runtime\/services\/generateStudentWorkoutPlan\.js/);
  assert.doesNotMatch(bridge, /src\/projeto-lm/);
});

test('Project LM public runtime has no imports that reference source tree', async () => {
  const manifest = JSON.parse(await fs.readFile('public/assets/js/project-lm-runtime/runtime-manifest.json', 'utf8'));
  for (const file of manifest.files.filter((entry) => entry.public.endsWith('.js'))) {
    const contents = await fs.readFile(file.public, 'utf8');
    for (const specifier of parseRelativeImports(contents)) {
      assert.doesNotMatch(specifier, /src\/projeto-lm|^\/src\//, `${file.public} has invalid import ${specifier}`);
    }
  }
});
