(function initializeProjectLm2App(global, document) {
  function boot() {
    const root = document.querySelector('#project-lm-2-root');
    if (!root) return;

    const route = global.ProjectLm2Router.getCurrentRoute();
    const state = global.ProjectLm2State.createState();

    root.dataset.lm2Route = route;
    root.dataset.lm2NextAction = state.next_action;

    const startButton = root.querySelector('[data-lm2-start]');
    if (startButton) {
      startButton.addEventListener('click', () => {
        global.location.hash = global.ProjectLm2Router.routes.onboarding.path;
        root.dataset.lm2Route = 'onboarding';
      });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})(window, document);
