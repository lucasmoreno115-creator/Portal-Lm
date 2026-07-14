import { createPremiumUseCase } from './create-use-case.js';
import { resolvePremiumIdentityForLegacyEmail } from './dual-write-helpers.js';

export function createListWeeklyFeedbacksUseCase(depsOrHandler) {
  if (typeof depsOrHandler === 'function') return createPremiumUseCase('list-weekly-feedbacks', depsOrHandler);
  const deps = depsOrHandler;
  return createPremiumUseCase('list-weekly-feedbacks', async ({ email, limit = 20, route, method }) => {
    const identity = await resolvePremiumIdentityForLegacyEmail({ identityService: deps.identityService, email, log: deps.log, area: 'premium_weekly_feedback', route, method });
    if (identity.student_id) {
      const records = await deps.weeklyFeedbackRepository.listByStudentId(identity.student_id, { limit });
      if (records.length) return { records, identity, method: 'student_id' };
    }
    return { records: await deps.weeklyFeedbackRepository.listByEmail(email, { limit }), identity, method: 'email_fallback' };
  });
}
