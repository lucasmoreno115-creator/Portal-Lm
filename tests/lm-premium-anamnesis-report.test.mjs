import test from 'node:test';
import assert from 'node:assert/strict';
import { presentAnamnesisReport } from '../workers/premium/presenters/anamnesis-report-presenter.js';

const answers = { version: 'LM_V2_2', personal: { birth_date: '1995-01-02', height: 174, weight: 105 }, objectives: { main_goal: 'Perder peso' }, training: { currently_trains: true, days_per_week: '5 dias', best_time: '19:00', injuries_pain: 'Dor no joelho após corrida.' }, nutrition: { meals_per_day: '1-2 refeições', self_evaluation: 'Muito desorganizada' }, recovery: { sleep_hours: 5, sleep_quality: 'Regular' }, health: { medications: 'Monjaro' }, routine: { flow: 'Trabalho das 8h às 18h.\nChego tarde em casa.' }, metadata: { source: 'authenticated-premium-anamnesis', form_version: 'LM_V2_2' }, unknown_answer: ['Saúde', 'Autoestima'] };

test('LM V2.2 report keeps labels, formats values, and separates answers', () => {
  const report = presentAnamnesisReport(JSON.stringify(answers), { id: 'anam-1', submittedAt: '2026-07-20T00:35:00.000Z' });
  assert.equal(report.version, 'LM_V2_2');
  assert.equal(report.executiveSummary.length, 6);
  assert.equal(report.sections.find((section) => section.key === 'training').items.find((item) => item.key === 'training.currently_trains').value, 'Sim');
  assert.equal(report.sections.find((section) => section.key === 'weight_history').items.find((item) => item.key === 'personal.weight').value, '105 kg');
  assert.equal(report.sections.find((section) => section.key === 'additional').items.find((item) => item.key === 'personal.birth_date').value, '02/01/1995');
  assert.deepEqual(report.technical.unknownFields[0].value, ['Saúde', 'Autoestima']);
  assert.deepEqual(report.highlights.map((item) => item.code), ['LOW_MEAL_FREQUENCY', 'DISORGANIZED_NUTRITION', 'HIGH_TRAINING_FREQUENCY', 'SHORT_SLEEP', 'MEDICATION_REPORTED', 'LIMITATION_REPORTED']);
  assert.equal(report.highlights[0].source.label, 'Quantas refeições faz por dia');
});

test('legacy aliases and invalid answers preserve safe visibility', () => {
  const legacy = presentAnamnesisReport({ current_weight: 88, main_goal: 'Saúde', meals_per_day: '3 refeições' });
  assert.equal(legacy.version, 'LEGACY');
  assert.equal(legacy.sections.find((section) => section.key === 'weight_history').items[0].value, '88 kg');
  assert.equal(legacy.sections.find((section) => section.key === 'objectives').items[0].label, 'Objetivo principal');
  const invalid = presentAnamnesisReport('{not json');
  assert.equal(invalid.invalid, true);
  assert.equal(invalid.technical.metadata[0].value.includes('preservado'), true);
});
