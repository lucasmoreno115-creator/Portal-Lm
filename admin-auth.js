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
        headers: getAdminAuthHeaders({}, sessionId)
      }).catch(() => null);
    }
    clearAdminSession();
  }

  function getVisibleAdminCredential(){
    const sessionId = getAdminSession();
    if (sessionId) return sessionId;
    const input = document.getElementById('adminToken') || document.getElementById('token');
    return String(input?.value || '').trim();
  }

  function getAdminAuthHeaders(extraHeaders, credentialOverride){
    const credential = String(credentialOverride || getVisibleAdminCredential() || '').trim();
    const headers = extraHeaders || {};
    if (!credential) return { ...headers };
    return {
      'Content-Type': 'application/json',
      'x-admin-session': credential,
      'x-admin-token': credential,
      ...headers
    };
  }

  const getAdminHeaders = getAdminAuthHeaders;

  function getAdminToken(){
    return getAdminSession();
  }

  function setAdminToken(token){
    setAdminSession(token);
  }

  function clearAdminToken(){
    clearAdminSession();
  }

  function isSafeAdminReturnTo(value){
    const raw = String(value || '').trim();
    if (!raw || raw.startsWith('//') || raw.startsWith('\\')) return false;
    if (!raw.startsWith('/')) return false;
    if (/[\u0000-\u001f\u007f]/.test(raw)) return false;
    let target;
    try {
      target = new URL(raw, window.location.origin);
    } catch (_) {
      return false;
    }
    if (target.origin !== window.location.origin) return false;
    if (target.protocol !== window.location.protocol) return false;
    const pathname = target.pathname;
    if (pathname === '/admin') return true;
    if (pathname === '/admin-login.html') return false;
    return /^\/admin-[a-z0-9-]+\.html$/i.test(pathname);
  }

  function resolveAdminReturnTo(value, fallback = '/admin'){
    const raw = String(value || '').trim();
    if (!isSafeAdminReturnTo(raw)) return fallback;
    const target = new URL(raw, window.location.origin);
    return `${target.pathname}${target.search}${target.hash}`;
  }

  function getCurrentAdminReturnTo(){
    return resolveAdminReturnTo(`${window.location.pathname}${window.location.search}${window.location.hash}`);
  }

  function getAdminLoginUrl(returnTo){
    const login = new URL('/admin-login.html', window.location.origin);
    login.searchParams.set('returnTo', resolveAdminReturnTo(returnTo));
    return `${login.pathname}${login.search}`;
  }

  function requireAdmin(){
    const sessionId = getAdminSession();
    if (!sessionId) {
      window.location.href = getAdminLoginUrl(getCurrentAdminReturnTo());
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
    getAdminAuthHeaders,
    getAdminToken,
    setAdminToken,
    clearAdminToken,
    getAdminSession,
    setAdminSession,
    clearAdminSession,
    requireAdmin,
    isSafeAdminReturnTo,
    resolveAdminReturnTo,
    getCurrentAdminReturnTo,
    getAdminLoginUrl,
    attachLogout,
    hydrateAdminTokenInput,
    init
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
