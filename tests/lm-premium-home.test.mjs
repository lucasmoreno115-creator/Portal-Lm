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
    ['Plano Alimentar', home.indexOf("<a class='primary-action-link' href='portal-plano-alimentar.html'")],
    ['Treino', home.indexOf("<a class='primary-action-link' href='https://www.mfitpersonal.com.br/app.jsp'")],
    ['Check-in', home.indexOf("<a class='secondary-link' href='portal-checkin.html'")],
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
  assert.match(home, /<section class='primary-actions[\s\S]*?portal-plano-alimentar\.html[\s\S]*?Plano Alimentar[\s\S]*?mfitpersonal[\s\S]*?Treino[\s\S]*?<\/section>/s);
  assert.match(home, /<section class='secondary-actions[\s\S]*?portal-checkin\.html[\s\S]*?Check-in[\s\S]*?portal-biblioteca\.html[\s\S]*?Biblioteca[\s\S]*?wa\.me[\s\S]*?Preciso de ajuda[\s\S]*?<\/section>/s);

  for (const href of ['portal-plano-alimentar.html', 'portal-checkin.html', 'portal-biblioteca.html', 'https://www.mfitpersonal.com.br/app.jsp']) {
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
