import { createPremiumUseCase } from './create-use-case.js';

export function createAnalyzeWeeklyFeedbackUseCase(handler) {
  return createPremiumUseCase('analyze-weekly-feedback', handler);
}
