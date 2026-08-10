// A legacy check-in may inherit an identity only when its normalized e-mail
// identifies exactly one Premium student. Keep list and detail reads on this
// shared expression so neither surface can implement a weaker fallback.
export function uniqueLegacyCheckinStudentIdSql(checkinAlias = 'sc') {
  return `(CASE WHEN ${checkinAlias}.student_id IS NULL
    AND (SELECT COUNT(*) FROM premium_students ps_count
      WHERE lower(trim(ps_count.email))=lower(trim(${checkinAlias}.student_email)))=1
    THEN (SELECT ps_match.student_id FROM premium_students ps_match
      WHERE lower(trim(ps_match.email))=lower(trim(${checkinAlias}.student_email)) LIMIT 1)
    ELSE NULL END)`;
}
