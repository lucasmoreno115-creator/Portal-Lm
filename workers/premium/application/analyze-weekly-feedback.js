import { createPremiumUseCase } from './create-use-case.js';

export function createAnalyzeWeeklyFeedbackUseCase(depsOrHandler) {
  if (typeof depsOrHandler === 'function') return createPremiumUseCase('analyze-weekly-feedback', depsOrHandler);
  const deps = depsOrHandler;
  return createPremiumUseCase('analyze-weekly-feedback', async ({ id, decision }) => {
    const changed = await deps.weeklyFeedbackRepository.saveProfessionalDecision(id, decision);
    if (!changed) return { ok: false, error: 'WEEKLY_FEEDBACK_NOT_FOUND' };
    return { ok: true };
  });
}
