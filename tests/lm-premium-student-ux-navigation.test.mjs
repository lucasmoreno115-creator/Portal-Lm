import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const nutritionSources = [
  fs.readFileSync('portal-premium-nutrition-plan.html', 'utf8'),
  fs.readFileSync('public/portal-premium-nutrition-plan.html', 'utf8'),
];
const homeSources = [
  fs.readFileSync('portal-premium-home.html', 'utf8'),
  fs.readFileSync('public/portal-premium-home.html', 'utf8'),
];

test('canonical Nutrition has a deterministic Home escape outside dynamic states', () => {
  for (const source of nutritionSources) {
    const navigation = source.match(/<nav class="page-navigation"[\s\S]*?<\/nav>/)?.[0];
    assert.ok(navigation, 'Nutrition must expose persistent page navigation.');
    assert.match(navigation, /<a class="home-return" href="portal-premium-home\.html">Voltar para a página inicial<\/a>/);
    assert.ok(source.indexOf(navigation) < source.indexOf('<section id="app"'), 'Navigation must be outside the replaceable app state.');
    assert.doesNotMatch(navigation, /history\.back|onclick/);
    assert.match(source, /portal-premium-nutrition-plan\.js/);
  }
  for (const source of nutritionSources) {
    assert.match(source, /\.home-return\{[^}]*min-height:44px[^}]*max-width:100%/);
    assert.match(source, /@media print\{\.page-navigation\{display:none\}\}/);
  }
});

test('Premium Home exposes only neutral loading before ACTIVE authorization', () => {
  for (const source of homeSources) {
    const loadingIndex = source.indexOf("id='accessLoading'");
    const contentIndex = source.indexOf("id='premiumContent' hidden");
    assert.ok(loadingIndex > -1 && contentIndex > loadingIndex);
    assert.match(source, /id='accessLoading'[^>]*role='status'[^>]*aria-live='polite'/);
    assert.match(source, /Carregando seu portal\.\.\./);
    assert.match(source, /id='premiumContent' hidden/);
    assert.doesNotMatch(source, /body\{visibility:hidden\}/);
    assert.match(source, /experience !== 'PREMIUM_PORTAL' \|\| response\.data\.consultationStatus !== 'ACTIVE'/);
    assert.match(source, /if \(!allowed\) return;[\s\S]*?accessLoading'\)\.hidden = true;[\s\S]*?premiumContent'\)\.hidden = false;/);
  }
});

test('non-ACTIVE and failed access-state paths never execute the Home reveal branch', () => {
  for (const source of homeSources) {
    const authorization = source.slice(source.indexOf("api('/portal/premium/access-state')"), source.indexOf('</script>', source.indexOf("api('/portal/premium/access-state')")));
    assert.match(authorization, /consultationStatus !== 'ACTIVE'/);
    assert.match(authorization, /return false/);
    assert.match(authorization, /\.catch\(\(\) => \{ window\.location\.replace\('portal-login\.html'\); return false; \}\)/);
  }
});
