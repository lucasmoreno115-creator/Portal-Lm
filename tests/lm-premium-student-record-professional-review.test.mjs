import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const runtime = readFileSync(new URL('../public/admin-premium-student-record.js', import.meta.url), 'utf8');
const runtimeCopy = readFileSync(new URL('../public/assets/js/admin-premium-student-record.20260810-2.js', import.meta.url), 'utf8');
const css = readFileSync(new URL('../public/assets/css/admin-premium-student-record.css', import.meta.url), 'utf8');

test('F2.2.2 renders the accessible professional review form without replacing check-in answers', () => {
  for (const copy of ['Análise profissional', 'Conduta', 'Feedback para o aluno', 'Nota interna', 'Follow-up', 'Enviar feedback e concluir análise']) assert.match(runtime, new RegExp(copy));
  assert.match(runtime, /aria-labelledby', 'weeklyFeedbackReviewHeading'/);
  assert.match(runtime, /setAttribute\('for', id\)/);
  assert.match(runtime, /aria-live', 'polite'/);
  assert.match(runtime, /answers,[\s\S]*dates,[\s\S]*renderProfessionalReview/);
  assert.match(css, /input,select,textarea\{width:100%/);
});

test('F2.2.2 exposes exactly the four canonical professional decisions', () => {
  const match = runtime.match(/const decisionLabels = Object\.freeze\(\{([^}]+)\}\)/);
  assert.ok(match);
  const values = [...match[1].matchAll(/([A-Z_]+):/g)].map((entry) => entry[1]);
  assert.deepEqual(values, ['KEEP_STRATEGY', 'UPDATE_PLAN', 'CONTACT_STUDENT', 'REQUEST_MORE_INFORMATION']);
  for (const invented of ['KEEP_PLAN', 'REQUEST_INFORMATION', 'OTHER', 'CUSTOM']) assert.equal(values.includes(invented), false);
  assert.match(runtime, /decision\.required = true/);
  assert.match(runtime, /textContent: 'Selecione a conduta'/);
  assert.match(runtime, /decisionPlaceholder\.value = ''/);
  assert.match(runtime, /decisionPlaceholder\.selected = true/);
  assert.match(runtime, /decisionPlaceholder\.disabled = true/);
  assert.equal(values.includes(''), false, 'the empty placeholder is not a domain decision');
});

test('F2.2.2 posts only the review command to the canonical opened-feedback endpoint', () => {
  assert.match(runtime, /weekly-feedbacks\/\$\{encodeURIComponent\(activeFeedbackId\)\}\/decision`[\s\S]*method:'POST'/);
  assert.match(runtime, /JSON\.stringify\(\{ decision_type:decision\.value, note:[\s\S]*coach_reply:coachReply, followup_at:/);
  assert.doesNotMatch(runtime, /\/api\/admin\/checkins\//);
  assert.doesNotMatch(runtime, /\/api\/project-lm/);
  assert.doesNotMatch(runtime, /JSON\.stringify\(\{[^}]*coach_status/);
  assert.doesNotMatch(runtime, /JSON\.stringify\(\{[^}]*(student_id|week_ref|reviewed_at)/);
  assert.doesNotMatch(runtime, /pending-items[^\n]*resolve[\s\S]*weekly-feedback-review/);
});

test('F2.2.2 requires trimmed public feedback and protects the request from double submit', () => {
  assert.match(runtime, /if \(!decision\.value\) \{ message\.textContent = 'Selecione a conduta profissional\.'/);
  assert.match(runtime, /decision\.focus\?\.\(\); return;/);
  assert.ok(runtime.indexOf('if (!decision.value)') < runtime.indexOf('await api(`/api/admin/premium/weekly-feedbacks/${encodeURIComponent(activeFeedbackId)}/decision`'), 'the empty-decision guard must run before the request');
  assert.match(runtime, /String\(reply\.value \|\| ''\)\.trim\(\)/);
  assert.match(runtime, /if \(!coachReply\)/);
  assert.match(runtime, /if \(reviewSubmitting \|\| activeFeedbackId !== feedback\.id \|\| feedback\.student_id !== lastStudent\.student_id\) return/);
  assert.match(runtime, /reviewSubmitting = true; form\.setAttribute\('aria-busy', 'true'\); submit\.disabled = true; submit\.textContent = 'Enviando\.\.\.'/);
  assert.match(runtime, /catch \(error\)[\s\S]*reviewSubmitting = false; form\.setAttribute\('aria-busy', 'false'\); submit\.disabled = false/);
});

test('F2.2.2 reloads canonical detail after success and renders analyzed compatibility states read-only', () => {
  assert.match(runtime, /new Set\(\['REVIEWED', 'REPLIED', 'ANALYZED', 'ANALISADO', 'ANALISADA'\]\)/);
  assert.match(runtime, /trim\(\)\.toUpperCase\(\)/);
  assert.match(runtime, /Análise concluída/);
  assert.match(runtime, /if \(!feedback\.submitted_at\)/);
  assert.match(runtime, /await api\(`\/api\/admin\/premium\/weekly-feedbacks\/\$\{encodeURIComponent\(activeFeedbackId\)\}`\)/);
  assert.match(runtime, /renderCheckinDetail\(detail\.feedback, detail\.previousDecision, 'Feedback enviado e análise concluída\.'\)/);
  assert.match(runtime, /await load\(\)/);
  assert.doesNotMatch(runtime, /items\.splice|checkins\.items\.(?:splice|filter)/);
});

test('Student Record runtime copies remain byte-identical', () => {
  assert.equal(runtime, runtimeCopy);
});
