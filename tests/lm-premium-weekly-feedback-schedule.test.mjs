import test from 'node:test';
import assert from 'node:assert/strict';
import { createWeeklyFeedbackScheduleService } from '../workers/premium/services/weekly-feedback-schedule-service.js';

const service = createWeeklyFeedbackScheduleService();

test('sexta-feira fica disponível no ciclo correto', () => {
  const friday = new Date('2026-07-17T13:00:00Z');
  const availability = service.getAvailability(friday);
  assert.equal(availability.weekRef, '2026-W29');
  assert.equal(availability.availableAt, '2026-07-17T03:00:00.000Z');
  assert.equal(availability.recommendedDeadline, '2026-07-18T15:00:00.000Z');
  assert.equal(service.isAvailable(friday), true);
  assert.equal(service.getReminderType(friday), 'FRIDAY_PREPARATION');
});

test('sábado antes do prazo fica disponível e não atrasado', () => {
  const saturdayMorning = new Date('2026-07-18T13:00:00Z');
  assert.equal(service.getAvailability(saturdayMorning).weekRef, '2026-W29');
  assert.equal(service.isAvailable(saturdayMorning), true);
  assert.equal(service.isAfterRecommendedDeadline(saturdayMorning), false);
  assert.equal(service.getReminderType(saturdayMorning), 'SATURDAY_MORNING');
});

test('sábado depois do prazo continua disponível e fica atrasado', () => {
  const saturdayAfternoon = new Date('2026-07-18T16:00:00Z');
  assert.equal(service.getAvailability(saturdayAfternoon).weekRef, '2026-W29');
  assert.equal(service.isAvailable(saturdayAfternoon), true);
  assert.equal(service.isAfterRecommendedDeadline(saturdayAfternoon), true);
  assert.equal(service.getReminderType(saturdayAfternoon), null);
});

test('domingo mantém feedback disponível no ciclo anterior e atrasado', () => {
  const sunday = new Date('2026-07-19T15:00:00Z');
  const availability = service.getAvailability(sunday);
  assert.equal(availability.weekRef, '2026-W29');
  assert.equal(availability.availableAt, '2026-07-17T03:00:00.000Z');
  assert.equal(availability.recommendedDeadline, '2026-07-18T15:00:00.000Z');
  assert.equal(service.isAvailable(sunday), true);
  assert.equal(service.isAfterRecommendedDeadline(sunday), true);
});

test('domingo próximo à meia-noite UTC não aponta para a sexta seguinte', () => {
  const lateUtcSaturdayButSaoPauloSaturday = new Date('2026-07-19T02:30:00Z');
  const sundaySaoPauloNearUtcMidnight = new Date('2026-07-20T02:30:00Z');
  assert.equal(service.getAvailability(lateUtcSaturdayButSaoPauloSaturday).availableAt, '2026-07-17T03:00:00.000Z');
  assert.equal(service.getAvailability(sundaySaoPauloNearUtcMidnight).availableAt, '2026-07-17T03:00:00.000Z');
});

test('segunda-feira inicia novo ciclo ainda não disponível', () => {
  const monday = new Date('2026-07-20T13:00:00Z');
  const availability = service.getAvailability(monday);
  assert.equal(availability.weekRef, '2026-W30');
  assert.equal(availability.availableAt, '2026-07-24T03:00:00.000Z');
  assert.equal(availability.recommendedDeadline, '2026-07-25T15:00:00.000Z');
  assert.equal(service.isAvailable(monday), false);
});

test('virada de ano ISO mantém weekRef, disponibilidade e prazo do mesmo ciclo', () => {
  const newYearFriday = new Date('2027-01-01T15:00:00Z');
  const availability = service.getAvailability(newYearFriday);
  assert.equal(availability.weekRef, '2026-W53');
  assert.equal(availability.availableAt, '2027-01-01T03:00:00.000Z');
  assert.equal(availability.recommendedDeadline, '2027-01-02T15:00:00.000Z');
});
