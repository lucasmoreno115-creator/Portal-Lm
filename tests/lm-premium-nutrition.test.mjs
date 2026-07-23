import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const nutrition = fs.readFileSync('portal-plano-alimentar.html', 'utf8');

test('Premium nutrition keeps the execution sections in the intended order', () => {
  assert.doesNotMatch(nutrition, /Estrat.gia|acc-strategy|plan\.strategy/);
  const headings = ['Refei&ccedil;&otilde;es', 'Observa&ccedil;&otilde;es', 'Ferramentas', 'Suporte'];
  let previous = -1;
  for (const heading of headings) {
    const index = nutrition.indexOf(heading);
    assert.ok(index > previous, `${heading} should follow the preceding section`);
    previous = index;
  }
  assert.match(nutrition, /downloadPdfBtn/);
  assert.match(nutrition, /renderMealContent\(meal/);
  assert.match(nutrition, /observations \|\| plan\.notes/);
  assert.match(nutrition, /buildFoodConverterSection/);
  assert.match(nutrition, /supportSection/);
  for (const headerField of ['Consultoria LM', 'Plano Alimentar', 'premiumStudentName', 'premiumPlanUpdatedAt', 'premiumPlanGoal']) {
    assert.match(nutrition, new RegExp(headerField));
  }
  assert.match(nutrition, /premiumStudentName\.textContent = localStorage\.getItem\('lm_student_name'\) \|\| 'Aluno'/);
  assert.match(nutrition, /premiumPlanUpdatedAt\.textContent = formatPlanDate\(plan\.updated_at \|\| plan\.published_at\)/);
  assert.match(nutrition, /premiumPlanGoal\.textContent = plan\.goal \|\| 'Não informado\.'/);
  assert.match(nutrition, /window\.print\(\)/);
  assert.doesNotMatch(nutrition, /Seu planejamento nutricional foi preparado especialmente para você\./);
  assert.doesNotMatch(nutrition, /nutrition-accordion|data-accordion|acc-meals/);
  assert.match(nutrition, /class='meal-list'/);
  assert.match(nutrition, /class='meal-equivalences'/);
  assert.match(nutrition, /pdfActions\.hidden = false/);
  assert.match(nutrition, /id='pdfActions' class='nutrition-actions' hidden><button id='downloadPdfBtn'/);
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
