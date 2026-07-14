// LM Premium 3.0 Build 5 nutrition-plan workflow use case.
export function createCreateNutritionPlanDraftUseCase({ studentRepository, nutritionPlanRepository, randomUUID }) {
  return { async execute({ student_id, plan = {}, source_feedback_id = null }) {
    const student = await studentRepository.findByStudentId(student_id);
    if (!student) return { ok:false, error:'STUDENT_NOT_FOUND' };
    try {
      const draft = await nutritionPlanRepository.createDraft({ id: randomUUID(), student_id, student_email: student.email, title: plan.title || 'Plano alimentar', goal: plan.goal || '', strategy: plan.strategy || '', meals: plan.meals || [], substitutions: plan.substitutions || [], adherenceRules: plan.adherenceRules || plan.adherence_rules || [], notes: plan.notes || '', whatsappMessage: plan.whatsappMessage || plan.whatsapp_message || '', source_feedback_id });
      return { ok:true, data: draft };
    } catch (error) { return { ok:false, error:error.message, conflict:Boolean(error.conflict) }; }
  } };
}
