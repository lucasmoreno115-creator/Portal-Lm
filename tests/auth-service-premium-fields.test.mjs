import assert from 'node:assert/strict';
import test from 'node:test';
import { getOptionalPremiumStudentAccessFields, validateStudent } from '../workers/services/auth-service.js';

function request() { return new Request('https://portal.test', { headers: { 'x-student-email': 'student@example.com', 'x-student-token': 'token' } }); }

test('validateStudent remains compatible with the minimum student_access schema', async () => {
  const calls = [];
  const db = { prepare(sql) { calls.push(sql); return { bind() { return { async first() { return { id: 'access-1', name: 'Student', email: 'student@example.com', plan_type: 'PROJECT_LM', plan: 'projeto_lm' }; } }; } }; } };
  const auth = await validateStudent(request(), db);
  assert.equal(auth.ok, true); assert.equal(auth.student.plan, 'projeto_lm');
  assert.match(calls[0], /SELECT id, name, email, plan_type, plan\s+FROM student_access/);
  assert.doesNotMatch(calls[0], /whatsapp|student_id/);
});

test('optional Premium access fields gracefully fall back when legacy columns do not exist', async () => {
  const db = { prepare() { throw new Error('no such column: whatsapp'); } };
  assert.deepEqual(await getOptionalPremiumStudentAccessFields(db, 'access-1'), { whatsapp: null, studentId: null });
});

test('optional Premium access fields preserve whatsapp and student_id when available', async () => {
  const db = { prepare() { return { bind() { return { async first() { return { whatsapp: '5511999999999', student_id: 'student-1' }; } }; } }; } };
  assert.deepEqual(await getOptionalPremiumStudentAccessFields(db, 'access-1'), { whatsapp: '5511999999999', studentId: 'student-1' });
});
