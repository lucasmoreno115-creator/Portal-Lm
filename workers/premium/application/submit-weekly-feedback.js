import { createPremiumUseCase } from './create-use-case.js';

export function createSubmitWeeklyFeedbackUseCase(handler) {
  return createPremiumUseCase('submit-weekly-feedback', handler);
}
