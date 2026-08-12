export function presentProfessionalDecision({ feedback, entry, unchanged, pendingResolved }) {
  return {
    unchanged: Boolean(unchanged),
    pendingResolved: Boolean(pendingResolved),
    feedback: {
      id: feedback.id,
      student_id: feedback.student_id,
      week_ref: feedback.week_ref ?? null,
      coach_status: feedback.coach_status ?? null,
      coach_reply: feedback.coach_reply ?? null,
      coach_reply_at: feedback.coach_reply_at ?? null,
      decision_type: feedback.decision_type ?? null,
      decision_note: feedback.decision_note ?? null,
      reviewed_at: feedback.reviewed_at ?? null,
      analyzed_at: feedback.analyzed_at ?? null,
      decision_at: feedback.decision_at ?? null,
      followup_at: feedback.followup_at ?? null,
    },
    decision: {
      id: entry.id,
      entry_type: entry.entry_type,
      related_entity_type: entry.related_entity_type,
      related_entity_id: entry.related_entity_id,
      decision_type: feedback.decision_type ?? null,
      note: feedback.decision_note ?? null,
      followup_at: feedback.followup_at ?? null,
    },
  };
}
