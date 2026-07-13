import { InvalidPremiumStatusError, InvalidPremiumTransitionError } from './domain-errors.js';
import { createTransitionResult } from './transition-result.js';

export const CONSULTATION_STATUS_DOMAIN = 'consultation';

export const ConsultationStatus = Object.freeze({
  NEW: 'NEW',
  AWAITING_ANAMNESIS: 'AWAITING_ANAMNESIS',
  UNDER_REVIEW: 'UNDER_REVIEW',
  ACTIVE: 'ACTIVE',
  PAUSED: 'PAUSED',
  ENDED: 'ENDED',
});

const validStatuses = new Set(Object.values(ConsultationStatus));

const allowedTransitions = Object.freeze({
  [ConsultationStatus.NEW]: Object.freeze([ConsultationStatus.AWAITING_ANAMNESIS]),
  [ConsultationStatus.AWAITING_ANAMNESIS]: Object.freeze([ConsultationStatus.UNDER_REVIEW]),
  [ConsultationStatus.UNDER_REVIEW]: Object.freeze([ConsultationStatus.ACTIVE]),
  [ConsultationStatus.ACTIVE]: Object.freeze([ConsultationStatus.PAUSED, ConsultationStatus.ENDED]),
  [ConsultationStatus.PAUSED]: Object.freeze([ConsultationStatus.ACTIVE, ConsultationStatus.ENDED]),
  [ConsultationStatus.ENDED]: Object.freeze([]),
});

export function assertConsultationStatus(status) {
  if (!validStatuses.has(status)) {
    throw new InvalidPremiumStatusError(status, CONSULTATION_STATUS_DOMAIN);
  }
  return status;
}

export function canTransitionConsultationStatus(from, to) {
  assertConsultationStatus(from);
  assertConsultationStatus(to);
  return from === to || allowedTransitions[from].includes(to);
}

export function transitionConsultationStatus(from, to, options = {}) {
  if (!canTransitionConsultationStatus(from, to)) {
    throw new InvalidPremiumTransitionError({ domain: CONSULTATION_STATUS_DOMAIN, from, to });
  }

  return createTransitionResult({
    domain: CONSULTATION_STATUS_DOMAIN,
    from,
    to,
    event: options.event ?? null,
    metadata: options.metadata ?? {},
  });
}

export function listConsultationStatuses() {
  return Object.values(ConsultationStatus);
}
