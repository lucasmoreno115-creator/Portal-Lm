import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const portal = fs.readFileSync('public/portal-plano-alimentar.html', 'utf8');
const css = fs.readFileSync('public/portal.css', 'utf8');

test('premium print header identifies the student, update date, and objective', () => {
  for (const value of ['Consultoria LM', 'Plano Alimentar', 'premiumStudentName', 'premiumPlanUpdatedAt', 'premiumPlanGoal', 'formatPlanDate', 'plan.updated_at || plan.published_at']) {
    assert.match(portal, new RegExp(value));
  }
});

test('the portal structure is the sole PDF source and retains the shared meal renderer', () => {
  assert.match(portal, /renderMealContent\(meal/);
  assert.match(portal, /content\.substitutionsHtml/);
  assert.match(portal, /window\.print\(\)/);
  assert.doesNotMatch(portal, /portal-plano-alimentar-print/);
  assert.equal(fs.existsSync('public/portal-plano-alimentar-print.html'), false);
});

test('print styles expand equivalences and keep meal blocks together', () => {
  assert.match(css, /@media print/);
  assert.match(css, /\.meal-equivalences\[hidden\][^{]*\{\s*display: block !important/);
  assert.match(css, /\.meal-equivalences-toggle[^{]*\{\s*display: none !important/);
  assert.match(css, /\.meal-card \{[^}]*break-inside: avoid/);
  assert.match(css, /page-break-inside: avoid/);
});

test('print hides application tools and formats document support and footer', () => {
  for (const value of ['#nav, .nutrition-tools-section, #pdfActions, .nutrition-actions', 'support-document-title', 'Consultoria LM\\A Planejamento individual.\\A Documento gerado em:']) {
    assert.match(css, new RegExp(value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
  assert.match(portal, /Dúvidas\?/);
  assert.match(portal, /Entre em contato com seu consultor/);
  assert.match(portal, /WhatsApp:/);
});
