import test from 'node:test';
import assert from 'node:assert/strict';
import { createWeeklyFeedbackScheduleService } from '../workers/premium/services/weekly-feedback-schedule-service.js';

test('calcula semana ISO e disponibilidade em America/Sao_Paulo', () => {
  const service = createWeeklyFeedbackScheduleService();
  const friday = new Date('2026-07-17T13:00:00Z');
  assert.equal(service.getWeekRef(friday), '2026-W29');
  assert.equal(service.isAvailable(friday), true);
  assert.equal(service.getAvailability(friday).recommendedDeadline, '2026-07-18T15:00:00.000Z');
  assert.equal(service.getReminderType(friday), 'FRIDAY_PREPARATION');
});

test('não usa UTC para virada perto da meia-noite', () => {
  const service = createWeeklyFeedbackScheduleService();
  assert.equal(service.getReminderType(new Date('2026-07-18T02:30:00Z')), 'FRIDAY_PREPARATION');
  assert.equal(service.getReminderType(new Date('2026-07-18T16:00:00Z')), null);
  assert.equal(service.isAfterRecommendedDeadline(new Date('2026-07-18T15:00:01Z')), true);
});

test('mudança de ano mantém padrão YYYY-Www', () => {
  const service = createWeeklyFeedbackScheduleService();
  assert.equal(service.getWeekRef(new Date('2027-01-01T15:00:00Z')), '2026-W53');
});
