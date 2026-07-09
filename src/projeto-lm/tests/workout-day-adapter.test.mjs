import test from 'node:test';
import assert from 'node:assert/strict';
import { adaptWorkoutDay } from '../adapters/workoutDayAdapter.js';

const dates = {
  monday: '2026-07-06T10:00:00.000Z',
  tuesday: '2026-07-07T10:00:00.000Z',
  wednesday: '2026-07-08T10:00:00.000Z',
  thursday: '2026-07-09T10:00:00.000Z',
  friday: '2026-07-10T10:00:00.000Z',
  saturday: '2026-07-11T10:00:00.000Z',
  sunday: '2026-07-12T10:00:00.000Z'
};

test('Workout Day Adapter resolve estrutura semanal feminina', () => {
  assert.equal(adaptWorkoutDay({ sex: 'female', date: dates.monday }).today.dayKey, 'lower_a');
  assert.equal(adaptWorkoutDay({ sex: 'female', date: dates.tuesday }).today.dayKey, 'upper_a');
  assert.equal(adaptWorkoutDay({ sex: 'female', date: dates.wednesday }).today.dayKey, 'cardio_day');
  assert.equal(adaptWorkoutDay({ sex: 'female', date: dates.thursday }).today.dayKey, 'lower_b');
  assert.equal(adaptWorkoutDay({ sex: 'female', date: dates.friday }).today.dayKey, 'upper_b');
});

test('Workout Day Adapter resolve estrutura semanal masculina', () => {
  assert.equal(adaptWorkoutDay({ sex: 'male', date: dates.monday }).today.dayKey, 'upper_a');
  assert.equal(adaptWorkoutDay({ sex: 'male', date: dates.tuesday }).today.dayKey, 'lower_a');
  assert.equal(adaptWorkoutDay({ sex: 'male', date: dates.thursday }).today.dayKey, 'upper_b');
  assert.equal(adaptWorkoutDay({ sex: 'male', date: dates.friday }).today.dayKey, 'lower_b');
});

test('Workout Day Adapter trata cardio, sábado opcional e domingo descanso', () => {
  assert.equal(adaptWorkoutDay({ sex: 'female', date: dates.wednesday }).today.type, 'cardio');
  const saturday = adaptWorkoutDay({ sex: 'male', date: dates.saturday });
  assert.equal(saturday.today.dayKey, 'cardio_day');
  assert.equal(saturday.today.label, 'Cardio opcional');
  const sunday = adaptWorkoutDay({ sex: 'female', date: dates.sunday });
  assert.equal(sunday.today.dayKey, 'rest_day');
  assert.equal(sunday.today.rest_day, true);
  assert.match(sunday.today.message, /Hoje é dia de descanso/);
});

test('Workout Day Adapter aceita sexo português, abreviado, data ausente e fallback feminino', () => {
  assert.equal(adaptWorkoutDay({ sexo: 'feminino', today: dates.monday }).workoutProfile, 'GYM_FEMALE');
  assert.equal(adaptWorkoutDay({ sexo: 'masculino', currentDate: dates.monday }).today.dayKey, 'upper_a');
  assert.equal(adaptWorkoutDay({ sex: 'F', date: dates.monday }).today.dayKey, 'lower_a');
  assert.equal(adaptWorkoutDay({ sex: 'M', date: dates.monday }).today.dayKey, 'upper_a');
  assert.equal(Boolean(adaptWorkoutDay({ sex: 'female' }).today.dayKey), true);
  assert.equal(adaptWorkoutDay({ date: dates.monday }).workoutProfile, 'GYM_FEMALE');
});

test('Workout Day Adapter retorna próximos 3 treinos sem domingo', () => {
  const plan = adaptWorkoutDay({ sex: 'female', date: dates.wednesday });
  assert.deepEqual(plan.nextWorkouts.map((day) => [day.label, day.dayKey, day.title]), [
    ['Quinta', 'lower_b', 'Inferiores B'],
    ['Sexta', 'upper_b', 'Superiores B'],
    ['Sábado', 'cardio_day', 'Cardio opcional']
  ]);
  assert.equal(adaptWorkoutDay({ sex: 'male', date: dates.saturday }).nextWorkouts.some((day) => day.label === 'Domingo'), false);
});
