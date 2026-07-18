(function () {
  const $ = (id) => document.getElementById(id);
  const state = { studentCursor: null, selected: null, lastSearch: '' };

  function log(event, data = {}) { try { console.info('[lm-premium-admin]', event, { ...data, token: undefined, email: undefined, name: undefined, phone: undefined }); } catch (_) {} }
  function headers(extra = {}) { return window.LMAdminAuth?.getAdminAuthHeaders?.(extra) || extra; }
  function sanitizeErrorCode(body, status) { return String(body?.code || body?.error_code || body?.error || `HTTP_${status}` || 'UNKNOWN').replace(/[^A-Z0-9_:-]/gi, '_').slice(0, 80); }
  function aggregateCount(data) { if (Array.isArray(data?.items)) return data.items.length; if (Array.isArray(data)) return data.length; if (data?.indicators) return Object.values(data.indicators).reduce((sum, value) => sum + (Number(value) || 0), 0); return Number(data?.total || data?.count || 0) || 0; }
  async function api(path, opts = {}) {
    const res = await fetch(path, { ...opts, headers: { ...headers(), ...(opts.headers || {}) } });
    const body = await res.json().catch(() => ({}));
    log('endpoint_result', { path: new URL(path, window.location.origin).pathname, status: res.status, ok: Boolean(res.ok && body.ok), errorCode: res.ok && body.ok ? null : sanitizeErrorCode(body, res.status), aggregateCount: aggregateCount(body.data) });
    if (res.status === 401) {
      const invalidSession = /session|sess[aã]o|unauthorized|invalid|expir/i.test(String(body?.error || body?.code || ''));
      if (invalidSession) window.LMAdminAuth?.clearAdminSession?.();
      window.location.assign(window.LMAdminAuth?.getAdminLoginUrl?.(`${window.location.pathname}${window.location.search}${window.location.hash}`) || '/admin-login.html?returnTo=/admin');
      throw new Error('Sessão expirada. Faça login novamente.');
    }
    if (!res.ok || !body.ok) throw new Error('Não foi possível carregar esta informação. Tente novamente.');
    return body.data;
  }
  function el(tag, txt, cls) { const n = document.createElement(tag); if (cls) n.className = cls; if (txt != null) n.textContent = txt; return n; }
  function clear(node) { node.replaceChildren(); }
  function qs(obj) { const p = new URLSearchParams(); Object.entries(obj).forEach(([k, v]) => { if (v) p.set(k, v); }); return p.toString(); }
  function setLoading(v) { $('loading').hidden = !v; $('studentList').classList.toggle('skeleton', Boolean(v)); }
  function showError(e) { $('errorText').textContent = e.message || 'Não foi possível carregar o Workspace.'; $('error').hidden = false; }
  function badges(arr) { const r = el('div', null, 'row'); arr.filter(Boolean).forEach((x) => r.append(el('span', x, 'badge'))); return r; }
  async function diagnoseWorkspaceEndpoints() { await Promise.allSettled([api('/api/admin/premium/workspace/summary'), api('/api/admin/premium/workspace/students?limit=1'), api('/api/admin/premium/workspace/pending-items?limit=1')]); }
  async function loadAll() { log('workspace_opened'); $('error').hidden = true; setLoading(true); try { await api('/api/admin/premium/workspace/summary'); await loadStudents(true); } catch (e) { showError(e); } finally { setLoading(false); } }
  async function loadStudents(reset = false) { if (reset) state.studentCursor = null; const data = await api('/api/admin/premium/workspace/students?' + qs({ cursor: state.studentCursor || '', limit: 25 })); if (reset) clear($('studentList')); renderStudents(data.items || []); state.studentCursor = data.nextCursor; $('loadMore').hidden = !data.nextCursor; }
  async function searchStudents(q) { const data = q.length < 2 ? await api('/api/admin/premium/workspace/students?limit=25') : await api('/api/admin/premium/workspace/students/search?' + qs({ q, limit: 20 })); clear($('studentList')); renderStudents(data.items || []); $('loadMore').hidden = true; }
  function renderStudents(items) { const box = $('studentList'); box.classList.remove('skeleton'); if (!items.length && !box.children.length) { box.textContent = 'Nenhum aluno Premium encontrado.'; return; } items.forEach((s) => { const article = el('article', null, 'item student-row'); article.append(el('h3', s.name || s.email || 'Aluno sem nome'), el('p', s.email || 'E-mail não informado', 'muted'), badges([s.consultationStatusLabel || s.consultationStatus, s.accessStatusLabel || s.accessStatus])); const btn = el('button', 'Abrir', 'open-student'); btn.type = 'button'; btn.dataset.studentId = s.studentId; article.append(btn); box.append(article); }); }
  async function loadContext(id) { state.selected = id; setLoading(true); try { const c = await api('/api/admin/premium/workspace/students/' + encodeURIComponent(id)); renderContext(c); } catch (e) { showError(e); } finally { setLoading(false); } }
  function renderContext(c) { const summary = c.summary || {}; const box = $('contextBody'); clear(box); box.append(el('h3', summary.name || summary.email || 'Aluno'), el('p', [summary.email, summary.phone].filter(Boolean).join(' · ') || 'Contato não informado', 'muted'), badges([summary.consultationStatusLabel || summary.consultationStatus, summary.accessStatusLabel || summary.accessStatus])); const available = [summary.nextAction, summary.lastActivityAt && `Última atividade: ${summary.lastActivityAt}`, Number.isFinite(Number(summary.openPendingCount)) && `${summary.openPendingCount} pendência(s) aberta(s)`].filter(Boolean).join('\n') || 'Resumo básico disponível. Sem módulos adicionais nesta Sprint.'; const section = el('article', null, 'basic-summary'); section.append(el('h4', 'Resumo disponível'), el('pre', available)); box.append(section); }
  let timer; $('search').addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(() => { state.lastSearch = $('search').value.trim(); searchStudents(state.lastSearch).catch(showError); }, 250); });
  document.addEventListener('click', (e) => { const st = e.target.closest('[data-student-id]'); if (st) loadContext(st.dataset.studentId); });
  $('refresh').addEventListener('click', loadAll); $('retry').addEventListener('click', loadAll); $('loadMore').addEventListener('click', () => loadStudents(false));
  window.LMWorkspaceDiagnostics = { diagnoseWorkspaceEndpoints };
  window.LMAdminAuth?.requireAdmin?.();
  window.LMAdminAuth?.attachLogout?.('adminLogoutBtn');
  loadAll();
})();
