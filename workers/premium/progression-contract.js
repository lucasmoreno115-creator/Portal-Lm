const TARGET_ZONE_PATTERN = /^\d+–\d+$/;
const EXECUTION_QUALITIES = new Set(['Sim', 'Não']);

function requiredText(value) {
  return typeof value === 'string' && value.trim() ? value : null;
}

export function normalizeProgressionInput(body) {
  const recommendation = requiredText(body?.recommendation) ?? requiredText(body?.decision);
  const progression = {
    exercise: requiredText(body?.exercise),
    targetZone: requiredText(body?.targetZone),
    loadUsed: typeof body?.loadUsed === 'number' ? body.loadUsed : Number(body?.loadUsed),
    repsDone: typeof body?.repsDone === 'number' ? body.repsDone : Number(body?.repsDone),
    executionQuality: body?.executionQuality == null ? null : requiredText(body.executionQuality),
    recommendation,
  };

  if (!progression.exercise) return { ok: false, error: 'exercise deve ser uma string não vazia.' };
  if (!progression.targetZone || !TARGET_ZONE_PATTERN.test(progression.targetZone)) return { ok: false, error: 'targetZone inválida.' };
  if (!Number.isFinite(progression.loadUsed) || progression.loadUsed < 0) return { ok: false, error: 'loadUsed deve ser um número válido.' };
  if (!Number.isInteger(progression.repsDone) || progression.repsDone < 0) return { ok: false, error: 'repsDone deve ser um inteiro válido.' };
  if (progression.executionQuality != null && !EXECUTION_QUALITIES.has(progression.executionQuality)) return { ok: false, error: 'executionQuality deve ser Sim ou Não.' };
  if (!progression.recommendation) return { ok: false, error: 'recommendation (ou decision legacy) é obrigatória.' };
  return { ok: true, data: progression };
}

export function presentProgression(row) {
  return {
    ...row,
    exercise: row.exercise,
    targetZone: row.target_zone,
    loadUsed: row.load_used == null ? null : Number(row.load_used),
    repsDone: row.reps_done == null ? null : Number(row.reps_done),
    executionQuality: row.execution_quality ?? null,
    recommendation: row.decision ?? null,
    created_at: row.created_at,
  };
}
