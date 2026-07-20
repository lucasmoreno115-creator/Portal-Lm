import { presentAnamnesisReport } from './anamnesis-report-presenter.js';
function strip(row) { if (!row || typeof row !== 'object') return row; const { access_token, token, internal_scores_json, answers_json, meals_json, substitutions_json, adherence_rules_json, ...safe } = row; return safe; }
export function presentStudentRecord(record) {
  return {
    student: strip(record.student),
    summary: strip(record.summary),
    anamnesis: record.anamnesis ? { ...strip(record.anamnesis), report: presentAnamnesisReport(record.anamnesis.answers_json, { id: record.anamnesis.id, submittedAt: record.anamnesis.created_at }) } : null,
    nutrition_plan: record.nutrition_plan ? { current: strip(record.nutrition_plan.current), draft: strip(record.nutrition_plan.draft) } : { current: null, draft: null },
    feedbacks: (record.feedbacks || []).map(strip),
    followup_entries: (record.followup_entries || []).map(strip),
    pending_items: (record.pending_items || []).map(strip),
  };
}
