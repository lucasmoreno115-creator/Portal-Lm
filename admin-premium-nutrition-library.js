const adminAuth = globalThis.LMAdminAuth;
const renderer = globalThis.PortalNutritionPlanRenderer;
if (!adminAuth) throw new Error('A autenticação administrativa não foi inicializada.');
if (!renderer) throw new Error('O renderer de planejamentos alimentares não foi inicializado.');
adminAuth.requireAdmin();

const $ = (id) => document.getElementById(id);
const state = { q: '', type: '', status: '', limit: 20, offset: 0, total: 0 };
const statusLabels = { PUBLISHED: 'Publicado', DRAFT: 'Rascunho', ARCHIVED: 'Arquivado' };

function node(tag, options = {}, ...children) {
  const element = document.createElement(tag);
  if (options.className) element.className = options.className;
  if (options.textContent != null) element.textContent = options.textContent;
  for (const child of children.flat().filter(Boolean)) element.append(child);
  return element;
}
function formatDate(value) { if (!value) return '—'; const date = new Date(value); return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString('pt-BR'); }
function formatStatus(value) { return statusLabels[value] || value || '—'; }
function setStatus(message, error = false) { $('libraryStatus').textContent = message; $('libraryStatus').className = `notice screen-only${error ? ' error' : ''}`; }
async function api(path) {
  const response = await fetch(path, { method: 'GET', headers: adminAuth.getAdminAuthHeaders() });
  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload?.ok) throw new Error(payload?.error || 'Não foi possível consultar a biblioteca.');
  return payload.data;
}
function pill(text, modifier) { return node('span', { className: `pill ${modifier || ''}`, textContent: text }); }

function renderResults(items) {
  const root = $('results'); root.replaceChildren();
  if (!items.length) { root.append(node('p', { className: 'empty', textContent: 'Nenhum planejamento encontrado.' })); return; }
  items.forEach((plan) => {
    const title = node('h3', { textContent: plan.title || 'Plano alimentar' });
    const badges = node('div', { className: 'badges' }, pill(plan.type === 'LEGACY' ? 'Legado' : 'Premium', plan.type.toLowerCase()), pill(formatStatus(plan.status), String(plan.status || '').toLowerCase()));
    if (plan.version_number != null) badges.append(pill(`Versão ${plan.version_number}`, 'version'));
    const button = node('button', { textContent: 'Visualizar' }); button.type = 'button'; button.addEventListener('click', () => openDetail(plan.id));
    root.append(node('article', { className: 'result-card' }, node('div', { className: 'result-main' }, title, node('p', { className: 'student-name', textContent: plan.student_name || 'Aluno' }), node('p', { className: 'muted', textContent: plan.student_email || 'E-mail não informado' }), badges), node('div', { className: 'result-side' }, node('span', { className: 'muted', textContent: `Atualizado em ${formatDate(plan.updated_at)}` }), button)));
  });
}
async function loadList() {
  setStatus('Carregando planejamentos…');
  const params = new URLSearchParams({ limit: String(state.limit), offset: String(state.offset) });
  if (state.q) params.set('q', state.q); if (state.type) params.set('type', state.type); if (state.status) params.set('status', state.status);
  try {
    const data = await api(`/api/admin/premium/nutrition-library?${params}`); state.total = data.total; renderResults(data.items);
    $('resultCount').textContent = `${data.total} ${data.total === 1 ? 'registro' : 'registros'}`;
    const page = Math.floor(state.offset / state.limit) + 1; const pages = Math.max(1, Math.ceil(data.total / state.limit)); $('pageInfo').textContent = `Página ${page} de ${pages}`;
    $('previousPage').disabled = state.offset === 0; $('nextPage').disabled = state.offset + state.limit >= data.total; setStatus('');
  } catch (error) { setStatus(error.message, true); renderResults([]); }
}
function addMetadata(label, value) { $('detailMetadata').append(node('div', {}, node('dt', { textContent: label }), node('dd', { textContent: value || '—' }))); }
function trustedRendererHtml(html) { const container = node('div'); container.innerHTML = html; return container; }
function renderGeneralSubstitutions(items) {
  const root = $('detailSubstitutions'); root.replaceChildren();
  items.forEach((item) => {
    if (typeof item === 'string') { root.append(trustedRendererHtml(renderer.renderLines(renderer.normalizeMealLines(item)))); return; }
    const title = item?.category || item?.title || 'Alternativa'; const section = node('article', { className: 'substitution-card' }, node('h4', { textContent: item?.icon ? `${item.icon} ${title}` : title }));
    if (item?.reference) section.append(node('p', { textContent: `Referência: ${item.reference}` })); section.append(trustedRendererHtml(renderer.renderLines(renderer.normalizeMealLines(item?.items || item?.text || item)))); root.append(section);
  });
}
function renderDetail(plan) {
  $('detailTitle').textContent = plan.title || 'Plano alimentar'; $('detailStudent').textContent = `${plan.student_name || 'Aluno'} · ${plan.student_email || 'E-mail não informado'}`;
  $('detailMetadata').replaceChildren(); addMetadata('Tipo', plan.type === 'LEGACY' ? 'Legado' : 'Premium'); addMetadata('Status', formatStatus(plan.status)); if (plan.version_number != null) addMetadata('Versão', String(plan.version_number)); addMetadata('Criado em', formatDate(plan.created_at)); addMetadata('Atualizado em', formatDate(plan.updated_at)); if (plan.published_at) addMetadata('Publicado em', formatDate(plan.published_at)); if (plan.archived_at) addMetadata('Arquivado em', formatDate(plan.archived_at));
  $('detailOverview').replaceChildren(); if (plan.goal) $('detailOverview').append(node('section', {}, node('h3', { textContent: 'Objetivo' }), node('p', { textContent: plan.goal }))); if (plan.strategy) $('detailOverview').append(node('section', {}, node('h3', { textContent: 'Estratégia' }), node('p', { textContent: plan.strategy })));
  $('detailMeals').replaceChildren(); (plan.meals || []).forEach((meal) => $('detailMeals').append(node('article', { className: 'meal-card' }, node('h4', { textContent: meal?.name || meal?.title || 'Refeição' }), meal?.time ? node('p', { className: 'muted', textContent: meal.time }) : null, meal?.guidance || meal?.orientation ? node('p', { className: 'guidance', textContent: meal.guidance || meal.orientation }) : null, trustedRendererHtml(renderer.renderMealContent(meal, { emptyHtml: '<p>Sem itens cadastrados.</p>' }).primaryHtml), trustedRendererHtml(renderer.renderMealContent(meal).substitutionsHtml))));
  if (!(plan.meals || []).length) $('detailMeals').append(node('p', { textContent: 'Sem refeições cadastradas.' }));
  renderGeneralSubstitutions(plan.substitutions || []); $('substitutionsSection').hidden = !(plan.substitutions || []).length;
  $('detailRules').replaceChildren(trustedRendererHtml(renderer.renderLines(renderer.normalizeMealLines(plan.adherence_rules || [])))); $('rulesSection').hidden = !(plan.adherence_rules || []).length;
  $('detailNotes').replaceChildren(node('p', { textContent: plan.notes || '' })); $('notesSection').hidden = !plan.notes;
  $('resultsSection').hidden = true; document.querySelector('.library-controls').hidden = true; $('detail').hidden = false; window.scrollTo?.({ top: 0, behavior: 'smooth' });
}
async function openDetail(id) { setStatus('Carregando planejamento…'); try { renderDetail(await api(`/api/admin/premium/nutrition-library/${encodeURIComponent(id)}`)); setStatus(''); } catch (error) { setStatus(error.message, true); } }
function closeDetail() { $('detail').hidden = true; $('resultsSection').hidden = false; document.querySelector('.library-controls').hidden = false; }

$('searchForm').addEventListener('submit', (event) => { event.preventDefault(); state.q = $('search').value.trim(); state.offset = 0; loadList(); });
$('typeFilters').addEventListener('change', (event) => { if (event.target.name === 'type') { state.type = event.target.value; state.offset = 0; loadList(); } });
$('statusFilter').addEventListener('change', () => { state.status = $('statusFilter').value; state.offset = 0; loadList(); });
$('previousPage').addEventListener('click', () => { state.offset = Math.max(0, state.offset - state.limit); loadList(); });
$('nextPage').addEventListener('click', () => { state.offset += state.limit; loadList(); });
$('closeDetail').addEventListener('click', closeDetail); $('printPlan').addEventListener('click', () => window.print());
loadList();
