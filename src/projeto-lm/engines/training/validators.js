import exercises from './exercises.json' with { type: 'json' };
import substitutions from './substitutions.json' with { type: 'json' };
import cardioRules from './cardio_rules.json' with { type: 'json' };
import progressionRules from './progression_rules.json' with { type: 'json' };
import rules from './rules.json' with { type: 'json' };
import { getWorkoutForDay, hasWorkoutProfile } from './workoutLibrary.js';

export function validateWorkoutInput(input) {
  if (!input || !hasWorkoutProfile(input.profile)) throw new Error('Perfil de treino inválido para o Projeto LM.');
  if (!getWorkoutForDay(input.profile, input.day)) throw new Error('Dia de treino inválido para o Projeto LM.');
  return true;
}

export function validateWorkoutData(profile, day) {
  const workout = getWorkoutForDay(profile, day);
  if (!workout) throw new Error('Treino não encontrado na Workout Library oficial.');
  const exerciseIds = new Set(exercises.map((exercise) => exercise.id));
  for (const prescription of workout.exercises) {
    if (!exerciseIds.has(prescription.id)) throw new Error(`Exercício inválido: ${prescription.id}.`);
    if (!Array.isArray(substitutions[prescription.id])) throw new Error(`Substituição inválida para ${prescription.id}.`);
    if (!prescription.sets || !prescription.reps || !prescription.rest || !prescription.observations) {
      throw new Error(`Prescrição incompleta na Workout Library: ${prescription.id}.`);
    }
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
