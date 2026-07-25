(function portalNotificationsModule(global) {
  'use strict';

  const ICONS = Object.freeze({
    WEEKLY_CHECKIN_REMINDER: '📋',
    ANAMNESIS_REQUIRED: '📝',
    PLANNING_PUBLISHED: '🥗',
    WORKOUT_UPDATED: '🏋️',
    COACH_REPLY: '💬',
    ACCOUNT_RELEASED: '🔓',
    CUSTOM: '🔔',
  });

  const GROUP_ORDER = ['Hoje', 'Ontem', 'Esta semana', 'Mais antigas'];

  function startOfDay(value) {
    const date = new Date(value);
    date.setHours(0, 0, 0, 0);
    return date;
  }

  function groupForDate(value, now = new Date()) {
    const date = startOfDay(value);
    const today = startOfDay(now);
    const elapsedDays = Math.round((today - date) / 86400000);
    if (elapsedDays <= 0) return 'Hoje';
    if (elapsedDays === 1) return 'Ontem';
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - ((today.getDay() + 6) % 7));
    return date >= weekStart ? 'Esta semana' : 'Mais antigas';
  }

  function groupNotifications(items, now = new Date()) {
    const groups = Object.fromEntries(GROUP_ORDER.map((name) => [name, []]));
    items.forEach((item) => groups[groupForDate(item.created_at, now)].push(item));
    return groups;
  }

  function badgeText(count) {
    const safeCount = Math.max(0, Number(count) || 0);
    if (!safeCount) return '';
    return safeCount > 99 ? '99+' : String(Math.trunc(safeCount));
  }

  function iconFor(type) {
    return ICONS[type] || ICONS.CUSTOM;
  }

  function createElement(tag, attributes = {}, children = []) {
    const element = document.createElement(tag);
    Object.entries(attributes).forEach(([key, value]) => {
      if (key === 'className') element.className = value;
      else if (key === 'textContent') element.textContent = value;
      else if (key.startsWith('aria-')) element.setAttribute(key, value);
      else element[key] = value;
    });
    children.forEach((child) => element.append(child));
    return element;
  }

  function mount() {
    const hero = document.querySelector('.hero-app');
    if (!hero || document.querySelector('#notificationButton')) return;

    let notifications = [];
    let unreadCount = 0;
    let returnFocus = null;

    const badge = createElement('span', { id: 'notificationBadge', className: 'notification-badge', 'aria-hidden': 'true' });
    const trigger = createElement('button', {
      id: 'notificationButton', className: 'notification-trigger', type: 'button',
      'aria-label': 'Abrir central de notificações', 'aria-haspopup': 'dialog', 'aria-expanded': 'false',
    }, [createElement('span', { textContent: '🔔', 'aria-hidden': 'true' }), badge]);
    const close = createElement('button', { className: 'notification-close', type: 'button', textContent: '×', 'aria-label': 'Fechar notificações' });
    const markAll = createElement('button', { className: 'notification-read-all', type: 'button', textContent: 'Marcar todas como lidas' });
    const content = createElement('div', { className: 'notification-content', 'aria-live': 'polite' });
    const pushStatus = createElement('span', { className: 'notification-settings__status', textContent: 'Notificações desativadas' });
    const disablePush = createElement('button', { className: 'notification-settings__disable', type: 'button', textContent: 'Desativar neste dispositivo' });
    const settings = createElement('footer', { className: 'notification-settings' }, [
      createElement('strong', { className: 'notification-settings__title', textContent: '⚙️ Configurações' }),
      pushStatus,
      disablePush,
    ]);
    const panel = createElement('section', { className: 'notification-panel', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'notificationTitle', tabIndex: -1 }, [
      createElement('header', { className: 'notification-header' }, [
        createElement('h2', { id: 'notificationTitle', textContent: 'Notificações' }), markAll, close,
      ]), content, settings,
    ]);
    const backdrop = createElement('button', { className: 'notification-backdrop', type: 'button', tabIndex: -1, 'aria-label': 'Fechar notificações' });
    const drawer = createElement('div', { id: 'notificationDrawer', className: 'notification-drawer', hidden: true }, [backdrop, panel]);
    hero.append(trigger);
    document.body.append(drawer);

    function updateCount(count) {
      unreadCount = Math.max(0, Number(count) || 0);
      const label = badgeText(unreadCount);
      badge.textContent = label;
      badge.hidden = !label;
      trigger.setAttribute('aria-label', label ? `Abrir central de notificações. ${unreadCount} não lidas.` : 'Abrir central de notificações. Nenhuma não lida.');
      markAll.disabled = unreadCount === 0;
    }

    function updatePushSettings(detail = global.PortalPushNotifications?.getState?.()) {
      const enabled = detail?.enabled === true;
      pushStatus.textContent = enabled ? '✓ Notificações ativadas' : 'Notificações desativadas';
      disablePush.hidden = !enabled;
      disablePush.disabled = false;
    }

    function status(message, modifier, retry) {
      content.replaceChildren(createElement('div', { className: `notification-state notification-state--${modifier}`, role: modifier === 'error' ? 'alert' : 'status' }, [
        createElement('p', { textContent: message }),
        ...(retry ? [createElement('button', { type: 'button', textContent: 'Tentar novamente', onclick: retry })] : []),
      ]));
    }

    function render() {
      if (!notifications.length) {
        status('Você está em dia.\n\nQuando houver novidades,\nelas aparecerão aqui.', 'empty');
        return;
      }
      const fragment = document.createDocumentFragment();
      const groups = groupNotifications(notifications);
      GROUP_ORDER.forEach((name) => {
        if (!groups[name].length) return;
        const section = createElement('section', { className: 'notification-group', 'aria-labelledby': `notification-group-${name.replace(/\s/g, '-').toLowerCase()}` });
        section.append(createElement('h3', { id: `notification-group-${name.replace(/\s/g, '-').toLowerCase()}`, textContent: name }));
        groups[name].forEach((notification) => {
          const unread = notification.status === 'UNREAD';
          const button = createElement('button', {
            type: 'button', className: `notification-item${unread ? ' notification-item--unread' : ''}`,
            'aria-label': `${unread ? 'Não lida. ' : ''}${notification.title}`,
          }, [
            createElement('span', { className: 'notification-icon', textContent: iconFor(notification.type), 'aria-hidden': 'true' }),
            createElement('span', { className: 'notification-copy' }, [
              createElement('strong', { textContent: notification.title }),
              createElement('span', { textContent: notification.body }),
              createElement('time', { dateTime: notification.created_at, textContent: new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' }).format(new Date(notification.created_at)) }),
            ]),
            ...(unread ? [createElement('span', { className: 'notification-unread-dot', 'aria-label': 'Não lida' })] : []),
          ]);
          button.addEventListener('click', () => readOne(notification, button));
          section.append(button);
        });
        fragment.append(section);
      });
      content.replaceChildren(fragment);
    }

    async function load() {
      status('Carregando notificações…', 'loading');
      try {
        const response = await global.api('/portal/notifications?limit=50');
        notifications = Array.isArray(response?.data?.items) ? response.data.items : [];
        render();
      } catch (error) {
        status('Não foi possível carregar suas notificações.', 'error', load);
      }
    }

    async function refreshCount() {
      try {
        const response = await global.api('/portal/notifications/unread-count');
        updateCount(response?.data?.count);
      } catch (_) {
        updateCount(0);
      }
    }

    async function readOne(notification, button) {
      button.disabled = true;
      try {
        const response = await global.api(`/portal/notifications/${encodeURIComponent(notification.id)}/read`, { method: 'PATCH' });
        const wasUnread = notification.status === 'UNREAD';
        Object.assign(notification, response?.data || {}, { status: 'READ' });
        if (wasUnread) updateCount(unreadCount - 1);
        button.classList.remove('notification-item--unread');
        const unreadDot = button.querySelector('.notification-unread-dot');
        if (unreadDot) {
          unreadDot.style.opacity = '0';
          unreadDot.style.transform = 'scale(.4)';
          await new Promise((resolve) => global.setTimeout(resolve, 180));
        }
        render();
        if (notification.action_url) global.location.assign(notification.action_url);
      } catch (_) {
        status('Não foi possível marcar a notificação como lida.', 'error', load);
      }
    }

    async function readAll() {
      markAll.disabled = true;
      try {
        await global.api('/portal/notifications/read-all', { method: 'PATCH' });
        notifications.forEach((notification) => { notification.status = 'READ'; });
        updateCount(0);
        render();
      } catch (_) {
        markAll.disabled = false;
        status('Não foi possível marcar todas como lidas.', 'error', load);
      }
    }

    function openDrawer() {
      returnFocus = document.activeElement;
      drawer.hidden = false;
      document.body.classList.add('notification-drawer-open');
      trigger.setAttribute('aria-expanded', 'true');
      close.focus();
      updatePushSettings();
      load();
    }

    function closeDrawer() {
      drawer.hidden = true;
      document.body.classList.remove('notification-drawer-open');
      trigger.setAttribute('aria-expanded', 'false');
      if (returnFocus?.focus) returnFocus.focus();
    }

    trigger.addEventListener('click', openDrawer);
    close.addEventListener('click', closeDrawer);
    backdrop.addEventListener('click', closeDrawer);
    markAll.addEventListener('click', readAll);
    disablePush.addEventListener('click', async () => {
      disablePush.disabled = true;
      try {
        await global.PortalPushNotifications?.disableCurrent();
        updatePushSettings({ enabled: false });
        closeDrawer();
      } catch (_) {
        disablePush.disabled = false;
        pushStatus.textContent = 'Não foi possível desativar agora.';
      }
    });
    global.addEventListener('portal-push-statechange', (event) => updatePushSettings(event.detail));
    drawer.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') { event.preventDefault(); closeDrawer(); }
      if (event.key !== 'Tab') return;
      const focusable = [...panel.querySelectorAll('button:not([disabled]), a[href]')];
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    });
    updateCount(0);
    refreshCount();
    updatePushSettings();
  }

  const publicApi = { ICONS, GROUP_ORDER, badgeText, groupForDate, groupNotifications, iconFor, mount };
  global.PortalNotifications = publicApi;
  if (typeof document !== 'undefined') {
    const ready = global.lmPremiumAccessReady || Promise.resolve(true);
    ready.then((allowed) => { if (allowed !== false) mount(); });
  }
})(typeof window === 'undefined' ? globalThis : window);
