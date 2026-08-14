(function(){
window.LMAdminAuth?.requireAdmin();
window.LMAdminAuth?.attachLogout('adminLogoutBtn');
const params = new URLSearchParams(location.search);
const studentId = params.get('student_id');
const state = document.getElementById('state');
const root = document.getElementById('record');
let lastStudent = {};
let activeFeedbackButton = null;
let activeFeedbackId = null;
let reviewSubmitting = false;
let temporaryAccessCredentials = null;
let deactivationSubmitting = false;
const statusLabels = { NEW:'Novo', AWAITING_ANAMNESIS:'Aguardando anamnese', UNDER_REVIEW:'Em análise', READY_TO_RELEASE:'Pronto para liberação', ACTIVE:'Ativo', PAUSED:'Pausado', ENDED:'Encerrado' };
const byId = (id) => document.getElementById(id);
const fmt = (value) => value ? new Date(value).toLocaleString('pt-BR') : '—';
const text = (value, empty = '—') => value == null || value === '' ? empty : String(value);
const analyzedCoachStatuses = new Set(['REVIEWED', 'REPLIED', 'ANALYZED', 'ANALISADO', 'ANALISADA']);
const decisionLabels = Object.freeze({ KEEP_STRATEGY:'Manter estratégia', UPDATE_PLAN:'Atualizar plano', CONTACT_STUDENT:'Entrar em contato', REQUEST_MORE_INFORMATION:'Solicitar mais informações' });
function el(tag, { className, textContent, href, dataset } = {}, ...children) {
const node = document.createElement(tag);
if (className) node.className = className;
if (textContent != null) node.textContent = textContent;
if (href) node.setAttribute('href', href);
if (dataset) Object.entries(dataset).forEach(([key, value]) => { node.dataset[key] = String(value); });
node.append(...children.filter(Boolean));
return node;
}
function field(label, value) {
return el('div', {}, el('strong', { textContent: label }), el('p', { textContent: text(value) }));
}
function labeledControl(labelText, control, description) {
const id = `weeklyFeedbackReview${control.name.replace(/(^|_)([a-z])/g, (_, prefix, letter) => letter.toUpperCase())}`;
control.id = id;
const label = el('label', { textContent: labelText });
label.setAttribute('for', id);
const wrapper = el('div', { className: 'weekly-feedback-review-field' }, label, control);
if (description) wrapper.append(el('p', { className: 'muted weekly-feedback-review-help', textContent: description }));
return wrapper;
}
function emptyState(title, meta, className = '') {
return el('div', { className: `item ${className}`.trim() }, el('div', {}, el('strong', { textContent: title }), el('p', { className: 'muted', textContent: meta })));
}
async function api(path, options = {}) {
const res = await fetch(path, { ...options, headers: window.LMAdminAuth.getAdminAuthHeaders({ 'Content-Type': 'application/json', ...(options.headers || {}) }) });
const json = await res.json().catch(() => null);
if (!res.ok || !json?.ok) throw new Error(json?.error || 'Falha ao carregar');
return json.data;
}
function renderSummary(student, summary) {
byId('summary').replaceChildren(
field('Situação', statusLabels[student.consultation_status] || student.consultation_status),
field('Última atividade', fmt(student.last_activity_at)),
field('Pendências', `${summary.open_pending_items_count || 0} abertas`),
field('Próxima ação', summary.next_operational_action)
);
}
function renderCareStatus(data) { const student=data.student||{}, summary=data.summary||{}, root=byId('careStatusContent'); if (!root) return; const status=student.consultation_status; const action=status==='UNDER_REVIEW'?{label:'Marcar planejamento como pronto',to:'READY_TO_RELEASE',confirmation:'O planejamento deste aluno está concluído e pronto para liberação?'}:null; const description=status==='ACTIVE'?'Acompanhamento ativo. Acesso ao Portal liberado.':status==='READY_TO_RELEASE'?'O planejamento está pronto para liberação.':status==='ENDED'?'Acompanhamento encerrado. O histórico permanece preservado.':'Acompanhe as pendências e o próximo passo permitido.'; const last=(data.followup_entries||[]).find(x=>['STUDENT_DEACTIVATED','CONSULTATION_STATUS_CHANGE'].includes(x.entry_type)); root.replaceChildren(field('Status atual',statusLabels[status]||status),field('Descrição',description),field('Próxima ação permitida',action?.label||(status==='ACTIVE'?'Acompanhamento ativo':summary.next_operational_action)),field('Pendências',`${summary.open_pending_items_count||0} abertas`),field(status==='ENDED'?'Desativado em':'Última mudança',status==='ENDED'?fmt(student.deactivated_at):(last?`${fmt(last.created_at)} — ${text(last.content)}`:'Sem mudança registrada'))); if(action)root.append(el('button',{textContent:action.label,dataset:{transition:action.to,confirmation:action.confirmation}})); if(status!=='ENDED')root.append(el('button',{textContent:'Desativar aluno',dataset:{deactivateStudent:'true'}})); }
function renderPending(items) {
const list = byId('pendingList');
if (!items.length) {
list.replaceChildren(emptyState('Nenhuma pendência aberta', 'Não há ação operacional pendente.'));
return;
}
list.replaceChildren(...items.map((item) => {
const button = el('button', { textContent: 'Resolver', dataset: { resolve: item.id } });
return el('div', { className: 'item' },
el('div', {}, el('strong', { textContent: text(item.title) }), el('p', { className: 'muted', textContent: `${text(item.priority)} • ${text(item.source)} • ${fmt(item.created_at)}` })),
button
);
}));
}
function renderAnamnesis(anamnesis) {
const target = byId('anamnesis');
if (!anamnesis) {
target.replaceChildren(emptyState('Anamnese ainda não respondida', 'Sem dados de anamnese para este aluno.'));
return;
}
const report = anamnesis.report;
if (!report || report.invalid) {
const technical = el('details', { className: 'anamnesis-technical' }, el('summary', { textContent: 'Ver informações técnicas' }));
technical.append(el('p', { className: 'muted', textContent: 'A resposta original foi preservada.' }));
target.replaceChildren(el('p', { textContent: 'Não foi possível interpretar esta anamnese.' }), technical);
return;
}
const reportNodes = [el('p', { className: 'muted', textContent: `Enviada em ${fmt(report.submittedAt)}` })];
if (report.executiveSummary.length) { const summary = el('div', { className: 'anamnesis-summary', dataset: { report: 'executive-summary' } }); report.executiveSummary.forEach((item) => summary.append(el('div', { className: 'anamnesis-summary-card' }, el('span', { textContent: item.label }), el('strong', { textContent: item.value })))); reportNodes.push(el('h3', { textContent: 'Resumo executivo' }), summary); }
if (report.highlights.length) { const highlights = el('section', { className: 'anamnesis-highlights', dataset: { report: 'highlights' } }, el('h3', { textContent: 'Destaques automáticos' }), el('p', { className: 'muted', textContent: 'Estes destaques apenas organizam respostas informadas pelo aluno e não substituem avaliação profissional.' })); const list = el('ul'); report.highlights.forEach((item) => { const detail = el('details', { className: `anamnesis-highlight ${item.level}`, dataset: { highlight: item.code } }, el('summary', { textContent: `${item.title} — ${item.description}` })); detail.append(el('p', { textContent: `Origem: “${item.source.label}” — “${item.source.value}”` })); list.append(el('li', { 'aria-label': `Destaque: ${item.title}` }, detail)); }); highlights.append(list); reportNodes.push(highlights); }
report.sections.forEach((section) => { const detail = el('details', { className: 'anamnesis-section', dataset: { section: section.key } }, el('summary', { textContent: section.title })); const list = el('dl', { className: 'anamnesis-answers' }); section.items.forEach((item) => { const row = el('div', { className: item.longText ? 'anamnesis-answer long-text' : 'anamnesis-answer' }); row.append(el('dt', { textContent: item.label }), el('dd', { textContent: Array.isArray(item.value) ? item.value.join('\n') : item.value })); list.append(row); }); detail.append(list); reportNodes.push(detail); });
const technical = el('details', { className: 'anamnesis-technical' }, el('summary', { textContent: 'Informações técnicas' })); const technicalList = el('dl', { className: 'anamnesis-answers' }); report.technical.metadata.forEach((item) => technicalList.append(el('div', { className: 'anamnesis-answer' }, el('dt', { textContent: item.label }), el('dd', { textContent: item.value })))); technical.append(technicalList); reportNodes.push(technical);
target.replaceChildren(...reportNodes);
}
function nutritionPlanLink(studentId) {
const origin = location.origin || 'http://localhost';
const returnTo = new URL('/admin-premium-student-record.html', origin);
returnTo.searchParams.set('student_id', studentId);
returnTo.hash = 'planejamento-alimentar';
const editor = new URL('/admin-premium-nutrition-plan.html', origin);
editor.searchParams.set('student_id', studentId);
editor.searchParams.set('return_to', `${returnTo.pathname}${returnTo.search}${returnTo.hash}`);
return `${editor.pathname}${editor.search}`;
}
function planningObjectivesLink(studentId) {
const url = new URL('/admin-premium-planning-objectives.html', location.origin || 'http://localhost');
url.searchParams.set('student_id', studentId);
return `${url.pathname}${url.search}`;
}
function portalPremiumUrl() {
return new URL('/portal-login.html', location.origin || 'http://localhost').href;
}
function buildStudentAccessMessage({ studentName, email, temporaryPassword, loginUrl }) {
if (!temporaryPassword) throw new Error('ACCESS_PASSWORD_UNAVAILABLE');
return [
'Portal LM',
'',
`Aluno: ${studentName || ''}`,
`E-mail: ${email || ''}`,
`Senha: ${temporaryPassword}`,
`Link: ${loginUrl || ''}`
].join('\n');
}
function accessMessage(student) {
return buildStudentAccessMessage({
studentName: student.name || student.display_name || 'aluno(a)',
email: student.email,
temporaryPassword: temporaryAccessCredentials?.temporaryPassword,
loginUrl: 'https://portal.lucasmorenopersonal.com.br/portal-login.html'
});
}
async function copyAccessMessage(message) {
if (navigator.clipboard && navigator.clipboard.writeText) {
await navigator.clipboard.writeText(message);
return;
}
const area = document.createElement('textarea');
area.value = message;
area.setAttribute('readonly', '');
if (area.style) { area.style.position = 'fixed'; area.style.opacity = '0'; }
document.body?.append(area);
area.select?.();
const copied = document.execCommand?.('copy');
area.remove?.();
if (!copied) throw new Error('Não foi possível copiar a mensagem de acesso.');
}
function renderStudentAccess(student) {
const target = byId('studentAccess');
if (!target) return;
const status = student.consultation_status;
const feedback = el('p', { className: 'muted', textContent: '' });
feedback.setAttribute('role', 'status');
const nodes = [field('Status do acesso', statusLabels[status] || status || '—'), field('E-mail oficial', student.email)];
if (['NEW', 'AWAITING_ANAMNESIS'].includes(status)) {
nodes.push(el('p', { className: 'muted', textContent: 'Acesso ainda não disponível.' }));
if (temporaryAccessCredentials?.temporaryPassword) {
const link = 'https://portal.lucasmorenopersonal.com.br/portal-login.html';
const message = accessMessage(student);
nodes.push(field('Link de acesso', link), field('Código de acesso', temporaryAccessCredentials.temporaryPassword), el('pre', { className: 'access-message', textContent: message }), el('button', { textContent: 'Copiar mensagem de acesso', dataset: { copyAccess: 'true' } }));
} else nodes.push(el('button', { textContent: 'Gerar novo acesso', dataset: { generateAccess: 'true' } }));
} else if (status === 'UNDER_REVIEW') {
nodes.push(el('p', { className: 'muted', textContent: 'Acesso ainda não disponível.' }));
} else if (status === 'READY_TO_RELEASE') {
nodes.push(el('button', { textContent: 'Liberar acesso ao aluno', dataset: { releaseAccess: 'true' } }));
} else if (status === 'ACTIVE') {
nodes.push(el('p', { textContent: 'Acesso liberado' }), el('a', { className: 'button', textContent: 'Abrir Portal', href: portalPremiumUrl() }));
if (temporaryAccessCredentials?.temporaryPassword) {
const link = 'https://portal.lucasmorenopersonal.com.br/portal-login.html';
nodes.push(field('Link de acesso', link), field('Senha de acesso', temporaryAccessCredentials.temporaryPassword), el('pre', { className: 'access-message', textContent: accessMessage(student) }), el('button', { textContent: 'Copiar mensagem de acesso', dataset: { copyAccess: 'true' } }));
} else {
nodes.push(el('p', { className: 'muted', textContent: 'A senha anterior não fica armazenada por segurança. Gere uma nova senha para enviá-la ao aluno.' }), el('button', { textContent: 'Gerar nova senha de acesso', dataset: { resetAccessPassword: 'true' } }));
}
} else if (status === 'PAUSED') {
nodes.push(el('p', { className: 'muted', textContent: 'Acesso pausado.' }));
} else if (status === 'ENDED') {
nodes.push(el('p', { className: 'muted', textContent: 'Acesso encerrado. Todo o histórico permanece preservado.' }),field('Desativado em',fmt(student.deactivated_at)));
}
if(status!=='ENDED')nodes.push(el('button',{textContent:'Desativar aluno',dataset:{deactivateStudent:'true'}}));
nodes.push(feedback);
target.replaceChildren(...nodes);
}
function renderPlanningObjectives(student) {
const target = byId('planningObjectives');
if (!target || !student?.student_id) return;
target.replaceChildren(
el('p', { className: 'muted', textContent: 'Defina os focos de treino, cardio e alimentação exibidos na Home Premium.' }),
el('a', { className: 'button', textContent: 'Editar objetivos', href: planningObjectivesLink(student.student_id) })
);
}
function makeNutritionPlanCardNavigable(studentId) { const card=byId('planejamento-alimentar'); if (!card || !studentId) return; card.setAttribute('role', 'link'); card.setAttribute('tabindex', '0'); const navigate=()=>window.location.assign(nutritionPlanLink(studentId)); card.onclick=(event)=>{if(event.target?.closest?.('a, button'))return;navigate();}; card.onkeydown=(event)=>{if(event.key!=='Enter'&&event.key!==' ')return;event.preventDefault();navigate();}; }
function renderPlan(workflow, student) {
const target = byId('plan');
makeNutritionPlanCardNavigable(student.student_id);
const current = workflow?.current || null;
const draft = workflow?.draft || null;
const hasPublished = workflow?.hasPublished ?? Boolean(current);
const hasDraft = workflow?.hasDraft ?? Boolean(draft);
const legacyAvailable = Boolean(workflow?.legacy_available);
const fallback = hasPublished && hasDraft
? { label: 'Alterações em revisão', description: 'O plano publicado continua ativo enquanto o novo rascunho é editado.', actionLabel: 'Revisar alterações' }
: hasDraft
? { label: 'Rascunho em edição', description: 'Há alterações ainda não publicadas.', actionLabel: 'Continuar planejamento' }
: hasPublished
? { label: 'Plano publicado', description: 'O aluno já possui um planejamento ativo.', actionLabel: 'Editar planejamento alimentar' }
: { label: 'Nenhum plano criado', description: 'Crie o primeiro planejamento alimentar deste aluno.', actionLabel: 'Criar planejamento alimentar' };
const plan = workflow && typeof workflow === 'object' ? workflow : fallback;
const actionLabel = plan.actionLabel || fallback.actionLabel;
const action = el('a', { className: 'button nutrition-plan-action', textContent: actionLabel, href: nutritionPlanLink(student.student_id) });
action.setAttribute('aria-label', `${actionLabel} para ${student.name || student.display_name || 'este aluno'}`);
const nodes = [el('div', { className: 'nutrition-plan-status' }, el('span', { className: 'badge', textContent: plan.label || fallback.label }), el('p', { className: 'muted', textContent: plan.description || fallback.description })), action];
if (hasPublished && student.consultation_status !== 'ACTIVE') nodes.push(el('button', { textContent: 'Liberar planejamento', dataset: { releasePlanning: 'true' } }));
if (!hasPublished && legacyAvailable) nodes.push(el('button', { textContent: 'Importar planejamento antigo', dataset: { importLegacyPlanning: 'true' } }));
target.replaceChildren(...nodes);
}
function renderFeedbacks(feedbacks) {
const target = byId('feedbacks');
if (!feedbacks.length) {
target.replaceChildren(emptyState('Nenhum check-in enviado.', 'Os check-ins realmente enviados aparecerão aqui.'));
return;
}
target.replaceChildren(...feedbacks.map((feedback) => {
const pending = !['reviewed','replied','analyzed','analisado','analisada'].includes(String(feedback.coach_status || '').trim().toLowerCase());
const button = el('button', { textContent: 'Ver check-in', dataset: { viewCheckin: feedback.id } });
button.setAttribute('type', 'button');
return el('div', { className: `item feedback-item${pending ? ' pending danger' : ''}` },
el('div', { className: 'feedback-meta' },
el('strong', { textContent: `Enviado em ${fmt(feedback.submitted_at || feedback.created_at)}` }),
el('span', { textContent: `Semana de referência: ${text(feedback.week_ref, 'Não informado')}` }),
el('span', { className: 'muted', textContent: `Status profissional: ${text(feedback.coach_status, 'Pendente')}` })
), button);
}));
}
const checkinFields = [
['Adesão ao treino', 'training_adherence'], ['Adesão alimentar', 'nutrition_adherence'],
['Cardio', 'cardio_adherence'], ['Refeições livres', 'free_meals'], ['Fome', 'hunger_level'],
['Compulsão/beliscos', 'binge_or_snacking'], ['Sono', 'sleep_quality'], ['Energia', 'energy_level'],
['Estresse', 'stress_level'], ['Peso semanal', 'weekly_weight'],
['Evolução de força', 'strength_status'], ['Principal dificuldade', 'main_difficulty'],
['Contexto da rotina', 'routine_context'], ['Nota da semana', 'weekly_score'],
['Suporte solicitado', 'support_needed'], ['Resposta do profissional', 'coach_reply']
];
function closeCheckin() {
const dialog = byId('checkinDialog');
if (dialog?.open) dialog.close();
activeFeedbackId = null;
const button = activeFeedbackButton;
activeFeedbackButton = null;
button?.focus?.();
}
function renderProfessionalReview(feedback, previousDecision, successMessage = '') {
const section = el('section', { className: 'weekly-feedback-review' });
section.setAttribute('aria-labelledby', 'weeklyFeedbackReviewHeading');
const heading = el('h3', { textContent: 'Análise profissional' });
heading.id = 'weeklyFeedbackReviewHeading';
section.append(heading);
if (successMessage) {
const success = el('p', { className: 'weekly-feedback-review-message success', textContent: successMessage });
success.setAttribute('role', 'status'); success.setAttribute('tabindex', '-1'); section.append(success); success.focus?.();
}
const analyzed = analyzedCoachStatuses.has(String(feedback.coach_status || '').trim().toUpperCase());
if (analyzed) {
section.append(el('p', { className: 'badge', textContent: 'Análise concluída' }));
const decisionType = feedback.decision_type || previousDecision?.decision_type || null;
section.append(field('Conduta', decisionLabels[decisionType] || decisionType), field('Feedback enviado', feedback.coach_reply), field('Nota interna', feedback.decision_note || previousDecision?.content), field('Data da análise/resposta', fmt(feedback.reviewed_at || feedback.coach_reply_at)));
return section;
}
if (!feedback.submitted_at) {
section.append(el('p', { className: 'muted', textContent: 'Este check-in ainda não foi submetido pelo aluno. A análise profissional não está disponível.' }));
return section;
}
const form = el('form', { className: 'weekly-feedback-review-form' });
form.setAttribute('aria-busy', 'false');
const decision = el('select'); decision.name = 'decision_type'; decision.required = true;
const decisionPlaceholder = el('option', { textContent: 'Selecione a conduta' }); decisionPlaceholder.value = ''; decisionPlaceholder.selected = true; decisionPlaceholder.disabled = true; decision.append(decisionPlaceholder);
Object.entries(decisionLabels).forEach(([value, label]) => { const option = el('option', { textContent: label }); option.value = value; decision.append(option); });
const reply = el('textarea'); reply.name = 'coach_reply'; reply.required = true; reply.rows = 5;
const note = el('textarea'); note.name = 'note'; note.rows = 3;
const followup = el('input'); followup.name = 'followup_at'; followup.type = 'datetime-local';
const message = el('p', { className: 'weekly-feedback-review-message' }); message.setAttribute('role', 'status'); message.setAttribute('aria-live', 'polite'); message.setAttribute('tabindex', '-1');
const submit = el('button', { textContent: 'Enviar feedback e concluir análise' }); submit.type = 'submit';
form.append(labeledControl('Conduta', decision), labeledControl('Feedback para o aluno', reply, 'Esta mensagem ficará disponível para o aluno no Portal LM.'), labeledControl('Nota interna', note, 'Visível somente no acompanhamento profissional.'), labeledControl('Follow-up', followup, 'Metadado operacional opcional.'), submit, message);
form.addEventListener('submit', async (event) => {
event.preventDefault();
if (reviewSubmitting || activeFeedbackId !== feedback.id || feedback.student_id !== lastStudent.student_id) return;
if (!decision.value) { message.textContent = 'Selecione a conduta profissional.'; message.className = 'weekly-feedback-review-message error'; decision.focus?.(); return; }
const coachReply = String(reply.value || '').trim();
if (!coachReply) { message.textContent = 'Informe o feedback para o aluno.'; message.className = 'weekly-feedback-review-message error'; message.focus?.(); return; }
reviewSubmitting = true; form.setAttribute('aria-busy', 'true'); submit.disabled = true; submit.textContent = 'Enviando...'; message.textContent = '';
try {
await api(`/api/admin/premium/weekly-feedbacks/${encodeURIComponent(activeFeedbackId)}/decision`, { method:'POST', body:JSON.stringify({ decision_type:decision.value, note:String(note.value || '').trim() || null, coach_reply:coachReply, followup_at:String(followup.value || '').trim() || null }) });
const detail = await api(`/api/admin/premium/weekly-feedbacks/${encodeURIComponent(activeFeedbackId)}`);
if (!detail?.feedback || detail.feedback.student_id !== lastStudent.student_id || detail.feedback.id !== activeFeedbackId) throw new Error('Não foi possível confirmar o check-in analisado.');
renderCheckinDetail(detail.feedback, detail.previousDecision, 'Feedback enviado e análise concluída.');
await load();
} catch (error) {
reviewSubmitting = false; form.setAttribute('aria-busy', 'false'); submit.disabled = false; submit.textContent = 'Enviar feedback e concluir análise'; message.textContent = error.message || 'Não foi possível concluir a análise.'; message.className = 'weekly-feedback-review-message error'; message.focus?.();
}
});
section.append(form);
return section;
}
function renderCheckinDetail(feedback, previousDecision = null, successMessage = '') {
const answers = el('dl', { className: 'checkin-answers' });
checkinFields.forEach(([label, key]) => answers.append(el('div', { className: 'checkin-answer' }, el('dt', { textContent: label }), el('dd', { textContent: text(feedback[key], 'Não informado') }))));
const dates = el('dl', { className: 'checkin-answers' },
el('div', { className: 'checkin-answer' }, el('dt', { textContent: 'Enviado em' }), el('dd', { textContent: feedback.submitted_at ? fmt(feedback.submitted_at) : 'Não informado' })),
el('div', { className: 'checkin-answer' }, el('dt', { textContent: 'Criado em' }), el('dd', { textContent: feedback.created_at ? fmt(feedback.created_at) : 'Não informado' })),
el('div', { className: 'checkin-answer' }, el('dt', { textContent: 'Respondido pelo profissional em' }), el('dd', { textContent: feedback.coach_reply_at ? fmt(feedback.coach_reply_at) : 'Não informado' })),
el('div', { className: 'checkin-answer' }, el('dt', { textContent: 'Revisado em' }), el('dd', { textContent: feedback.reviewed_at ? fmt(feedback.reviewed_at) : 'Não informado' }))
);
byId('checkinDetail').replaceChildren(
field('Semana de referência', text(feedback.week_ref, 'Não informado')),
field('Status profissional', text(feedback.coach_status, 'Pendente')),
answers, el('h3', { textContent: 'Datas relevantes' }), dates, renderProfessionalReview(feedback, previousDecision, successMessage)
);
}
async function openCheckin(id, trigger) {
const dialog = byId('checkinDialog');
activeFeedbackButton = trigger;
activeFeedbackId = id;
byId('checkinDetail').replaceChildren(el('p', { textContent: 'Carregando check-in…' }));
if (dialog && !dialog.open) dialog.showModal?.();
try {
const detail = await api(`/api/admin/premium/weekly-feedbacks/${encodeURIComponent(id)}`);
if (activeFeedbackId !== id) return;
const feedback = detail?.feedback;
if (!feedback || feedback.student_id !== lastStudent.student_id) throw new Error('Este check-in não pertence ao aluno aberto no prontuário.');
reviewSubmitting = false;
renderCheckinDetail(feedback, detail.previousDecision);
} catch (error) {
if (activeFeedbackId !== id) return;
const retry = el('button', { textContent: 'Tentar novamente', dataset: { retryCheckin: id } });
retry.setAttribute('type', 'button');
byId('checkinDetail').replaceChildren(el('p', { textContent: error.message || 'Erro ao carregar check-in.' }), retry);
}
}
function renderEntries(entries) {
const target = byId('entries');
if (!entries.length) {
target.replaceChildren(emptyState('Nenhum registro de evolução', 'Registre decisões profissionais relevantes aqui.'));
return;
}
target.replaceChildren(...entries.map((entry) => emptyState(entry.title, `${text(entry.entry_type)} • ${fmt(entry.created_at)} • ${text(entry.content, 'Sem nota')}`)));
}
function render(data) {
state.hidden = true;
root.hidden = false;
const student = data.student || {};
if (lastStudent.student_id && lastStudent.student_id !== student.student_id) temporaryAccessCredentials = null;
lastStudent = student;
const summary = data.summary || {};
byId('studentName').textContent = student.name || student.display_name || 'Aluno Premium';
byId('contact').textContent = [student.email, student.phone].filter(Boolean).join(' • ');
byId('status').textContent = statusLabels[student.consultation_status] || student.consultation_status || '—';
renderSummary(student, summary);
renderCareStatus(data);
renderPending(data.pending_items || []);
renderAnamnesis(data.anamnesis || null);
renderStudentAccess(student);
renderPlanningObjectives(student);
renderPlan(data.nutrition_plan || null, student);
renderFeedbacks(data.feedbacks || []);
renderEntries(data.followup_entries || []);
}
document.addEventListener('click', async (event) => {
if (event.target?.dataset?.closeCheckin != null) { closeCheckin(); return; }
if (event.target?.dataset?.viewCheckin) { await openCheckin(event.target.dataset.viewCheckin, event.target); return; }
if (event.target?.dataset?.retryCheckin) { await openCheckin(event.target.dataset.retryCheckin, activeFeedbackButton); return; }
if (event.target === byId('checkinDialog')) { closeCheckin(); return; }
if (event.target?.dataset?.generateAccess) {
if (!confirm('Será criado um novo código de acesso para esta aluna. Um código anterior, se existir, deixará de funcionar.')) return;
event.target.disabled = true;
const feedback = byId('studentAccess')?.querySelector?.('[role="status"]');
try {
const credentials = await api(`/api/admin/premium/workspace/students/${encodeURIComponent(studentId)}/access`, { method: 'POST', body: '{}' });
temporaryAccessCredentials = { temporaryPassword: credentials.token };
renderStudentAccess(lastStudent);
const result = byId('studentAccess')?.querySelector?.('[role="status"]');
if (result) result.textContent = 'Novo acesso criado. Link, código e mensagem estão disponíveis para cópia.';
} catch (error) { if (feedback) feedback.textContent = error.message; event.target.disabled = false; }
return;
}
if (event.target?.dataset?.releaseAccess) {
event.target.disabled = true;
try {
await api(`/api/admin/premium/students/${encodeURIComponent(studentId)}/status`, { method: 'PATCH', body: JSON.stringify({ status: 'ACTIVE' }) });
const credentials = await api('/api/admin/student-access/token', { method: 'POST', body: JSON.stringify({ email: lastStudent.email }) });
temporaryAccessCredentials = { temporaryPassword: credentials.token };
await load();
} catch (error) { alert(error.message); event.target.disabled = false; }
return;
}
if (event.target?.dataset?.resetAccessPassword) {
if (!confirm('Gerar uma nova senha de acesso? A senha anterior deixará de funcionar.')) return;
event.target.disabled = true;
const feedback = byId('studentAccess')?.querySelector?.('[role="status"]');
try {
const credentials = await api('/api/admin/student-access/token', { method: 'POST', body: JSON.stringify({ email: lastStudent.email }) });
if (!credentials?.token) throw new Error('A API não retornou uma senha de acesso válida. Tente novamente.');
temporaryAccessCredentials = { temporaryPassword: credentials.token };
renderStudentAccess(lastStudent);
} catch (error) { if (feedback) feedback.textContent = error.message; event.target.disabled = false; }
return;
}
if (event.target?.dataset?.copyAccess) {
const feedback = byId('studentAccess')?.querySelector?.('[role="status"]');
event.target.disabled = true;
try { await copyAccessMessage(accessMessage(lastStudent)); if (feedback) feedback.textContent = '✓ Acesso copiado'; } catch (error) { if (feedback) feedback.textContent = error.message === 'ACCESS_PASSWORD_UNAVAILABLE' ? 'A senha não está mais disponível para cópia. Gere uma nova senha de acesso.' : 'Não foi possível copiar o acesso.'; } finally { event.target.disabled = false; }
return;
}
if (event.target?.dataset?.deactivateStudent) {
if (deactivationSubmitting) return;
if (!confirm('Desativar aluno?\n\nO aluno perderá acesso à Consultoria Premium, mas todo o histórico será preservado.')) return;
deactivationSubmitting = true;
event.target.disabled = true;
event.target.setAttribute('aria-busy', 'true');
event.target.textContent = 'Desativando...';
try { await api(`/api/admin/premium/workspace/students/${encodeURIComponent(studentId)}/deactivate`, { method:'POST', body:'{}' }); await load(); }
catch(error) { alert(error.message); event.target.disabled=false; event.target.removeAttribute('aria-busy'); event.target.textContent='Desativar aluno'; }
finally { deactivationSubmitting = false; }
return;
}
const transition = event.target?.dataset?.transition;
if (transition) { if (!confirm(event.target.dataset.confirmation)) return; event.target.disabled=true; try { await api(`/api/admin/premium/students/${encodeURIComponent(studentId)}/status`, { method:'PATCH', body:JSON.stringify({status:transition}) }); await load(); } catch(error) { alert(error.message); event.target.disabled=false; } return; }
if (event.target?.dataset?.releasePlanning) {
if (!confirm('Liberar o Portal para este aluno? O planejamento publicado ficará disponível imediatamente.')) return;
event.target.disabled = true;
try { await api(`/api/admin/premium/students/${encodeURIComponent(studentId)}/release-planning`, { method: 'POST' }); alert('Planejamento liberado. O aluno já pode acessar o Portal.'); await load(); } catch (error) { alert(error.message); event.target.disabled = false; }
return;
}
if (event.target?.dataset?.importLegacyPlanning) {
if (!confirm('Importar uma cópia publicada do planejamento antigo? O registro original e o rascunho atual serão preservados.')) return;
event.target.disabled = true;
try { await api(`/api/admin/premium/students/${encodeURIComponent(studentId)}/import-legacy-nutrition-plan`, { method: 'POST' }); alert('Planejamento antigo importado e preservado.'); await load(); } catch (error) { alert(error.message); event.target.disabled = false; }
return;
}
const id = event.target?.dataset?.resolve;
if (!id) return;
event.target.disabled = true;
await api(`/api/admin/premium/pending-items/${encodeURIComponent(id)}/resolve`, { method: 'PATCH' });
load();
});
document.addEventListener('keydown', (event) => { if (event.key === 'Escape' && byId('checkinDialog')?.open) { event.preventDefault(); closeCheckin(); } });
byId('entryForm').addEventListener('submit', async (event) => {
event.preventDefault();
const fd = new FormData(byId('entryForm'));
await api(`/api/admin/premium/students/${encodeURIComponent(studentId)}/followup-entries`, {
method: 'POST',
body: JSON.stringify({ title: fd.get('title'), entry_type: fd.get('entry_type'), content: '' })
});
byId('entryForm').reset();
load();
});
async function load() {
if (!studentId) {
state.textContent = 'Aluno não identificado.';
return;
}
try {
render(await api(`/api/admin/premium/students/${encodeURIComponent(studentId)}/record`));
} catch (error) {
state.textContent = error.message || 'Erro ao carregar prontuário.';
}
}
load();
})();
