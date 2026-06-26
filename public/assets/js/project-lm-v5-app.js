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

  const ACTION_LABELS = Object.freeze({
    choose_stage_1_actions: 'Definir suas três ações mínimas',
    complete_stage_1_actions: 'Concluir uma ação mínima pendente',
    fill_plan_b: 'Preencher seu Plano B',
    record_victories: 'Registrar uma vitória concreta',
    fill_recovery_protocols: 'Definir protocolos de recuperação',
    maintenance: 'Sustentar metas de manutenção'
  });


  const STATUS_LABELS = Object.freeze({
    active: 'Etapa atual',
    completed: 'Concluída',
    locked: 'Bloqueada',
    maintenance: 'Manutenção',
    loading: 'Carregando',
    error: 'Atenção necessária'
  });

  const UX_COPY = Object.freeze({
    loading: 'Preparando sua jornada.\nOrganizando o próximo passo para você continuar.',
    saving: 'Registrando seu progresso.',
    error: 'Algo não saiu como esperado.\n\nTente novamente em alguns instantes.\nSua jornada continua segura.',
    primaryMessageFallback: 'Pequenas ações repetidas vencem grandes planos abandonados.',
    overviewTitle: 'Seu próximo passo',
    overviewDescription: 'O foco agora não é fazer tudo.\n\nÉ fazer o próximo passo e continuar avançando.',
    backToOverview: 'Voltar para a visão geral',
    requiredFields: 'Mantenha simples.\n\nA melhor estratégia é aquela que você consegue executar.',
    lockedHint: 'Você ainda não precisa se preocupar com esta etapa.\n\nConcentre-se apenas no passo atual.',
    completedHint: 'Esta etapa já faz parte da sua base.\n\nQuando precisar, ela continuará disponível para consulta.',
    stage1Title: 'Defina suas ações mínimas.',
    stage1Message: 'Escolha ações tão simples que você consiga executá-las mesmo nos dias difíceis.',
    stage1Empty: 'Você ainda não definiu suas ações mínimas.',
    planBMessage: 'Seu Plano B existe para os dias em que o Plano A não for possível.\n\nContinuar parcialmente é melhor do que recomeçar.',
    victoriesMessage: 'Resultados grandes são construídos por pequenas vitórias acumuladas.',
    victoriesEmpty: 'Registre qualquer avanço que mostre que você continuou.',
    recoveryMessage: 'Errar o plano não encerra a jornada.\n\nO importante é saber como voltar rapidamente.',
    maintenanceTitle: 'Jornada concluída.',
    maintenanceSubtitle: 'Agora o objetivo é proteger o que você construiu.',
    maintenanceMessage: 'Você não precisa voltar ao início.\n\nVocê já possui um sistema para continuar mesmo quando a rotina apertar.',
    successGeneric: 'Salvo com sucesso.\n\nMais um passo construído.',
    successAction: 'Ação concluída.\n\nContinuar conta mais do que perfeição.',
    successVictory: 'Vitória registrada.\n\nReconhecer o progresso ajuda a sustentar o processo.'
  });

  const selectors = {
    root: '#project-lm-v5-root',
    pageTitle: '[data-plmv5="page-title"]',
    pageSubtitle: '[data-plmv5="page-subtitle"]',
    statusLabel: '[data-plmv5="status-label"]',
    progressLabel: '[data-plmv5="progress-label"]',
    percentage: '[data-plmv5="percentage"]',
    percentageText: '[data-plmv5="percentage-text"]',
    primaryMessage: '[data-plmv5="primary-message"]',
    nextAction: '[data-plmv5="next-action"]',
    heroCta: '[data-plmv5="hero-cta"]',
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
  let successFeedback = null;
  let successFeedbackTimer = null;

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

  function readableAction(action) {
    return ACTION_LABELS[action] || text(action, 'Aguardando próxima ação');
  }

  function readableStatus(status) {
    return STATUS_LABELS[status] || text(status, 'Status não carregado');
  }

  function copyNode(className, content) {
    const node = el('p', className);
    safeText(node, content);
    return node;
  }

  function getProgressSupport(percentage) {
    if (percentage >= 100) return 'Hora de proteger o que foi construído.';
    if (percentage >= 75) return 'Você está perto de concluir sua jornada.';
    if (percentage >= 50) return 'Seu sistema está ficando mais forte.';
    if (percentage >= 25) return 'Você já começou a criar consistência.';
    return 'Você está construindo sua base.';
  }

  function getSuccessFeedback(action) {
    if (action === 'completeStage1Action') return UX_COPY.successAction;
    if (action === 'createVictory') return UX_COPY.successVictory;
    return UX_COPY.successGeneric;
  }

  function showSuccessFeedback(message) {
    successFeedback = message;
    if (successFeedbackTimer) globalScope.clearTimeout(successFeedbackTimer);
    successFeedbackTimer = globalScope.setTimeout(() => {
      successFeedback = null;
      if (store && elements) renderMessages(store.getState());
    }, 4200);
    if (store && elements) renderMessages(store.getState());
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

  function updateHeroCta(state, viewModel) {
    clear(elements.heroCta);
    if (!viewModel.primary_cta?.label) return;
    const cta = el('button', 'plmv5-button plmv5-button-primary', viewModel.primary_cta.label);
    cta.type = 'button';
    cta.disabled = Boolean(state?.loading || state?.saving);
    cta.addEventListener('click', () => {
      const nextScreen = contracts.getFlowForAction(viewModel.primary_cta.action);
      navigateToScreen(nextScreen?.key || contracts.getScreenForNextRequiredAction(state?.progress?.next_required_action)?.key || 'journey_overview');
    });
    elements.heroCta.appendChild(cta);
  }

  function renderOverviewIntro(state) {
    const intro = el('section', 'plmv5-ux-intro');
    intro.appendChild(el('p', 'plmv5-kicker', '◆ Foco da jornada'));
    intro.appendChild(el('h2', '', UX_COPY.overviewTitle));
    intro.appendChild(el('p', '', UX_COPY.overviewDescription));
    if (state?.progress?.next_required_action) intro.appendChild(el('strong', 'plmv5-next-action', readableAction(state.progress.next_required_action)));
    return intro;
  }

  function getVisibleStageCards(cards) {
    const safeCards = Array.isArray(cards) ? cards : [];
    if (safeCards.some((card) => getStageStatus(card) === 'maintenance')) return safeCards;
    const activeIndex = safeCards.findIndex((card) => getStageStatus(card) === 'active');
    if (activeIndex >= 0) return safeCards.slice(0, Math.min(safeCards.length, activeIndex + 2));
    const lastCompletedIndex = safeCards.reduce((lastIndex, card, index) => (getStageStatus(card) === 'completed' ? index : lastIndex), -1);
    if (lastCompletedIndex >= 0) return safeCards.slice(0, Math.min(safeCards.length, lastCompletedIndex + 2));
    return safeCards.slice(0, 2);
  }

  function renderOverview(state) {
    const viewModel = state?.view_model || {};
    clear(elements.overview);
    safeText(elements.pageTitle, UX_COPY.overviewTitle);
    safeText(elements.pageSubtitle, 'Projeto LM');
    safeText(elements.statusLabel, text(viewModel.status_label, state?.journey?.status || 'Status não carregado'));
    safeText(elements.progressLabel, text(viewModel.progress_label, 'Progresso não carregado'));
    const percentage = Number(state?.progress?.percentage ?? viewModel.percentage ?? 0);
    const safePercentage = Number.isFinite(percentage) ? Math.max(0, Math.min(100, percentage)) : 0;
    elements.percentage.value = safePercentage;
    safeText(elements.percentage, `${safePercentage}%`);
    safeText(elements.percentageText, `${safePercentage}%`);
    if (elements.progressLabel) elements.progressLabel.appendChild(copyNode('plmv5-progress-support', getProgressSupport(safePercentage)));
    safeText(elements.primaryMessage, text(viewModel.primary_message, UX_COPY.primaryMessageFallback));
    safeText(elements.nextAction, `◆ Próxima ação: ${readableAction(state?.progress?.next_required_action)}`);
    updateHeroCta(state, viewModel);

    elements.overview.appendChild(renderOverviewIntro(state));
  }

  function renderStageCards(state) {
    clear(elements.stageCards);
    const cards = getVisibleStageCards(state?.view_model?.stage_cards).filter((card) => {
      const status = getStageStatus(card);
      return status === 'active' || status === 'completed' || status === 'locked' || status === 'maintenance';
    });
    if (!cards.length) {
      elements.stageCards.appendChild(el('p', 'plmv5-empty', 'As etapas serão exibidas após o carregamento da jornada.'));
      return;
    }
    cards.forEach((card) => {
      const status = getStageStatus(card);
      const screen = getStageCardScreen(card, state);
      const button = el('button', `plmv5-card plmv5-stage-card is-${status}`);
      button.type = 'button';
      button.disabled = !screen || status === 'locked' || status === 'completed';
      if (button.disabled) button.setAttribute('aria-disabled', 'true');
      button.appendChild(el('span', 'plmv5-card-marker', '◆'));
      button.appendChild(el('strong', 'plmv5-card-title', text(card.title || card.label || card.name, 'Etapa')));
      button.appendChild(el('span', 'plmv5-card-status', text(card.status_label, readableStatus(status))));
      if (card.subtitle || card.description) button.appendChild(el('span', 'plmv5-card-subtitle', text(card.subtitle || card.description)));
      if (card.progress_text) button.appendChild(el('span', 'plmv5-card-progress', card.progress_text));
      if (card.empty_state && status === 'active') button.appendChild(el('small', 'plmv5-empty', card.empty_state));
      button.addEventListener('click', () => {
        if (screen && status !== 'locked' && status !== 'completed') navigateToScreen(screen.key);
      });
      elements.stageCards.appendChild(button);
    });
  }

  function payloadFromForm(form, formContract) {
    const formData = new FormData(form);
    if (formContract.type === 'stage_1_actions') {
      return { actions: formContract.fields.map((field) => ({ title: text(formData.get(field.name)).trim() })).filter((action) => action.title) };
    }
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
    form.setAttribute('aria-describedby', 'plmv5-form-feedback');
    formContract.fields.forEach((field) => {
      const wrapper = el('label', 'plmv5-field');
      wrapper.appendChild(el('span', 'plmv5-field-label', field.label));
      const input = el(field.type === 'textarea' ? 'textarea' : 'input');
      input.name = field.name;
      if (field.type !== 'textarea') input.type = field.type || 'text';
      input.required = Boolean(field.required);
      input.placeholder = text(field.placeholder);
      input.disabled = Boolean(currentState?.saving);
      wrapper.appendChild(input);
      form.appendChild(wrapper);
    });
    const feedback = el('p', currentState?.error ? 'plmv5-form-feedback plmv5-error' : 'plmv5-form-feedback', currentState?.error || UX_COPY.requiredFields);
    feedback.id = 'plmv5-form-feedback';
    feedback.setAttribute('aria-live', 'polite');
    form.appendChild(feedback);
    const submit = el('button', 'plmv5-button plmv5-button-primary', currentState?.saving ? UX_COPY.saving : 'Salvar');
    submit.type = 'submit';
    submit.disabled = !screenState.can_submit || Boolean(currentState?.saving);
    form.appendChild(submit);
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      if (!form.reportValidity()) return;
      const action = FORM_ACTIONS[formContract.submit_action] || formContract.submit_action;
      const payload = payloadFromForm(form, formContract);
      const argument = formContract.type === 'stage_1_actions' ? payload.actions : payload;
      if (typeof store[action] === 'function') {
        const result = await store[action](argument);
        if (result?.ok) showSuccessFeedback(getSuccessFeedback(action));
      }
    });
    return form;
  }

  function renderDataList(title, records, emptyText, pickText) {
    const section = el('section', 'plmv5-data-block');
    section.appendChild(el('h3', '', title));
    if (!Array.isArray(records) || records.length === 0) {
      section.appendChild(el('p', 'plmv5-empty', emptyText));
      return section;
    }
    const list = el('div', 'plmv5-record-list');
    records.forEach((record) => {
      const item = el('article', 'plmv5-record');
      item.appendChild(el('span', 'plmv5-card-marker', '◆'));
      item.appendChild(el('p', '', pickText(record)));
      list.appendChild(item);
    });
    section.appendChild(list);
    return section;
  }

  function renderStage1Actions(screenState) {
    const actions = screenState?.source_stage?.actions || screenState?.source_stage?.items || [];
    const section = el('section', 'plmv5-data-block');
    section.appendChild(el('h3', '', UX_COPY.stage1Title));
    section.appendChild(copyNode('plmv5-message', UX_COPY.stage1Message));
    if (!Array.isArray(actions) || actions.length === 0) {
      section.appendChild(el('p', 'plmv5-empty', UX_COPY.stage1Empty));
      return section;
    }
    const list = el('div', 'plmv5-record-list');
    actions.forEach((action) => {
      const item = el('article', 'plmv5-record');
      item.appendChild(el('strong', '', text(action.title, 'Ação mínima')));
      if (action.completed || action.completed_at || action.status === 'completed') {
        item.appendChild(el('span', 'plmv5-badge is-completed', 'Concluída'));
      } else {
        const button = el('button', 'plmv5-button', 'Concluir ação');
        button.type = 'button';
        button.disabled = Boolean(currentState?.saving);
        button.addEventListener('click', async () => {
          const result = await store.completeStage1Action(action.id);
          if (result?.ok) showSuccessFeedback(getSuccessFeedback('completeStage1Action'));
        });
        item.appendChild(button);
      }
      list.appendChild(item);
    });
    section.appendChild(list);
    return section;
  }

  function renderScreenCollections(screenState) {
    const stage = screenState?.source_stage || {};
    if (screenState.key === 'stage_1_actions') return renderStage1Actions(screenState);
    if (screenState.key === 'stage_3_victories') return renderDataList('Vitórias registradas', stage.victories || stage.items, UX_COPY.victoriesEmpty, (item) => text(item.description || item.title || item.value, 'Vitória registrada'));
    if (screenState.key === 'stage_4_recovery') return renderDataList('Protocolos salvos', stage.protocols || stage.items, 'Nenhum protocolo de recuperação foi salvo ainda.', (item) => text(item.description || item.title || item.value, 'Protocolo salvo'));
    if (screenState.key === 'maintenance_goals') return renderDataList('Metas de manutenção', stage.goals || stage.items, 'Nenhuma meta de manutenção foi criada ainda.', (item) => text(item.goal || item.title || item.description, 'Meta de manutenção'));
    return null;
  }

  function renderScreen(state) {
    const screenKey = getScreenKey();
    const screenState = contracts.buildScreenState(screenKey, state) || contracts.buildScreenState('journey_overview', state);
    clear(elements.screen);
    const header = el('header', 'plmv5-screen-header');
    const backLink = el('a', 'plmv5-back-link', UX_COPY.backToOverview);
    backLink.href = '#project-lm/journey';
    header.appendChild(backLink);
    header.appendChild(el('p', 'plmv5-kicker', '◆ Etapa da jornada'));
    header.appendChild(el('h2', '', screenState.title));
    header.appendChild(el('p', '', screenState.subtitle));
    header.appendChild(el('span', `plmv5-badge is-${screenState.status}`, readableStatus(screenState.status)));
    elements.screen.appendChild(header);
    if (screenState.key === 'stage_2_plan_b') elements.screen.appendChild(copyNode('plmv5-message', UX_COPY.planBMessage));
    if (screenState.key === 'stage_3_victories') elements.screen.appendChild(copyNode('plmv5-message', UX_COPY.victoriesMessage));
    if (screenState.key === 'stage_4_recovery') elements.screen.appendChild(copyNode('plmv5-message', UX_COPY.recoveryMessage));
    if (screenState.status === 'loading') elements.screen.appendChild(copyNode('plmv5-message', UX_COPY.loading));
    if (state?.saving) elements.screen.appendChild(copyNode('plmv5-message', UX_COPY.saving));
    if (screenState.status === 'error') elements.screen.appendChild(copyNode('plmv5-message plmv5-error', UX_COPY.error));
    if (screenState.status === 'locked') elements.screen.appendChild(copyNode('plmv5-message plmv5-locked', UX_COPY.lockedHint));
    if (screenState.status === 'completed') elements.screen.appendChild(copyNode('plmv5-message', UX_COPY.completedHint));
    if (screenState.status === 'maintenance') {
      const maintenance = el('section', 'plmv5-maintenance-highlight');
      maintenance.appendChild(el('p', 'plmv5-kicker', '◆ Continuidade'));
      maintenance.appendChild(el('h3', '', UX_COPY.maintenanceTitle));
      maintenance.appendChild(el('p', '', UX_COPY.maintenanceSubtitle));
      maintenance.appendChild(copyNode('plmv5-message', UX_COPY.maintenanceMessage));
      elements.screen.appendChild(maintenance);
    }
    const collection = renderScreenCollections(screenState);
    if (collection) elements.screen.appendChild(collection);
    const form = renderFormContract(screenState);
    if (form) elements.screen.appendChild(form);
  }

  function renderMessages(state) {
    clear(elements.messages);
    if (successFeedback) elements.messages.appendChild(copyNode('plmv5-message plmv5-success', successFeedback));
    if (state?.error) elements.messages.appendChild(copyNode('plmv5-message plmv5-error', UX_COPY.error));
    else if (state?.loading) elements.messages.appendChild(copyNode('plmv5-message', UX_COPY.loading));
    else if (state?.saving) elements.messages.appendChild(copyNode('plmv5-message', UX_COPY.saving));
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

  function focusMainContent() {
    const main = elements?.root?.querySelector('#plmv5-main-content');
    if (main && typeof main.focus === 'function') main.focus({ preventScroll: true });
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
    hashChangeHandler = () => {
      render(store.getState());
      focusMainContent();
    };
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
    successFeedback = null;
    if (successFeedbackTimer) globalScope.clearTimeout(successFeedbackTimer);
    successFeedbackTimer = null;
    elements = null;
    store = null;
    contracts = null;
  }

  if (globalScope.document?.readyState === 'loading') globalScope.document.addEventListener('DOMContentLoaded', boot);
  else boot();

  globalScope.ProjectLmV5App = Object.freeze({ OFFICIAL_ROUTES, getRoute, boot, destroy, renderCurrentRoute, safeText });
})(typeof window !== 'undefined' ? window : globalThis);
