import exercises from './exercises.json' with { type: 'json' };
import substitutions from './substitutions.json' with { type: 'json' };
import templates from './workout_templates.json' with { type: 'json' };
import profiles from './profiles.json' with { type: 'json' };
import cardioRules from './cardio_rules.json' with { type: 'json' };
import progressionRules from './progression_rules.json' with { type: 'json' };
import rules from './rules.json' with { type: 'json' };

export function validateWorkoutInput(input) {
  if (!input || !profiles[input.profile]) throw new Error('Perfil de treino inválido para o Projeto LM.');
  if (!templates[input.day]) throw new Error('Dia de treino inválido para o Projeto LM.');
  return true;
}

export function validateWorkoutData(day) {
  const exerciseIds = new Set(exercises.map((exercise) => exercise.id));
  for (const exerciseId of templates[day].exercises) {
    if (!exerciseIds.has(exerciseId)) throw new Error(`Exercício inválido: ${exerciseId}.`);
    if (!Array.isArray(substitutions[exerciseId])) throw new Error(`Substituição inválida para ${exerciseId}.`);
  }
  return true;
}

export function assertWorkoutRules(output) {
  const visible = output.student_visible;
  const serialized = JSON.stringify(visible);
  if (output.type === 'workout_plan' && visible.cardio?.minutes !== cardioRules.postWorkoutMinutes) {
    throw new Error('Cardio pós-musculação deve ter 30 minutos.');
  }
  if (output.type === 'cardio_day' && visible.cardio?.minutes !== cardioRules.cardioDayMinutes) {
    throw new Error('Cardio Day deve ter 40–60 minutos.');
  }
  if (output.progression_internal?.basis !== progressionRules.basis) {
    throw new Error('Progressão deve ser baseada na última série.');
  }
  for (const term of rules.forbiddenTerms) {
    if (serialized.toLowerCase().includes(term.toLowerCase())) throw new Error(`Termo proibido encontrado: ${term}.`);
  }
  return true;
}
