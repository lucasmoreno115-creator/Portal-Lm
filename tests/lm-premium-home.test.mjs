import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const home = fs.readFileSync('portal-premium-home.html', 'utf8');
const publicHome = fs.readFileSync('public/portal-premium-home.html', 'utf8');
const css = fs.readFileSync('portal.css', 'utf8');

function indexOfLabel(label) {
  const index = home.indexOf(label);
  assert.notEqual(index, -1, `Expected ${label} in the Premium home.`);
  return index;
}

test('Premium home presents direction, guidance, and execution in DOM order', () => {
  const sections = [
    ['Objetivos do planejamento', indexOfLabel('Objetivos do planejamento')],
    ['Meu conselho para você', indexOfLabel('Meu conselho para você')],
    ['Plano Alimentar', home.indexOf("<a class='primary-action-link' href='portal-premium-nutrition-plan.html'")],
    ['Treino', home.indexOf("<a class='primary-action-link' href='https://www.mfitpersonal.com.br/app.jsp'")],
    ['Check-in', home.indexOf("href='portal-premium-weekly-feedback.html'")],
    ['Biblioteca', home.indexOf("<a class='secondary-link' href='portal-biblioteca.html'")],
    ['Preciso de ajuda', home.indexOf("<a class='secondary-link' href='https://wa.me/")],
  ];

  for (const [label, index] of sections) assert.notEqual(index, -1, `Expected ${label} action in the Premium home.`);
  for (let index = 1; index < sections.length; index += 1) {
    assert.ok(sections[index - 1][1] < sections[index][1], `${sections[index - 1][0]} must precede ${sections[index][0]}.`);
  }

  assert.match(home, /<section class='planning[\s\S]*?<\/section>\s*<section class='coach-message[\s\S]*?<\/section>\s*<section class='primary-actions[\s\S]*?<\/section>\s*<section class='secondary-actions/s);
  assert.doesNotMatch(home, /Status da semana|status-week-section|statusLabel|weeklyStatus/);
  assert.doesNotMatch(home, /Jornada LM|journey-card-v6|journeyList/);
  assert.match(home, /api\('\/portal\/weekly-plan'\)/);
  assert.doesNotMatch(home, /api\('\/portal\/checkins'\)/);
});

test('Premium home keeps primary and secondary actions unique and visually aligned with their DOM order', () => {
  assert.match(home, /<section class='primary-actions[\s\S]*?portal-premium-nutrition-plan\.html[\s\S]*?Plano Alimentar[\s\S]*?mfitpersonal[\s\S]*?Treino[\s\S]*?<\/section>/s);
  assert.match(home, /<section class='secondary-actions[\s\S]*?portal-premium-weekly-feedback\.html[\s\S]*?Check-in[\s\S]*?portal-biblioteca\.html[\s\S]*?Biblioteca[\s\S]*?wa\.me[\s\S]*?Preciso de ajuda[\s\S]*?<\/section>/s);

  for (const href of ['portal-premium-nutrition-plan.html', 'portal-premium-weekly-feedback.html', 'portal-biblioteca.html', 'https://www.mfitpersonal.com.br/app.jsp']) {
    assert.equal((home.match(new RegExp(href.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length, 1, `${href} must not be duplicated.`);
  }

  assert.match(css, /\.primary-actions \.action-links\{grid-template-columns:repeat\(2,minmax\(0,1fr\)\)\}/);
  assert.match(css, /\.secondary-actions \.action-links\{grid-template-columns:repeat\(3,minmax\(0,1fr\)\)\}/);
  assert.match(css, /@media \(max-width:720px\)\{[\s\S]*?\.primary-actions \.action-links,[\s\S]*?grid-template-columns:1fr/s);
});

test('deployable Premium home preserves the same structural hierarchy', () => {
  assert.equal(
    publicHome.slice(publicHome.indexOf("    <section class='planning"), publicHome.indexOf('  </main>')),
    home.slice(home.indexOf("    <section class='planning"), home.indexOf('  </main>')),
  );
});


test('Premium home uses a concise greeting and compact visual hero copy', () => {
  for (const source of [home, publicHome]) {
    assert.match(source, /<h1 id='hello'>Olá, Aluno<\/h1>/);
    assert.match(source, /<p id='heroSubtext' class='hero-subtext'>Seu planejamento está disponível\.<\/p>/);
    assert.doesNotMatch(source, /Seu planejamento foi preparado especialmente para você\./);
    assert.match(source, /function shortGreetingName\(fullName\)/);
    assert.match(source, /return `\$\{parts\[0\]\} \$\{parts\.at\(-1\)\}`/);
    assert.match(source, /Olá, \$\{shortGreetingName\(localStorage\.getItem\('lm_student_name'\)\)\}/);

    const heroMarkup = source.slice(source.indexOf("  <section class='hero hero-premium hero-app'>"), source.indexOf("  <main class='container home-main'>"));
    assert.doesNotMatch(heroMarkup, /primary-cta|secondary-link|<a\b|<button\b|CTA/i);
  }

  assert.match(css, /\.portal-home-v7 \.hero-app\{[\s\S]*?min-height:120px;[\s\S]*?height:auto;[\s\S]*?border:1px solid rgba\(212,175,55,\.34\);[\s\S]*?rgba\(212,175,55,\.08\)/);
  assert.match(css, /\.portal-home-v7 \.hero-app \.hero-content\{padding:26px 32px;max-width:760px\}/);
  assert.match(css, /@media \(max-width:720px\)\{\.portal-home-v7 \.hero-app\{min-height:auto;height:auto;[\s\S]*?\.portal-home-v7 \.hero-app \.hero-content\{min-height:auto;padding:20px\}/);
  assert.match(css, /@media \(prefers-reduced-motion:reduce\)\{\.nutrition-observations-panel\{animation:none\}\}/);
});

test('Premium home compact hero CSS is synchronized between canonical and public copies', () => {
  const publicCss = fs.readFileSync('public/portal.css', 'utf8');
  const blockPattern = /\/\* Sprint U2\.7: compact Premium home hero\. \*\/[\s\S]*?(?=\.nutrition-plan-hero)/;
  assert.equal(css.match(blockPattern)?.[0], publicCss.match(blockPattern)?.[0]);
});
