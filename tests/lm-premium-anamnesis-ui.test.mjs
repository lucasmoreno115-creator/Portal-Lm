import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../anamnese-premium.html', import.meta.url), 'utf8');

test('anamnese Premium mantém identidade somente leitura e payload clínico autenticado', () => {
  for (const field of ['personal_full_name', 'personal_email', 'personal_whatsapp']) assert.doesNotMatch(source, new RegExp(`name=['"]${field}['"]`));
  assert.match(source, /Respondendo como/);
  assert.match(source, /identityName/); assert.match(source, /identityEmail/); assert.match(source, /identityPhone/);
  assert.match(source, /JSON\.stringify\(\{answers:answers\(v\)\}\)/);
  assert.doesNotMatch(source, /student_name:v|student_email:v|student_phone:v/);
});

test('rascunho é por identidade e só é apagado após sucesso ou retry idempotente', () => {
  assert.match(source, /lm_premium_anamnesis_draft:\$\{/);
  assert.match(source, /crypto\.subtle\.digest\('SHA-256'/);
  assert.match(source, /if\(res\.status===409\)\{location\.replace\('portal-premium-onboarding\.html'\);return\}/);
  assert.match(source, /localStorage\.removeItem\(storageKey\);location\.replace\('portal-premium-onboarding\.html'\)/);
  assert.match(source, /Suas respostas continuam salvas neste dispositivo/);
});
