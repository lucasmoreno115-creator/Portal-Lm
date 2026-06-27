(function initializeProjectLm2App(global, document) {
  const api = {
    onboarding: '/api/project-lm-2/onboarding',
    home: '/api/project-lm-2/home',
    week1VideoComplete: '/api/project-lm-2/week-1/video-complete',
    planB: '/api/project-lm-2/plan-b'
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
      continuity_days_count: Number(homeData.continuity_days_count || 0),
      required_days_count: homeData.required_days_count || currentState.required_days_count,
      next_action: homeData.next_action || currentState.next_action,
      week_1_video_completed: Boolean(homeData.week_1_video_completed),
      plan_b_completed: Boolean(homeData.plan_b_completed),
      plan_b: homeData.plan_b || currentState.plan_b
    });
  }

  function nextActionLabel(nextAction) {
    if (nextAction === 'week_1_video') return 'Assistir à aula da Semana 1.';
    if (nextAction === 'create_plan_b') return 'Criar seu Plano B inicial.';
    if (nextAction === 'checkin_pending_placeholder') return 'Próxima etapa em breve.';
    return 'Sua jornada começa na Semana 1.';
  }

  async function loadHome(root) {
    try {
      const response = await global.fetch(api.home);
      if (!response.ok) throw new Error('home_failed');
      const home = await response.json();
      applyHomeData(home.data || home);
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
        <p class="lm2-error" data-lm2-error role="alert"></p>
        <button class="lm2-primary-button" type="button" data-route="week-1-placeholder">CONTINUAR</button>
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
