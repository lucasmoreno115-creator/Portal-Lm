function strip(row) { if (!row || typeof row !== 'object') return row; const { access_token, token, internal_scores_json, answers_json, meals_json, substitutions_json, adherence_rules_json, ...safe } = row; return safe; }
export function presentStudentRecord(record) {
  return {
    student: strip(record.student),
    summary: strip(record.summary),
    anamnesis: strip(record.anamnesis),
    nutrition_plan: strip(record.nutrition_plan),
    feedbacks: (record.feedbacks || []).map(strip),
    followup_entries: (record.followup_entries || []).map(strip),
    pending_items: (record.pending_items || []).map(strip),
  };
}
