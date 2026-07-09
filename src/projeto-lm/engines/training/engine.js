import exercises from './exercises.json' with { type: 'json' };
import substitutions from './substitutions.json' with { type: 'json' };
import cardioRules from './cardio_rules.json' with { type: 'json' };
import progressionRules from './progression_rules.json' with { type: 'json' };
import { getWorkoutForDay } from './workoutLibrary.js';
import { assertWorkoutRules, validateWorkoutData, validateWorkoutInput } from './validators.js';

const exerciseById = Object.fromEntries(exercises.map((exercise) => [exercise.id, exercise]));

function buildExercises(workout) {
  return workout.exercises.map((prescription) => {
    const exercise = exerciseById[prescription.id];
    return {
      name: exercise.name,
      sets: prescription.sets,
      reps: prescription.reps,
      rest: prescription.rest,
      video: exercise.video,
      observations: prescription.observations,
      substitutions: substitutions[prescription.id]
    };
  });
}

export function generateWorkoutPlan(input) {
  validateWorkoutInput(input);
  validateWorkoutData(input.profile, input.day);

  const workout = getWorkoutForDay(input.profile, input.day);
  const isCardioDay = workout.type === 'cardio_day';
  const student_visible = isCardioDay
    ? {
        title: workout.title,
        display_name: workout.displayName,
        exercises: buildExercises(workout),
        cardio: { minutes: cardioRules.cardioDayMinutes, guidance: 'Ritmo contínuo e confortável.', mobility: cardioRules.cardioDayMobility },
        progression: progressionRules.studentText,
        observations: workout.observations
      }
    : {
        title: workout.title,
        display_name: workout.displayName,
        exercises: buildExercises(workout),
        cardio: { minutes: cardioRules.postWorkoutMinutes, guidance: 'Faça após a musculação em ritmo contínuo.' },
        progression: progressionRules.studentText,
        observations: workout.observations
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
