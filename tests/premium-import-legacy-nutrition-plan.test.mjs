import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createImportLegacyNutritionPlanUseCase } from '../workers/premium/application/import-legacy-nutrition-plan.js';

const legacy = { id:'legacy-1', student_id:null, student_email:'ana@example.com', status:null, is_active:1, title:'Plano anterior', goal:'Hipertrofia', strategy:'Déficit controlado', meals_json:'[{"name":"Café","items":[{"food":"Ovos","quantity":"2"}]}]', substitutions_json:'[{"from":"Ovos","to":"Tofu"}]', adherence_rules_json:'["água"]', notes:'observações', whatsapp_message:'mensagem', private_notes:'nota privada', created_at:'2026-01-01T00:00:00.000Z', updated_at:'2026-01-02T00:00:00.000Z' };
function db(state, { failInsert = false } = {}) { return { prepare(sql) { let params=[]; return { bind(...values) { params=values; return this; }, async all() { if (sql.includes('FROM premium_students')) return { results: state.student ? [state.student] : [] }; if (sql.includes('FROM student_access')) return { results: state.access ? [state.access] : [] }; if (sql.includes("status='PUBLISHED'")) return { results: state.plans.filter(p=>p.student_id===params[0] && p.status==='PUBLISHED' && p.is_active===1).map(p=>({id:p.id})) }; if (sql.includes('status IS NULL')) return { results: state.plans.filter(p=>p.status==null && p.is_active===1 && (p.student_id===params[0] || (!p.student_id && p.student_email===params[1]))).slice(0,2) }; return {results:[]}; }, async first() { if (sql.includes("WHERE id=? AND student_id=? AND status='PUBLISHED'")) return state.plans.find(p=>p.id===params[0] && p.student_id===params[1] && p.status==='PUBLISHED' && p.is_active===1) || null; return null; }, async run() { if (sql.startsWith('INSERT INTO nutrition_plans')) { if (failInsert) throw new Error('write failed'); const source=state.plans.find(p=>p.id===params[18]); if (!source || state.plans.some(p=>p.student_id===params[19] && p.status==='PUBLISHED' && p.is_active===1)) return {meta:{changes:0}}; state.plans.push({ ...source, id:params[0], student_id:params[1], student_email:params[2], title:params[3], goal:params[4], strategy:params[5], meals_json:params[6], substitutions_json:params[7], adherence_rules_json:params[8], notes:params[9], whatsapp_message:params[10], is_active:1, status:'PUBLISHED', version_number:1, published_at:params[12], published_by:params[13], supersedes_plan_id:params[14], source_feedback_id:null, private_notes:params[15], created_at:params[16], updated_at:params[17] }); } else if (sql.startsWith('INSERT INTO premium_followup_entries')) state.entries.push({content:params[2]}); return {meta:{changes:1}}; } }; }, async batch(statements) { for (const statement of statements) await statement.run(); } }; }

test('importa snapshot publicado, preservando legado e DRAFT, e é idempotente', async () => {
  const draft={id:'draft-1',student_id:'s1',status:'DRAFT',is_active:0,title:'rascunho',meals_json:'[]'};
  const state={student:{student_id:'s1',email:'ana@example.com'},access:{student_id:'s1',plan:'premium'},plans:[legacy,draft],entries:[]};
  const execute=createImportLegacyNutritionPlanUseCase({db:db(state),randomUUID:()=> 'import-1',now:()=> '2026-07-22T00:00:00.000Z'});
  const first=await execute({student_id:'s1',created_by:'admin'}); assert.equal(first.ok,true); assert.equal(first.data.idempotent,false);
  assert.equal(state.plans.length,3); assert.equal(state.plans[0],legacy); assert.equal(draft.status,'DRAFT');
  const imported=state.plans[2]; assert.equal(imported.status,'PUBLISHED'); assert.equal(imported.is_active,1); assert.equal(imported.meals_json,legacy.meals_json); assert.equal(imported.substitutions_json,legacy.substitutions_json); assert.equal(imported.supersedes_plan_id,legacy.id); assert.match(imported.private_notes,/"LEGACY_IMPORT"/);
  const second=await execute({student_id:'s1'}); assert.equal(second.ok,true); assert.equal(second.data.idempotent,true); assert.equal(state.plans.length,3);
});
test('sem legado, Projeto LM e falha de inserção não alteram planos nem liberam acesso', async () => {
  const none={student:{student_id:'s1',email:'ana@example.com'},access:{student_id:'s1',plan:'premium'},plans:[],entries:[]};
  assert.equal((await createImportLegacyNutritionPlanUseCase({db:db(none)})({student_id:'s1'})).status,404); assert.equal(none.plans.length,0);
  const project={student:{student_id:'s1',email:'ana@example.com'},access:{student_id:'s1',plan:'projeto_lm'},plans:[legacy],entries:[]};
  assert.equal((await createImportLegacyNutritionPlanUseCase({db:db(project)})({student_id:'s1'})).status,403); assert.equal(project.plans.length,1);
  const failure={student:{student_id:'s1',email:'ana@example.com'},access:{student_id:'s1',plan:'premium'},plans:[legacy],entries:[]};
  assert.equal((await createImportLegacyNutritionPlanUseCase({db:db(failure,{failInsert:true})})({student_id:'s1'})).status,409); assert.equal(failure.plans.length,1); assert.equal(failure.entries.length,0);
});
test('Prontuário expõe a importação antes da liberação e a rota mantém etapas explícitas', () => {
  const ui=readFileSync('public/admin-premium-student-record.js','utf8'); const api=readFileSync('workers/api.js','utf8');
  assert.match(ui,/!hasPublished && legacyAvailable/); assert.match(ui,/Importar planejamento antigo/); assert.match(ui,/Planejamento antigo importado e preservado/); assert.match(api,/import-legacy-nutrition-plan/);
});
function sqlValue(value) { if (value == null) return 'NULL'; if (typeof value === 'number') return String(value); return `'${String(value).replaceAll("'", "''")}'`; }
class SqliteD1BatchAdapter {
  constructor(file) { this.file = file; }
  prepare(sql) { const adapter=this; let params=[]; const render=()=>{let i=0;return sql.replace(/\?/g,()=>sqlValue(params[i++]));}; return { bind(...values) { params=values; return this; }, async all() { const output=execFileSync('sqlite3',['-json',adapter.file,render()],{encoding:'utf8'}).trim(); return {results:output?JSON.parse(output):[]}; }, async first() { return (await this.all()).results[0] ?? null; }, async run() { execFileSync('sqlite3',[adapter.file],{input:`${render()};`}); return {meta:{changes:1}}; }, render }; }
  async batch(statements) { execFileSync('sqlite3',[this.file],{input:`.bail on\nBEGIN;\n${statements.map((statement)=>`${statement.render()};`).join('\n')}\nCOMMIT;`}); }
}
async function withSqliteD1(fn) {
  const dir=await mkdtemp(join(tmpdir(),'legacy-import-')); const file=join(dir,'test.db'); const db=new SqliteD1BatchAdapter(file);
  try { execFileSync('sqlite3',[file],{input:`CREATE TABLE premium_students (student_id TEXT PRIMARY KEY,email TEXT NOT NULL,normalized_email TEXT NOT NULL,display_name TEXT,consultation_status TEXT,access_status TEXT,source TEXT,created_at TEXT,updated_at TEXT); CREATE TABLE student_access (id TEXT PRIMARY KEY,student_id TEXT,plan TEXT,plan_type TEXT,email TEXT); CREATE TABLE nutrition_plans (id TEXT PRIMARY KEY,student_id TEXT,student_email TEXT NOT NULL,title TEXT,goal TEXT,strategy TEXT,meals_json TEXT NOT NULL,substitutions_json TEXT,adherence_rules_json TEXT,notes TEXT,whatsapp_message TEXT,is_active INTEGER,status TEXT,version_number INTEGER,published_at TEXT,published_by TEXT,supersedes_plan_id TEXT,source_feedback_id TEXT,private_notes TEXT,created_at TEXT,updated_at TEXT); CREATE UNIQUE INDEX idx_nutrition_plans_single_active ON nutrition_plans(student_email) WHERE is_active=1; CREATE TABLE premium_followup_entries (id TEXT PRIMARY KEY,student_id TEXT,entry_type TEXT,title TEXT,content TEXT,source TEXT,related_entity_type TEXT,related_entity_id TEXT,created_by TEXT,created_at TEXT,updated_at TEXT);`}); await fn({file,db}); } finally { await rm(dir,{recursive:true,force:true}); }
}
function seedRealLegacy(file, { id = 'legacy-real', status = null } = {}) {
  execFileSync('sqlite3',[file],{input:`INSERT INTO premium_students VALUES ('student-real','real@example.com','real@example.com','Real','UNDER_REVIEW','ACTIVE','TEST','2026-01-01','2026-01-01'); INSERT INTO nutrition_plans (id,student_id,student_email,title,meals_json,is_active,status,created_at,updated_at) VALUES (${sqlValue(id)},NULL,'real@example.com','Legado real','[{"name":"Almoço","items":[{"food":"Arroz","quantity":"100g"}]}]',1,${sqlValue(status)},'2026-01-01','2026-01-01');`});
}
test('formato legado confirmado pelas migrations: somente status NULL ativo é elegível', async () => {
  const originalSchema=readFileSync('migrations/0004_nutrition_plans.sql','utf8'); const lifecycle=readFileSync('migrations/0031_add_nutrition_plan_lifecycle.sql','utf8'); const backfill=readFileSync('migrations/0032_finalize_nutrition_plan_lifecycle.sql','utf8');
  assert.doesNotMatch(originalSchema,/\bstatus\b/i); assert.match(lifecycle,/ADD COLUMN status TEXT/); assert.match(backfill,/WHERE status IS NULL/); assert.doesNotMatch(backfill,/status\s*=\s*''|status\s*=\s*'ACTIVE'/i);
  for (const status of ['', 'ACTIVE']) {
    await withSqliteD1(async ({file,db}) => { seedRealLegacy(file, { id: `legacy-${status || 'empty'}`, status }); const result = await createImportLegacyNutritionPlanUseCase({ db, randomUUID: () => 'import-real' })({ student_id: 'student-real' }); assert.equal(result.status, 404, `status ${JSON.stringify(status)} não é formato legado comprovado`); assert.equal(JSON.parse(execFileSync('sqlite3',['-json',file,"SELECT COUNT(*) AS count FROM nutrition_plans WHERE status='PUBLISHED'"],{encoding:'utf8'}))[0].count, 0); });
  }
});
test('db.batch D1/SQLite faz rollback real quando a auditoria falha após inserir o snapshot', async () => {
  await withSqliteD1(async ({file,db}) => { seedRealLegacy(file); execFileSync('sqlite3',[file],{input:`CREATE TRIGGER fail_legacy_import_audit BEFORE INSERT ON premium_followup_entries WHEN NEW.title='Planejamento antigo importado' BEGIN SELECT RAISE(ABORT, 'AUDIT_FAILURE'); END;`}); const result = await createImportLegacyNutritionPlanUseCase({ db, randomUUID: () => 'import-real', now: () => '2026-07-22T00:00:00.000Z' })({ student_id: 'student-real' }); assert.equal(result.status, 409); const counts=JSON.parse(execFileSync('sqlite3',['-json',file,"SELECT (SELECT COUNT(*) FROM nutrition_plans WHERE student_id='student-real' AND status='PUBLISHED') AS snapshots, (SELECT COUNT(*) FROM premium_followup_entries WHERE student_id='student-real') AS audits, (SELECT status FROM nutrition_plans WHERE id='legacy-real') AS legacy_status"],{encoding:'utf8'}))[0]; assert.deepEqual(counts,{snapshots:0,audits:0,legacy_status:null}); });
});
