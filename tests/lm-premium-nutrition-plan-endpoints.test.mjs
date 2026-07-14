import test from 'node:test'; import assert from 'node:assert/strict'; import fs from 'node:fs';
test('worker registers student and admin nutrition plan workflow endpoints',()=>{ const src=fs.readFileSync('workers/api.js','utf8'); assert.match(src,/\/api\/portal\/premium\/nutrition-plan\/current/); assert.match(src,/admin.*premium.*students/); assert.match(src,/duplicate-as-draft/); });
