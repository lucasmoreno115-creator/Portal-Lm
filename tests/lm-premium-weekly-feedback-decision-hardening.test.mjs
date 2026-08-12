import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';

const useCase = await readFile(new URL('../workers/premium/application/record-professional-decision.js', import.meta.url), 'utf8');
const worker = await readFile(new URL('../workers/api.js', import.meta.url), 'utf8');
const repository = await readFile(new URL('../workers/premium/repositories/d1-weekly-feedback-repository.js', import.meta.url), 'utf8');

test('comando exige reply normalizado e distingue retry idêntico de conflito estável', () => {
  assert.match(useCase, /code: 'COACH_REPLY_REQUIRED'/);
  assert.match(useCase, /decisionsEqual\(requested, persistedDecision\(feedback\)\)/);
  assert.match(useCase, /code: 'WEEKLY_FEEDBACK_ALREADY_REVIEWED'/);
  for (const field of ['decision_type', 'note', 'coach_reply', 'followup_at']) assert.match(useCase, new RegExp(`${field}:`));
});

test('primeira decisão usa batch obrigatório e condiciona todos os efeitos à entrada vencedora', () => {
  assert.match(useCase, /typeof db\.batch !== 'function'/);
  assert.doesNotMatch(useCase, /Promise\.all\(statements/);
  assert.match(useCase, /const ownership = `EXISTS/);
  assert.equal((useCase.match(/\$\{ownership\}/g) || []).length, 3, 'check-in, resolução e pending derivado devem pertencer ao insert vencedor');
  assert.match(useCase, /submitted_at IS NOT NULL/);
  assert.match(useCase, /NOT IN \('REVIEWED','REPLIED','ANALYZED','ANALISADO','ANALISADA'\)/);
});

test('rota canônica chama somente o comando profissional e preserva isolamento Premium no repository', () => {
  const canonical = worker.slice(worker.indexOf("if (/^\\/api\\/admin\\/premium\\/(weekly-feedbacks|feedbacks)"), worker.indexOf("if (url.pathname === '/api/admin/command-center'"));
  assert.match(canonical, /recordProfessionalDecision/);
  assert.doesNotMatch(canonical, /\/api\/admin\/checkins|saveProfessionalDecision|coach_status:/);
  assert.match(canonical, /code: result\.code/);
  assert.match(repository, /EXISTS \(SELECT 1 FROM premium_students ps WHERE ps\.student_id=COALESCE/);
});
