import workoutLibrary from './workout_library.json' with { type: 'json' };

export const WEEKDAY_KEYS = Object.freeze(['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']);

export function resolveWorkoutProgram(profile) {
  return workoutLibrary.profilePrograms?.[profile] || null;
}

export function resolveLegacyWorkoutProfile(programId) {
  return workoutLibrary.legacyProfiles?.[programId] || null;
}

export function getWorkoutProgram(profile) {
  const programId = resolveWorkoutProgram(profile);
  return programId ? workoutLibrary.programs?.[programId] || null : null;
}

export function getWorkoutWeek(profile, week = 'week_1') {
  const program = getWorkoutProgram(profile);
  return program?.[week] || null;
}

export function getWorkoutForDay(profile, day, week = 'week_1') {
  const programId = resolveWorkoutProgram(profile);
  return programId ? workoutLibrary.workouts?.[programId]?.[day] || null : null;
}

export function getWorkoutDayKey(profile, weekdayKey, week = 'week_1') {
  return getWorkoutWeek(profile, week)?.[weekdayKey] || null;
}

export function hasWorkoutProfile(profile) {
  return Boolean(resolveWorkoutProgram(profile));
}

export { workoutLibrary };
