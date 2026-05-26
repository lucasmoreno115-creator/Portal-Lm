(function(){
  const ADMIN_TOKEN_KEY = 'lm_admin_token';

  function getAdminToken(){
    return localStorage.getItem(ADMIN_TOKEN_KEY) || '';
  }

  function setAdminToken(token){
    const value = String(token || '').trim();
    if (value) localStorage.setItem(ADMIN_TOKEN_KEY, value);
    else localStorage.removeItem(ADMIN_TOKEN_KEY);
  }

  function clearAdminToken(){
    localStorage.removeItem(ADMIN_TOKEN_KEY);
  }

  function requireAdmin(){
    const token = getAdminToken();
    if (!token) {
      window.location.href = '/admin-login.html';
      return '';
    }
    return token;
  }

  function hydrateAdminTokenInput(inputId){
    const input = document.getElementById(inputId);
    if (!input) return;
    const saved = getAdminToken();
    if (saved && !input.value) input.value = saved;
  }

  function attachLogout(buttonId){
    const button = document.getElementById(buttonId);
    if (!button) return;
    button.addEventListener('click', () => {
      clearAdminToken();
      window.location.href = '/admin-login.html';
    });
  }

  function init(){
    hydrateAdminTokenInput('adminToken');
    hydrateAdminTokenInput('token');
  }

  window.LMAdminAuth = {
    getAdminToken,
    setAdminToken,
    clearAdminToken,
    requireAdmin,
    attachLogout,
    hydrateAdminTokenInput,
    init
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
