import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const nutrition = fs.readFileSync('portal-plano-alimentar.html', 'utf8');

test('Premium nutrition presents only the essential screen header and preserves the full student name', () => {
  assert.match(nutrition, /Consultoria LM/);
  assert.match(nutrition, /<h1>Planejamento Alimentar<\/h1>/);
  assert.match(nutrition, /id='premiumStudentName'/);
  assert.match(nutrition, /premiumStudentName\.textContent = localStorage\.getItem\('lm_student_name'\) \|\| 'Aluno'/);
  assert.doesNotMatch(nutrition, /premiumPlanGoal/);
  assert.match(nutrition, /premium-plan-details print-only/);
  assert.match(nutrition, /premiumPlanUpdatedAt\.textContent = formatPlanDate\(plan\.updated_at \|\| plan\.published_at\)/);
  assert.match(nutrition, /window\.print\(\)/);
});

test('meal equivalences are independently accessible, closed by default, and absent when empty', () => {
  assert.match(nutrition, /function renderEquivalencesToggle\(panelId, content\)/);
  assert.match(nutrition, /class='meal-equivalences-toggle' aria-expanded='false' aria-controls='\$\{panelId\}'/);
  assert.match(nutrition, /const panelId = `meal-\$\{index \+ 1\}-equivalences`/);
  assert.match(nutrition, /<div id='\$\{panelId\}' class='meal-equivalences' hidden>/);
  assert.match(nutrition, /renderEquivalencesToggle\(panelId, content\.substitutionsHtml\)/);
  assert.match(nutrition, /button\.setAttribute\('aria-expanded', String\(!expanded\)\)/);
  assert.match(nutrition, /panel\.hidden = expanded/);
  assert.match(nutrition, /event\.target\.closest\('\.meal-equivalences-toggle'\)/);
  assert.match(nutrition, /\(plan\.meals \|\| \[\]\)\.map\(\(meal, index\)/);
});

test('the shared renderer preserves meal quantities and only renders equivalences when supplied', () => {
  const source = fs.readFileSync('public/assets/js/premium-nutrition-plan-renderer.js', 'utf8');
  assert.match(source, /function renderMealEquivalences\(meal\)/);
  assert.match(source, /if \(!substitutions\.length\) return ''/);
  assert.match(source, /Trocas disponíveis/);
  assert.match(source, /meal-equivalence-categories/);
  assert.match(source, /renderMealEquivalences\(meal\)/);
  assert.match(source, /getMealPrimaryContent\(meal\)/);
});

test('premium nutrition uses reusable skeleton, empty, and retryable error states', () => {
  for (const file of ['portal-plano-alimentar.html', 'public/portal-plano-alimentar.html']) {
    const source = fs.readFileSync(file, 'utf8');
    assert.match(source, /function renderLoadingState\(\)/);
    assert.match(source, /portal-skeleton-hero/);
    assert.match(source, /Array\.from\(\{ length: 4 \}/);
    assert.match(source, /function renderStatusState\(type, title, body, actionLabel = ''\)/);
    assert.match(source, /Ainda não existe um planejamento alimentar disponível\./);
    assert.match(source, /Assim que seu consultor publicar a atualização, ela aparecerá aqui\./);
    assert.match(source, /Não foi possível carregar seu planejamento\./);
    assert.match(source, /Tentar novamente/);
    assert.match(source, /async function loadPlan\(\) \{\s*renderLoadingState\(\);/);
  }
  const css = fs.readFileSync('portal.css', 'utf8');
  for (const className of ['.portal-skeleton', '.portal-status-state', '.portal-empty-state', '.portal-error-state']) {
    assert.match(css, new RegExp(className.replace('.', '\\.')));
  }
});

test('premium nutrition omits an empty observations section while preserving optional equivalences', () => {
  assert.match(nutrition, /observationsSection \? `<section class='card nutrition-section nutrition-observations-section' aria-labelledby='notes-heading'>/);
  assert.doesNotMatch(nutrition, /Sem observa&ccedil;&otilde;es\./);
  assert.match(nutrition, /const substitutionsSection = substitutionsHtml \?/);
});


test('nutrition uses substitutions language, collapsible observations, and screen-only WhatsApp support', () => {
  assert.match(nutrition, /Ver substituições/);
  assert.match(nutrition, /Ocultar substituições/);
  assert.doesNotMatch(nutrition, /Ver equivalências/);
  assert.match(nutrition, /nutrition-observations-toggle screen-only' aria-expanded='false' aria-controls='nutrition-observations-panel'/);
  assert.match(nutrition, /id='nutrition-observations-panel'[^>]* hidden/);
  assert.match(nutrition, /nutrition-observations-section/);
  assert.match(nutrition, /support-whatsapp-button[^>]*>Chamar no WhatsApp/);
  assert.match(nutrition, /<div class='print-only'><p class='support-document-title'>Dúvidas\?<\/p><p>Entre em contato com seu consultor\.<\/p><p class='support-whatsapp'>WhatsApp: \+55 14 99117-4500/);
});
