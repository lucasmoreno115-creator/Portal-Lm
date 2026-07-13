import { createPremiumUseCase } from './create-use-case.js';

export function createCreatePremiumStudentUseCase(handler) {
  return createPremiumUseCase('create-premium-student', handler);
}
