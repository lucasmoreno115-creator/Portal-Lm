import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';

const rootDir = process.cwd();
const adminPages = [
  'admin.html',
  'admin-command-center.html',
  'admin-student.html',
  'admin-anamneses.html',
  'admin-alerts.html',
  'admin-checkins.html',
  'admin-followup.html',
  'admin-nutrition-plan.html',
  'admin-students.html',
  'admin-weekly-plan.html'
];

async function read(relativePath) {
  return readFile(path.join(rootDir, relativePath), 'utf8');
}

test('admin-auth exposes the only shared admin auth header helper', async () => {
  const source = await read('admin-auth.js');

  assert.match(source, /function getAdminAuthHeaders\(extraHeaders, credentialOverride\)/);
  assert.match(source, /'Content-Type': 'application\/json'/);
  assert.match(source, /'x-admin-session': credential/);
  assert.doesNotMatch(source, /'x-admin-token': credential/);
  assert.match(source, /const getAdminHeaders = getAdminAuthHeaders/);
});

test('admin pages do not define local admin auth header helpers', async () => {
  for (const page of adminPages) {
    const source = await read(page);
    assert.doesNotMatch(source, /function getAdminAuthHeaders\(/, `${page} não deve definir helper local.`);
  }
});

test('admin pages with admin API fetches use the shared auth helper', async () => {
  for (const page of adminPages) {
    const source = await read(page);
    if (!source.includes('/api/admin/')) continue;

    assert.match(source, /window\.LMAdminAuth\.getAdminAuthHeaders\(/, `${page} deve usar helper compartilhado.`);
    assert.doesNotMatch(source, /headers\s*:\s*\{[^}]*['"]x-admin-session['"]/s, `${page} não deve montar x-admin-session manualmente.`);
    assert.doesNotMatch(source, /headers\s*:\s*\{[^}]*['"]x-admin-token['"]/s, `${page} não deve montar x-admin-token manualmente.`);
    assert.ok(!source.includes("'Authorization'"), `${page} não deve usar Authorization em rotas admin.`);
  }
});
