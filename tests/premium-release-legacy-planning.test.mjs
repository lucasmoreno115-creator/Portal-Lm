import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createReleaseLegacyPlanningUseCase } from '../workers/premium/application/release-legacy-planning.js';

test('liberação legada normaliza acesso Premium publicado, preservando identidade e token', async () => {
  const state = { access: { id:'a1', student_id:'s1', name:'Ana', email:'ana@example.com', access_token:'token-preservado', status:'INACTIVE', plan:'premium' }, premium:null, plan:{id:'p1',student_id:null,student_email:'ana@example.com',status:'PUBLISHED',is_active:1}, entries:[] };
  const db = fakeDb(state);
  const result = await createReleaseLegacyPlanningUseCase({ db, randomUUID: () => 'audit-1' })({ student_id:'s1', created_by:'admin' });
  assert.equal(result.ok, true); assert.equal(state.premium.student_id, 's1'); assert.equal(state.premium.source, 'LEGACY_IMPORT'); assert.equal(state.premium.consultation_status, 'ACTIVE'); assert.equal(state.premium.access_status, 'ACTIVE'); assert.equal(state.access.status, 'ACTIVE'); assert.equal(state.access.access_token, 'token-preservado'); assert.equal(state.plan.student_id, 's1');
  const audit = JSON.parse(state.entries[0].content); assert.equal(audit.action, 'release-planning'); assert.equal(audit.origin, 'student_record'); assert.equal(audit.legacyCompatibility, true);
});
test('liberação legada é idempotente para aluno ativo e não libera draft ou Projeto LM', async () => {
  for (const scenario of [{ status:'ACTIVE', plan:'premium', expected:true }, { status:'UNDER_REVIEW', plan:'premium', nutrition:'DRAFT', expected:false }, { status:'UNDER_REVIEW', plan:'projeto_lm', expected:false }]) {
    const state = { access:{id:'a1',student_id:'s1',email:'ana@example.com',status:'INACTIVE',plan:scenario.plan}, premium:{student_id:'s1',email:'ana@example.com',consultation_status:scenario.status,access_status:'ACTIVE'}, plan:{id:'p1',student_id:'s1',student_email:'ana@example.com',status:scenario.nutrition || 'PUBLISHED',is_active:1}, entries:[] };
    const result = await createReleaseLegacyPlanningUseCase({db:fakeDb(state),randomUUID:()=> 'audit'})({student_id:'s1'});
    assert.equal(result.ok, scenario.expected); if (scenario.status === 'ACTIVE') assert.equal(result.data.idempotent, true); else assert.equal(result.status, scenario.plan === 'projeto_lm' ? 403 : 409);
  }
});
test('Prontuário oferece a liberação somente para plano publicado e usa auth admin; Workspace não recebe a ação', () => {
  const record = readFileSync('public/admin-premium-student-record.js','utf8'); const workspace = readFileSync('public/admin-premium-workspace.js','utf8');
  assert.match(record, /hasPublished && student\.consultation_status !== 'ACTIVE'/); assert.match(record, /Liberar planejamento/); assert.match(record, /release-planning/); assert.match(record, /LMAdminAuth\.getAdminAuthHeaders/); assert.doesNotMatch(workspace, /release-planning/);
});
function fakeDb(s) { return { prepare(sql) { let params=[]; return { bind(...v) { params=v; return this; }, async all() { if (sql.includes('FROM student_access WHERE student_id')) return {results:s.access?.student_id===params[0]?[s.access]:[]}; if (sql.includes('FROM premium_students WHERE student_id')) return {results:s.premium?.student_id===params[0]?[s.premium]:[]}; if (sql.includes('FROM nutrition_plans')) return {results:s.plan.status==='PUBLISHED'&&s.plan.is_active===1&&s.plan.student_id===params[0]||s.plan.status==='PUBLISHED'&&s.plan.is_active===1&&s.plan.student_id==null?[s.plan]:[]}; return {results:[]}; }, async run() { if (sql.startsWith('INSERT INTO premium_students')) s.premium={student_id:params[0],email:params[1],normalized_email:params[2],display_name:params[3],consultation_status:'ACTIVE',access_status:'ACTIVE',source:'LEGACY_IMPORT'}; else if (sql.startsWith('UPDATE premium_students')) { s.premium.consultation_status='ACTIVE';s.premium.access_status='ACTIVE'; } else if (sql.startsWith('UPDATE student_access')) s.access.status='ACTIVE'; else if (sql.startsWith('UPDATE nutrition_plans')) s.plan.student_id=params[0]; else if (sql.startsWith('INSERT INTO premium_followup_entries')) s.entries.push({content:params[2]}); return {meta:{changes:1}}; } }; }, async batch(statements) { return Promise.all(statements.map(x=>x.run())); } }; }
