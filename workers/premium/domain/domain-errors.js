export class PremiumDomainError extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = 'PremiumDomainError';
    this.details = details;
  }
}

export class InvalidPremiumStatusError extends PremiumDomainError {
  constructor(status, domain) {
    super(`Invalid ${domain} status: ${status}`, { status, domain });
    this.name = 'InvalidPremiumStatusError';
  }
}

export class InvalidPremiumTransitionError extends PremiumDomainError {
  constructor({ domain, from, to }) {
    super(`Invalid ${domain} transition: ${from} -> ${to}`, { domain, from, to });
    this.name = 'InvalidPremiumTransitionError';
  }
}

export class InvalidPremiumEventError extends PremiumDomainError {
  constructor(event) {
    super(`Invalid Premium event: ${event}`, { event });
    this.name = 'InvalidPremiumEventError';
  }
}
