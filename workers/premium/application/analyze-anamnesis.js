import { createPremiumUseCase } from './create-use-case.js';

export function createAnalyzeAnamnesisUseCase(depsOrHandler) {
  if (typeof depsOrHandler === 'function') return createPremiumUseCase('analyze-anamnesis', depsOrHandler);
  const deps = depsOrHandler;
  return createPremiumUseCase('analyze-anamnesis', async ({ id, status, updated_at }) => {
    const changed = await deps.anamnesisRepository.markAnalyzed(id, { status, updated_at });
    const record = await deps.anamnesisRepository.findById(id);
    if (!record) return { ok: false, error: 'ANAMNESIS_NOT_FOUND' };
    return { ok: true, data: { id, status: record.status, analyzed_at: record.updated_at, changed: Boolean(changed), unchanged: !changed } };
  });
}
