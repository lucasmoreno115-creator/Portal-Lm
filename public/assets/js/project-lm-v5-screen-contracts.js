(function initProjectLmV5ScreenContracts(globalScope) {
  const STATE_MESSAGES = Object.freeze({
    locked: 'Conclua o passo atual para abrir esta etapa.',
    active: 'Este é o passo para fazer agora.',
    completed: 'Etapa concluída. Você pode revisar ou voltar ao resumo.',
    maintenance: 'Você está em manutenção. Defina uma meta simples para sustentar a rotina.',
    loading: 'Preparando seu resumo.',
    error: 'Não conseguimos mostrar esta etapa agora. Tente novamente.'
  });

  const formContracts = Object.freeze({
    stage_1_actions: Object.freeze({
      type: 'stage_1_actions',
      submit_action: 'createStage1Actions',
      fields: Object.freeze([
        Object.freeze({ name: 'actions[0].title', label: 'Ação mínima 1', type: 'text', required: true, placeholder: 'Ex.: beber água ao acordar.' }),
        Object.freeze({ name: 'actions[1].title', label: 'Ação mínima 2', type: 'text', required: true, placeholder: 'Ex.: caminhar 10 minutos.' }),
        Object.freeze({ name: 'actions[2].title', label: 'Ação mínima 3', type: 'text', required: true, placeholder: 'Ex.: incluir proteína no almoço.' })
      ])
    }),
    stage_2_plan_b: Object.freeze({
      type: 'stage_2_plan_b',
      submit_action: 'savePlanB',
      fields: Object.freeze([
        Object.freeze({ name: 'emergency_meal', label: 'Refeição de emergência', type: 'text', required: true, placeholder: 'Ex.: ovos, arroz e salada pronta.' }),
        Object.freeze({ name: 'minimum_workout', label: 'Treino mínimo', type: 'text', required: true, placeholder: 'Ex.: 10 minutos em casa.' }),
        Object.freeze({ name: 'minimum_movement', label: 'Movimento mínimo', type: 'text', required: true, placeholder: 'Ex.: uma caminhada curta.' }),
        Object.freeze({ name: 'minimum_self_care', label: 'Autocuidado mínimo', type: 'text', required: true, placeholder: 'Ex.: dormir 30 minutos mais cedo.' })
      ])
    }),
    stage_3_victories: Object.freeze({
      type: 'stage_3_victories',
      submit_action: 'createVictory',
      fields: Object.freeze([
        Object.freeze({ name: 'description', label: 'Vitória', type: 'textarea', required: true, placeholder: 'Ex.: fiz minha ação mínima mesmo sem vontade.' })
      ])
    }),
    stage_4_recovery: Object.freeze({
      type: 'stage_4_recovery',
      submit_action: 'saveRecovery',
      fields: Object.freeze([
        Object.freeze({ name: 'overeating', label: 'Exagero alimentar', type: 'textarea', required: true, placeholder: 'Defina como retomar após exagerar na alimentação.' }),
        Object.freeze({ name: 'missed_workout', label: 'Treino perdido', type: 'textarea', required: true, placeholder: 'Defina como retomar após perder um treino.' }),
        Object.freeze({ name: 'travel', label: 'Viagem', type: 'textarea', required: true, placeholder: 'Defina como manter a jornada durante viagens.' }),
        Object.freeze({ name: 'difficult_week', label: 'Semana difícil', type: 'textarea', required: true, placeholder: 'Defina como atravessar uma semana difícil.' }),
        Object.freeze({ name: 'lack_of_motivation', label: 'Falta de motivação', type: 'textarea', required: true, placeholder: 'Defina como agir quando faltar motivação.' })
      ])
    }),
    maintenance_goals: Object.freeze({
      type: 'maintenance_goals',
      submit_action: 'createMaintenanceGoal',
      fields: Object.freeze([
        Object.freeze({ name: 'goal', label: 'Meta de manutenção', type: 'text', required: true, placeholder: 'Defina uma meta simples para sustentar sua evolução.' })
      ])
    })
  });

  const screens = Object.freeze([
    Object.freeze({ key: 'journey_overview', title: 'Sua Direção', subtitle: 'Veja o próximo passo e faça apenas o necessário agora.', route: '#project-lm/journey', stage_key: null, required_status: null, empty_state: 'Comece definindo suas três ações mínimas.', locked_state: STATE_MESSAGES.locked, completed_state: STATE_MESSAGES.completed, primary_action: 'open_current_stage', secondary_action: null, form_contract: null }),
    Object.freeze({ key: 'stage_1_actions', title: 'Ações mínimas', subtitle: 'Defina três ações mínimas para começar com consistência.', route: '#project-lm/stage-1-actions', stage_key: 'stage_1', required_status: 'active', empty_state: 'Defina três ações mínimas para começar.', locked_state: STATE_MESSAGES.locked, completed_state: STATE_MESSAGES.completed, primary_action: 'createStage1Actions', secondary_action: 'completeStage1Action', form_contract: formContracts.stage_1_actions }),
    Object.freeze({ key: 'stage_2_plan_b', title: 'Plano B', subtitle: 'Defina o que fazer quando o plano ideal não couber.', route: '#project-lm/plan-b', stage_key: 'stage_2', required_status: 'active', empty_state: 'Preencha seu Plano B para saber o que fazer em dias apertados.', locked_state: STATE_MESSAGES.locked, completed_state: STATE_MESSAGES.completed, primary_action: 'savePlanB', secondary_action: null, form_contract: formContracts.stage_2_plan_b }),
    Object.freeze({ key: 'stage_3_victories', title: 'Vitórias da Jornada', subtitle: 'Registre uma escolha concreta que mostrou progresso.', route: '#project-lm/victories', stage_key: 'stage_3', required_status: 'active', empty_state: 'Registre uma escolha concreta de hoje, mesmo que pequena.', locked_state: STATE_MESSAGES.locked, completed_state: STATE_MESSAGES.completed, primary_action: 'createVictory', secondary_action: null, form_contract: formContracts.stage_3_victories }),
    Object.freeze({ key: 'stage_4_recovery', title: 'Recuperação', subtitle: 'Defina respostas simples para retomar sem improviso.', route: '#project-lm/recovery', stage_key: 'stage_4', required_status: 'active', empty_state: 'Preencha seus protocolos para saber como retomar.', locked_state: STATE_MESSAGES.locked, completed_state: STATE_MESSAGES.completed, primary_action: 'saveRecovery', secondary_action: null, form_contract: formContracts.stage_4_recovery }),
    Object.freeze({ key: 'maintenance_goals', title: 'Manutenção', subtitle: 'Escolha uma meta simples para sustentar o que construiu.', route: '#project-lm/maintenance', stage_key: 'maintenance', required_status: 'maintenance', empty_state: 'Defina uma meta simples para os próximos dias.', locked_state: STATE_MESSAGES.locked, completed_state: STATE_MESSAGES.completed, primary_action: 'createMaintenanceGoal', secondary_action: null, form_contract: formContracts.maintenance_goals })
  ]);

  const STAGE_TO_SCREEN = Object.freeze({ stage_1: 'stage_1_actions', stage_2: 'stage_2_plan_b', stage_3: 'stage_3_victories', stage_4: 'stage_4_recovery', maintenance: 'maintenance_goals' });
  const NEXT_REQUIRED_ACTION_TO_SCREEN = Object.freeze({ choose_stage_1_actions: 'stage_1_actions', complete_stage_1_actions: 'stage_1_actions', fill_plan_b: 'stage_2_plan_b', record_victories: 'stage_3_victories', fill_recovery_protocols: 'stage_4_recovery', maintenance: 'maintenance_goals' });
  const CTA_ACTION_TO_SCREEN = Object.freeze({ open_stage_1_actions: 'stage_1_actions', open_plan_b: 'stage_2_plan_b', open_victories: 'stage_3_victories', open_recovery_protocols: 'stage_4_recovery', open_maintenance_goals: 'maintenance_goals' });

  const flows = Object.freeze({
    stageToScreen: STAGE_TO_SCREEN,
    nextRequiredActionToScreen: NEXT_REQUIRED_ACTION_TO_SCREEN,
    ctaActionToScreen: CTA_ACTION_TO_SCREEN
  });

  const actions = Object.freeze([
    Object.freeze({ key: 'createStage1Actions', state_action: 'createStage1Actions', success_message: 'Ações mínimas definidas.', error_fallback: 'Não foi possível salvar suas ações mínimas agora.' }),
    Object.freeze({ key: 'completeStage1Action', state_action: 'completeStage1Action', success_message: 'Ação mínima concluída.', error_fallback: 'Não foi possível concluir esta ação mínima agora.' }),
    Object.freeze({ key: 'savePlanB', state_action: 'savePlanB', success_message: 'Plano B criado.', error_fallback: 'Não foi possível salvar seu Plano B agora.' }),
    Object.freeze({ key: 'createVictory', state_action: 'createVictory', success_message: 'Vitória registrada.', error_fallback: 'Não foi possível registrar esta vitória agora.' }),
    Object.freeze({ key: 'saveRecovery', state_action: 'saveRecovery', success_message: 'Protocolos de recuperação definidos.', error_fallback: 'Não foi possível salvar seus protocolos de recuperação agora.' }),
    Object.freeze({ key: 'createMaintenanceGoal', state_action: 'createMaintenanceGoal', success_message: 'Meta de manutenção definida.', error_fallback: 'Não foi possível criar esta meta de manutenção agora.' })
  ]);

  function getScreenByKey(screenKey) {
    return screens.find((screen) => screen.key === screenKey) || null;
  }

  function getScreenForStage(stageKey) {
    return getScreenByKey(STAGE_TO_SCREEN[stageKey]);
  }

  function getFlowForAction(action) {
    const screenKey = CTA_ACTION_TO_SCREEN[action];
    return screenKey ? getScreenByKey(screenKey) : null;
  }

  function getScreenForNextRequiredAction(nextRequiredAction) {
    const screenKey = NEXT_REQUIRED_ACTION_TO_SCREEN[nextRequiredAction];
    return screenKey ? getScreenByKey(screenKey) : null;
  }

  function getStageForScreen(screen, journeyState) {
    if (!screen || !screen.stage_key || !journeyState || !journeyState.stages) return null;
    return journeyState.stages[screen.stage_key] || null;
  }

  function getCurrentScreenKey(journeyState) {
    const nextRequiredAction = journeyState?.progress?.next_required_action;
    const nextRequiredActionScreen = NEXT_REQUIRED_ACTION_TO_SCREEN[nextRequiredAction];
    if (nextRequiredActionScreen) return nextRequiredActionScreen;

    const ctaAction = journeyState?.view_model?.primary_cta?.action;
    const ctaActionScreen = CTA_ACTION_TO_SCREEN[ctaAction];
    if (ctaActionScreen) return ctaActionScreen;

    const stages = journeyState?.stages || {};
    const activeStageKey = Object.keys(STAGE_TO_SCREEN).find((stageKey) => stages[stageKey]?.status === 'active' || stages[stageKey]?.status === 'maintenance');
    return activeStageKey ? STAGE_TO_SCREEN[activeStageKey] : null;
  }

  function resolveStatus(screen, stage, journeyState) {
    if (journeyState?.loading) return 'loading';
    if (journeyState?.error) return 'error';
    if (screen.key === 'journey_overview') return journeyState?.progress?.status || journeyState?.journey?.status || 'active';
    if (screen.key === 'maintenance_goals' && stage?.status === 'active') return 'maintenance';
    return stage?.status || 'locked';
  }

  function buildScreenState(screenKey, journeyState) {
    const screen = getScreenByKey(screenKey);
    if (!screen) return null;

    const stage = getStageForScreen(screen, journeyState);
    const status = resolveStatus(screen, stage, journeyState);
    const canAccess = screen.key === 'journey_overview' || (status !== 'locked' && status !== 'error' && status !== 'loading');

    return {
      key: screen.key,
      route: screen.route,
      title: screen.title,
      subtitle: screen.subtitle,
      status,
      can_access: canAccess,
      can_submit: !journeyState?.loading && !journeyState?.saving && canAccess,
      is_current: screen.key === getCurrentScreenKey(journeyState),
      message: STATE_MESSAGES[status] || screen.empty_state,
      primary_action: screen.primary_action,
      form_contract: screen.form_contract,
      source_stage: stage
    };
  }

  function buildAllScreenStates(journeyState) {
    return screens.map((screen) => buildScreenState(screen.key, journeyState));
  }

  globalScope.ProjectLmV5ScreenContracts = Object.freeze({
    screens,
    flows,
    actions,
    getScreenByKey,
    getScreenForStage,
    getFlowForAction,
    getScreenForNextRequiredAction,
    buildScreenState,
    buildAllScreenStates
  });
})(typeof window !== 'undefined' ? window : globalThis);
