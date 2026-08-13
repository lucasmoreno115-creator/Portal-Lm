import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const html = fs.readFileSync('public/portal-premium-weekly-feedback.html', 'utf8');
const runtime = fs.readFileSync('public/assets/js/portal-premium-weekly-feedback.js', 'utf8');
const css = fs.readFileSync('public/assets/css/portal-premium-weekly-feedback.css', 'utf8');
const home = fs.readFileSync('public/portal-premium-home.html', 'utf8');

function loadHelpers() {
  const window = { addEventListener() {} };
  vm.runInNewContext(runtime, { window, Intl, Date, console, Object, String, Number });
  return window.WeeklyFeedbackUI;
}

test('Premium Home uses the canonical route and a fail-safe state-aware summary', () => {
  assert.match(home, /href='portal-premium-weekly-feedback\.html'[^>]*data-feature='checkin'/);
  assert.doesNotMatch(home, /href='portal-checkin\.html'[^>]*data-feature='checkin'/);
  assert.match(home, /api\('\/portal\/premium\/weekly-feedback\/current'\)/);
  for (const copy of ['Responder check-in', 'Aguardando análise', 'Acompanhar check-in', 'Resposta disponível', 'Ver resposta']) assert.match(home, new RegExp(copy));
  assert.match(home, /catch \(_\)[\s\S]*Check-in semanal[\s\S]*Acompanhe seu check-in semanal/);
});

test('canonical page exposes independent current and history loading, retry, and accessibility regions', () => {
  for (const id of ['currentSection', 'currentStatus', 'currentContent', 'retryCurrent', 'history', 'retryHistory']) assert.match(html, new RegExp(`id="${id}"`));
  assert.match(html, /Carregando seu check-in\.\.\./);
  assert.match(html, /Carregando histórico\.\.\./);
  assert.match(html, /aria-live="polite"/);
  assert.match(html, /aria-busy="true"/);
  assert.match(runtime, /async function loadCurrent\(\)/);
  assert.match(runtime, /async function loadHistory\(\)/);
  assert.match(runtime, /retryCurrent[^\n]*loadCurrent/);
  assert.match(runtime, /retryHistory[^\n]*loadHistory/);
});

test('ISO week helper uses Monday through Sunday and formats month/year crossings', () => {
  const { formatWeekRef, isoWeekRange } = loadHelpers();
  const week33 = isoWeekRange('2026-W33');
  assert.equal(week33.monday.toISOString().slice(0, 10), '2026-08-10');
  assert.equal(week33.sunday.toISOString().slice(0, 10), '2026-08-16');
  assert.equal(formatWeekRef('2026-W33'), 'Semana de 10 a 16 de agosto');
  assert.equal(formatWeekRef('2020-W53'), 'Semana de 28 de dezembro de 2020 a 3 de janeiro de 2021');
});

test('dates are fixed to pt-BR and America/Sao_Paulo', () => {
  const { formatPortalDate } = loadHelpers();
  const formatted = formatPortalDate('2026-08-12T20:30:00.000Z');
  assert.match(formatted, /12 de agosto de 2026/);
  assert.match(formatted, /17:30/);
  assert.match(runtime, /PORTAL_LOCALE\s*=\s*'pt-BR'/);
  assert.match(runtime, /PORTAL_TIME_ZONE\s*=\s*'America\/Sao_Paulo'/);
});

test('current states are concrete-field driven, read-only after submit, and safely render professional copy', () => {
  assert.match(runtime, /data\.professionalResponse\?\.message/);
  assert.match(runtime, /if\s*\(data\.submittedAt\)/);
  assert.match(runtime, /data\.status\s*===\s*'NOT_AVAILABLE'/);
  for (const copy of ['Check-in enviado', 'Suas respostas foram recebidas', 'Resposta do seu acompanhamento', 'Seu check-in foi analisado. A resposta ainda não está disponível.', 'Enviar check-in']) assert.match(runtime, new RegExp(copy));
  assert.match(runtime, /professional-response-message',\s*response\.message/);
  assert.doesNotMatch(runtime, /professional[^\n]*innerHTML|response\.message[^\n]*innerHTML/);
  assert.match(css, /\.professional-response-message\{white-space:pre-wrap;overflow-wrap:anywhere\}/);
});

test('temporary history adapter creates weekly details for replies, pending, and empty history', () => {
  const { adaptHistoricalFeedback } = loadHelpers();
  assert.deepEqual(
    JSON.parse(JSON.stringify(adaptHistoricalFeedback({ coach_reply: 'Ótima semana.', coach_reply_at: '2026-08-12T20:30:00.000Z' }).professionalResponse)),
    { message: 'Ótima semana.', respondedAt: '2026-08-12T20:30:00.000Z' },
  );
  assert.equal(adaptHistoricalFeedback({ coach_reply: null }).professionalResponse, null);
  assert.match(runtime, /Temporary adapter until F2\.3\.3 normalizes the public history contract/);
  assert.match(runtime, /element\('details',\s*'weekly-feedback-history-item'\)/);
  for (const copy of ['Suas respostas', 'Resposta do seu acompanhamento', 'Aguardando resposta do seu acompanhamento.', 'Você ainda não enviou check-ins.']) assert.match(runtime, new RegExp(copy));
});

test('answer allowlist excludes internal and transport fields from visual rendering', () => {
  const { normalizeAnswers } = loadHelpers();
  const visible = normalizeAnswers({
    training_adherence: 'Boa', decision_type: 'KEEP', decision_note: 'interno', followup_at: 'amanhã',
    reviewed_by: 'admin', decision_by: 'admin', priority: 'HIGH', coach_status: 'reviewed', coach_reply: 'reply', id: '1', student_email: 'x@example.com', created_at: 'today',
  });
  assert.deepEqual(JSON.parse(JSON.stringify(visible.map(({ key, value }) => ({ key, value })))), [{ key: 'training_adherence', value: 'Boa' }]);
});

test('submit blocks duplicates and reloads both persisted states', () => {
  assert.match(runtime, /if\s*\(isSubmitting\)\s*return/);
  assert.match(runtime, /button\.disabled\s*=\s*true/);
  assert.match(runtime, /button\.textContent\s*=\s*'Enviando\.\.\.'/);
  assert.match(runtime, /Promise\.all\(\[loadCurrent\(\),\s*loadHistory\(\)\]\)/);
  assert.match(runtime, /method:\s*'POST'/);
});

test('runtime and CSS deployable copies remain byte-identical', () => {
  assert.equal(fs.readFileSync('public/portal-premium-weekly-feedback.js', 'utf8'), runtime);
  assert.equal(fs.readFileSync('public/portal-premium-weekly-feedback.css', 'utf8'), css);
});
