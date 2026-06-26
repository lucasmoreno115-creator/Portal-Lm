(function initProjectLmV5App(globalScope) {
  const OFFICIAL_ROUTES = Object.freeze({
    '#project-lm/journey': 'journey_overview',
    '#project-lm/stage-1-actions': 'stage_1_actions',
    '#project-lm/plan-b': 'stage_2_plan_b',
    '#project-lm/victories': 'stage_3_victories',
    '#project-lm/recovery': 'stage_4_recovery',
    '#project-lm/maintenance': 'maintenance_goals'
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
    fill_plan_b: 'Criar meu Plano B',
    record_victories: 'Registrar uma vitória concreta',
    fill_recovery_protocols: 'Definir protocolos de recuperação',
    maintenance: 'Ver minha evolução'
  });


  const STATUS_LABELS = Object.freeze({
    active: 'Etapa atual',
    completed: 'Concluída',
    locked: 'Bloqueada',
    maintenance: 'Manutenção',
    loading: 'Carregando',
    error: 'Atenção necessária'
  });



  const HERO_CTA_LABEL = 'VER MEU PRÓXIMO PASSO';

  const STAGE_CARD_COPY = Object.freeze({
    stage_1: Object.freeze({
      title: 'Ações mínimas da semana',
      subtitle: 'Escolha três ações pequenas e possíveis para começar.'
    }),
    stage_2: Object.freeze({
      title: 'Plano B',
      subtitle: 'Defina o que fazer quando o plano ideal não couber.',
      empty: 'Preencha seu Plano B para saber o que fazer em dias apertados.'
    }),
    stage_3: Object.freeze({
      title: 'Vitórias da Jornada',
      subtitle: 'Registre uma escolha concreta que mostrou progresso.',
      empty: 'Registre uma escolha concreta de hoje, mesmo que pequena.'
    }),
    stage_4: Object.freeze({
      title: 'Recuperação',
      subtitle: 'Defina respostas simples para retomar sem improviso.'
    }),
    maintenance: Object.freeze({
      title: 'Manutenção',
      subtitle: 'Escolha uma meta simples para sustentar o que construiu.'
    })
  });

  const UX_COPY = Object.freeze({
    loading: 'Preparando seu próximo passo.',
    saving: 'Registrando. Aguarde um instante.',
    error: 'Não conseguimos atualizar agora. Tente novamente.',
    primaryMessageFallback: 'Siga um passo simples por vez.',
    overviewTitle: 'Projeto LM',
    overviewDescription: 'Veja seu próximo passo e faça apenas o necessário para avançar hoje.',
    backToOverview: 'Voltar para o resumo',
    requiredFields: 'Preencha com respostas simples e executáveis.',
    lockedHint: 'Esta etapa abre depois do passo atual. Volte ao resumo para ver o que fazer agora.',
    completedHint: 'Etapa concluída. Revise se quiser, ou volte ao resumo para seguir.',
    stage1Title: 'Ações mínimas da semana',
    stage1Message: 'Escolha três ações pequenas que cabem na sua rotina real.',
    stage1Empty: 'Defina suas três ações mínimas para começar.',
    planBMessage: 'Defina uma versão mínima para alimentação, treino, movimento e autocuidado.',
    victoriesMessage: 'Registre uma escolha concreta que mostrou progresso.',
    victoriesEmpty: 'Registre uma escolha concreta de hoje, mesmo que pequena.',
    recoveryMessage: 'Prepare respostas para retomar após obstáculos comuns.',
    maintenanceTitle: 'Você chegou à manutenção.',
    maintenanceSubtitle: 'Agora escolha o que sustenta sua rotina.',
    maintenanceMessage: 'Defina uma meta simples para os próximos dias.',
    successGeneric: 'Registro salvo. Veja o próximo passo no resumo.',
    successAction: 'Ação concluída. Veja se ainda há ações pendentes.',
    successVictory: 'Vitória registrada. Continue até completar 7.'
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
  let errorHandler = null;
  let rejectionHandler = null;
  let lastViewedEvent = null;

  const SCREEN_VIEW_EVENTS = Object.freeze({
    stage_1_actions: 'stage_1_viewed',
    stage_2_plan_b: 'stage_2_viewed',
    stage_3_victories: 'stage_3_viewed',
    stage_4_recovery: 'stage_4_viewed',
    maintenance_goals: 'maintenance_viewed'
  });

  const SCREEN_ENTER_EVENTS = Object.freeze({
    stage_1_actions: 'entered_stage_1',
    stage_2_plan_b: 'entered_stage_2',
    stage_3_victories: 'entered_stage_3',
    stage_4_recovery: 'entered_stage_4',
    maintenance_goals: 'entered_maintenance'
  });

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
    const hash = text(globalScope.location.hash).trim();
    if (!hash || hash === '#' || !hash.startsWith('#project-lm/') || !OFFICIAL_ROUTES[hash]) return '#project-lm/journey';
    return hash;
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


  function getUserFacingError(state) {
    if (!state?.error && !state?.last_error_code) return '';
    const code = state.last_error_code;
    if (code === 'PROJECT_LM_V5_REQUEST_TIMEOUT') return 'A conexão demorou mais do que o esperado. Tente novamente.';
    if (code === 'PROJECT_LM_V5_NETWORK_ERROR') return 'Não conseguimos conectar agora. Verifique sua internet e tente novamente.';
    if (code === 'PROJECT_LM_V5_INVALID_CONTRACT') return 'Não conseguimos preparar sua jornada agora. Tente atualizar a página.';
    if (code === 'PROJECT_LM_V5_SAVE_IN_PROGRESS') return 'Já estamos registrando sua resposta. Aguarde um instante.';
    if (code === 'PROJECT_LM_V5_LOAD_IN_PROGRESS') return 'Seu resumo já está sendo preparado. Aguarde um instante.';
    return text(state.error, UX_COPY.error);
  }

  function getSubmitLabel(formType) {
    const labels = {
      stage_1_actions: 'Definir minhas 3 ações',
      stage_2_plan_b: 'Criar meu Plano B',
      stage_3_victories: 'Registrar minha vitória',
      stage_4_recovery: 'Salvar meus protocolos',
      maintenance_goals: 'Definir meta de manutenção'
    };
    return labels[formType] || 'Registrar resposta';
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
    appendRouteLink(contracts.getScreenByKey('journey_overview'), screenKey, 'Sua Direção');
    const nextScreen = getCurrentActionScreen(state);
    if (nextScreen && nextScreen.key !== 'journey_overview') appendRouteLink(nextScreen, screenKey, 'Seu Próximo Passo');
    if (screenKey !== 'journey_overview' && (!nextScreen || nextScreen.key !== screenKey)) {
      appendRouteLink(contracts.getScreenByKey(screenKey), screenKey);
    }
  }

  function updateHeroCta(state, viewModel) {
    clear(elements.heroCta);
    if (!viewModel.primary_cta?.label) return;
    const cta = el('button', 'plmv5-button plmv5-button-primary', HERO_CTA_LABEL);
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
    intro.appendChild(el('p', 'plmv5-kicker', '◆ Sua Direção'));
    intro.appendChild(el('p', 'plmv5-message', 'Faça apenas o próximo passo indicado.'));
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
    safeText(elements.pageSubtitle, 'Um passo simples por vez.');
    safeText(elements.statusLabel, text(viewModel.status_label, state?.journey?.status || 'Status não carregado'));
    safeText(elements.progressLabel, text(viewModel.progress_label, 'Progresso não carregado'));
    const percentage = Number(state?.progress?.percentage ?? viewModel.percentage ?? 0);
    const safePercentage = Number.isFinite(percentage) ? Math.max(0, Math.min(100, percentage)) : 0;
    elements.percentage.value = safePercentage;
    safeText(elements.percentage, `${safePercentage}%`);
    safeText(elements.percentageText, `${safePercentage}%`);
    if (elements.progressLabel) elements.progressLabel.appendChild(copyNode('plmv5-progress-support', getProgressSupport(safePercentage)));
    safeText(elements.primaryMessage, UX_COPY.overviewDescription);
    safeText(elements.nextAction, `◆ Próximo: ${readableAction(state?.progress?.next_required_action)}`);
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
      elements.stageCards.appendChild(el('p', 'plmv5-empty', 'As etapas aparecem assim que seu resumo estiver pronto.'));
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
      const cardCopy = STAGE_CARD_COPY[card.key] || {};
      button.appendChild(el('strong', 'plmv5-card-title', text(cardCopy.title || card.title || card.label || card.name, 'Etapa')));
      button.appendChild(el('span', 'plmv5-card-status', text(card.status_label, readableStatus(status))));
      if (cardCopy.subtitle || card.subtitle || card.description) button.appendChild(el('span', 'plmv5-card-subtitle', text(cardCopy.subtitle || card.subtitle || card.description)));
      if (card.progress_text) button.appendChild(el('span', 'plmv5-card-progress', card.progress_text));
      if ((card.empty_state || cardCopy.empty) && status === 'active') button.appendChild(el('small', 'plmv5-empty', text(cardCopy.empty || card.empty_state)));
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
    const feedback = el('p', currentState?.error ? 'plmv5-form-feedback plmv5-error' : 'plmv5-form-feedback', getUserFacingError(currentState) || UX_COPY.requiredFields);
    feedback.id = 'plmv5-form-feedback';
    feedback.setAttribute('aria-live', 'polite');
    form.appendChild(feedback);
    const submit = el('button', 'plmv5-button plmv5-button-primary', currentState?.saving ? UX_COPY.saving : getSubmitLabel(formContract.type));
    submit.type = 'submit';
    submit.disabled = !screenState.can_submit || Boolean(currentState?.saving);
    form.appendChild(submit);
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      if (form.dataset.submitting === 'true' || currentState?.saving) return;
      if (!form.reportValidity()) return;
      const action = FORM_ACTIONS[formContract.submit_action] || formContract.submit_action;
      const payload = payloadFromForm(form, formContract);
      const argument = formContract.type === 'stage_1_actions' ? payload.actions : payload;
      if (typeof store[action] === 'function') {
        form.dataset.submitting = 'true';
        const result = await store[action](argument);
        form.dataset.submitting = 'false';
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
        const button = el('button', 'plmv5-button', 'Marcar ação como concluída');
        button.type = 'button';
        button.disabled = Boolean(currentState?.saving);
        button.addEventListener('click', async () => {
          if (button.dataset.submitting === 'true' || currentState?.saving) return;
          button.dataset.submitting = 'true';
          button.disabled = true;
          const result = await store.completeStage1Action(action.id);
          button.dataset.submitting = 'false';
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
    if (screenState.key === 'stage_3_victories') return renderDataList('Vitórias da Jornada', stage.victories || stage.items, UX_COPY.victoriesEmpty, (item) => text(item.description || item.title || item.value, 'Vitória registrada'));
    if (screenState.key === 'stage_4_recovery') return renderDataList('Recuperação', stage.protocols || stage.items, 'Preencha seus protocolos para saber como retomar.', (item) => text(item.description || item.title || item.value, 'Protocolo salvo'));
    if (screenState.key === 'maintenance_goals') return renderDataList('Manutenção', stage.goals || stage.items, 'Defina uma meta simples para sustentar sua rotina.', (item) => text(item.goal || item.title || item.description, 'Meta de manutenção'));
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
    header.appendChild(el('p', 'plmv5-kicker', '◆ Passo da jornada'));
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
    if (state?.error) elements.messages.appendChild(copyNode('plmv5-message plmv5-error', getUserFacingError(state) || UX_COPY.error));
    else if (state?.loading) elements.messages.appendChild(copyNode('plmv5-message', UX_COPY.loading));
    else if (state?.saving) elements.messages.appendChild(copyNode('plmv5-message', UX_COPY.saving));
  }

  function trackRouteView(screenKey) {
    if (!store || typeof store.track !== 'function') return;
    const viewed = screenKey === 'journey_overview' ? null : SCREEN_VIEW_EVENTS[screenKey];
    const entered = SCREEN_ENTER_EVENTS[screenKey];
    const key = `${screenKey}:${viewed}:${entered}`;
    if (key === lastViewedEvent) return;
    lastViewedEvent = key;
    if (viewed) store.track(viewed);
    if (entered) store.track(entered);
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
    trackRouteView(isOverviewRoute ? 'journey_overview' : getScreenKey());
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
    if (unsubscribe || hashChangeHandler) destroy();
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
    errorHandler = (event) => {
      if (store && typeof store.track === 'function') store.track('unexpected_client_error', { error_code: event?.error?.name || 'CLIENT_ERROR', message: event?.message || null });
    };
    rejectionHandler = (event) => {
      if (store && typeof store.track === 'function') store.track('unexpected_client_error', { error_code: event?.reason?.name || 'UNHANDLED_REJECTION', message: event?.reason?.message || String(event?.reason || '') });
    };
    globalScope.addEventListener('error', errorHandler);
    globalScope.addEventListener('unhandledrejection', rejectionHandler);
    unsubscribe = store.subscribe(render);
    store.loadJourney();
  }

  function destroy() {
    if (typeof unsubscribe === 'function') unsubscribe();
    if (hashChangeHandler) globalScope.removeEventListener('hashchange', hashChangeHandler);
    if (errorHandler) globalScope.removeEventListener('error', errorHandler);
    if (rejectionHandler) globalScope.removeEventListener('unhandledrejection', rejectionHandler);
    unsubscribe = null;
    hashChangeHandler = null;
    errorHandler = null;
    rejectionHandler = null;
    lastViewedEvent = null;
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
