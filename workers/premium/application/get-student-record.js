import { createPremiumUseCase } from './create-use-case.js';

export function createGetStudentRecordUseCase(handler) {
  return createPremiumUseCase('get-student-record', handler);
}
