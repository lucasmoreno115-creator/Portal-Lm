import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('F3.4.1 exposes an authenticated, idempotent professional review command without lifecycle mutation', () => {
  const api = readFileSync(new URL('../workers/api.js', import.meta.url), 'utf8');
  assert.match(api, /\/api\\\/admin\\\/premium\\\/anamnesis/);
  assert.match(api, /ANAMNESIS_ANALYZED/);
  assert.match(api, /changed:false,unchanged:true/);
  const command = api.slice(api.indexOf('const analyzeAnamnesisMatch'), api.indexOf("if (url.pathname === '/api/admin/premium/workspace/pending-items'"));
  assert.doesNotMatch(command, /consultation_status\s*=/);
  assert.match(command, /type='ANALYZE_ANAMNESIS'/);
  assert.match(command, /related_entity_type='premium_anamnesis'/);
});

test('professional UI reads before marking and renders durable pending/analyzed states', () => {
  const ui = readFileSync(new URL('../admin-anamneses.html', import.meta.url), 'utf8');
  assert.match(ui, /Análise pendente/);
  assert.match(ui, /Anamnese analisada em/);
  assert.match(ui, /Marcar como analisada/);
  assert.match(ui, /api\/admin\/premium\/anamnesis\/\$\{encodeURIComponent/);
});

test('student submission creates the already-recognized pending type exactly through its unique related identity', () => {
  const api = readFileSync(new URL('../workers/api.js', import.meta.url), 'utf8');
  assert.match(api, /INSERT OR IGNORE INTO premium_pending_items/);
  assert.match(api, /`analyze-anamnesis:\$\{id\}`/);
  assert.match(api, /'premium_anamnesis'/);
});
