const SECTIONS = [
  ['objectives', 'Objetivos'], ['weight_history', 'Histórico de peso'], ['training', 'Treinamento'],
  ['nutrition', 'Alimentação'], ['routine', 'Rotina'], ['recovery', 'Sono e recuperação'],
  ['health', 'Saúde'], ['adherence', 'Adesão e comportamento'], ['observations', 'Observações do aluno'], ['additional', 'Informações adicionais'],
];

// This catalog follows the submitted LM V2.2 questionnaire. Aliases keep old flat
// payloads visible without guessing at similarly named, but semantically different fields.
const field = (section, label, type = 'text', aliases = []) => ({ section, label, type, aliases });
export const ANAMNESIS_FIELD_CATALOG = {
  LM_V2_2: {
    'personal.birth_date': field('additional', 'Data de nascimento', 'date', ['personal_birth_date', 'birth_date']),
    'personal.sex': field('additional', 'Sexo', 'text', ['personal_sex', 'sex']),
    'personal.height': field('additional', 'Altura', 'height', ['personal_height', 'height', 'height_cm']),
    'personal.weight': field('weight_history', 'Peso atual', 'weight', ['personal_weight', 'weight', 'current_weight', 'currentWeight', 'peso_atual']),
    'personal.city_state': field('additional', 'Cidade/Estado', 'text', ['personal_city_state']),
    'personal.instagram': field('additional', 'Instagram', 'text', ['personal_instagram']),
    'objectives.main_goal': field('objectives', 'Objetivo principal', 'longText', ['objectives_main_goal', 'goal_primary', 'main_goal', 'goal']),
    'objectives.current_pain': field('objectives', 'O que mais incomoda atualmente', 'longText', ['objectives_current_pain']),
    'objectives.importance': field('objectives', 'Por que esse objetivo é importante', 'longText', ['objectives_importance']),
    'objectives.life_change': field('objectives', 'Mudança esperada na vida', 'longText', ['objectives_life_change']),
    'weight_history.low_5y': field('weight_history', 'Menor peso dos últimos 5 anos', 'weight', ['weight_history_low_5y']),
    'weight_history.high_5y': field('weight_history', 'Maior peso dos últimos 5 anos', 'weight', ['weight_history_high_5y']),
    'weight_history.near_current_time': field('weight_history', 'Tempo próximo ao peso atual', 'text', ['weight_history_near_current_time']),
    'weight_history.recent_assessment': field('weight_history', 'Possui avaliação física recente', 'boolean', ['weight_history_recent_assessment']),
    'training.currently_trains': field('training', 'Treina atualmente', 'boolean', ['training_currently_trains']),
    'training.time_training': field('training', 'Tempo de experiência', 'text', ['training_time_training']),
    'training.days_per_week': field('training', 'Frequência pretendida', 'frequency', ['training_days_per_week', 'training_frequency']),
    'training.where': field('training', 'Local de treino', 'text', ['training_where']),
    'training.best_time': field('training', 'Horário preferido', 'time', ['training_best_time']),
    'training.cardio': field('training', 'Cardio atualmente', 'text', ['training_cardio']),
    'training.injuries_pain': field('training', 'Lesões ou dores informadas', 'longText', ['training_injuries_pain']),
    'nutrition.meals_per_day': field('nutrition', 'Quantas refeições faz por dia', 'text', ['nutrition_meals_per_day', 'meals_per_day']),
    'nutrition.defined_schedule': field('nutrition', 'Possui horários definidos', 'boolean', ['nutrition_defined_schedule']),
    'nutrition.self_evaluation': field('nutrition', 'Organização alimentar', 'text', ['nutrition_self_evaluation', 'nutrition_organization']),
    'nutrition.hardest_meal': field('nutrition', 'Refeição mais difícil', 'text', ['nutrition_hardest_meal']),
    'nutrition.hunger_peak': field('nutrition', 'Horário de maior fome', 'time', ['nutrition_hunger_peak']),
    'nutrition.off_plan_frequency': field('nutrition', 'Frequência fora do planejado', 'text', ['nutrition_off_plan_frequency']),
    'nutrition.weighs_food': field('nutrition', 'Pesa os alimentos', 'boolean', ['nutrition_weighs_food']),
    'nutrition.stress_eating': field('nutrition', 'Come mais quando está estressado', 'text', ['nutrition_stress_eating']),
    'nutrition.binge_episodes': field('nutrition', 'Episódios de compulsão informados', 'text', ['nutrition_binge_episodes']),
    'nutrition.biggest_difficulty': field('nutrition', 'Maior dificuldade alimentar', 'longText', ['nutrition_biggest_difficulty']),
    'nutrition.restrictions': field('nutrition', 'Restrições ou intolerâncias', 'longText', ['nutrition_restrictions']),
    'recovery.sleep_hours': field('recovery', 'Horas de sono', 'hours', ['recovery_sleep_hours', 'sleep_hours']),
    'recovery.sleep_quality': field('recovery', 'Qualidade do sono', 'text', ['recovery_sleep_quality']),
    'recovery.daily_energy': field('recovery', 'Energia diária (0–10)', 'number', ['recovery_daily_energy']),
    'recovery.stress_level': field('recovery', 'Estresse (0–10)', 'number', ['recovery_stress_level']),
    'recovery.wakes_rested': field('recovery', 'Acorda descansado', 'text', ['recovery_wakes_rested']),
    'routine.flow': field('routine', 'Rotina relatada', 'longText', ['routine_flow']),
    'routine.work_hours': field('routine', 'Horário de trabalho', 'text', ['routine_work_hours']),
    'routine.best_training_time': field('routine', 'Melhor horário para treinar', 'time', ['routine_best_training_time']),
    'routine.allows_planning': field('routine', 'A rotina permite seguir um planejamento', 'text', ['routine_allows_planning']),
    'routine.organization_barrier': field('routine', 'Barreira de organização', 'longText', ['routine_organization_barrier']),
    'routine.lives_with': field('routine', 'Com quem mora', 'text', ['routine_lives_with']),
    'routine.prepares_meals': field('routine', 'Prepara as refeições', 'text', ['routine_prepares_meals']),
    'health.conditions': field('health', 'Condições de saúde informadas', 'longText', ['health_conditions']),
    'health.medications': field('health', 'Medicamentos informados', 'longText', ['health_medications', 'medications']),
    'health.hormones': field('health', 'Hormônios informados', 'longText', ['health_hormones']),
    'health.supplements': field('health', 'Suplementos informados', 'longText', ['health_supplements']),
    'health.bowel_function': field('health', 'Funcionamento intestinal', 'longText', ['health_bowel_function']),
    'health.recent_exams': field('health', 'Possui exames recentes', 'boolean', ['health_recent_exams']),
    'adherence.consistency_barrier': field('adherence', 'O que atrapalha a consistência', 'longText', ['adherence_consistency_barrier']),
    'adherence.tried_before': field('adherence', 'O que já tentou', 'longText', ['adherence_tried_before']),
    'adherence.worked': field('adherence', 'O que funcionou', 'longText', ['adherence_worked']),
    'adherence.not_worked': field('adherence', 'O que não funcionou', 'longText', ['adherence_not_worked']),
    'adherence.change_readiness': field('adherence', 'Disposição para mudar (0–10)', 'number', ['adherence_change_readiness']),
    'adherence.expectation': field('adherence', 'Expectativa sobre a Consultoria LM', 'longText', ['adherence_expectation']),
    'observations.final_notes': field('observations', 'Observações finais', 'longText', ['final_notes']),
  },
};
const technicalKeys = new Set(['version', 'metadata', 'form_version', 'source']);
const empty = (value) => value == null || value === '' || (Array.isArray(value) && !value.length);
const get = (object, path) => path.split('.').reduce((value, key) => value && typeof value === 'object' ? value[key] : undefined, object);
const humanize = (key) => String(key).replace(/([a-z])([A-Z])/g, '$1 $2').replace(/[_.-]+/g, ' ').replace(/\b\w/g, (x) => x.toUpperCase());
function format(value, type) { if (empty(value)) return ''; if (Array.isArray(value)) return value.map((item) => format(item, 'text')).filter(Boolean); if (type === 'boolean') return value === true || String(value).toLowerCase() === 'sim' || String(value).toLowerCase() === 'true' ? 'Sim' : value === false || String(value).toLowerCase() === 'não' || String(value).toLowerCase() === 'nao' || String(value).toLowerCase() === 'false' ? 'Não' : String(value); if (type === 'weight' && /^\d+(?:[.,]\d+)?$/.test(String(value).trim())) return `${value} kg`; if (type === 'height' && /^\d+(?:[.,]\d+)?$/.test(String(value).trim())) return `${value} cm`; if (type === 'hours' && /^\d+(?:[.,]\d+)?$/.test(String(value).trim())) return `${value} h`; if (type === 'frequency' && /^\d+$/.test(String(value).trim())) return `${value} vezes por semana`; if (type === 'date' && /^\d{4}-\d{2}-\d{2}$/.test(String(value))) { const [y, m, d] = String(value).split('-'); return `${d}/${m}/${y}`; } return String(value); }
function flatten(object, prefix = '') { return Object.entries(object || {}).flatMap(([key, value]) => value && typeof value === 'object' && !Array.isArray(value) ? flatten(value, prefix ? `${prefix}.${key}` : key) : [[prefix ? `${prefix}.${key}` : key, value]]); }
function numeric(value) { const found = String(value ?? '').match(/\d+(?:[.,]\d+)?/); return found ? Number(found[0].replace(',', '.')) : null; }
function highlight(code, level, title, description, item) { return { code, level, title, description, sourceField: item.key, source: { label: item.label, value: item.value } }; }
function highlights(items) { const byKey = Object.fromEntries(items.map((item) => [item.key, item])); const meal = byKey['nutrition.meals_per_day']; const organization = byKey['nutrition.self_evaluation']; const train = byKey['training.days_per_week']; const sleep = byKey['recovery.sleep_hours']; const medication = byKey['health.medications']; const injury = byKey['training.injuries_pain']; const result = [];
  if (meal && /^(1|1\s*[-–]\s*2)(\s*refeições)?$/i.test(String(meal.raw).trim())) result.push(highlight('LOW_MEAL_FREQUENCY', 'attention', 'Poucas refeições por dia', `O aluno informou fazer ${meal.value} por dia.`, meal));
  if (organization && /^(muito desorganizada|desorganizada)$/i.test(String(organization.raw).trim())) result.push(highlight('DISORGANIZED_NUTRITION', 'attention', 'Baixa organização alimentar', `O aluno classificou sua alimentação como ${String(organization.raw).toLowerCase()}.`, organization));
  if (train && numeric(train.raw) >= 5) result.push(highlight('HIGH_TRAINING_FREQUENCY', 'context', 'Alta frequência de treino informada', `O aluno relatou ${train.value}.`, train));
  if (sleep && typeof sleep.raw === 'number' && sleep.raw < 6) result.push(highlight('SHORT_SLEEP', 'attention', 'Menor duração de sono informada', `O aluno informou ${sleep.value} de sono.`, sleep));
  if (medication && !/^(não|nao|nenhum|nenhuma)$/i.test(String(medication.raw).trim())) result.push(highlight('MEDICATION_REPORTED', 'context', 'Uso de medicamento informado', 'O aluno relatou uso de medicamento.', medication));
  if (injury && !/^(não|nao|nenhuma|nenhum)$/i.test(String(injury.raw).trim())) result.push(highlight('LIMITATION_REPORTED', 'context', 'Lesão ou dor informada', 'O aluno relatou lesão ou dor.', injury));
  return result.slice(0, 6);
}
export function presentAnamnesisReport(rawAnswers, metadata = {}) {
  let answers; try { answers = typeof rawAnswers === 'string' ? JSON.parse(rawAnswers) : rawAnswers; } catch { return { invalid: true, version: null, submittedAt: metadata.submittedAt || null, executiveSummary: [], highlights: [], sections: [], technical: { metadata: [{ label: 'Resposta original', value: 'answers_json inválido; preservado no banco.' }], unknownFields: [] } }; }
  if (!answers || typeof answers !== 'object' || Array.isArray(answers)) return { invalid: true, version: null, submittedAt: metadata.submittedAt || null, executiveSummary: [], highlights: [], sections: [], technical: { metadata: [], unknownFields: [] } };
  const version = answers.version || answers.metadata?.form_version || 'LEGACY'; const catalog = ANAMNESIS_FIELD_CATALOG.LM_V2_2; const used = new Set(); const items = [];
  for (const [key, definition] of Object.entries(catalog)) { const candidates = [key, ...definition.aliases]; let match = candidates.map((candidate) => [candidate, get(answers, candidate)]).find(([, value]) => !empty(value)); if (!match) continue; const [sourceKey, raw] = match; used.add(sourceKey); items.push({ key, label: definition.label, value: format(raw, definition.type), raw, type: definition.type, longText: definition.type === 'longText', sourceKey }); }
  const unknownFields = flatten(answers).filter(([key, value]) => !empty(value) && !technicalKeys.has(key) && !key.startsWith('metadata.') && !used.has(key) && !Object.keys(catalog).some((known) => key === known)).map(([key, value]) => ({ key, label: humanize(key), value: format(value, 'text'), type: 'text' }));
  const sectionItems = Object.fromEntries(SECTIONS.map(([key]) => [key, []])); items.forEach((item) => sectionItems[item.key.split('.')[0] === 'personal' ? item.key === 'personal.weight' ? 'weight_history' : 'additional' : catalog[item.key].section].push(item)); sectionItems.additional.push(...unknownFields);
  const sections = SECTIONS.map(([key, title]) => ({ key, title, items: sectionItems[key] })).filter((section) => section.items.length);
  const pick = (key, label) => { const item = items.find((candidate) => candidate.key === key); return item ? { key, label, value: item.value } : null; };
  const executiveSummary = [pick('objectives.main_goal', 'Objetivo'), pick('personal.weight', 'Peso atual'), pick('training.days_per_week', 'Treino'), pick('nutrition.meals_per_day', 'Refeições'), (() => { const hours = pick('recovery.sleep_hours', 'Sono'); const quality = pick('recovery.sleep_quality', 'Sono'); return hours ? { ...hours, value: quality ? `${hours.value} · ${quality.value}` : hours.value } : quality; })(), pick('nutrition.self_evaluation', 'Organização alimentar')].filter(Boolean).slice(0, 6);
  const technical = { metadata: [{ label: 'Versão do formulário', value: version }, ...(answers.metadata?.source ? [{ label: 'Origem', value: answers.metadata.source }] : []), ...(metadata.id ? [{ label: 'Identificador', value: metadata.id }] : []), ...(metadata.submittedAt ? [{ label: 'Data bruta', value: metadata.submittedAt }] : [])], unknownFields };
  return { invalid: false, version, submittedAt: metadata.submittedAt || null, executiveSummary, highlights: highlights(items), sections, technical };
}
