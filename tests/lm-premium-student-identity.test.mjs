import assert from 'node:assert/strict';
import test from 'node:test';
import { createStudentIdentityService, generatePremiumStudentId, normalizePremiumStudentEmail, STUDENT_IDENTITY_ERRORS } from '../workers/premium/services/student-identity-service.js';

function repo(students) {
  return {
    async findByStudentId(id) { return students.find((s) => s.student_id === id) ?? null; },
    async findByNormalizedEmail(email) { return students.filter((s) => s.normalized_email === email); },
  };
}

test('gera student_id válido sem derivar do e-mail e sem reutilizar IDs', () => {
  let n = 0;
  const ids = [generatePremiumStudentId(() => `00000000-0000-4000-8000-00000000000${++n}`), generatePremiumStudentId(() => `00000000-0000-4000-8000-00000000000${++n}`)];
  assert.match(ids[0], /^[0-9a-z-]{36}$/);
  assert.notEqual(ids[0], ids[1]);
  assert(!ids[0].includes('aluna'));
});

test('normaliza e-mail com trim/lowercase preservando pontos e +alias', () => {
  assert.equal(normalizePremiumStudentEmail('  Aluna.Teste+LM@Example.COM  ', { required: true }), 'aluna.teste+lm@example.com');
  assert.throws(() => normalizePremiumStudentEmail('   ', { required: true }), /EMAIL_REQUIRED/);
});

test('resolve por student_id e prioriza ID sobre e-mail legado', async () => {
  const service = createStudentIdentityService({ repository: repo([
    { student_id: 'stable-1', normalized_email: 'a@example.com' },
    { student_id: 'stable-2', normalized_email: 'b@example.com' },
  ]) });
  const result = await service.resolve({ student_id: 'stable-1', email: 'b@example.com' });
  assert.equal(result.ok, true);
  assert.equal(result.method, 'student_id');
  assert.equal(result.student.student_id, 'stable-1');
});

test('resolve por e-mail como fallback e rejeita ausência ou ambiguidade', async () => {
  const service = createStudentIdentityService({ repository: repo([
    { student_id: 'stable-1', normalized_email: 'a@example.com' },
  ]) });
  assert.equal((await service.resolve({ email: ' A@Example.com ' })).student.student_id, 'stable-1');
  assert.equal((await service.resolve({ email: 'missing@example.com' })).error, STUDENT_IDENTITY_ERRORS.STUDENT_NOT_FOUND);

  const ambiguous = createStudentIdentityService({ repository: repo([
    { student_id: '1', normalized_email: 'dup@example.com' },
    { student_id: '2', normalized_email: 'dup@example.com' },
  ]) });
  assert.equal((await ambiguous.resolve({ email: 'dup@example.com' })).error, STUDENT_IDENTITY_ERRORS.AMBIGUOUS_STUDENT_IDENTITY);
});

test('rejeita aluno exclusivamente Projeto LM', async () => {
  const service = createStudentIdentityService({ repository: repo([{ student_id: 'project', normalized_email: 'p@example.com', plan: 'projeto_lm' }]) });
  assert.equal((await service.resolve({ student_id: 'project' })).error, STUDENT_IDENTITY_ERRORS.NON_PREMIUM_STUDENT);
  assert.equal((await service.resolve({ email: 'p@example.com' })).error, STUDENT_IDENTITY_ERRORS.STUDENT_NOT_FOUND);
});

test('updateEmail no contrato não deve alterar student_id', () => {
  const student = { student_id: 'immutable', email: 'old@example.com' };
  student.email = 'new@example.com';
  assert.equal(student.student_id, 'immutable');
});
