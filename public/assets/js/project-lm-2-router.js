(function initializeProjectLm2Router(global) {
  const routes = Object.freeze({
    welcome: { path: '#welcome', label: 'Boas-vindas' },
    'onboarding-name': { path: '#onboarding-name', label: 'Nome' },
    'onboarding-goal': { path: '#onboarding-goal', label: 'Objetivo' },
    'onboarding-sex': { path: '#onboarding-sex', label: 'Sexo' },
    'onboarding-weight': { path: '#onboarding-weight', label: 'Peso' },
    'direction-created': { path: '#direction-created', label: 'Direção criada' },
    home: { path: '#home', label: 'Início' },
    direction: { path: '#direction', label: 'Minha Direção' },
    training: { path: '#training', label: 'Treino' },
    nutrition: { path: '#nutrition', label: 'Plano alimentar' },
    library: { path: '#library', label: 'Biblioteca' },
    journey: { path: '#journey', label: 'Jornada' },
    'profile-edit': { path: '#profile-edit', label: 'Atualizar informações' },
    'week-1': { path: '#week-1', label: 'Semana 1' },
    'daily-checkin': { path: '#daily-checkin', label: 'Check-in diário' },
    'week-complete': { path: '#week-complete', label: 'Semana 1 concluída' },
    'week-2': { path: '#week-2', label: 'Semana 2' },
    'week-2-complete': { path: '#week-2-complete', label: 'Semana 2 concluída' },
    'week-3-placeholder': { path: '#week-3-placeholder', label: 'Semana 3' },
    'week-3-complete': { path: '#week-3-complete', label: 'Semana 3 concluída' },
    'week-4-placeholder': { path: '#week-4-placeholder', label: 'Semana 4' },
    'week-4-complete': { path: '#week-4-complete', label: 'Semana 4 concluída' },
    'program-completion': { path: '#program-completion', label: 'Program Completion' },
    'premium-bridge': { path: '#premium-bridge', label: 'Premium Bridge' },
    'week-1-placeholder': { path: '#week-1', label: 'Semana 1' },
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
