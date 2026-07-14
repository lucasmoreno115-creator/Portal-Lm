import test from 'node:test';
import assert from 'node:assert/strict';
import { canTransitionConsultationStatus, transitionConsultationStatus } from '../workers/premium/domain/consultation-status.js';
import { assertFollowupEntryType, assertProfessionalDecisionType } from '../workers/premium/domain/followup-entry.js';
import { assertPendingItemPriority, assertPendingItemStatus, assertPendingItemType } from '../workers/premium/domain/pending-item.js';

test('domínio do prontuário valida status, tipos e condutas oficiais', () => {
  assert.equal(canTransitionConsultationStatus('NEW', 'AWAITING_ANAMNESIS'), true);
  assert.equal(canTransitionConsultationStatus('ACTIVE', 'ENDED'), true);
  assert.throws(() => transitionConsultationStatus('NEW', 'ACTIVE'), /Invalid .* transition|INVALID/i);
  assert.equal(assertFollowupEntryType('PROFESSIONAL_DECISION'), 'PROFESSIONAL_DECISION');
  assert.equal(assertProfessionalDecisionType('KEEP_STRATEGY'), 'KEEP_STRATEGY');
  assert.equal(assertPendingItemType('ANALYZE_WEEKLY_FEEDBACK'), 'ANALYZE_WEEKLY_FEEDBACK');
  assert.equal(assertPendingItemStatus('OPEN'), 'OPEN');
  assert.equal(assertPendingItemPriority('HIGH'), 'HIGH');
  assert.throws(() => assertFollowupEntryType('CLINICAL_SCORE'));
});
