import { createPremiumUseCase } from './create-use-case.js';

export function createSendAnamnesisLinkUseCase(handler) {
  return createPremiumUseCase('send-anamnesis-link', handler);
}
