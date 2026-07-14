export function createListFeedbacksAwaitingAnalysisUseCase({ weeklyFeedbackRepository }) { return ({ limit = 50 } = {}) => weeklyFeedbackRepository.listPendingAnalysis({ limit }); }
