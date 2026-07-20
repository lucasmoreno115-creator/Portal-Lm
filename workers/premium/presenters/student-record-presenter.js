import { presentAnamnesisReport } from './anamnesis-report-presenter.js';
function strip(row) { if (!row || typeof row !== 'object') return row; const { access_token, token, internal_scores_json, answers_json, meals_json, substitutions_json, adherence_rules_json, ...safe } = row; return safe; }
function presentNutritionPlanWorkflow(workflow) {
  const current = strip(workflow?.current) || null;
  const draft = strip(workflow?.draft) || null;
  const hasPublished = Boolean(current);
  const hasDraft = Boolean(draft);
  if (hasPublished && hasDraft) return { current, draft, hasPublished, hasDraft, status: 'PUBLISHED_WITH_DRAFT', label: 'Alterações em revisão', description: 'O plano publicado continua ativo enquanto o novo rascunho é editado.', actionLabel: 'Revisar alterações', action: 'open-nutrition-plan' };
  if (hasDraft) return { current, draft, hasPublished, hasDraft, status: 'DRAFT', label: 'Rascunho em edição', description: 'Há alterações ainda não publicadas.', actionLabel: 'Continuar planejamento', action: 'open-nutrition-plan' };
  if (hasPublished) return { current, draft, hasPublished, hasDraft, status: 'PUBLISHED', label: 'Plano publicado', description: 'O aluno já possui um planejamento ativo.', actionLabel: 'Editar planejamento alimentar', action: 'open-nutrition-plan' };
  return { current: null, draft: null, hasPublished, hasDraft, status: 'EMPTY', label: 'Nenhum plano criado', description: 'Crie o primeiro planejamento alimentar deste aluno.', actionLabel: 'Criar planejamento alimentar', action: 'open-nutrition-plan' };
}
export function presentStudentRecord(record) {
  return {
    student: strip(record.student),
    summary: strip(record.summary),
    anamnesis: record.anamnesis ? { ...strip(record.anamnesis), report: presentAnamnesisReport(record.anamnesis.answers_json, { id: record.anamnesis.id, submittedAt: record.anamnesis.created_at }) } : null,
    nutrition_plan: presentNutritionPlanWorkflow(record.nutrition_plan),
    feedbacks: (record.feedbacks || []).map(strip),
    followup_entries: (record.followup_entries || []).map(strip),
    pending_items: (record.pending_items || []).map(strip),
  };
}
