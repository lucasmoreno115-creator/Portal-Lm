import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';

const html=await readFile(new URL('../public/admin-premium-student-record.html',import.meta.url),'utf8');
const js=await readFile(new URL('../public/assets/js/admin-premium-student-record.20260810-2.js',import.meta.url),'utf8');

test('Student Record exposes confirmed, single-submit deactivation and preserves the ended record',()=>{
 assert.match(html,/Acesso do aluno/);assert.match(js,/Desativar aluno/);assert.match(js,/todo o histórico será preservado/);
 assert.match(js,/deactivationSubmitting/);assert.match(js,/aria-busy/);assert.match(js,/Desativando\.\.\./);
 assert.match(js,/status!==['"]ENDED['"]/);assert.match(js,/deactivated_at/);assert.doesNotMatch(`${html}\n${js}`,/Excluir aluno|Apagar cadastro/);
 assert.equal((js.match(/\/deactivate`/g)||[]).length,1,'one canonical command call');
});
