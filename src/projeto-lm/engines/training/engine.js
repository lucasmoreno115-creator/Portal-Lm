import exercises from './exercises.json' with { type: 'json' };
import substitutions from './substitutions.json' with { type: 'json' };
import templates from './workout_templates.json' with { type: 'json' };
import cardioRules from './cardio_rules.json' with { type: 'json' };
import progressionRules from './progression_rules.json' with { type: 'json' };
import { assertWorkoutRules, validateWorkoutData, validateWorkoutInput } from './validators.js';

const exerciseById = Object.fromEntries(exercises.map((exercise) => [exercise.id, exercise]));

function prescriptionFor(profile, day, index) {
  const isLower = day.startsWith('lower');
  const femaleLowerBonus = profile === 'GYM_FEMALE' && isLower && index < 2;
  const maleUpperBonus = profile === 'GYM_MALE' && day.startsWith('upper') && index < 2;
  return {
    sets: femaleLowerBonus || maleUpperBonus ? 4 : 3,
    reps: isLower ? '10 a 12' : '8 a 12',
    rest: '60 a 90 segundos'
  };
}

function buildExercises(profile, day) {
  return templates[day].exercises.map((exerciseId, index) => {
    const exercise = exerciseById[exerciseId];
    return {
      name: exercise.name,
      ...prescriptionFor(profile, day, index),
      video: exercise.video,
      observations: 'Priorize execução controlada e amplitude confortável.',
      substitutions: substitutions[exerciseId]
    };
  });
}

export function generateWorkoutPlan(input) {
  validateWorkoutInput(input);
  validateWorkoutData(input.day);

  const isCardioDay = input.day === 'cardio_day';
  const student_visible = isCardioDay
    ? {
        title: 'Cardio Day',
        display_name: templates[input.day].displayName,
        exercises: buildExercises(input.profile, input.day),
        cardio: { minutes: cardioRules.cardioDayMinutes, guidance: 'Ritmo contínuo e confortável.', mobility: cardioRules.cardioDayMobility },
        progression: progressionRules.studentText,
        observations: 'O objetivo é manter o corpo em movimento e recuperar bem para o próximo treino.'
      }
    : {
        title: 'Treino Projeto LM',
        display_name: templates[input.day].displayName,
        exercises: buildExercises(input.profile, input.day),
        cardio: { minutes: cardioRules.postWorkoutMinutes, guidance: 'Faça após a musculação em ritmo contínuo.' },
        progression: progressionRules.studentText,
        observations: 'Anote a carga usada e observe a última série para evoluir na próxima sessão.'
      };

  const output = {
    product: 'Projeto LM',
    type: isCardioDay ? 'cardio_day' : 'workout_plan',
    profile_internal: input.profile,
    progression_internal: { basis: progressionRules.basis },
    student_visible
  };

  assertWorkoutRules(output);
  return output;
}
