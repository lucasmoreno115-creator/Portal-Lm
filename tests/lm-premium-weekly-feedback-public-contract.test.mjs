import assert from 'node:assert/strict';
import test from 'node:test';
import {
  PUBLIC_WEEKLY_FEEDBACK_ANSWER_FIELDS,
  presentPublicWeeklyFeedback,
} from '../workers/premium/presenters/public-weekly-feedback-presenter.js';

const PRIVATE_FIELDS = [
  'coach_status', 'coach_reply', 'coach_reply_at', 'reviewed_at', 'analyzed_at',
  'decision_type', 'decision_note', 'decision_at', 'decision_by', 'followup_at',
  'created_by', 'pending_item', 'priority',
];

function internal(overrides = {}) {
  return {
    id: 'checkin-w33', week_ref: '2026-W33', submitted_at: '2026-08-12T18:30:00.000Z',
    available_at: '2026-08-12T03:00:00.000Z', training_adherence: 'Completo',
    nutrition_adherence: 'Boa', support_needed: 'Ajustar cardio', coach_status: 'reviewed',
    coach_reply: 'Boa evolução nesta semana.', coach_reply_at: '2026-08-13T12:10:00.000Z',
    reviewed_at: '2026-08-13T12:10:00.000Z', analyzed_at: '2026-08-13T12:10:00.000Z',
    decision_type: 'UPDATE_PLAN', decision_note: 'Nota interna que o aluno não pode ver.',
    decision_at: '2026-08-13T12:10:00.000Z', decision_by: 'admin', followup_at: null,
    created_by: 'admin', pending_item: { priority: 'HIGH' }, priority: 'HIGH',
    ...overrides,
  };
}

function assertPrivateFieldsAbsent(value) {
  const serialized = JSON.stringify(value);
  for (const field of PRIVATE_FIELDS) assert.equal(serialized.includes(`"${field}"`), false, `${field} leaked`);
  assert.equal(serialized.includes('Nota interna que o aluno não pode ver.'), false);
}

test('current and history share canonical submission, answers, and professional response fields', () => {
  const row = internal();
  const current = presentPublicWeeklyFeedback(row, {
    weekRef: row.week_ref, status: 'ANALYZED', availableAt: row.available_at,
    recommendedDeadline: '2026-08-16T23:59:59.000Z', isLate: false,
  });
  const history = presentPublicWeeklyFeedback(row);
  for (const field of ['id', 'weekRef', 'submittedAt', 'questions', 'professionalResponse']) {
    assert.deepEqual(history[field], current[field], field);
  }
  assert.deepEqual(current.professionalResponse, {
    message: 'Boa evolução nesta semana.', respondedAt: '2026-08-13T12:10:00.000Z',
  });
  assert.deepEqual(Object.keys(current.questions), [...PUBLIC_WEEKLY_FEEDBACK_ANSWER_FIELDS]);
  assertPrivateFieldsAbsent(current);
  assertPrivateFieldsAbsent(history);
});

test('reply presence supports historical statuses without exposing operational spellings', () => {
  for (const coach_status of ['replied', 'ANALYZED', 'ANALISADO', 'ANALISADA', 'reviewed', 'pending']) {
    const result = presentPublicWeeklyFeedback(internal({ coach_status }));
    assert.equal(result.status, 'ANALYZED');
    assert.equal(result.professionalResponse.message, 'Boa evolução nesta semana.');
    assertPrivateFieldsAbsent(result);
  }
  for (const decision_type of ['UPDATE_PLAN', 'KEEP_STRATEGY', 'CONTACT_STUDENT', 'REQUEST_MORE_INFORMATION']) {
    const serialized = JSON.stringify(presentPublicWeeklyFeedback(internal({ decision_type })));
    assert.equal(serialized.includes(decision_type), false);
  }
});

test('empty replies are null and a valid reply never receives a fabricated timestamp', () => {
  for (const coach_reply of [null, undefined, '', '   ']) {
    const result = presentPublicWeeklyFeedback(internal({ coach_status: 'pending', coach_reply, coach_reply_at: null }));
    assert.equal(result.professionalResponse, null);
    assert.equal(result.status, 'RESPONDED');
  }
  assert.deepEqual(
    presentPublicWeeklyFeedback(internal({ coach_status: 'pending', coach_reply: 'Mensagem', coach_reply_at: null })).professionalResponse,
    { message: 'Mensagem', respondedAt: null },
  );
});

test('history retains each week submission and response and does not fall back to created_at', () => {
  const rows = [
    internal({ id: 'w32', week_ref: '2026-W32', submitted_at: '2026-08-05T10:00:00.000Z', coach_reply: 'Resposta A' }),
    internal({ id: 'w33', week_ref: '2026-W33', submitted_at: '2026-08-12T18:30:00.000Z', coach_reply: 'Resposta B' }),
    internal({ id: 'legacy', week_ref: '2026-W31', submitted_at: null, created_at: '2026-07-30T10:00:00.000Z' }),
  ].map((row) => presentPublicWeeklyFeedback(row));
  assert.deepEqual(rows.slice(0, 2).map(({ weekRef, submittedAt, professionalResponse }) => ({ weekRef, submittedAt, message: professionalResponse.message })), [
    { weekRef: '2026-W32', submittedAt: '2026-08-05T10:00:00.000Z', message: 'Resposta A' },
    { weekRef: '2026-W33', submittedAt: '2026-08-12T18:30:00.000Z', message: 'Resposta B' },
  ]);
  assert.equal(rows[2].submittedAt, null);
});
