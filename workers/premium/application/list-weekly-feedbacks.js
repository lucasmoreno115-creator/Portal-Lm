import { createPremiumUseCase } from './create-use-case.js';

export function createListWeeklyFeedbacksUseCase(handler) {
  return createPremiumUseCase('list-weekly-feedbacks', handler);
}
