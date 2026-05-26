import { safeJsonParse } from './lm-utils.js';

export function buildBaseTimeline({ latestAnamnesis, latestCheckin, activeWeeklyPlan, activeNutritionPlan }) {
  const timeline = [];
  if (latestAnamnesis?.created_at) timeline.push({ type: 'anamnese_enviada', at: latestAnamnesis.created_at, title: 'Anamnese enviada' });
  if (latestCheckin?.created_at) timeline.push({ type: 'checkin_enviado', at: latestCheckin.created_at, title: 'Check-in enviado' });
  if (latestCheckin?.coach_reply_at || latestCheckin?.coach_reply) timeline.push({ type: 'resposta_coach', at: latestCheckin.coach_reply_at || latestCheckin.created_at, title: 'Resposta do coach', detail: latestCheckin.coach_reply || null });
  if (activeWeeklyPlan?.updated_at) timeline.push({ type: 'plano_semanal_atualizado', at: activeWeeklyPlan.updated_at, title: 'Plano semanal atualizado' });
  if (activeNutritionPlan?.updated_at || activeNutritionPlan?.created_at) timeline.push({ type: 'plano_alimentar_atualizado', at: activeNutritionPlan.updated_at || activeNutritionPlan.created_at, title: 'Plano alimentar atualizado' });
  return timeline;
}

export function appendActivityRows(timeline, rows) {
  for (const row of rows || []) {
    timeline.push({ type: String(row.event_type || '').toLowerCase(), at: row.created_at, title: row.title || 'Atividade', detail: safeJsonParse(row.metadata_json) });
  }
  timeline.sort((a, b) => String(b.at || '').localeCompare(String(a.at || '')));
  return timeline;
}
