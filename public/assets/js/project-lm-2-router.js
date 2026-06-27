(function initializeProjectLm2Router(global) {
  const routes = Object.freeze({
    welcome: { path: '#welcome', label: 'Boas-vindas' },
    'onboarding-name': { path: '#onboarding-name', label: 'Nome' },
    'onboarding-goal': { path: '#onboarding-goal', label: 'Objetivo' },
    'onboarding-sex': { path: '#onboarding-sex', label: 'Sexo' },
    'onboarding-weight': { path: '#onboarding-weight', label: 'Peso' },
    'direction-created': { path: '#direction-created', label: 'Direção criada' },
    'home-placeholder': { path: '#home-placeholder', label: 'Início' }
  });

  function normalizeRoute(route) {
    return Object.prototype.hasOwnProperty.call(routes, route) ? route : 'welcome';
  }

  function getCurrentRoute(hash = global.location.hash) {
    return normalizeRoute(String(hash || '').replace(/^#/, '') || 'welcome');
  }

  function navigate(route) {
    const normalizedRoute = normalizeRoute(route);
    global.location.hash = routes[normalizedRoute].path;
    return normalizedRoute;
  }

  global.ProjectLm2Router = {
    routes,
    getCurrentRoute,
    normalizeRoute,
    navigate
  };
})(window);
