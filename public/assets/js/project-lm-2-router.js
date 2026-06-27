(function initializeProjectLm2Router(global) {
  const routes = Object.freeze({
    welcome: { path: '#welcome', label: 'Boas-vindas' },
    onboarding: { path: '#onboarding', label: 'Onboarding' },
    home: { path: '#home', label: 'Início' },
    direction: { path: '#direction', label: 'Direção' },
    'week-1': { path: '#week-1', label: 'Semana 1' }
  });

  function normalizeRoute(route) {
    return Object.prototype.hasOwnProperty.call(routes, route) ? route : 'welcome';
  }

  function getCurrentRoute(hash = global.location.hash) {
    return normalizeRoute(String(hash || '').replace(/^#/, '') || 'welcome');
  }

  global.ProjectLm2Router = {
    routes,
    getCurrentRoute,
    normalizeRoute
  };
})(window);
