import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { resolveWorkerVersionByTag, versionTag } from '../scripts/resolve-cloudflare-worker-version-by-tag.mjs';

const sha = '86090baf2060ec4c40e33c9ad76d4221bb689418';

test('reads workers/tag from current and legacy-compatible version shapes', () => {
  assert.equal(versionTag({ annotations: { 'workers/tag': sha } }), sha);
  assert.equal(versionTag({ metadata: { annotations: { 'workers/tag': sha } } }), sha);
  assert.equal(versionTag({ metadata: { tag: sha } }), sha);
});

test('resolves exactly one Worker version by SHA tag instead of latest position', () => {
  const payload = { success: true, result: { items: [
    { id: 'newer-unrelated', metadata: { annotations: { 'workers/tag': 'other-sha' } } },
    { id: 'version-for-sha', metadata: { annotations: { 'workers/tag': sha } } },
  ] } };
  assert.deepEqual(resolveWorkerVersionByTag(payload, sha), { id: 'version-for-sha', tag: sha });
});

test('returns null while the expected SHA version has not been published', () => {
  const payload = { success: true, result: { items: [{ id: 'old', metadata: { tag: 'old-sha' } }] } };
  assert.equal(resolveWorkerVersionByTag(payload, sha), null);
});

test('fails closed on ambiguous tag or malformed API contract', () => {
  assert.throws(() => resolveWorkerVersionByTag({ success: true, result: { items: [
    { id: 'a', tag: sha }, { id: 'b', tag: sha },
  ] } }, sha), /multiple Worker versions/);
  assert.throws(() => resolveWorkerVersionByTag({ success: false }, sha), /success=true/);
  assert.throws(() => resolveWorkerVersionByTag({ success: true, result: {} }, sha), /versions array/);
});

test('staging workflow polls Cloudflare by exact checkout tag and uses the returned version prefix', () => {
  const workflow = fs.readFileSync('.github/workflows/qa-lm-staging.yml', 'utf8');
  assert.match(workflow, /resolve-cloudflare-worker-version-by-tag\.mjs "\$EXPECTED_SHA"/);
  assert.match(workflow, /VERSION_PREFIX="\$\{VERSION_ID:0:8\}"/);
  assert.match(workflow, /SOURCE="Cloudflare version tag match"/);
  assert.doesNotMatch(workflow, /SOURCE="Cloudflare SHA preview alias"/);
  assert.doesNotMatch(workflow, /BASE_URL="https:\/\/sha-\$\{EXPECTED_SHA\}/);
});
