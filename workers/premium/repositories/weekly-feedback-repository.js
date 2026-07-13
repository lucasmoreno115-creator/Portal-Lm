import { createRepositoryContract } from './create-repository-contract.js';
export function createWeeklyFeedbackRepositoryContract() { return createRepositoryContract('weeklyFeedbackRepository', ['listByStudentId', 'submit', 'markAnalyzed']); }
