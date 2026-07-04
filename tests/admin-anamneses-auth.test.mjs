import { readFileSync } from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';

test('admin anamneses sends both admin session and legacy token headers', () => {
  const source = readFileSync(new URL('../admin-anamneses.html', import.meta.url), 'utf8');

  assert.match(source, /window\.LMAdminAuth\.getAdminAuthHeaders\(\)/);
  assert.doesNotMatch(source, /function getAdminAuthHeaders\(/);
  assert.match(source, /fetchJson\('\/api\/admin\/anamneses'\)/);
});
