(function initializeProjectLm2App(global, document) {
  const api = {
    onboarding: '/api/project-lm-2/onboarding',
    home: '/api/project-lm-2/home'
  };

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
        <button class="lm2-primary-button" type="button" data-route="home-placeholder">IR PARA MINHA JORNADA</button>
      </section>`;
    if (route === 'home-placeholder') root.innerHTML = `
      <section class="lm2-card" aria-labelledby="lm2-home-title">
        <h1 id="lm2-home-title">Olá ${escapeHtml(state.name)}</h1>
        <p>Semana ${state.current_week} de 4</p><p>Dias de continuidade</p><p>${state.continuity_days_count} de ${state.required_days_count} necessários</p><p>Próxima ação:</p><p>Semana 1 será liberada em breve.</p>
        <button class="lm2-primary-button" type="button">MINHA DIREÇÃO</button>
      </section>`;
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
      const homeData = home.data || home;
      global.ProjectLm2State.updateState({
        home: homeData,
        current_week: homeData.current_week || state.current_week,
        continuity_days_count: homeData.continuity_days_count || 0,
        required_days_count: homeData.required_days_count || state.required_days_count,
        next_action: homeData.next_action || state.next_action
      });
      routeTo(root, 'direction-created');
    } catch (error) {
      setError(root, 'Não foi possível criar sua direção. Tente novamente.');
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
