#!/usr/bin/env node
import { readFileSync } from 'node:fs';

export const WEEKLY_FEEDBACK_DUPLICATE_AUDIT_SQL = `
SELECT student_id, week_ref, COUNT(*) AS total, GROUP_CONCAT(id) AS checkin_ids
FROM student_checkins
WHERE student_id IS NOT NULL AND week_ref IS NOT NULL
GROUP BY student_id, week_ref
HAVING COUNT(*) > 1
ORDER BY total DESC, student_id, week_ref;
`;

export function parseDuplicateAuditRows(rows = []) {
  return rows.map((row) => ({
    student_id: row.student_id,
    week_ref: row.week_ref,
    total: Number(row.total || 0),
    checkin_ids: String(row.checkin_ids || '').split(',').filter(Boolean),
    recommended_action: 'Revisar manualmente as respostas clínicas duplicadas antes de aplicar o índice único; não mesclar nem apagar silenciosamente.',
  }));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const inputPath = process.argv[2];
  if (!inputPath) {
    console.log(WEEKLY_FEEDBACK_DUPLICATE_AUDIT_SQL.trim());
    process.exit(0);
  }
  const rows = JSON.parse(readFileSync(inputPath, 'utf8'));
  const conflicts = parseDuplicateAuditRows(rows);
  console.log(JSON.stringify({ ok: conflicts.length === 0, conflicts }, null, 2));
  process.exit(conflicts.length === 0 ? 0 : 1);
}
