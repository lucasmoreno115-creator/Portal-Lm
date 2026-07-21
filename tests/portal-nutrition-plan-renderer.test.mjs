import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const source = fs.readFileSync('public/assets/js/premium-nutrition-plan-renderer.js', 'utf8');
const context = { window: {} };
vm.runInNewContext(source, context);
const renderer = context.window.PortalNutritionPlanRenderer;

const textualPlan = {
  goal: 'Ganhar massa magra', strategy: 'Aumentar calorias no pré-treino',
  meals: [
    { name: 'Almoço', guidance: 'Comer sem pressa', primary_text: '180 g de peito de frango\n150 g de arroz\n100 g de feijão\nSalada à vontade', substitutions: [{ text: '150 g de batata\n150 g de carne moída' }, { text: '200 g de mandioca\n150 g de frango' }] },
    { name: 'Lanche / Pré-treino', primary_text: '30 g de whey\n1 banana' },
    { name: 'Jantar', primary_text: '180 g de peito de frango\n150 g de arroz\nSalada à vontade' }
  ], substitutions: [{ category: 'Carboidratos', reference: 'Arroz', items: ['Batata'] }]
};

test('textual v2 meals preserve all lines and keep substitutions scoped to their meal', () => {
  const lunch = renderer.renderMealContent(textualPlan.meals[0]);
  const snack = renderer.renderMealContent(textualPlan.meals[1]);
  assert.match(lunch.primaryHtml, /180 g de peito de frango\n150 g de arroz/);
  assert.match(lunch.substitutionsHtml, /Substituições/);
  assert.match(lunch.substitutionsHtml, /Alternativa 1/);
  assert.match(lunch.substitutionsHtml, /Alternativa 2/);
  assert.doesNotMatch(snack.substitutionsHtml, /Alternativa/);
  assert.equal(textualPlan.meals.map((meal) => renderer.getMealPrimaryLines(meal).length).join(','), '4,2,3');
});

test('legacy string and structured items render every item without undefined', () => {
  const strings = renderer.renderMealContent({ items: ['100 g de arroz', '150 g de frango'] }).primaryHtml;
  const objects = renderer.renderMealContent({ items: [{ food: 'Arroz', quantity: '100', unit: 'g', note: 'cozido' }, { food: 'Frango', quantity: '150', unit: 'g' }] }).primaryHtml;
  assert.match(strings, /100 g de arroz\n150 g de frango/);
  assert.match(objects, /100 g de Arroz — cozido\n150 g de Frango/);
  assert.doesNotMatch(objects, /undefined/);
});

test('text and structured substitutions are normalized and malicious content is escaped', () => {
  const substitutions = renderer.getMealSubstitutions({ substitutions: [{ text: '150 g de batata\n150 g de carne' }, { food: 'Batata', quantity: '150', unit: 'g' }, '<img src=x onerror=alert(1)>' ] });
  assert.deepEqual(JSON.parse(JSON.stringify(substitutions)), [['150 g de batata', '150 g de carne'], ['150 g de Batata'], ['<img src=x onerror=alert(1)>']]);
  assert.match(renderer.renderLines(substitutions[2]), /&lt;img/);
  assert.doesNotMatch(renderer.renderLines(substitutions[2]), /<img/);
});

test('portal and print pages share the renderer and preserve the established endpoint', () => {
  for (const file of ['public/portal-plano-alimentar.html', 'public/portal-plano-alimentar-print.html']) {
    const html = fs.readFileSync(file, 'utf8');
    assert.match(html, /premium-nutrition-plan-renderer\.js/);
    assert.match(html, /\/portal\/nutrition-plan/);
  }
  const portal = fs.readFileSync('public/portal-plano-alimentar.html', 'utf8');
  assert.match(portal, /plan\.goal \|\| 'Objetivo não informado'/);
  assert.match(portal, /plan\.strategy \|\| 'Estratégia não informada'/);
  assert.match(portal, /meal\?\.guidance/);
});
