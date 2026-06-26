(function(){
  const ADMIN_SESSION_KEY = 'lm_admin_session_id';
  const ADMIN_SESSION_EXPIRES_KEY = 'lm_admin_session_expires_at';
  const LEGACY_ADMIN_TOKEN_KEY = 'lm_admin_token';

  function clearLegacyAdminToken(){
    localStorage.removeItem(LEGACY_ADMIN_TOKEN_KEY);
  }

  function getAdminSession(){
    clearLegacyAdminToken();
    const sessionId = localStorage.getItem(ADMIN_SESSION_KEY) || '';
    const expiresAt = localStorage.getItem(ADMIN_SESSION_EXPIRES_KEY) || '';
    if (expiresAt && Date.parse(expiresAt) <= Date.now()) {
      clearAdminSession();
      return '';
    }
    return sessionId;
  }

  function setAdminSession(sessionId, expiresAt){
    clearLegacyAdminToken();
    const value = String(sessionId || '').trim();
    if (value) {
      localStorage.setItem(ADMIN_SESSION_KEY, value);
      if (expiresAt) localStorage.setItem(ADMIN_SESSION_EXPIRES_KEY, String(expiresAt));
    } else {
      clearAdminSession();
    }
  }

  function clearAdminSession(){
    localStorage.removeItem(ADMIN_SESSION_KEY);
    localStorage.removeItem(ADMIN_SESSION_EXPIRES_KEY);
    clearLegacyAdminToken();
  }

  async function loginAdmin(token){
    const res = await fetch('/api/admin/session/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: String(token || '').trim() })
    });
    const payload = await res.json().catch(() => null);
    if (!res.ok || !payload?.ok || !payload?.data?.session_id) {
      clearAdminSession();
      throw new Error(payload?.error || 'Unauthorized');
    }
    setAdminSession(payload.data.session_id, payload.data.expires_at);
    return payload.data;
  }

  async function logoutAdmin(){
    const sessionId = getAdminSession();
    if (sessionId) {
      await fetch('/api/admin/session/logout', {
        method: 'POST',
        headers: { 'x-admin-session': sessionId }
      }).catch(() => null);
    }
    clearAdminSession();
  }

  function getAdminHeaders(extraHeaders){
    const sessionId = getAdminSession();
    return { ...(extraHeaders || {}), ...(sessionId ? { 'x-admin-session': sessionId } : {}) };
  }

  function getAdminToken(){
    return getAdminSession();
  }

  function setAdminToken(token){
    setAdminSession(token);
  }

  function clearAdminToken(){
    clearAdminSession();
  }

  function requireAdmin(){
    const sessionId = getAdminSession();
    if (!sessionId) {
      window.location.href = '/admin-login.html';
      return '';
    }
    return sessionId;
  }

  function hydrateAdminTokenInput(inputId){
    const input = document.getElementById(inputId);
    if (!input) return;
    clearLegacyAdminToken();
    const sessionId = getAdminSession();
    if (sessionId && !input.value) input.value = sessionId;
  }

  function attachLogout(buttonId){
    const button = document.getElementById(buttonId);
    if (!button) return;
    button.addEventListener('click', async () => {
      await logoutAdmin();
      window.location.href = '/admin-login.html';
    });
  }

  function init(){
    clearLegacyAdminToken();
    hydrateAdminTokenInput('adminToken');
    hydrateAdminTokenInput('token');
  }

  window.LMAdminAuth = {
    loginAdmin,
    logoutAdmin,
    getAdminHeaders,
    getAdminToken,
    setAdminToken,
    clearAdminToken,
    getAdminSession,
    setAdminSession,
    clearAdminSession,
    requireAdmin,
    attachLogout,
    hydrateAdminTokenInput,
    init
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
