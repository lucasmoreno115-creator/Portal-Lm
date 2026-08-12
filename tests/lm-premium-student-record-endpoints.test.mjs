import assert from 'node:assert/strict';
import test from 'node:test';
import { SqliteD1 } from './helpers/sqlite-d1.mjs';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import worker, { initializeSchemaForTests } from '../workers/api.js';
async function withDb(fn){ const dir=await mkdtemp(join(tmpdir(),'record-')); const db=new SqliteD1(join(dir,'test.db')); let testError; try{ await initializeSchemaForTests(db); await seed(db); await fn(db);} catch(error){testError=error;throw error;} finally{try{db.close();}catch(closeError){if(!testError)throw closeError;}await rm(dir,{recursive:true,force:true});}}
async function seed(db){ await db.prepare(`INSERT INTO student_access (id, name, email, access_token, status, plan_type, plan, whatsapp, student_id, created_at) VALUES ('a1','Student','student@example.com','tok','ACTIVE','PREMIUM','premium','5511999999999','student-1','2026-07-14T00:00:00.000Z')`).run(); await db.prepare(`INSERT INTO premium_students (student_id,email,normalized_email,display_name,consultation_status,access_status,source,created_at,updated_at) VALUES ('student-1','student@example.com','student@example.com','Student','ACTIVE','ACTIVE','TEST','2026-07-14T00:00:00.000Z','2026-07-14T00:00:00.000Z')`).run(); await db.prepare(`INSERT INTO premium_anamnesis (id, student_id, student_name, student_email, student_phone, status, answers_json, created_at, updated_at) VALUES ('anam-1','student-1','Student','student@example.com','55','RECEBIDA','{}','2026-07-14T00:01:00.000Z','2026-07-14T00:01:00.000Z')`).run(); await db.prepare(`INSERT INTO student_checkins (id, student_id, student_email, week_ref, submitted_at, created_at) VALUES ('fb-1','student-1','student@example.com','2026-W29','2026-07-14T00:02:00.000Z','2026-07-14T00:02:00.000Z')`).run(); await db.prepare(`INSERT INTO student_checkins (id, student_id, student_email, week_ref, coach_status, submitted_at, created_at) VALUES ('fb-reviewed','student-1','student@example.com','2026-W28',' Reviewed ','2026-07-13T00:02:00.000Z','2026-07-13T00:02:00.000Z')`).run(); }
async function api(db,method,path,body,admin=true){ const headers={'content-type':'application/json'}; if(admin) headers['x-admin-token']='admin-token'; const res=await worker.fetch(new Request(`https://portal.test${path}`,{method,headers,body:body?JSON.stringify(body):undefined}),{DB:db,ADMIN_TOKEN:'admin-token'}); return {status:res.status, body:await res.json()}; }

test('endpoints administrativos do Prontuário exigem admin e preservam contrato seguro', async()=>withDb(async(db)=>{
  assert.equal((await api(db,'GET','/api/admin/premium/students/student-1/record',null,false)).status,401);
  const record=await api(db,'GET','/api/admin/premium/students/student-1/record');
  assert.equal(record.status,200); assert.equal(record.body.ok,true); assert.equal(record.body.data.student.student_id,'student-1'); assert.equal(record.body.data.feedbacks.length,2); assert.equal(JSON.stringify(record.body).includes('access_token'),false); assert.ok(record.body.data.pending_items.length>=2);
  assert.deepEqual(record.body.data.nutrition_plan, { current: null, draft: null, hasPublished: false, hasDraft: false, status: 'EMPTY', label: 'Nenhum plano criado', description: 'Crie o primeiro planejamento alimentar deste aluno.', actionLabel: 'Criar planejamento alimentar', action: 'open-nutrition-plan' });
  const emptyObjectives = await api(db,'GET','/api/admin/premium/students/student-1/planning-objectives');
  assert.equal(emptyObjectives.status,200); assert.equal(emptyObjectives.body.data.status,'EMPTY');
  assert.equal(emptyObjectives.body.data.main_risk,'');
  const savedObjectives = await api(db,'PUT','/api/admin/premium/students/student-1/planning-objectives',{training_focus:'Técnica',cardio_target:'Caminhar',nutrition_focus:'Seguir o plano',main_risk:'Evitar interromper a rotina'});
  assert.equal(savedObjectives.status,200); assert.equal(savedObjectives.body.data.training_focus,'Técnica'); assert.equal(savedObjectives.body.data.main_risk,'Evitar interromper a rotina');
  const loadedObjectives = await api(db,'GET','/api/admin/premium/students/student-1/planning-objectives');
  assert.equal(loadedObjectives.body.data.main_risk,'Evitar interromper a rotina');
  const publishedObjectives = await worker.fetch(new Request('https://portal.test/api/portal/weekly-plan',{headers:{'x-student-email':'student@example.com','x-student-token':'tok'}}),{DB:db,ADMIN_TOKEN:'admin-token'});
  assert.equal((await publishedObjectives.json()).data.main_risk,'Evitar interromper a rotina');
  await db.prepare(`UPDATE weekly_plans SET coach_message='Mensagem preservada' WHERE id=?`).bind(savedObjectives.body.data.id).run();
  const mainRiskOnly = await api(db,'PUT','/api/admin/premium/students/student-1/planning-objectives',{main_risk:'Risco atualizado'});
  assert.equal(mainRiskOnly.body.data.main_risk,'Risco atualizado');
  const preservedObjectives = await db.prepare(`SELECT training_focus, cardio_target, nutrition_focus, coach_message FROM weekly_plans WHERE id=?`).bind(savedObjectives.body.data.id).first();
  assert.deepEqual(preservedObjectives,{training_focus:'Técnica',cardio_target:'Caminhar',nutrition_focus:'Seguir o plano',coach_message:'Mensagem preservada'});
  const partialObjectives = await api(db,'PUT','/api/admin/premium/students/student-1/planning-objectives',{training_focus:'',cardio_target:'',nutrition_focus:'',main_risk:''});
  assert.equal(partialObjectives.status,200); assert.equal(partialObjectives.body.data.main_risk,null);
  const persistedObjectives = await db.prepare(`SELECT training_focus, cardio_target, nutrition_focus, main_risk, coach_message FROM weekly_plans WHERE id=?`).bind(savedObjectives.body.data.id).first();
  assert.deepEqual(persistedObjectives,{training_focus:null,cardio_target:null,nutrition_focus:null,main_risk:null,coach_message:'Mensagem preservada'});
  const portalObjectives = await worker.fetch(new Request('https://portal.test/api/portal/weekly-plan',{headers:{'x-student-email':'student@example.com','x-student-token':'tok'}}),{DB:db,ADMIN_TOKEN:'admin-token'});
  const portalObjectivesBody=await portalObjectives.json(); assert.equal(portalObjectivesBody.data.nutrition_focus,null); assert.equal(portalObjectivesBody.data.main_risk,null); assert.equal(portalObjectivesBody.data.coach_message,'Mensagem preservada');
  const entry=await api(db,'POST','/api/admin/premium/students/student-1/followup-entries',{entry_type:'PROFESSIONAL_NOTE',title:'Nota',content:'Ok'}); assert.equal(entry.status,201);
  const pending=await api(db,'POST','/api/admin/premium/students/student-1/pending-items',{type:'CUSTOM',title:'Contato'}); assert.equal(pending.status,201);
  const resolved=await api(db,'PATCH',`/api/admin/premium/pending-items/${pending.body.data.id}/resolve`); assert.equal(resolved.body.data.status,'RESOLVED');
  const status=await api(db,'PATCH','/api/admin/premium/students/student-1/status',{status:'PAUSED'}); assert.equal(status.body.data.to,'PAUSED');
  const decision=await api(db,'POST','/api/admin/premium/feedbacks/fb-1/decision',{decision_type:'KEEP_STRATEGY',note:'Manter',coach_reply:'Siga assim.'}); assert.equal(decision.body.data.feedback.decision_type,'KEEP_STRATEGY');
}));


test('pendências abertas são realmente idempotentes e permitem recriação após resolução', async()=>withDb(async(db)=>{
  await Promise.all([
    api(db,'POST','/api/admin/premium/students/student-1/pending-items',{type:'CUSTOM',title:'Contato'}),
    api(db,'POST','/api/admin/premium/students/student-1/pending-items',{type:'CUSTOM',title:'Contato duplicado'})
  ]);
  let count = await db.prepare(`SELECT COUNT(*) AS total FROM premium_pending_items WHERE student_id='student-1' AND type='CUSTOM' AND status='OPEN' AND related_entity_type IS NULL AND related_entity_id IS NULL`).first();
  assert.equal(count.total, 1);

  await api(db,'POST','/api/admin/premium/students/student-1/pending-items',{type:'CONTACT_STUDENT',title:'Feedback A',related_entity_type:'student_checkins',related_entity_id:'fb-1'});
  await api(db,'POST','/api/admin/premium/students/student-1/pending-items',{type:'CONTACT_STUDENT',title:'Feedback B',related_entity_type:'student_checkins',related_entity_id:'fb-reviewed'});
  count = await db.prepare(`SELECT COUNT(*) AS total FROM premium_pending_items WHERE student_id='student-1' AND type='CONTACT_STUDENT' AND status='OPEN'`).first();
  assert.equal(count.total, 2);

  const open = await db.prepare(`SELECT id FROM premium_pending_items WHERE student_id='student-1' AND type='CUSTOM' AND status='OPEN' LIMIT 1`).first();
  await api(db,'PATCH',`/api/admin/premium/pending-items/${open.id}/resolve`);
  await api(db,'POST','/api/admin/premium/students/student-1/pending-items',{type:'CUSTOM',title:'Contato reapareceu'});
  count = await db.prepare(`SELECT COUNT(*) AS total FROM premium_pending_items WHERE student_id='student-1' AND type='CUSTOM'`).first();
  assert.equal(count.total, 2);
  count = await db.prepare(`SELECT COUNT(*) AS total FROM premium_pending_items WHERE student_id='student-1' AND type='CUSTOM' AND status='OPEN'`).first();
  assert.equal(count.total, 1);
}));

test('GET record legado resolve e-mail exato para student_id canônico e cria pendências canônicas', async()=>withDb(async(db)=>{
  await db.prepare(`INSERT INTO student_access (id, name, email, access_token, status, plan_type, plan, student_id, created_at) VALUES ('legacy-access','Legacy','legacy@email.com','tok-legacy','ACTIVE','PREMIUM','premium','stu_legacy123','2026-07-14T00:00:00.000Z')`).run();
  await db.prepare(`INSERT INTO premium_students (student_id,email,normalized_email,display_name,consultation_status,access_status,source,created_at,updated_at) VALUES ('stu_legacy123','legacy@email.com','legacy@email.com','Legacy','ACTIVE','ACTIVE','TEST','2026-07-14T00:00:00.000Z','2026-07-14T00:00:00.000Z')`).run();
  for (const identifier of ['legacy@email.com', ' LEGACY@EMAIL.COM ']) {
    const response = await api(db,'GET',`/api/admin/premium/students/${encodeURIComponent(identifier)}/record`);
    assert.equal(response.status, 200);
    assert.equal(response.body.data.student.student_id, 'stu_legacy123');
  }
  const nutrition = await api(db,'GET','/api/admin/premium/students/LEGACY%40EMAIL.COM/nutrition-plan');
  assert.equal(nutrition.status, 200);
  const draft = await api(db,'POST','/api/admin/premium/students/legacy%40email.com/nutrition-plan/draft',{plan:{title:'Legacy plan',meals:[]}});
  assert.equal(draft.status, 200);
  assert.equal(draft.body.data.student_id, 'stu_legacy123');
  const persisted = await db.prepare(`SELECT student_id FROM nutrition_plans WHERE id=?`).bind(draft.body.data.id).first();
  assert.equal(persisted.student_id, 'stu_legacy123');
  const pending = await db.prepare(`SELECT student_id, type, related_entity_id FROM premium_pending_items WHERE student_id='stu_legacy123' ORDER BY type`).all();
  assert.ok(pending.results.some((item) => item.type === 'CREATE_NUTRITION_PLAN'));
  assert.equal(pending.results.every((item) => item.student_id === 'stu_legacy123'), true);
  const legacyIdCount = await db.prepare(`SELECT COUNT(*) AS total FROM premium_pending_items WHERE student_id='legacy@email.com'`).first();
  assert.equal(legacyIdCount.total, 0);
  assert.equal(pending.results.length, 1);
  assert.equal((await api(db,'GET','/api/admin/premium/students/naoexiste%40email.com/record')).status,404);
}));

test('GET record combina identidade canônica e legado enviado sem misturar, duplicar ou exceder 12', async()=>withDb(async(db)=>{
  await db.prepare(`INSERT INTO premium_students (student_id,email,normalized_email,display_name,consultation_status,access_status,source,created_at,updated_at) VALUES ('student-2','other@example.com','other@example.com','Other','ACTIVE','ACTIVE','TEST','2026-07-14','2026-07-14')`).run();
  await db.prepare(`INSERT INTO student_checkins (id,student_id,student_email,week_ref,submitted_at,created_at) VALUES ('legacy-sent',NULL,'  STUDENT@EXAMPLE.COM  ','legacy','2026-08-20T10:00:00Z','2026-08-01')`).run();
  await db.prepare(`INSERT INTO student_checkins (id,student_id,student_email,week_ref,submitted_at,created_at) VALUES ('wrong-email',NULL,'stranger@example.com','wrong-email','2026-08-21T10:00:00Z','2026-08-21')`).run();
  await db.prepare(`INSERT INTO student_checkins (id,student_id,student_email,week_ref,submitted_at,created_at) VALUES ('conflicting-id','student-2','student@example.com','conflict','2026-08-22T10:00:00Z','2026-08-22')`).run();
  await db.prepare(`INSERT INTO student_checkins (id,student_id,student_email,week_ref,submitted_at,created_at) VALUES ('not-submitted','student-1','student@example.com','draft',NULL,'2026-08-23')`).run();
  for (let index=0; index<12; index++) await db.prepare(`INSERT INTO student_checkins (id,student_id,student_email,week_ref,submitted_at,created_at) VALUES (?,?,?,?,?,?)`).bind(`sent-${index}`,'student-1','stale-address@example.com',`week-${index}`,`2026-08-${String(index+1).padStart(2,'0')}T10:00:00Z`,`2026-07-${String(index+1).padStart(2,'0')}`).run();
  const response=await api(db,'GET','/api/admin/premium/students/student-1/record');
  assert.equal(response.status,200);
  const feedbacks=response.body.data.feedbacks;
  assert.equal(feedbacks.length,12);
  assert.equal(feedbacks[0].id,'legacy-sent');
  assert.equal(feedbacks[0].student_id,'student-1');
  assert.equal(new Set(feedbacks.map((item)=>item.id)).size,feedbacks.length);
  for(const excluded of ['wrong-email','conflicting-id','not-submitted']) assert.equal(feedbacks.some((item)=>item.id===excluded),false);
  assert.deepEqual(feedbacks.map((item)=>item.submitted_at),[...feedbacks].map((item)=>item.submitted_at).sort().reverse());
  const legacyDetail=await api(db,'GET','/api/admin/premium/weekly-feedbacks/legacy-sent');
  assert.equal(legacyDetail.status,200);
  assert.equal(legacyDetail.body.data.feedback.student_id,'student-1');
  const pendingBefore=await db.prepare(`SELECT COUNT(*) AS total FROM premium_pending_items WHERE related_entity_id='legacy-sent' AND status='OPEN'`).first();
  const decision=await api(db,'POST','/api/admin/premium/weekly-feedbacks/legacy-sent/decision',{decision_type:'KEEP_STRATEGY',note:'Identidade comprovada',coach_reply:'Continue assim.'});
  assert.equal(decision.status,200);
  const persistedLegacy=await db.prepare(`SELECT student_id,coach_reply FROM student_checkins WHERE id='legacy-sent'`).first();
  assert.deepEqual(persistedLegacy,{student_id:'student-1',coach_reply:'Continue assim.'});
  const pendingAfter=await db.prepare(`SELECT COUNT(*) AS total FROM premium_pending_items WHERE related_entity_id='legacy-sent'`).first();
  assert.equal(pendingAfter.total,pendingBefore.total);
  const otherDetail=await api(db,'GET','/api/admin/premium/weekly-feedbacks/conflicting-id');
  assert.equal(otherDetail.body.data.feedback.student_id,'student-2');
}));

test('fallback legado ambíguo não aparece, não resolve detalhe e não aceita decisão', async()=>withDb(async(db)=>{
  await db.prepare(`INSERT INTO premium_students (student_id,email,normalized_email,display_name,consultation_status,access_status,source,created_at,updated_at) VALUES ('duplicate-1','duplicate@example.com','duplicate-key-1','Duplicate 1','ACTIVE','ACTIVE','TEST','2026-07-14','2026-07-14')`).run();
  await db.prepare(`INSERT INTO premium_students (student_id,email,normalized_email,display_name,consultation_status,access_status,source,created_at,updated_at) VALUES ('duplicate-2',' DUPLICATE@EXAMPLE.COM ','duplicate-key-2','Duplicate 2','ACTIVE','ACTIVE','TEST','2026-07-14','2026-07-14')`).run();
  await db.prepare(`INSERT INTO student_checkins (id,student_id,student_email,week_ref,submitted_at,created_at) VALUES ('ambiguous-legacy',NULL,' duplicate@example.com ','ambiguous','2026-08-20','2026-08-20')`).run();
  for(const studentId of ['duplicate-1','duplicate-2']) {
    const record=await api(db,'GET',`/api/admin/premium/students/${studentId}/record`);
    assert.equal(record.status,200);
    assert.equal(record.body.data.feedbacks.some((feedback)=>feedback.id==='ambiguous-legacy'),false);
  }
  const detail=await api(db,'GET','/api/admin/premium/weekly-feedbacks/ambiguous-legacy');
  assert.equal(detail.status,404);
  const decision=await api(db,'POST','/api/admin/premium/weekly-feedbacks/ambiguous-legacy/decision',{decision_type:'KEEP_STRATEGY',coach_reply:'Não deve salvar'});
  assert.equal(decision.status,404);
  const persisted=await db.prepare(`SELECT student_id,coach_reply FROM student_checkins WHERE id='ambiguous-legacy'`).first();
  assert.deepEqual(persisted,{student_id:null,coach_reply:null});
  const pending=await db.prepare(`SELECT COUNT(*) AS total FROM premium_pending_items WHERE related_entity_id='ambiguous-legacy'`).first();
  assert.equal(pending.total,0);
}));


test('GET record concorrente não duplica pendências automáticas e normaliza coach_status', async()=>withDb(async(db)=>{
  await Promise.all([
    api(db,'GET','/api/admin/premium/students/student-1/record'),
    api(db,'GET','/api/admin/premium/students/student-1/record')
  ]);
  const anamnesis = await db.prepare(`SELECT COUNT(*) AS total FROM premium_pending_items WHERE student_id='student-1' AND type='ANALYZE_ANAMNESIS' AND status='OPEN'`).first();
  assert.equal(anamnesis.total, 1);
  const pendingFeedback = await db.prepare(`SELECT COUNT(*) AS total FROM premium_pending_items WHERE student_id='student-1' AND type='ANALYZE_WEEKLY_FEEDBACK' AND related_entity_id='fb-1' AND status='OPEN'`).first();
  assert.equal(pendingFeedback.total, 1);
  const reviewedFeedback = await db.prepare(`SELECT COUNT(*) AS total FROM premium_pending_items WHERE student_id='student-1' AND type='ANALYZE_WEEKLY_FEEDBACK' AND related_entity_id='fb-reviewed' AND status='OPEN'`).first();
  assert.equal(reviewedFeedback.total, 0);
}));

test('student_id direct match has precedence over an e-mail fallback', async()=>withDb(async(db)=>{
  await db.prepare(`INSERT INTO premium_students (student_id,email,normalized_email,display_name,consultation_status,access_status,source,created_at,updated_at) VALUES ('collision@email.com','direct@example.com','direct@example.com','Direct','ACTIVE','ACTIVE','TEST','2026-07-14T00:00:00.000Z','2026-07-14T00:00:00.000Z')`).run();
  await db.prepare(`INSERT INTO premium_students (student_id,email,normalized_email,display_name,consultation_status,access_status,source,created_at,updated_at) VALUES ('other','collision@email.com','collision@email.com','Other','ACTIVE','ACTIVE','TEST','2026-07-14T00:00:00.000Z','2026-07-14T00:00:00.000Z')`).run();
  const response = await api(db,'GET','/api/admin/premium/students/collision%40email.com/record');
  assert.equal(response.status,200);
  assert.equal(response.body.data.student.student_id,'collision@email.com');
}));

test('status e decisão profissional usam batch e não duplicam evolução em retry', async()=>withDb(async(db)=>{
  const firstStatus = await api(db,'PATCH','/api/admin/premium/students/student-1/status',{status:'PAUSED'});
  assert.equal(firstStatus.status, 200);
  const retryStatus = await api(db,'PATCH','/api/admin/premium/students/student-1/status',{status:'PAUSED'});
  assert.equal(retryStatus.body.data.unchanged, true);
  let count = await db.prepare(`SELECT COUNT(*) AS total FROM premium_followup_entries WHERE student_id='student-1' AND entry_type='CONSULTATION_STATUS_CHANGE'`).first();
  assert.equal(count.total, 1);

  const firstDecision = await api(db,'POST','/api/admin/premium/feedbacks/fb-1/decision',{decision_type:'KEEP_STRATEGY',note:'Manter',coach_reply:'Siga assim.'});
  assert.equal(firstDecision.status, 200);
  const retryDecision = await api(db,'POST','/api/admin/premium/feedbacks/fb-1/decision',{decision_type:'KEEP_STRATEGY',note:'Manter',coach_reply:'Siga assim.'});
  assert.equal(retryDecision.body.data.unchanged, true);
  count = await db.prepare(`SELECT COUNT(*) AS total FROM premium_followup_entries WHERE student_id='student-1' AND entry_type='PROFESSIONAL_DECISION' AND related_entity_id='fb-1'`).first();
  assert.equal(count.total, 1);
}));

test('decisão canônica exige reply, confirma estado e rejeita retries divergentes sem mutação', async()=>withDb(async(db)=>{
  for (const coach_reply of [undefined,null,'','   ']) {
    const payload={decision_type:'UPDATE_PLAN',note:'  Ajustar plano  ',followup_at:'2026-08-20T12:00:00.000Z'};
    if (coach_reply !== undefined) payload.coach_reply=coach_reply;
    const response=await api(db,'POST','/api/admin/premium/weekly-feedbacks/fb-1/decision',payload);
    assert.equal(response.status,400); assert.equal(response.body.code,'COACH_REPLY_REQUIRED');
  }
  assert.equal((await db.prepare(`SELECT COUNT(*) total FROM premium_followup_entries WHERE related_entity_id='fb-1' AND entry_type='PROFESSIONAL_DECISION'`).first()).total,0);
  await db.prepare(`INSERT INTO premium_pending_items (id,student_id,type,title,status,priority,source,related_entity_type,related_entity_id,created_at,updated_at) VALUES ('analyze-fb-1','student-1','ANALYZE_WEEKLY_FEEDBACK','Analisar','OPEN','HIGH','test','student_checkins','fb-1','2026-08-12T00:00:00.000Z','2026-08-12T00:00:00.000Z')`).run();
  const payload={decision_type:'UPDATE_PLAN',note:'  Ajustar plano  ',coach_reply:'  Vamos ajustar seu plano.  ',followup_at:'2026-08-20T12:00:00.000Z'};
  const first=await api(db,'POST','/api/admin/premium/weekly-feedbacks/fb-1/decision',payload);
  assert.equal(first.status,200); assert.equal(first.body.data.unchanged,false); assert.equal(first.body.data.pendingResolved,true);
  assert.deepEqual(first.body.data.feedback,{...first.body.data.feedback,coach_status:'reviewed',coach_reply:'Vamos ajustar seu plano.',decision_type:'UPDATE_PLAN',decision_note:'Ajustar plano',followup_at:'2026-08-20T12:00:00.000Z'});
  const persisted=await db.prepare(`SELECT coach_reply_at,reviewed_at,analyzed_at,decision_at,updated_at FROM student_checkins WHERE id='fb-1'`).first();
  const resolved=(await db.prepare(`SELECT resolved_at FROM premium_pending_items WHERE id='analyze-fb-1'`).first()).resolved_at;
  const retry=await api(db,'POST','/api/admin/premium/weekly-feedbacks/fb-1/decision',payload);
  assert.equal(retry.status,200); assert.equal(retry.body.data.unchanged,true); assert.deepEqual(await db.prepare(`SELECT coach_reply_at,reviewed_at,analyzed_at,decision_at,updated_at FROM student_checkins WHERE id='fb-1'`).first(),persisted); assert.equal((await db.prepare(`SELECT resolved_at FROM premium_pending_items WHERE id='analyze-fb-1'`).first()).resolved_at,resolved);
  for (const divergent of [{...payload,coach_reply:'Outra resposta'},{...payload,decision_type:'KEEP_STRATEGY'},{...payload,note:'Outro motivo'},{...payload,followup_at:null}]) {
    const response=await api(db,'POST','/api/admin/premium/weekly-feedbacks/fb-1/decision',divergent);
    assert.equal(response.status,409); assert.equal(response.body.code,'WEEKLY_FEEDBACK_ALREADY_REVIEWED');
  }
  const final=await db.prepare(`SELECT coach_reply,decision_type,decision_note,followup_at FROM student_checkins WHERE id='fb-1'`).first();
  assert.deepEqual(final,{coach_reply:'Vamos ajustar seu plano.',decision_type:'UPDATE_PLAN',decision_note:'Ajustar plano',followup_at:'2026-08-20T12:00:00.000Z'});
  assert.equal((await db.prepare(`SELECT COUNT(*) total FROM premium_followup_entries WHERE related_entity_id='fb-1' AND entry_type='PROFESSIONAL_DECISION'`).first()).total,1);
  assert.equal((await db.prepare(`SELECT COUNT(*) total FROM premium_pending_items WHERE related_entity_id='fb-1' AND type='CREATE_NUTRITION_PLAN'`).first()).total,1);
}));

test('decisão canônica isola check-in não Premium', async()=>withDb(async(db)=>{
  await db.prepare(`INSERT INTO student_checkins (id,student_id,student_email,week_ref,coach_status,submitted_at,created_at) VALUES ('project-checkin','project-student','project@example.com','2026-W30','pending','2026-08-01T00:00:00.000Z','2026-08-01T00:00:00.000Z')`).run();
  const response=await api(db,'POST','/api/admin/premium/weekly-feedbacks/project-checkin/decision',{decision_type:'KEEP_STRATEGY',coach_reply:'Não persistir'});
  assert.equal(response.status,404); assert.equal((await db.prepare(`SELECT coach_status FROM student_checkins WHERE id='project-checkin'`).first()).coach_status,'pending');
}));
