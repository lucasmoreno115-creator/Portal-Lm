import test from 'node:test';
import assert from 'node:assert/strict';
import { isFeedbackAnalyzed, normalizeFeedbackStatus, FeedbackStatus } from '../workers/premium/domain/feedback-status.js';

test('normaliza status legados analisados', () => {
  assert.equal(isFeedbackAnalyzed('reviewed'), true);
  assert.equal(isFeedbackAnalyzed('ANALISADO'), true);
  assert.equal(normalizeFeedbackStatus('pending'), FeedbackStatus.RESPONDED);
});
