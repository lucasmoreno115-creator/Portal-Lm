const LM_ACCESS = {
  projeto_lm: [
    'minha-jornada',
    'plano-inicial',
    'meu-planejamento',
    'consistencia',
    'modo-dia-dificil',
    'marcos',
    'biblioteca'
  ],
  premium: [
    'dashboard',
    'biblioteca',
    'plano-alimentar',
    'treinos',
    'progressao',
    'plano-da-semana',
    'checkin',
    'suporte'
  ]
};

const LM_ACCESS_DENIED_MESSAGE = 'Essa área está disponível na Consultoria Premium LM.';
const LM_DEFAULT_PLAN = 'premium';

const LM_MENU_ITEMS = [
  { feature: 'dashboard', label: 'Página inicial', href: 'portal.html' },
  { feature: 'minha-jornada', label: '🗺 Minha Jornada', href: 'projeto-lm-jornada.html' },
  { feature: 'meu-planejamento', label: '📋 Meu Planejamento', href: 'projeto-lm-planejamento.html' },
  { feature: 'consistencia', label: '📈 Consistência', href: 'projeto-lm-consistencia.html' },
  { feature: 'modo-dia-dificil', label: '🧭 Plano B', href: 'projeto-lm-dia-dificil.html' },
  { feature: 'marcos', label: '🏅 Marcos', href: 'projeto-lm-conquistas.html' },
  { feature: 'biblioteca', label: '📚 Biblioteca', href: 'projeto-lm-biblioteca.html' },
  { feature: 'plano-alimentar', label: 'Plano alimentar', href: 'portal-plano-alimentar.html' },
  { feature: 'progressao', label: 'Progressão de carga', href: 'portal-progressao.html' },
  { feature: 'plano-da-semana', label: 'Objetivo do planejamento', href: 'portal.html#weekly-plan-section' },
  { feature: 'checkin', label: 'Check-in semanal', href: 'portal-checkin.html' },
  { feature: 'suporte', label: 'Preciso de ajuda', href: 'portal-checkin.html#supportNeeded' }
];

function getCurrentUser() {
  return {
    name: localStorage.getItem('lm_student_name') || 'Aluno',
    email: localStorage.getItem('lm_student_email') || '',
    token: localStorage.getItem('lm_student_token') || '',
    plan: localStorage.getItem('lm_student_plan') || localStorage.getItem('lm_student_plan_type') || ''
  };
}

function normalizeUserPlan(plan) {
  if (!plan) return LM_DEFAULT_PLAN;
  const normalized = String(plan).trim().toLowerCase();
  if (normalized === 'premium') return 'premium';
  if (normalized === 'projeto_lm') return 'projeto_lm';
  return LM_DEFAULT_PLAN;
}

function getUserPlan() {
  return normalizeUserPlan(getCurrentUser().plan);
}

function hasAccess(feature) {
  const allowedFeatures = LM_ACCESS[getUserPlan()] || LM_ACCESS[LM_DEFAULT_PLAN];
  return allowedFeatures.includes(feature);
}

function redirectIfNoAccess(feature) {
  if (hasAccess(feature)) return true;
  sessionStorage.setItem('lm_access_message', LM_ACCESS_DENIED_MESSAGE);
  window.location.href = getUserPlan() === 'projeto_lm' ? 'projeto-lm-jornada.html' : 'portal.html';
  return false;
}

function getMenuItemsForPlan(plan) {
  const normalizedPlan = normalizeUserPlan(plan);
  const allowedFeatures = LM_ACCESS[normalizedPlan] || LM_ACCESS[LM_DEFAULT_PLAN];

  if (normalizedPlan === 'premium') {
    const premiumMenuOrder = ['dashboard', 'checkin', 'plano-alimentar', 'progressao', 'suporte'];
    return premiumMenuOrder
      .map((feature) => LM_MENU_ITEMS.find((item) => item.feature === feature))
      .filter((item) => item && allowedFeatures.includes(item.feature));
  }

  return LM_MENU_ITEMS.filter((item) => {
    if (item.feature === 'dashboard') return false;
    if (['plano-inicial', 'consistencia'].includes(item.feature)) return false;
    return allowedFeatures.includes(item.feature);
  });
}

function renderPlanAwareMenu(target) {
  const html = `<nav>${getMenuItemsForPlan(getUserPlan())
    .map((item) => `<a href='${item.href}' data-feature='${item.feature}'>${item.label}</a>`)
    .join('')}<button onclick='logout()'>Sair</button></nav>`;

  if (typeof target === 'string') {
    const el = document.querySelector(target);
    if (el) el.innerHTML = html;
  } else if (target && 'innerHTML' in target) {
    target.innerHTML = html;
  }

  return html;
}

function isProjectLm() {
  return getUserPlan() === 'projeto_lm';
}

async function getProjectLmProfile() {
  const response = await api('/project-lm/profile');
  return response?.profile || response?.data || null;
}

async function shouldShowProjectOnboarding() {
  if (!isProjectLm()) return false;
  const profile = await getProjectLmProfile();
  return !profile || !profile.sex;
}

async function redirectProjectLmOnboardingIfNeeded() {
  if (!isProjectLm()) return false;
  const path = window.location.pathname;
  if (path.endsWith('/project-lm-profile.html') || path.endsWith('project-lm-profile.html')) {
    return false;
  }
  const shouldRedirect = await shouldShowProjectOnboarding();
  if (shouldRedirect) {
    window.location.href = 'project-lm-profile.html';
    return true;
  }
  return false;
}
