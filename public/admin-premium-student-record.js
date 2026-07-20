(function(){
  window.LMAdminAuth?.requireAdmin();
  window.LMAdminAuth?.attachLogout('adminLogoutBtn');

  const params = new URLSearchParams(location.search);
  const studentId = params.get('student_id');
  const state = document.getElementById('state');
  const root = document.getElementById('record');
  const statusLabels = { NEW:'Novo', AWAITING_ANAMNESIS:'Aguardando anamnese', UNDER_REVIEW:'Em análise', ACTIVE:'Ativo', PAUSED:'Pausado', ENDED:'Encerrado' };

  const byId = (id) => document.getElementById(id);
  const fmt = (value) => value ? new Date(value).toLocaleString('pt-BR') : '—';
  const text = (value, empty = '—') => value == null || value === '' ? empty : String(value);

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
    const editor = new URL('/admin-premium-nutrition-plan.html', origin);
    editor.searchParams.set('student_id', studentId);
    editor.searchParams.set('return_to', `${returnTo.pathname}${returnTo.search}`);
    return `${editor.pathname}${editor.search}`;
  }

  function renderPlan(workflow, student) {
    const target = byId('plan');
    const current = workflow?.current || null;
    const draft = workflow?.draft || null;
    const hasPublished = workflow?.hasPublished ?? Boolean(current);
    const hasDraft = workflow?.hasDraft ?? Boolean(draft);
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
    target.replaceChildren(el('div', { className: 'nutrition-plan-status' }, el('span', { className: 'badge', textContent: plan.label || fallback.label }), el('p', { className: 'muted', textContent: plan.description || fallback.description })), action);
  }

  function renderFeedbacks(feedbacks) {
    const target = byId('feedbacks');
    if (!feedbacks.length) {
      target.replaceChildren(emptyState('Nenhum feedback enviado', 'Sem check-ins semanais registrados.'));
      return;
    }
    target.replaceChildren(...feedbacks.map((feedback) => emptyState(
      `${fmt(feedback.created_at)} • ${text(feedback.week_ref)}`,
      `Treino: ${text(feedback.training_adherence)} • Dieta: ${text(feedback.nutrition_adherence)} • Sono: ${text(feedback.sleep_quality)} • Status: ${text(feedback.coach_status, 'pendente')}`,
      !['reviewed','replied'].includes(String(feedback.coach_status || '').trim().toLowerCase()) ? 'danger' : ''
    )));
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
    const summary = data.summary || {};
    byId('studentName').textContent = student.name || student.display_name || 'Aluno Premium';
    byId('contact').textContent = [student.email, student.phone].filter(Boolean).join(' • ');
    byId('status').textContent = statusLabels[student.consultation_status] || student.consultation_status || '—';
    renderSummary(student, summary);
    renderPending(data.pending_items || []);
    renderAnamnesis(data.anamnesis || null);
    renderPlan(data.nutrition_plan || null, student);
    renderFeedbacks(data.feedbacks || []);
    renderEntries(data.followup_entries || []);
  }

  document.addEventListener('click', async (event) => {
    const id = event.target?.dataset?.resolve;
    if (!id) return;
    event.target.disabled = true;
    await api(`/api/admin/premium/pending-items/${encodeURIComponent(id)}/resolve`, { method: 'PATCH' });
    load();
  });

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
