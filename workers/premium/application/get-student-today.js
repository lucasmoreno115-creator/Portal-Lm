import { createPremiumUseCase } from './create-use-case.js';

export function createGetStudentTodayUseCase(handler) {
  return createPremiumUseCase('get-student-today', handler);
}
