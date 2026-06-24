import { access, readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';

const rootDir = process.cwd();
const docPath = path.join(rootDir, 'docs/v4-admin-flow-consolidation.md');

async function readDoc() {
  await assert.doesNotReject(access(docPath));
  return readFile(docPath, 'utf8');
}

test('documento V4-10 de consolidação administrativa existe', async () => {
  const doc = await readDoc();
  assert.match(doc, /# V4-10 Admin Flow Consolidation/);
});

test('documento contém seções de classificação administrativa', async () => {
  const doc = await readDoc();
  assert.match(doc, /### CORE/);
  assert.match(doc, /### AUXILIARY/);
  assert.match(doc, /### LEGACY_CANDIDATE/);
});

test('fluxo oficial administrativo está documentado', async () => {
  const doc = await readDoc();
  assert.match(doc, /Admin Login\s*↓\s*Command Center\s*↓\s*Student 360\s*↓\s*Cadastro de Aluno/);
});

test('telas administrativas protegidas estão documentadas', async () => {
  const doc = await readDoc();
  assert.match(doc, /## Protected Administrative Screens/);
  for (const screen of ['admin.html', 'admin-login.html', 'admin-command-center.html', 'admin-student.html', 'admin-students.html']) {
    assert.ok(doc.includes('- `' + screen + '`'), `${screen} deve estar listado como tela protegida.`);
  }
});

test('matriz de consolidação existe', async () => {
  const doc = await readDoc();
  assert.match(doc, /## Matriz de consolidação/);
  assert.match(doc, /\| Tela \| Categoria \| Pode ser absorvida por \| Justificativa \|/);
});
