import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeProgressionInput, presentProgression } from '../workers/premium/progression-contract.js';

test('F4.1 canonical adapter prioritizes recommendation and preserves public shape', () => {
  const input = normalizeProgressionInput({ exercise: 'Supino', targetZone: '8–10', loadUsed: 80.5, repsDone: 10, executionQuality: 'Sim', recommendation: 'Subir carga', decision: 'Default incorreto' });
  assert.deepEqual(input, { ok: true, data: { exercise: 'Supino', targetZone: '8–10', loadUsed: 80.5, repsDone: 10, executionQuality: 'Sim', recommendation: 'Subir carga' } });
  const output = presentProgression({ id: '1', exercise: 'Supino', target_zone: '8–10', load_used: 80.5, reps_done: 10, execution_quality: 'Sim', decision: 'Subir carga', created_at: 'now' });
  assert.deepEqual(Object.fromEntries(['exercise', 'targetZone', 'loadUsed', 'repsDone', 'executionQuality', 'recommendation', 'created_at'].map(key => [key, output[key]])), {
    exercise: 'Supino', targetZone: '8–10', loadUsed: 80.5, repsDone: 10, executionQuality: 'Sim', recommendation: 'Subir carga', created_at: 'now',
  });
  assert.deepEqual({ id: output.id, rir: output.rir }, { id: '1', rir: null });
  for (const privateOrRaw of ['student_email', 'student_id', 'target_zone', 'load_used', 'reps_done', 'execution_quality', 'decision']) assert.equal(privateOrRaw in output, false);
});
