import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('repositories do Prontuário usam student_id e SQL parametrizado', () => {
  for (const file of ['d1-student-record-repository.js','d1-followup-entry-repository.js','d1-pending-item-repository.js']) {
    const src = readFileSync(new URL(`../workers/premium/repositories/${file}`, import.meta.url), 'utf8');
    assert.match(src, /student_id|studentId/);
    assert.match(src, /prepare\([^`'\)]*[`'][\s\S]*\?/);
    assert.doesNotMatch(src, /\$\{.*student/i);
  }
});

test('pendências automáticas são idempotentes por índice e busca de item aberto', () => {
  const migration = readFileSync(new URL('../migrations/0028_create_premium_pending_items.sql', import.meta.url), 'utf8');
  const repo = readFileSync(new URL('../workers/premium/repositories/d1-pending-item-repository.js', import.meta.url), 'utf8');
  assert.match(migration, /UNIQUE INDEX[\s\S]*COALESCE\(related_entity_type, ''\)[\s\S]*COALESCE\(related_entity_id, ''\)[\s\S]*WHERE status = 'OPEN'/);
  assert.match(repo, /INSERT OR IGNORE INTO premium_pending_items/);
  assert.match(repo, /status='OPEN'[\s\S]*LIMIT 1/);
});
