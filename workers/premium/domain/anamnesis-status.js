import { InvalidPremiumStatusError, InvalidPremiumTransitionError } from './domain-errors.js';
import { createTransitionResult } from './transition-result.js';

export const ANAMNESIS_STATUS_DOMAIN = 'anamnesis';

export const AnamnesisStatus = Object.freeze({
  NOT_SENT: 'NOT_SENT',
  SENT: 'SENT',
  RESPONDED: 'RESPONDED',
  ANALYZED: 'ANALYZED',
});

const validStatuses = new Set(Object.values(AnamnesisStatus));

const allowedTransitions = Object.freeze({
  [AnamnesisStatus.NOT_SENT]: Object.freeze([AnamnesisStatus.SENT]),
  [AnamnesisStatus.SENT]: Object.freeze([AnamnesisStatus.RESPONDED]),
  [AnamnesisStatus.RESPONDED]: Object.freeze([AnamnesisStatus.ANALYZED]),
  [AnamnesisStatus.ANALYZED]: Object.freeze([]),
});

export function assertAnamnesisStatus(status) {
  if (!validStatuses.has(status)) {
    throw new InvalidPremiumStatusError(status, ANAMNESIS_STATUS_DOMAIN);
  }
  return status;
}

export function canTransitionAnamnesisStatus(from, to) {
  assertAnamnesisStatus(from);
  assertAnamnesisStatus(to);
  return from === to || allowedTransitions[from].includes(to);
}

export function transitionAnamnesisStatus(from, to, options = {}) {
  if (!canTransitionAnamnesisStatus(from, to)) {
    throw new InvalidPremiumTransitionError({ domain: ANAMNESIS_STATUS_DOMAIN, from, to });
  }

  return createTransitionResult({
    domain: ANAMNESIS_STATUS_DOMAIN,
    from,
    to,
    event: options.event ?? null,
    metadata: options.metadata ?? {},
  });
}

export function listAnamnesisStatuses() {
  return Object.values(AnamnesisStatus);
}
