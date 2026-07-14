import test from 'node:test'; import assert from 'node:assert/strict'; import fs from 'node:fs';
test('new nutrition UIs avoid dynamic innerHTML',()=>{ for (const f of ['public/admin-premium-nutrition-plan.js','public/portal-premium-nutrition-plan.js']) { const src=fs.readFileSync(f,'utf8'); assert.doesNotMatch(src,/\.innerHTML\s*=/); assert.match(src,/textContent/); } });
