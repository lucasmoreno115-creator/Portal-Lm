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

  function attachTokenPersistence(input){
    if (!input) return;
    const saved = getAdminToken();
    if (saved && !input.value) input.value = saved;

    input.addEventListener('change', () => setAdminToken(input.value));
    input.addEventListener('blur', () => setAdminToken(input.value));
  }

  function renderLoginHint(input){
    if (!input || getAdminToken()) return;
    if (document.getElementById('adminLoginHint')) return;
    const hint = document.createElement('p');
    hint.id = 'adminLoginHint';
    hint.className = 'status muted';
    hint.innerHTML = "Token global não encontrado. <a class='secondary-link' href='/admin-login.html'>Fazer login admin global</a>";
    const parent = input.closest('label') || input.parentElement;
    if (parent && parent.parentNode) parent.parentNode.insertBefore(hint, parent.nextSibling);
  }

  function init(){
    const tokenInput = document.getElementById('adminToken') || document.getElementById('token');
    if (!tokenInput) return;
    attachTokenPersistence(tokenInput);
    renderLoginHint(tokenInput);
  }

  window.LMAdminAuth = { getAdminToken, setAdminToken, init };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
