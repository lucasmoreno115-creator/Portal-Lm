import { createPremiumUseCase } from './create-use-case.js';

export function createGetProfessionalWorkspaceUseCase(handler) {
  return createPremiumUseCase('get-professional-workspace', handler);
}
