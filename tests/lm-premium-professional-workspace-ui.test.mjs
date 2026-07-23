import assert from 'node:assert/strict';import test from 'node:test';import { readFileSync } from 'node:fs';import { nextAction } from '../workers/premium/presenters/professional-workspace-student-presenter.js';
test('workspace UI contains the W2.1 operational surface without command center modules',()=>{const html=readFileSync('public/admin-premium-workspace.html','utf8');for(const pattern of [/<section class="workspace-dashboard" aria-labelledby="workspaceDashboardHeading">/,/<article class="workspace-dashboard-card" data-dashboard-card="anamnesis-pending">[\s\S]*?Anamneses pendentes/,/<article class="workspace-dashboard-card" data-dashboard-card="checkins-answered">[\s\S]*?Check-ins respondidos/,/<article(?=[^>]*class="[^"]*\bworkspace-dashboard-card\b[^"]*")(?=[^>]*data-dashboard-card="checkins-open")(?=[^>]*(?:aria-disabled="true"|class="[^"]*\bis-unavailable\b[^"]*"))[^>]*>[\s\S]*?Check-ins em aberto/,/<section id="students" class="panel">[\s\S]*?<h2>Alunos Premium<\/h2>/,/<section id="record" class="panel context" hidden aria-labelledby="recordHeading">[\s\S]*?<h2 id="recordHeading" tabindex="-1">Prontuário LM<\/h2>/])assert.match(html,pattern);for(const text of ['Contexto básico','Selecione um aluno para visualizar o contexto básico','Inbox operacional','Revisão semanal','Filtros','Student 360'])assert.doesNotMatch(html,new RegExp(text));const js=readFileSync('public/admin-premium-workspace.js','utf8');for(const endpoint of ['/api/admin/premium/workspace/summary','/api/admin/premium/workspace/students','/api/admin/premium/workspace/pending-items'])assert.match(js,new RegExp(endpoint.replaceAll('/','\/')));assert.match(js,/diagnoseWorkspaceEndpoints/);assert.match(js,/Prontuário LM mínimo/);assert.doesNotMatch(js,/loadSaturdayReview\(\)/);});
test('workspace exposes only approved Sprint 3.1 student context actions',()=>{const js=readFileSync('public/admin-premium-workspace.js','utf8');for(const text of ['Feedback Semanal','Editar Plano Alimentar','Ver Evolução','resolvePending'])assert.doesNotMatch(js,new RegExp(text));for(const text of ['Copiar acesso','Abrir anamnese','Marcar planejamento como pronto','Liberar acompanhamento','Pausar acesso'])assert.match(js,new RegExp(text));assert.match(js,/Prontuário LM mínimo/);assert.match(js,/open-student/);});
test('UNDER_REVIEW only marks planning ready after a published plan exists',()=>{const base={consultation_status:'UNDER_REVIEW'};const cases=[
  [{...base,nutrition_plan_status:'NO_PUBLISHED_PLAN',has_draft:false,has_published:false},{label:'Abrir planejamento',action:'open-nutrition-plan',description:'Analise a anamnese e prepare o planejamento alimentar do aluno.'}],
  [{...base,nutrition_plan_status:'DRAFT',has_draft:true,has_published:false},{label:'Continuar planejamento',action:'open-nutrition-plan',description:'Existe um planejamento alimentar em edição.'}],
  [{...base,nutrition_plan_status:'PUBLISHED',has_draft:false,has_published:true},{label:'Abrir Prontuário',action:'open-student',description:'Marque o planejamento como pronto no Prontuário.'}],
  [{...base,nutrition_plan_status:'DRAFT',has_draft:true,has_published:true},{label:'Revisar alterações',action:'open-nutrition-plan',description:'Existem alterações ainda não publicadas no planejamento alimentar.'}],
];for(const [student,expected] of cases)assert.deepEqual(nextAction(student,true),{title:'Recebidas / em preparação',...expected});});

test('READY_TO_RELEASE opens the record for release',()=>assert.deepEqual(nextAction({consultation_status:'READY_TO_RELEASE'},true),{title:'Pronto para liberação',label:'Abrir Prontuário',action:'open-student',description:'Libere o acesso no Prontuário.'}));

test('workspace feedback has semantic variants, accessible live regions, and synchronized runtime copies',()=>{
  const html=readFileSync('public/admin-premium-workspace.html','utf8');
  assert.match(html,/<section id="error" class="panel workspace-feedback-error" role="alert" aria-live="assertive" hidden>/);
  const runtimePaths=['admin-premium-workspace.js','public/admin-premium-workspace.js','public/assets/js/admin-premium-workspace.js'];
  const runtimes=runtimePaths.map((path)=>readFileSync(path,'utf8'));
  assert.ok(runtimes.every((source)=>source===runtimes[0]));
  for(const source of runtimes){
    assert.match(source,/const workspaceFeedbackTypes = new Set\(\['success', 'warning', 'error'\]\)/);
    assert.match(source,/function showWorkspaceFeedback\(\{ type, message \}\)/);
    assert.match(source,/workspace-feedback-\$\{type\}/);
    assert.match(source,/type === 'error' \? 'alert' : 'status'/);
    assert.match(source,/type === 'error' \? 'assertive' : 'polite'/);
    assert.match(source,/showWorkspaceFeedback\(\{ type: 'success', message: 'Mensagem de acesso copiada\.' \}\)/);
    assert.match(source,/showWorkspaceFeedback\(\{ type: 'warning', message \}\)/);
    assert.match(source,/function operationalError\(message\) \{ showWorkspaceFeedback\(\{ type: 'error', message \}\); \}/);
  }
  const cssPaths=['admin-premium-workspace.css','public/admin-premium-workspace.css','public/assets/css/admin-premium-workspace.css'];
  const styles=cssPaths.map((path)=>readFileSync(path,'utf8'));
  assert.ok(styles.every((source)=>source===styles[0]));
  for(const selector of ['.workspace-feedback-success','.workspace-feedback-warning','.workspace-feedback-error'])assert.match(styles[0],new RegExp(`\\${selector}\\{`));
  assert.doesNotMatch(styles[0],/\.error\{/);
});
