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
    const details = el('details', {}, el('summary', { textContent: 'Respostas completas' }));
    const pre = el('pre');
    pre.textContent = JSON.stringify(anamnesis.answers || {}, null, 2);
    details.append(pre);
    target.replaceChildren(
      field('Status', anamnesis.status),
      field('Enviada', fmt(anamnesis.created_at)),
      field('Atualizada/analisada', fmt(anamnesis.updated_at)),
      details
    );
  }

  function nutritionPlanLink(studentId) {
    const returnTo = `/admin-premium-student-record.html?student_id=${encodeURIComponent(studentId)}`;
    return `/admin-premium-nutrition-plan.html?student_id=${encodeURIComponent(studentId)}&return_to=${encodeURIComponent(returnTo)}`;
  }

  function renderPlan(workflow, student) {
    const target = byId('plan');
    const current = workflow?.current || null;
    const draft = workflow?.draft || null;
    const action = (label) => el('a', { className: 'button', textContent: label, href: nutritionPlanLink(student.student_id) });
    if (!current && !draft) return target.replaceChildren(emptyState('Planejamento ainda não iniciado.', 'Prepare o planejamento alimentar deste aluno.'), action('Criar planejamento'));
    if (!current && draft) return target.replaceChildren(emptyState('Planejamento em edição.', `Atualizado em ${fmt(draft.updated_at)}`), action('Continuar planejamento'));
    if (current && draft) return target.replaceChildren(emptyState('Existem alterações ainda não publicadas.', `Plano publicado em ${fmt(current.published_at)}.`), action('Revisar alterações'));
    target.replaceChildren(emptyState('Planejamento publicado.', current.published_at ? `Publicado em ${fmt(current.published_at)}.` : 'Plano disponível para consulta.'), action('Visualizar planejamento'), action('Editar planejamento'));
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
      state.textContent = 'Informe student_id na URL.';
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
