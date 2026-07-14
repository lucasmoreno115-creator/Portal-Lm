// LM Premium 3.0 Build 5 nutrition-plan workflow use case.
export function createPublishNutritionPlanUseCase({ nutritionPlanRepository, randomUUID }) {
  return { async execute({ id, student_id, published_by, professional_note }) {
    const draft = await nutritionPlanRepository.findById(id);
    if (!draft || draft.student_id !== student_id) return { ok:false, error:'NOT_FOUND' };
    if (draft.status === 'PUBLISHED') return { ok:true, data: draft, idempotent:true };
    if (draft.status !== 'DRAFT') return { ok:false, error:'NOT_DRAFT', conflict:true };
    try {
      const published = await nutritionPlanRepository.publish(id, { published_by, professional_note, randomUUID });
      if (!published || published.status !== 'PUBLISHED') return { ok:false, error:'PUBLISH_NOT_CONFIRMED', conflict:true };
      return { ok:true, data: published };
    } catch (error) {
      return { ok:false, error:error.message, details:error.details, conflict:Boolean(error.conflict) || error.message.includes('CONFLICT') };
    }
  } };
}
