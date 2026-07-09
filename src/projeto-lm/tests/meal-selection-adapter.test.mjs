import test from 'node:test';
import assert from 'node:assert/strict';
import { adaptMealSelection, extractMealSelections } from '../adapters/mealSelectionAdapter.js';

const defaults = {
  breakfast: 'breakfast_01',
  lunch: 'lunch_01',
  snack: 'snack_01',
  dinner: 'dinner_01'
};

test('sem selectedMeals usa defaults', () => {
  assert.deepEqual(adaptMealSelection(), defaults);
});

test('selectedMeals vazio usa defaults', () => {
  assert.deepEqual(adaptMealSelection({ selectedMeals: {} }), defaults);
});

test('inglês funciona', () => {
  assert.deepEqual(adaptMealSelection({ selectedMeals: { breakfast: 'breakfast_02', lunch: 'lunch_03', snack: 'snack_03', dinner: 'dinner_02' } }), {
    breakfast: 'breakfast_02',
    lunch: 'lunch_03',
    snack: 'snack_03',
    dinner: 'dinner_02'
  });
});

test('português funciona', () => {
  assert.deepEqual(adaptMealSelection({ mealSelections: { cafe_da_manha: 'breakfast_02', almoco: 'lunch_03', lanche: 'snack_03', jantar: 'dinner_02' } }), {
    breakfast: 'breakfast_02',
    lunch: 'lunch_03',
    snack: 'snack_03',
    dinner: 'dinner_02'
  });
});

test('cada refeição válida é mantida', () => {
  assert.equal(adaptMealSelection({ breakfast: 'breakfast_02' }).breakfast, 'breakfast_02');
  assert.equal(adaptMealSelection({ lunch: 'lunch_03' }).lunch, 'lunch_03');
  assert.equal(adaptMealSelection({ snack: 'snack_03' }).snack, 'snack_03');
  assert.equal(adaptMealSelection({ dinner: 'dinner_02' }).dinner, 'dinner_02');
});

test('refeição inválida volta para fallback individual', () => {
  assert.deepEqual(adaptMealSelection({ selectedMeals: { breakfast: 'breakfast_999', lunch: 'lunch_03' } }), {
    ...defaults,
    lunch: 'lunch_03'
  });
});

test('refeição de tipo errado volta para fallback', () => {
  assert.deepEqual(adaptMealSelection({ selectedMeals: { breakfast: 'lunch_03', snack: 'dinner_02' } }), defaults);
});

test('uma refeição inválida não apaga as válidas', () => {
  assert.deepEqual(adaptMealSelection({ selectedMeals: { breakfast: 'bad', lunch: 'lunch_03', snack: 'snack_03', dinner: 'nope' } }), {
    breakfast: 'breakfast_01',
    lunch: 'lunch_03',
    snack: 'snack_03',
    dinner: 'dinner_01'
  });
});

test('IDs internos não são preparados para exibição', () => {
  const result = adaptMealSelection({ selectedMeals: { breakfast: 'breakfast_02' } });
  assert.deepEqual(Object.keys(result), ['breakfast', 'lunch', 'snack', 'dinner']);
  assert.equal(Object.hasOwn(result, 'label'), false);
  assert.equal(Object.hasOwn(result, 'displayName'), false);
});

test('extrai fontes defensivas de seleção', () => {
  assert.deepEqual(extractMealSelections({ selectedMeals: { breakfast: 'breakfast_02' } }), { breakfast: 'breakfast_02' });
  assert.deepEqual(extractMealSelections({ mealSelections: { almoco: 'lunch_03' } }), { almoco: 'lunch_03' });
  assert.deepEqual(extractMealSelections({ profile: { selectedMeals: { dinner: 'dinner_02' } } }), { dinner: 'dinner_02' });
});
