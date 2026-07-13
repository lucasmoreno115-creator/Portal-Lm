import assert from 'node:assert/strict';
import test from 'node:test';

import {
  AnamnesisStatus,
  ConsultationStatus,
  FeedbackStatus,
  InvalidPremiumEventError,
  InvalidPremiumStatusError,
  InvalidPremiumTransitionError,
  PremiumEvent,
  assertPremiumEvent,
  isPremiumEvent,
  listPremiumEvents,
  transitionAnamnesisStatus,
  transitionConsultationStatus,
  transitionFeedbackStatus,
} from '../workers/premium/domain/index.js';
import { createPremiumEventService } from '../workers/premium/services/index.js';

test('consultation status allows official forward transitions', () => {
  const result = transitionConsultationStatus(ConsultationStatus.NEW, ConsultationStatus.AWAITING_ANAMNESIS);

  assert.equal(result.ok, true);
  assert.equal(result.domain, 'consultation');
  assert.equal(result.from, ConsultationStatus.NEW);
  assert.equal(result.to, ConsultationStatus.AWAITING_ANAMNESIS);
  assert.equal(result.changed, true);
});

test('consultation status rejects invalid regressions', () => {
  assert.throws(
    () => transitionConsultationStatus(ConsultationStatus.ACTIVE, ConsultationStatus.NEW),
    InvalidPremiumTransitionError,
  );
});

test('anamnesis status follows the official lifecycle', () => {
  assert.equal(transitionAnamnesisStatus(AnamnesisStatus.NOT_SENT, AnamnesisStatus.SENT).to, AnamnesisStatus.SENT);
  assert.equal(transitionAnamnesisStatus(AnamnesisStatus.SENT, AnamnesisStatus.RESPONDED).to, AnamnesisStatus.RESPONDED);
  assert.equal(transitionAnamnesisStatus(AnamnesisStatus.RESPONDED, AnamnesisStatus.ANALYZED).to, AnamnesisStatus.ANALYZED);
});

test('feedback status follows the weekly feedback lifecycle', () => {
  assert.equal(transitionFeedbackStatus(FeedbackStatus.NOT_AVAILABLE, FeedbackStatus.AVAILABLE).to, FeedbackStatus.AVAILABLE);
  assert.equal(transitionFeedbackStatus(FeedbackStatus.AVAILABLE, FeedbackStatus.RESPONDED).to, FeedbackStatus.RESPONDED);
  assert.equal(transitionFeedbackStatus(FeedbackStatus.RESPONDED, FeedbackStatus.ANALYZED).to, FeedbackStatus.ANALYZED);
});

test('invalid statuses throw domain errors', () => {
  assert.throws(() => transitionConsultationStatus('UNKNOWN', ConsultationStatus.NEW), InvalidPremiumStatusError);
  assert.throws(() => transitionAnamnesisStatus(AnamnesisStatus.SENT, 'DONE'), InvalidPremiumStatusError);
  assert.throws(() => transitionFeedbackStatus('OPEN', FeedbackStatus.AVAILABLE), InvalidPremiumStatusError);
});

test('premium events catalog validates official Premium events only', () => {
  assert.equal(assertPremiumEvent(PremiumEvent.ANAMNESIS_SENT), PremiumEvent.ANAMNESIS_SENT);
  assert.equal(isPremiumEvent(PremiumEvent.PLAN_UPDATED), true);
  assert.equal(listPremiumEvents().includes(PremiumEvent.CONSULTATION_ENDED), true);
  assert.throws(() => assertPremiumEvent('PROJECT_LM_WEEK_UNLOCKED'), InvalidPremiumEventError);
});

test('premium event service validates and can record without persistence adapter', async () => {
  const service = createPremiumEventService();
  const result = await service.record(PremiumEvent.FEEDBACK_RECEIVED, { studentId: 'student-1' });

  assert.deepEqual(result, {
    event: PremiumEvent.FEEDBACK_RECEIVED,
    payload: { studentId: 'student-1' },
    persisted: false,
  });
});
