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
  assert.match(nutrition, /Seu planejamento nutricional foi preparado especialmente para você\./);
  assert.doesNotMatch(nutrition, /nutrition-accordion|data-accordion|acc-meals/);
  assert.match(nutrition, /class='meal-list'/);
  assert.match(nutrition, /class='meal-equivalences'/);
  assert.match(nutrition, /class='nutrition-actions'><button id='downloadPdfBtn'/);
});
