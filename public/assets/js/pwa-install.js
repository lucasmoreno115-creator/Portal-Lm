(function initializePwaInstall(window, document) {
  'use strict';

  const DISMISS_KEY = 'lm_pwa_install_dismissed_at';
  const DISMISS_DURATION = 7 * 24 * 60 * 60 * 1000;
  const card = document.getElementById('pwaInstallCard');
  const installButton = document.getElementById('pwaInstallButton');
  const dismissButton = document.getElementById('pwaInstallDismiss');
  const iosModal = document.getElementById('pwaIosModal');
  let deferredPrompt = null;

  if (!card || !installButton || !dismissButton || !iosModal) return;

  const standalone = () => window.matchMedia('(display-mode: standalone)').matches
    || window.navigator.standalone === true;
  const dismissedRecently = () => {
    const dismissedAt = Number(window.localStorage.getItem(DISMISS_KEY));
    return Number.isFinite(dismissedAt) && dismissedAt > 0 && Date.now() - dismissedAt < DISMISS_DURATION;
  };
  const isIphoneSafari = () => /iPhone|iPod/.test(window.navigator.userAgent)
    && /Safari/.test(window.navigator.userAgent)
    && !/CriOS|FxiOS|EdgiOS|OPiOS/.test(window.navigator.userAgent);
  const hide = () => {
    card.hidden = true;
    iosModal.hidden = true;
    document.body.classList.remove('pwa-install-modal-open');
  };
  const show = () => {
    if (!standalone() && !dismissedRecently()) card.hidden = false;
  };

  dismissButton.addEventListener('click', () => {
    window.localStorage.setItem(DISMISS_KEY, String(Date.now()));
    hide();
  });

  installButton.addEventListener('click', async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      await deferredPrompt.userChoice.catch(() => null);
      deferredPrompt = null;
      hide();
      return;
    }
    if (isIphoneSafari()) {
      iosModal.hidden = false;
      document.body.classList.add('pwa-install-modal-open');
    }
  });

  iosModal.querySelectorAll('[data-pwa-modal-close]').forEach((element) => {
    element.addEventListener('click', () => {
      iosModal.hidden = true;
      document.body.classList.remove('pwa-install-modal-open');
    });
  });

  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    deferredPrompt = event;
    show();
  });
  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    window.localStorage.removeItem(DISMISS_KEY);
    hide();
  });

  if (standalone() || dismissedRecently()) return;
  if (isIphoneSafari()) show();
}(window, document));
