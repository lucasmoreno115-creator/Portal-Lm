import { createPremiumUseCase } from './create-use-case.js';

export function createListPremiumStudentsUseCase(handler) {
  return createPremiumUseCase('list-premium-students', handler);
}
