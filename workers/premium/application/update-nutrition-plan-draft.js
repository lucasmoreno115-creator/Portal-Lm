// LM Premium 3.0 Build 5 nutrition-plan workflow use case.
import { validateNutritionPlanStructure } from '../domain/nutrition-plan-schema.js';
export function createUpdateNutritionPlanDraftUseCase({ nutritionPlanRepository }) {
  return { async execute({ id, student_id, updates }) {
    const current = await nutritionPlanRepository.findById(id);
    if (!current || current.student_id !== student_id) return { ok:false, error:'NOT_FOUND' };
    if (current.status !== 'DRAFT') return { ok:false, error:'NOT_DRAFT', conflict:true };
    if (!updates?.expected_updated_at) return { ok:false, error:'REVISION_REQUIRED', conflict:true, message:'Recarregue o rascunho antes de salvar.' };
    const validation = validateNutritionPlanStructure({ ...current, ...updates });
    if (!validation.ok) return { ok:false, error:'INVALID_STRUCTURE', details: validation.errors };
    try { return { ok:true, data: await nutritionPlanRepository.updateDraft(id, updates) }; }
    catch (error) { return { ok:false, error:error.message, conflict:Boolean(error.conflict), message:'Este rascunho foi alterado em outra sessão. Recarregue antes de salvar novamente.' }; }
  } };
}
