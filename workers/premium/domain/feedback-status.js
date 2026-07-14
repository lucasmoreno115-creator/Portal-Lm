import { InvalidPremiumStatusError, InvalidPremiumTransitionError } from './domain-errors.js';
import { createTransitionResult } from './transition-result.js';

export const FEEDBACK_STATUS_DOMAIN = 'weeklyFeedback';

export const FeedbackStatus = Object.freeze({
  NOT_AVAILABLE: 'NOT_AVAILABLE',
  AVAILABLE: 'AVAILABLE',
  RESPONDED: 'RESPONDED',
  ANALYZED: 'ANALYZED',
});

const validStatuses = new Set(Object.values(FeedbackStatus));

const allowedTransitions = Object.freeze({
  [FeedbackStatus.NOT_AVAILABLE]: Object.freeze([FeedbackStatus.AVAILABLE]),
  [FeedbackStatus.AVAILABLE]: Object.freeze([FeedbackStatus.RESPONDED]),
  [FeedbackStatus.RESPONDED]: Object.freeze([FeedbackStatus.ANALYZED]),
  [FeedbackStatus.ANALYZED]: Object.freeze([FeedbackStatus.AVAILABLE]),
});

export function assertFeedbackStatus(status) {
  if (!validStatuses.has(status)) {
    throw new InvalidPremiumStatusError(status, FEEDBACK_STATUS_DOMAIN);
  }
  return status;
}

export function canTransitionFeedbackStatus(from, to) {
  assertFeedbackStatus(from);
  assertFeedbackStatus(to);
  return from === to || allowedTransitions[from].includes(to);
}

export function transitionFeedbackStatus(from, to, options = {}) {
  if (!canTransitionFeedbackStatus(from, to)) {
    throw new InvalidPremiumTransitionError({ domain: FEEDBACK_STATUS_DOMAIN, from, to });
  }

  return createTransitionResult({
    domain: FEEDBACK_STATUS_DOMAIN,
    from,
    to,
    event: options.event ?? null,
    metadata: options.metadata ?? {},
  });
}

export function listFeedbackStatuses() {
  return Object.values(FeedbackStatus);
}

export const ANALYZED_COACH_STATUSES = Object.freeze(new Set(['REVIEWED', 'REPLIED', 'ANALYZED', 'ANALISADO', 'ANALISADA']));

export function normalizeCoachStatus(status) {
  return String(status || '').trim().toUpperCase();
}

export function isAnalyzedCoachStatus(status) {
  return ANALYZED_COACH_STATUSES.has(normalizeCoachStatus(status));
}

export function normalizeFeedbackStatus(status) {
  const normalized = normalizeCoachStatus(status);
  if (!normalized || normalized === 'PENDING') return FeedbackStatus.RESPONDED;
  if (ANALYZED_COACH_STATUSES.has(normalized)) return FeedbackStatus.ANALYZED;
  if (normalized === FeedbackStatus.NOT_AVAILABLE) return FeedbackStatus.NOT_AVAILABLE;
  if (normalized === FeedbackStatus.AVAILABLE) return FeedbackStatus.AVAILABLE;
  if (normalized === FeedbackStatus.RESPONDED) return FeedbackStatus.RESPONDED;
  return normalized;
}

export function isFeedbackAnalyzed(status) {
  return normalizeFeedbackStatus(status) === FeedbackStatus.ANALYZED;
}
