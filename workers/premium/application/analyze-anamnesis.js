import { createPremiumUseCase } from './create-use-case.js';

export function createAnalyzeAnamnesisUseCase(depsOrHandler) {
  if (typeof depsOrHandler === 'function') return createPremiumUseCase('analyze-anamnesis', depsOrHandler);
  const deps = depsOrHandler;
  return createPremiumUseCase('analyze-anamnesis', async ({ id, status, updated_at }) => {
    const changed = await deps.anamnesisRepository.markAnalyzed(id, { status, updated_at });
    if (!changed) return { ok: false, error: 'ANAMNESIS_NOT_FOUND' };
    return { ok: true, data: { id, status, updated_at } };
  });
}
