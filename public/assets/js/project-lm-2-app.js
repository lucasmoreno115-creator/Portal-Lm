(function initializeProjectLm2App(global, document) {
  const api = {
    onboarding: '/api/project-lm-2/onboarding',
    home: '/api/project-lm-2/home',
    week1VideoComplete: '/api/project-lm-2/week-1/video-complete',
    planB: '/api/project-lm-2/plan-b',
    progress: '/api/project-lm-2/progress',
    weekStatus: '/api/project-lm-2/week-status',
    checkin: '/api/project-lm-2/checkin',
    week2VideoComplete: '/api/project-lm-2/week-2/video-complete',
    week2Reflection: '/api/project-lm-2/week-2/reflection',
    week2Status: '/api/project-lm-2/week-2/status',
    activateWeek2: '/api/project-lm-2/activate-week-2'
  };

  // Semana 1 será liberada em breve.
  const copy = {
    welcome: `
      <section class="lm2-hero" aria-labelledby="lm2-title">
        <h1 id="lm2-title">Projeto LM</h1>
        <div class="lm2-subtitle">
          <p>Você não precisa de mais motivação.</p>
          <p>Precisa de direção.</p>
          <p>Nos próximos 30 dias vamos construir uma habilidade que muda tudo:</p>
          <p>Continuar mesmo quando a vida não sai como planejado.</p>
        </div>
        <button class="lm2-primary-button" type="button" data-route="onboarding-name">COMEÇAR</button>
      </section>`
  };

  function escapeHtml(value) {
    return String(value || '').replace(/[&<>"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[char]));
  }

  function optionButton(name, value, label, selected) {
    return `<button class="lm2-option${selected === value ? ' is-selected' : ''}" type="button" data-option-name="${name}" data-option-value="${value}">${label}</button>`;
  }

  function setError(root, message) {
    const error = root.querySelector('[data-lm2-error]');
    if (error) error.textContent = message || '';
  }

  function applyHomeData(homeData = {}) {
    const currentState = global.ProjectLm2State.getState();
    global.ProjectLm2State.updateState({
      home_loaded: true,
      home_data: homeData,
      home: homeData,
      name: homeData.name || currentState.name,
      onboarding_completed: homeData.onboarding_completed ?? currentState.onboarding_completed,
      current_week: homeData.current_week || currentState.current_week,
      week_started_at: homeData.week_started_at || currentState.week_started_at,
      week_completed_at: homeData.week_completed_at || currentState.week_completed_at,
      continuity_days_count: Number(homeData.continuity_days_count || 0),
      required_days_count: homeData.required_days_count || currentState.required_days_count,
      goal_reached: Boolean(homeData.goal_reached),
      today_checkin_completed: Boolean(homeData.today_checkin_completed),
      next_action: homeData.next_action || currentState.next_action,
      next_action_label: homeData.next_action_label || currentState.next_action_label,
      week_status: homeData.week_status || currentState.week_status,
      week_completed: Boolean(homeData.week_completed),
      next_week_available: Boolean(homeData.next_week_available),
      week_1_video_completed: Boolean(homeData.week_1_video_completed),
      plan_b_completed: Boolean(homeData.plan_b_completed),
      plan_b: homeData.plan_b || currentState.plan_b,
      week_2_status: homeData.week_2_status || currentState.week_2_status,
      week_2_video_completed: Boolean(homeData.week_2_video_completed),
      week_2_reflection_completed: Boolean(homeData.week_2_reflection_completed),
      week_2_response_completed: Boolean(homeData.week_2_response_completed),
      week_2_reflection: homeData.week_2_reflection || currentState.week_2_reflection,
      week_2_minimum_response: homeData.week_2_minimum_response || currentState.week_2_minimum_response
    });
  }

  function nextActionLabel(nextAction) {
    if (nextAction === 'week_1_video') return 'Assistir à aula da Semana 1.';
    if (nextAction === 'create_plan_b') return 'Criar seu Plano B inicial.';
    if (nextAction === 'daily_checkin') return 'Registrar check-in de hoje';
    if (nextAction === 'checkin_completed_today') return 'Check-in de hoje registrado.';
    if (nextAction === 'checkin_pending_placeholder') return 'Registrar check-in de hoje';
    if (nextAction === 'week_1_complete') return 'Continuar para Semana 2';
    if (nextAction === 'week_2_video') return 'Assistir à aula da Semana 2.';
    if (nextAction === 'week_2_reflection') return 'Salvar reflexão da Semana 2.';
    if (nextAction === 'week_2_minimum_response') return 'Salvar resposta mínima da Semana 2.';
    return 'Sua jornada começa na Semana 1.';
  }

  async function loadHome(root) {
    try {
      const [response, progressResponse] = await Promise.all([global.fetch(api.home), global.fetch(api.progress)]);
      if (!response.ok || !progressResponse.ok) throw new Error('home_failed');
      const home = await response.json();
      const progress = await progressResponse.json();
      applyHomeData({ ...(home.data || home), ...(progress.data || {}) });
      render(root, 'home');
    } catch (error) {
      setError(root, 'Não foi possível carregar sua jornada. Tente novamente.');
    }
  }

  function render(root, route) {
    const state = global.ProjectLm2State.getState();
    root.dataset.lm2Route = route;
    root.dataset.lm2NextAction = state.next_action;

    if (route === 'welcome') root.innerHTML = copy.welcome;
    if (route === 'onboarding-name') root.innerHTML = `
      <section class="lm2-card" aria-labelledby="lm2-name-title">
        <h1 id="lm2-name-title">Como gostaria de ser chamado?</h1>
        <input class="lm2-input" name="name" data-lm2-name autocomplete="given-name" value="${escapeHtml(state.name)}">
        <p class="lm2-error" data-lm2-error role="alert"></p>
        <button class="lm2-primary-button" type="button" data-continue-name>CONTINUAR</button>
      </section>`;
    if (route === 'onboarding-goal') root.innerHTML = `
      <section class="lm2-card" aria-labelledby="lm2-goal-title">
        <h1 id="lm2-goal-title">Qual seu principal objetivo hoje?</h1>
        <div class="lm2-options">
          ${optionButton('goal', 'emagrecer', 'emagrecer', state.goal)}
          ${optionButton('goal', 'voltar a treinar', 'voltar a treinar', state.goal)}
          ${optionButton('goal', 'criar consistência', 'criar consistência', state.goal)}
        </div>
        <p class="lm2-error" data-lm2-error role="alert"></p>
        <button class="lm2-primary-button" type="button" data-continue-goal>CONTINUAR</button>
      </section>`;
    if (route === 'onboarding-sex') root.innerHTML = `
      <section class="lm2-card" aria-labelledby="lm2-sex-title">
        <h1 id="lm2-sex-title">Sexo</h1>
        <div class="lm2-options">
          ${optionButton('sex', 'male', 'male', state.sex)}
          ${optionButton('sex', 'female', 'female', state.sex)}
        </div>
        <p class="lm2-error" data-lm2-error role="alert"></p>
        <button class="lm2-primary-button" type="button" data-continue-sex>CONTINUAR</button>
      </section>`;
    if (route === 'onboarding-weight') root.innerHTML = `
      <section class="lm2-card" aria-labelledby="lm2-weight-title">
        <h1 id="lm2-weight-title">Qual seu peso atual?</h1>
        <input class="lm2-input" name="weight_kg" data-lm2-weight inputmode="decimal" type="number" min="1" step="0.1" value="${state.weight_kg || ''}">
        <p class="lm2-error" data-lm2-error role="alert"></p>
        <button class="lm2-primary-button" type="button" data-create-direction>CRIAR MINHA DIREÇÃO</button>
      </section>`;
    if (route === 'direction-created') root.innerHTML = `
      <section class="lm2-card" aria-labelledby="lm2-direction-title">
        <h1 id="lm2-direction-title">Olá ${escapeHtml(state.name)}</h1>
        <p>Sua direção está pronta.</p><p>Seu treino está pronto.</p><p>Seu plano alimentar está pronto.</p><p>Mas existe algo importante:</p><p>Você não precisa emagrecer tudo em 30 dias.</p><p>Você precisa aprender a continuar por mais de 30 dias.</p><p>É isso que realmente gera resultado.</p>
        <button class="lm2-primary-button" type="button" data-route="home">IR PARA MINHA JORNADA</button>
      </section>`;
    if (route === 'home-placeholder') route = 'home';
    if (route === 'home') root.innerHTML = `
      <section class="lm2-card" aria-labelledby="lm2-home-title">
        <h1 id="lm2-home-title">Olá ${escapeHtml(state.name)}</h1>
        <p>Semana ${state.current_week} de 4</p><p>Dias de continuidade</p><p>${state.continuity_days_count} de ${state.required_days_count} necessários</p><p>Próxima ação:</p><p>${nextActionLabel(state.next_action)}</p>
        ${state.next_action === 'week_1_complete' ? '<div class="lm2-celebration-cta"><p>Parabéns.</p><p>Você concluiu sua primeira semana.</p></div>' : ''}
        <p class="lm2-error" data-lm2-error role="alert"></p>
        <button class="lm2-primary-button" type="button" data-route="${state.next_action === 'week_1_complete' ? 'week-complete' : state.next_action === 'daily_checkin' ? 'daily-checkin' : state.next_action && state.next_action.startsWith('week_2_') ? 'week-2' : 'week-1-placeholder'}">${state.next_action === 'week_1_complete' ? 'CONTINUAR PARA SEMANA 2' : state.next_action === 'daily_checkin' ? 'FAZER CHECK-IN' : 'CONTINUAR'}</button>
        <button class="lm2-secondary-button" type="button" data-route="direction">MINHA DIREÇÃO</button>
      </section>`;
    if (route === 'direction') root.innerHTML = `
      <section class="lm2-card" aria-labelledby="lm2-direction-tools-title">
        <h1 id="lm2-direction-tools-title">Minha Direção</h1>
        <p>As ferramentas que vão ajudar você a continuar.</p>
        <article class="lm2-block"><h2>Meu Treino</h2><p>Seu treino já foi definido para esta jornada.</p><button class="lm2-secondary-button" type="button">ABRIR TREINO</button></article>
        <article class="lm2-block"><h2>Minha Alimentação</h2><p>Seu plano alimentar já foi definido para esta jornada.</p><button class="lm2-secondary-button" type="button">ABRIR PLANO</button></article>
        <article class="lm2-block"><h2>Meu Plano B</h2><p>Sua estratégia para continuar quando a vida não sair como planejado.</p><button class="lm2-secondary-button" type="button">EM BREVE</button></article>
        <button class="lm2-primary-button" type="button" data-route="home">VOLTAR PARA HOME</button>
      </section>`;
    if (route === 'week-1-placeholder') route = 'week-1';
    if (route === 'week-1') root.innerHTML = `
      <section class="lm2-card" aria-labelledby="lm2-week-title">
        <h1 id="lm2-week-title">Semana 1</h1>
        <h2>Pare de Recomeçar</h2>
        <p>Nenhum plano de emagrecimento funciona se você precisa começar de novo toda segunda-feira.</p>
        <article class="lm2-lesson">
          <h3>Por que você sempre recomeça?</h3>
          <p>Assista à aula inicial para entender o ciclo do recomeço.</p>
          <button class="lm2-primary-button" type="button" data-complete-week-1-video>${state.week_1_video_completed ? 'AULA ASSISTIDA' : 'MARCAR AULA COMO ASSISTIDA'}</button>
        </article>
        <form class="lm2-plan-b" data-plan-b-form>
          <h3>Meu Plano B</h3>
          <label>Se eu não conseguir treinar<textarea class="lm2-input" name="unable_to_train">${escapeHtml(state.plan_b?.unable_to_train)}</textarea></label>
          <label>Se eu exagerar na alimentação<textarea class="lm2-input" name="overeating">${escapeHtml(state.plan_b?.overeating)}</textarea></label>
          <label>Se eu estiver sem motivação<textarea class="lm2-input" name="no_motivation">${escapeHtml(state.plan_b?.no_motivation)}</textarea></label>
          <button class="lm2-primary-button" type="button" data-save-plan-b>SALVAR MEU PLANO B</button>
        </form>
        <p class="lm2-error" data-lm2-error role="alert"></p>
        <button class="lm2-secondary-button" type="button" data-route="home">VOLTAR PARA HOME</button>
      </section>`;

    if (route === 'week-complete') root.innerHTML = `
      <section class="lm2-card" aria-labelledby="lm2-week-complete-title">
        <h1 id="lm2-week-complete-title">Parabéns.</h1>
        <p>Você não precisou ser perfeito.</p>
        <p>Você precisou continuar.</p>
        <p>Nos dias bons, você continuou.</p>
        <p>Nos dias difíceis, você também encontrou uma forma de continuar.</p>
        <p>E isso é o que realmente gera resultado.</p>
        <p class="lm2-error" data-lm2-error role="alert"></p>
        <button class="lm2-primary-button" type="button" data-activate-week-2>IR PARA SEMANA 2</button>
      </section>`;

    if (route === 'week-2') root.innerHTML = `
      <section class="lm2-card" aria-labelledby="lm2-week-2-title">
        <h1 id="lm2-week-2-title">Semana 2</h1>
        <h2>Dias difíceis fazem parte.</h2>
        <p>O problema não é ter dias difíceis.</p>
        <p>O problema é acreditar que um dia difícil apaga todo o progresso construído.</p>
        <p>Nesta semana você vai praticar uma habilidade simples:</p>
        <p>Continuar.</p>
        <p>Mesmo quando a rotina não sair como planejado.</p>
        <article class="lm2-lesson">
          <h3>Como continuar quando o dia sai do controle</h3>
          <p>${state.week_2_video_completed ? 'Assistida' : 'Não assistida'}</p>
          <button class="lm2-primary-button" type="button" data-complete-week-2-video>${state.week_2_video_completed ? 'ASSISTIDA' : 'MARCAR COMO ASSISTIDA'}</button>
        </article>
        <form class="lm2-plan-b" data-week-2-form>
          <label>Qual situação costuma fazer você abandonar o plano?<textarea class="lm2-input" name="reflection" maxlength="300">${escapeHtml(state.week_2_reflection)}</textarea></label>
          <button class="lm2-primary-button" type="button" data-save-week-2-reflection>SALVAR REFLEXÃO</button>
          <label>Quando essa situação acontecer novamente, qual será sua resposta mínima?<textarea class="lm2-input" name="minimum_response" maxlength="300">${escapeHtml(state.week_2_minimum_response)}</textarea></label>
          <button class="lm2-primary-button" type="button" data-save-week-2-response>SALVAR RESPOSTA</button>
        </form>
        <p class="lm2-error" data-lm2-error role="alert"></p>
        <button class="lm2-secondary-button" type="button" data-route="home">VOLTAR PARA HOME</button>
      </section>`;

    if (route === 'daily-checkin') root.innerHTML = `
      <section class="lm2-card" aria-labelledby="lm2-checkin-title">
        <h1 id="lm2-checkin-title">Como foi seu dia hoje?</h1>
        <div class="lm2-options" data-checkin-options>
          ${optionButton('daily_checkin_answer', 'on_track', 'Segui minha direção', state.daily_checkin_answer)}
          ${optionButton('daily_checkin_answer', 'adapted', 'Precisei adaptar', state.daily_checkin_answer)}
          ${optionButton('daily_checkin_answer', 'off_track', 'Saí da direção', state.daily_checkin_answer)}
        </div>
        <p class="lm2-feedback" data-lm2-feedback></p>
        <p class="lm2-error" data-lm2-error role="alert"></p>
        <button class="lm2-primary-button" type="button" data-submit-checkin>REGISTRAR DIA</button>
        <button class="lm2-secondary-button" type="button" data-route="home">VOLTAR PARA HOME</button>
      </section>`;

    if (route === 'home' && !state.home_loaded) loadHome(root);
    if (route === 'direction' && !state.direction_loaded) global.ProjectLm2State.updateState({ direction_loaded: true });
  }

  function routeTo(root, route) {
    render(root, global.ProjectLm2Router.navigate(route));
  }

  async function submitOnboarding(root) {
    const weight = Number(root.querySelector('[data-lm2-weight]').value);
    if (!Number.isFinite(weight) || weight <= 0) return setError(root, 'Informe um peso válido.');
    const state = global.ProjectLm2State.updateState({ weight_kg: weight });
    try {
      const response = await global.fetch(api.onboarding, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: state.name, goal: state.goal, sex: state.sex, weight_kg: state.weight_kg }) });
      if (!response.ok) throw new Error('onboarding_failed');
      global.ProjectLm2State.updateState({ onboarding_completed: true });
      const homeResponse = await global.fetch(api.home);
      if (!homeResponse.ok) throw new Error('home_failed');
      const home = await homeResponse.json();
      applyHomeData(home.data || home);
      routeTo(root, 'direction-created');
    } catch (error) {
      setError(root, 'Não foi possível criar sua direção. Tente novamente.');
    }
  }

  async function refreshHomeState(root, response) {
    if (!response.ok) throw new Error('lm2_action_failed');
    const payload = await response.json();
    applyHomeData(payload.data || payload);
    render(root, global.ProjectLm2Router.getCurrentRoute());
  }

  async function completeWeek1Video(root) {
    try {
      await refreshHomeState(root, await global.fetch(api.week1VideoComplete, { method: 'POST' }));
    } catch (error) {
      setError(root, 'Não foi possível marcar a aula como assistida.');
    }
  }

  async function savePlanB(root) {
    const form = root.querySelector('[data-plan-b-form]');
    const body = {
      unable_to_train: form?.elements.unable_to_train.value.trim(),
      overeating: form?.elements.overeating.value.trim(),
      no_motivation: form?.elements.no_motivation.value.trim()
    };
    if (!body.unable_to_train || !body.overeating || !body.no_motivation) return setError(root, 'Preencha todos os campos do Plano B.');
    try {
      await refreshHomeState(root, await global.fetch(api.planB, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }));
    } catch (error) {
      setError(root, 'Não foi possível salvar seu Plano B.');
    }
  }

  async function activateWeek2(root) {
    try {
      const response = await global.fetch(api.activateWeek2, { method: 'POST' });
      if (!response.ok) throw new Error('activate_week_2_failed');
      const payload = await response.json();
      global.ProjectLm2State.updateState({ ...(payload.data || {}), current_week: 2, home_loaded: false });
      routeTo(root, 'week-2');
    } catch (error) {
      setError(root, 'Não foi possível ativar a Semana 2. Conclua os requisitos da Semana 1.');
    }
  }

  async function completeWeek2Video(root) {
    try {
      await refreshHomeState(root, await global.fetch(api.week2VideoComplete, { method: 'POST' }));
    } catch (error) {
      setError(root, 'Não foi possível marcar a aula da Semana 2 como assistida.');
    }
  }

  async function saveWeek2Reflection(root) {
    const value = root.querySelector('[data-week-2-form]')?.elements.reflection.value.trim();
    if (!value) return setError(root, 'Preencha sua reflexão.');
    try {
      await refreshHomeState(root, await global.fetch(api.week2Reflection, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ reflection: value }) }));
    } catch (error) {
      setError(root, 'Não foi possível salvar sua reflexão.');
    }
  }

  async function saveWeek2Response(root) {
    const value = root.querySelector('[data-week-2-form]')?.elements.minimum_response.value.trim();
    if (!value) return setError(root, 'Preencha sua resposta mínima.');
    try {
      await refreshHomeState(root, await global.fetch(api.week2Reflection, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ minimum_response: value }) }));
    } catch (error) {
      setError(root, 'Não foi possível salvar sua resposta mínima.');
    }
  }

  async function submitCheckin(root) {
    const answer = global.ProjectLm2State.getState().daily_checkin_answer;
    const messages = {
      on_track: 'Excelente. Mais um dia construído.',
      adapted: 'Você não precisou ser perfeito. Precisou continuar.',
      off_track: 'Tudo bem. Amanhã você retoma a direção.'
    };
    if (!answer) return setError(root, 'Selecione como foi seu dia.');
    try {
      const response = await global.fetch(api.checkin, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ answer }) });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error || 'Não foi possível registrar seu dia.');
      }
      const payload = await response.json();
      global.ProjectLm2State.updateState({ ...(payload.data || {}), today_checkin_completed: true, next_action: 'checkin_completed_today' });
      const feedback = root.querySelector('[data-lm2-feedback]');
      if (feedback) feedback.textContent = messages[answer];
    } catch (error) {
      setError(root, error.message || 'Não foi possível registrar seu dia.');
    }
  }

  function bind(root) {
    root.addEventListener('click', event => {
      const target = event.target.closest('button');
      if (!target) return;
      if (target.dataset.route) return routeTo(root, target.dataset.route);
      if (target.dataset.optionName) {
        global.ProjectLm2State.updateState({ [target.dataset.optionName]: target.dataset.optionValue });
        return render(root, global.ProjectLm2Router.getCurrentRoute());
      }
      if (target.hasAttribute('data-continue-name')) {
        const name = root.querySelector('[data-lm2-name]').value.trim();
        if (!name) return setError(root, 'Informe seu nome.');
        global.ProjectLm2State.updateState({ name });
        return routeTo(root, 'onboarding-goal');
      }
      if (target.hasAttribute('data-continue-goal')) {
        if (!global.ProjectLm2State.getState().goal) return setError(root, 'Selecione um objetivo.');
        return routeTo(root, 'onboarding-sex');
      }
      if (target.hasAttribute('data-continue-sex')) {
        if (!global.ProjectLm2State.getState().sex) return setError(root, 'Selecione uma opção.');
        return routeTo(root, 'onboarding-weight');
      }
      if (target.hasAttribute('data-create-direction')) submitOnboarding(root);
      if (target.hasAttribute('data-complete-week-1-video')) completeWeek1Video(root);
      if (target.hasAttribute('data-save-plan-b')) savePlanB(root);
      if (target.hasAttribute('data-activate-week-2')) activateWeek2(root);
      if (target.hasAttribute('data-complete-week-2-video')) completeWeek2Video(root);
      if (target.hasAttribute('data-save-week-2-reflection')) saveWeek2Reflection(root);
      if (target.hasAttribute('data-save-week-2-response')) saveWeek2Response(root);
      if (target.hasAttribute('data-submit-checkin')) submitCheckin(root);
    });
  }

  function boot() {
    const root = document.querySelector('#project-lm-2-root');
    if (!root) return;
    bind(root);
    render(root, global.ProjectLm2Router.getCurrentRoute());
    global.addEventListener('hashchange', () => render(root, global.ProjectLm2Router.getCurrentRoute()));
  }

  global.ProjectLm2App = { boot, render, api };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})(window, document);
