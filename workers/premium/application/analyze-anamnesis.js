import { createPremiumUseCase } from './create-use-case.js';

export function createAnalyzeAnamnesisUseCase(handler) {
  return createPremiumUseCase('analyze-anamnesis', handler);
}
