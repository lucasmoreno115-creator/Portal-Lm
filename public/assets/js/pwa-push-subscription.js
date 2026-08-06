(function initPortalPush() {
  const card = document.getElementById('pwaPushCard');
  const button = document.getElementById('pwaPushButton');
  const message = document.getElementById('pwaPushMessage');
  if (!card || !button || !message) return;

  const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent || '');
  const isStandalone = window.matchMedia?.('(display-mode: standalone)').matches || navigator.standalone === true;
  const supported = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

  function announce(state) {
    if (typeof window.CustomEvent !== 'function' || typeof window.dispatchEvent !== 'function') return;
    window.dispatchEvent(new window.CustomEvent('portal-push-statechange', { detail: { state, enabled: state === 'enabled' } }));
  }

  function render(state) {
    card.dataset.state = state;
    card.setAttribute?.('aria-busy', 'false');
    const states = {
      unsupported: ['Notificações não são compatíveis com este navegador.', 'Indisponível', true],
      install: ['No iPhone, instale o Portal na Tela de Início para ativar os lembretes.', 'Instalação necessária', true],
      waiting: ['Você decide quando autorizar. A permissão será solicitada somente ao tocar no botão.', 'Ativar notificações', false],
      enabled: ['Lembretes ativados neste dispositivo.', 'Desativar neste dispositivo', false],
      blocked: ['As notificações estão bloqueadas. Altere a permissão nas configurações do navegador.', 'Notificações bloqueadas', true],
      error: ['Não foi possível atualizar agora. Tente novamente em instantes.', 'Tentar novamente', false]
    };
    const [copy, label, disabled] = states[state];
    message.textContent = copy;
    button.textContent = label;
    button.disabled = disabled;
    card.hidden = state === 'enabled';
    announce(state);
  }

  function applicationServerKey(value) {
    const padding = '='.repeat((4 - value.length % 4) % 4);
    const raw = atob((value + padding).replace(/-/g, '+').replace(/_/g, '/'));
    return Uint8Array.from(raw, (character) => character.charCodeAt(0));
  }

  async function currentSubscription() {
    const registration = await navigator.serviceWorker.ready;
    return registration.pushManager.getSubscription();
  }

  async function register() {
    if (Notification.permission === 'denied') { render('blocked'); return; }
    // This is deliberately the only permission request, and register() is only called by a user click.
    const permission = Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission();
    if (permission !== 'granted') { render(permission === 'denied' ? 'blocked' : 'waiting'); return; }
    const registration = await navigator.serviceWorker.ready;
    let subscription = await registration.pushManager.getSubscription();
    if (!subscription) {
      const config = await api('/portal/push/config');
      subscription = await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: applicationServerKey(config.data.publicKey) });
    }
    const serialized = subscription.toJSON();
    await api('/portal/push/subscriptions', { method: 'POST', body: JSON.stringify(serialized) });
    render('enabled');
  }

  async function disable(subscription) {
    await api('/portal/push/subscriptions/current', { method: 'DELETE', body: JSON.stringify({ endpoint: subscription.endpoint }) });
    await subscription.unsubscribe();
    render('waiting');
  }

  async function disableCurrent() {
    const subscription = await currentSubscription();
    if (!subscription) { render('waiting'); return; }
    await disable(subscription);
  }

  async function recover(subscription) {
    const serialized = subscription.toJSON();
    await api('/portal/push/subscriptions', { method: 'POST', body: JSON.stringify(serialized) });
    render('enabled');
  }

  button.addEventListener('click', async () => {
    button.disabled = true;
    try {
      const subscription = await currentSubscription();
      if (subscription && card.dataset.state === 'enabled') await disableCurrent();
      else await register();
    } catch (_) {
      render('error');
    }
  });

  window.PortalPushNotifications = Object.freeze({
    disableCurrent,
    getState: () => ({ state: card.dataset.state, enabled: card.dataset.state === 'enabled' }),
  });

  if (!supported) { render('unsupported'); return; }
  if (isIos && !isStandalone) { render('install'); return; }
  if (Notification.permission === 'denied') { render('blocked'); return; }
  currentSubscription().then((subscription) => subscription ? recover(subscription) : render('waiting')).catch(() => render('error'));
})();
