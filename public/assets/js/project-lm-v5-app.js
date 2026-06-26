(function initProjectLmV5App(globalScope) {
  const OFFICIAL_ROUTES = Object.freeze({
    '#project-lm/journey': 'journey_overview',
    '#project-lm/stage-1-actions': 'stage_1_actions',
    '#project-lm/plan-b': 'stage_2_plan_b',
    '#project-lm/victories': 'stage_3_victories',
    '#project-lm/recovery': 'stage_4_recovery',
    '#project-lm/maintenance-goals': 'maintenance_goals'
  });

  const SCREEN_TO_ROUTE = Object.freeze(Object.keys(OFFICIAL_ROUTES).reduce((acc, route) => {
    acc[OFFICIAL_ROUTES[route]] = route;
    return acc;
  }, {}));


  const FORM_ACTIONS = Object.freeze({
    createStage1Actions: 'createStage1Actions',
    savePlanB: 'savePlanB',
    createVictory: 'createVictory',
    saveRecovery: 'saveRecovery',
    createMaintenanceGoal: 'createMaintenanceGoal'
  });

  const selectors = {
    root: '#project-lm-v5-root',
    pageTitle: '[data-plmv5="page-title"]',
    pageSubtitle: '[data-plmv5="page-subtitle"]',
    statusLabel: '[data-plmv5="status-label"]',
    progressLabel: '[data-plmv5="progress-label"]',
    percentage: '[data-plmv5="percentage"]',
    routeList: '[data-plmv5="route-list"]',
    stageCards: '[data-plmv5="stage-cards"]',
    overview: '[data-plmv5="overview"]',
    screen: '[data-plmv5="screen"]',
    messages: '[data-plmv5="messages"]'
  };

  let store;
  let contracts;
  let elements;
  let currentState = null;
  let unsubscribe = null;
  let hashChangeHandler = null;

  function text(value, fallback) {
    if (value === null || value === undefined || value === '') return fallback || '';
    return String(value);
  }

  function safeText(node, value) {
    if (!node) return;
    node.textContent = value === null || value === undefined ? '' : String(value);
  }

  function clear(node) {
    while (node && node.firstChild) node.removeChild(node.firstChild);
  }

  function el(tag, className, content) {
    const node = globalScope.document.createElement(tag);
    if (className) node.className = className;
    if (content !== undefined) safeText(node, text(content));
    return node;
  }

  function getRoute() {
    const hash = globalScope.location.hash;
    if (!hash) return '#project-lm/journey';
    return OFFICIAL_ROUTES[hash] ? hash : '#project-lm/journey';
  }

  function ensureRoute() {
    const route = getRoute();
    if (globalScope.location.hash !== route) globalScope.location.hash = route;
    return route;
  }

  function getScreenKey() {
    return OFFICIAL_ROUTES[ensureRoute()] || 'journey_overview';
  }

  function navigateToScreen(screenKey) {
    const route = SCREEN_TO_ROUTE[screenKey] || '#project-lm/journey';
    globalScope.location.hash = route;
  }

  function getStageStatus(stageCard) {
    return stageCard?.status || stageCard?.state || 'locked';
  }

  function getCurrentActionScreen(state) {
    return contracts.getScreenForNextRequiredAction(state?.progress?.next_required_action);
  }

  function getStageCardScreen(card, state) {
    if (card?.action) return contracts.getFlowForAction(card.action);
    if (getStageStatus(card) === 'active') return getCurrentActionScreen(state);
    return null;
  }

  function appendRouteLink(screen, currentScreenKey, label) {
    if (!screen) return;
    const link = el('a', 'plmv5-link', label || screen.title);
    link.href = screen.route;
    if (screen.key === currentScreenKey) link.setAttribute('aria-current', 'page');
    elements.routeList.appendChild(link);
  }

  function renderRoutes(screenKey, state) {
    clear(elements.routeList);
    appendRouteLink(contracts.getScreenByKey('journey_overview'), screenKey, 'Visão geral');
    const nextScreen = getCurrentActionScreen(state);
    if (nextScreen && nextScreen.key !== 'journey_overview') appendRouteLink(nextScreen, screenKey, 'Próxima ação');
    if (screenKey !== 'journey_overview' && (!nextScreen || nextScreen.key !== screenKey)) {
      appendRouteLink(contracts.getScreenByKey(screenKey), screenKey);
    }
  }

  function renderOverview(state) {
    const viewModel = state?.view_model || {};
    clear(elements.overview);
    safeText(elements.pageTitle, text(viewModel.page_title, 'Jornada Projeto LM V5'));
    safeText(elements.pageSubtitle, text(viewModel.page_subtitle, 'Skeleton visual isolado para teste interno.'));
    safeText(elements.statusLabel, text(viewModel.status_label, state?.journey?.status || 'Status indisponível'));
    safeText(elements.progressLabel, text(viewModel.progress_label, 'Progresso não carregado'));
    const percentage = Number(state?.progress?.percentage ?? viewModel.percentage ?? 0);
    elements.percentage.value = Number.isFinite(percentage) ? percentage : 0;
    safeText(elements.percentage, `${elements.percentage.value}%`);

    elements.overview.appendChild(el('p', 'plmv5-message', text(viewModel.primary_message, 'Carregando sua jornada.')));
    if (state?.progress?.next_required_action) elements.overview.appendChild(el('p', 'plmv5-message', `Próxima ação: ${state.progress.next_required_action}`));
    if (viewModel.primary_cta?.label) {
      const cta = el('button', 'plmv5-button', viewModel.primary_cta.label);
      cta.type = 'button';
      cta.disabled = Boolean(state?.loading || state?.saving);
      cta.addEventListener('click', () => {
        const nextScreen = contracts.getFlowForAction(viewModel.primary_cta.action);
        navigateToScreen(nextScreen?.key || contracts.getScreenForNextRequiredAction(state?.progress?.next_required_action)?.key || 'journey_overview');
      });
      elements.overview.appendChild(cta);
    }
  }

  function renderStageCards(state) {
    clear(elements.stageCards);
    const cards = (state?.view_model?.stage_cards || []).filter((card) => {
      const status = getStageStatus(card);
      return status === 'active' || status === 'completed' || status === 'maintenance';
    });
    cards.forEach((card) => {
      const status = getStageStatus(card);
      const screen = getStageCardScreen(card, state);
      const button = el('button', `plmv5-card${status === 'active' ? ' is-active' : ''}`);
      button.type = 'button';
      button.disabled = !screen || status === 'locked' || status === 'completed';
      if (button.disabled) button.setAttribute('aria-disabled', 'true');
      button.appendChild(el('strong', '', text(card.title || card.label || card.name, 'Etapa')));
      button.appendChild(el('span', '', `Status: ${status}`));
      if (card.description) button.appendChild(el('small', '', card.description));
      button.addEventListener('click', () => {
        if (screen && status !== 'locked' && status !== 'completed') navigateToScreen(screen.key);
      });
      elements.stageCards.appendChild(button);
    });
  }

  function payloadFromForm(form, formContract) {
    if (formContract.type === 'stage_1_actions') {
      return { actions: formContract.fields.map((field) => ({ title: text(new FormData(form).get(field.name)).trim() })).filter((action) => action.title) };
    }
    const formData = new FormData(form);
    return formContract.fields.reduce((payload, field) => {
      payload[field.name] = text(formData.get(field.name)).trim();
      return payload;
    }, {});
  }

  function renderFormContract(screenState) {
    const formContract = screenState.form_contract;
    if (!formContract) return null;
    const form = el('form', 'plmv5-form');
    form.dataset.contractType = formContract.type;
    formContract.fields.forEach((field) => {
      const wrapper = el('label', 'plmv5-field');
      wrapper.appendChild(el('span', '', field.label));
      const input = el(field.type === 'textarea' ? 'textarea' : 'input');
      input.name = field.name;
      if (field.type !== 'textarea') input.type = field.type || 'text';
      input.required = Boolean(field.required);
      input.placeholder = text(field.placeholder);
      wrapper.appendChild(input);
      form.appendChild(wrapper);
    });
    const submit = el('button', 'plmv5-button', currentState?.saving ? 'Salvando...' : 'Salvar');
    submit.type = 'submit';
    submit.disabled = !screenState.can_submit || Boolean(currentState?.saving);
    form.appendChild(submit);
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const action = FORM_ACTIONS[formContract.submit_action] || formContract.submit_action;
      const payload = payloadFromForm(form, formContract);
      const argument = formContract.type === 'stage_1_actions' ? payload.actions : payload;
      if (typeof store[action] === 'function') await store[action](argument);
    });
    return form;
  }

  function renderStage1Actions(screenState) {
    const actions = screenState?.source_stage?.actions || screenState?.source_stage?.items || [];
    if (!Array.isArray(actions) || actions.length === 0) return null;
    const list = el('div', 'plmv5-stage-cards');
    actions.forEach((action) => {
      const item = el('div', 'plmv5-card');
      item.appendChild(el('strong', '', text(action.title, 'Ação mínima')));
      if (action.completed || action.completed_at || action.status === 'completed') {
        item.appendChild(el('span', '', 'Concluída'));
      } else {
        const button = el('button', 'plmv5-button', 'Concluir');
        button.type = 'button';
        button.disabled = Boolean(currentState?.saving);
        button.addEventListener('click', () => store.completeStage1Action(action.id));
        item.appendChild(button);
      }
      list.appendChild(item);
    });
    return list;
  }

  function renderScreen(state) {
    const screenKey = getScreenKey();
    const screenState = contracts.buildScreenState(screenKey, state) || contracts.buildScreenState('journey_overview', state);
    clear(elements.screen);
    elements.screen.appendChild(el('h2', '', screenState.title));
    elements.screen.appendChild(el('p', '', screenState.subtitle));
    elements.screen.appendChild(el('p', 'plmv5-message', `Status: ${screenState.status}`));
    elements.screen.appendChild(el('p', 'plmv5-message', screenState.message));
    if (screenState.source_stage?.key || screenState.source_stage?.status) {
      elements.screen.appendChild(el('p', '', `Origem: ${text(screenState.source_stage.key || screenState.source_stage.name || screenState.source_stage.status)}`));
    }
    if (screenState.status === 'loading') elements.screen.appendChild(el('p', 'plmv5-message', 'Carregando sua jornada.'));
    if (screenState.status === 'error') elements.screen.appendChild(el('p', 'plmv5-message plmv5-error', text(state.error, 'Não foi possível carregar esta etapa agora.')));
    if (screenState.status === 'locked') elements.screen.appendChild(el('p', 'plmv5-message', screenState.message));
    if (screenState.status === 'completed') elements.screen.appendChild(el('p', 'plmv5-message', screenState.message));
    if (screenState.status === 'maintenance') elements.screen.appendChild(el('p', 'plmv5-message', screenState.message));
    const actionList = screenState.key === 'stage_1_actions' ? renderStage1Actions(screenState) : null;
    if (actionList) elements.screen.appendChild(actionList);
    const form = renderFormContract(screenState);
    if (form) elements.screen.appendChild(form);
  }

  function renderMessages(state) {
    clear(elements.messages);
    if (state?.error) elements.messages.appendChild(el('p', 'plmv5-message plmv5-error', state.error));
    else if (state?.loading) elements.messages.appendChild(el('p', 'plmv5-message', 'Carregando sua jornada.'));
    else if (state?.saving) elements.messages.appendChild(el('p', 'plmv5-message', 'Salvando alterações.'));
  }

  function renderCurrentRoute(state) {
    const route = getRoute();
    const isOverviewRoute = route === '#project-lm/journey';
    elements.overview.hidden = !isOverviewRoute;
    elements.stageCards.hidden = !isOverviewRoute;
    elements.screen.hidden = isOverviewRoute;
    clear(elements.overview);
    clear(elements.stageCards);
    clear(elements.screen);
    renderRoutes(isOverviewRoute ? 'journey_overview' : getScreenKey(), state);
    if (isOverviewRoute) {
      renderOverview(state);
      renderStageCards(state);
    } else {
      renderScreen(state);
    }
  }

  function render(state) {
    currentState = state;
    renderCurrentRoute(state);
    renderMessages(state);
  }

  function boot() {
    contracts = globalScope.ProjectLmV5ScreenContracts;
    store = globalScope.ProjectLmV5State || (typeof globalScope.createProjectLmV5State === 'function' ? globalScope.createProjectLmV5State() : null);
    const root = globalScope.document.querySelector(selectors.root);
    if (!root || !contracts || !store) return;
    elements = Object.keys(selectors).reduce((acc, key) => {
      acc[key] = key === 'root' ? root : root.querySelector(selectors[key]);
      return acc;
    }, {});
    ensureRoute();
    hashChangeHandler = () => render(store.getState());
    globalScope.addEventListener('hashchange', hashChangeHandler);
    unsubscribe = store.subscribe(render);
    store.loadJourney();
  }

  function destroy() {
    if (typeof unsubscribe === 'function') unsubscribe();
    if (hashChangeHandler) globalScope.removeEventListener('hashchange', hashChangeHandler);
    unsubscribe = null;
    hashChangeHandler = null;
    currentState = null;
    elements = null;
    store = null;
    contracts = null;
  }

  if (globalScope.document?.readyState === 'loading') globalScope.document.addEventListener('DOMContentLoaded', boot);
  else boot();

  globalScope.ProjectLmV5App = Object.freeze({ OFFICIAL_ROUTES, getRoute, boot, destroy, renderCurrentRoute, safeText });
})(typeof window !== 'undefined' ? window : globalThis);
