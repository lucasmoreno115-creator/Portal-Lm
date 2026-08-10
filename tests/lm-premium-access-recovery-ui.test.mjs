import assert from 'node:assert/strict';
import test from 'node:test';
import { access, readFile } from 'node:fs/promises';

test('Student Record oferece emissão recuperável com confirmação, resultado e cópia segura', async () => {
  const source = await readFile('public/admin-premium-student-record.js', 'utf8');
  for (const text of [
    'Gerar novo acesso',
    'Será criado um novo código de acesso para esta aluna. Um código anterior, se existir, deixará de funcionar.',
    'Link de acesso',
    'Código de acesso',
    'Copiar mensagem de acesso',
    'Novo acesso criado. Link, código e mensagem estão disponíveis para cópia.'
  ]) assert.match(source, new RegExp(text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.match(source, /\['NEW', 'AWAITING_ANAMNESIS'\]\.includes\(status\)/);
  assert.match(source, /\/api\/admin\/premium\/workspace\/students\/\$\{encodeURIComponent\(studentId\)\}\/access/);
  assert.match(source, /if \(!copied\) throw new Error/);
});

test('cópias públicas do runtime de recuperação permanecem sincronizadas', async () => {
  const [source, asset] = await Promise.all([
    readFile('public/admin-premium-student-record.js', 'utf8'),
    readFile('public/assets/js/admin-premium-student-record.20260810-1.js', 'utf8')
  ]);
  assert.equal(asset, source);
});

test('HTML usa exclusivamente o runtime fingerprintado e o asset público antigo foi removido', async () => {
  const html = await readFile('public/admin-premium-student-record.html', 'utf8');
  assert.match(html, /src="\/assets\/js\/admin-premium-student-record\.20260810-1\.js"/);
  assert.doesNotMatch(html, /src="\/assets\/js\/admin-premium-student-record\.js"/);
  await assert.rejects(access('public/assets/js/admin-premium-student-record.js'));
});
