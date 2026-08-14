import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';

test('Student Record exposes confirmed, single-submit reactivation only for ended students',async()=>{
 const [canonical,asset]=await Promise.all([readFile('public/admin-premium-student-record.js','utf8'),readFile('public/assets/js/admin-premium-student-record.20260810-2.js','utf8')]);
 assert.equal(canonical,asset,'deployed asset stays byte-identical to canonical script');
 assert.match(canonical,/status\s*===\s*['"]ENDED['"][\s\S]*?Reativar aluno/);
 assert.match(canonical,/pendências operacionais ainda abertas poderão voltar a aparecer no Workspace/);
 assert.match(canonical,/reactivationSubmitting/);assert.match(canonical,/aria-busy/);assert.match(canonical,/Reativando\.\.\./);
 assert.equal((canonical.match(/\/reactivate`/g)||[]).length,1,'one canonical command call');
 assert.match(canonical,/reactivated_at/);assert.match(canonical,/Última desativação/);
});
