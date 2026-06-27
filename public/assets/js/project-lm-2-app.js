(function initializeProjectLm2App(global, document) {
  const premiumConsultingCtaUrl = 'https://wa.me/5514991174500?text=Ol%C3%A1%20Lucas,%20quero%20conhecer%20a%20Consultoria%20Premium.';

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
    activateWeek2: '/api/project-lm-2/activate-week-2',
    activateWeek3: '/api/project-lm-2/activate-week-3'
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
      week_2_minimum_response: homeData.week_2_minimum_response || currentState.week_2_minimum_response,
      week_2_completed: Boolean(homeData.week_2_completed || homeData.week_2_status?.week_completed),
      week_3_available: Boolean(homeData.week_3_available || homeData.week_2_status?.next_week_available)
    });
  }

  function isWeek3Completed(state) {
    return Boolean(state.week_3_video_completed && state.week_3_reflection_completed && state.week_3_response_completed);
  }

  function isWeek4Completed(state) {
    return Boolean(state.week_4_video_completed && state.week_4_reflection_completed && state.week_4_response_completed);
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
    if (nextAction === 'week_2_complete') return 'Continuar para Semana 3';
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
        ${state.next_action === 'week_2_complete' ? '<div class="lm2-celebration-cta"><p>Parabéns.</p><p>Você concluiu a Semana 2.</p></div>' : ''}
        <p class="lm2-error" data-lm2-error role="alert"></p>
        <button class="lm2-primary-button" type="button" data-route="${state.next_action === 'week_1_complete' ? 'week-complete' : state.next_action === 'week_2_complete' ? 'week-2-complete' : state.next_action === 'daily_checkin' ? 'daily-checkin' : state.next_action && state.next_action.startsWith('week_2_') ? 'week-2' : 'week-1-placeholder'}">${state.next_action === 'week_1_complete' ? 'CONTINUAR PARA SEMANA 2' : state.next_action === 'week_2_complete' ? 'CONTINUAR PARA SEMANA 3' : state.next_action === 'daily_checkin' ? 'FAZER CHECK-IN' : 'CONTINUAR'}</button>
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


    if (route === 'week-2-complete') root.innerHTML = `
      <section class="lm2-card" aria-labelledby="lm2-week-2-complete-title">
        <h1 id="lm2-week-2-complete-title">Você continuou nos dias difíceis.</h1>
        <p>Nesta semana você praticou uma habilidade essencial:</p>
        <p>continuar mesmo quando o dia não saiu como planejado.</p>
        <p>Você não precisou fazer tudo perfeito.</p>
        <p>Você precisou encontrar uma resposta mínima.</p>
        <p>E isso é exatamente o que transforma o processo de emagrecimento em algo sustentável.</p>
        <button class="lm2-primary-button" type="button" data-route="week-3-placeholder">IR PARA SEMANA 3</button>
      </section>`;

    if (route === 'week-3-placeholder') root.innerHTML = `
      <section class="lm2-card" aria-labelledby="lm2-week-3-title">
        <h1 id="lm2-week-3-title">As mudanças começam antes da balança</h1>
        <h2>Você já está mudando. Talvez apenas ainda não consiga enxergar tudo.</h2>
        <article class="lm2-lesson">
          <h3>Aula</h3>
          <p>${state.week_3_video_completed ? 'Assistida' : 'Não assistida'}</p>
          <button class="lm2-primary-button" type="button" data-complete-week-3-video>${state.week_3_video_completed ? 'ASSISTIDA' : 'MARCAR COMO ASSISTIDA'}</button>
          <p>Durante muito tempo, talvez você tenha acreditado que progresso significa apenas perder peso.</p>
          <p>Mas essa é apenas uma parte da história.</p>
          <p>Antes da balança mudar, outras mudanças acontecem primeiro.</p>
          <p>Você começa a organizar melhor sua rotina.</p>
          <p>Volta mais rápido depois de um dia difícil.</p>
          <p>Faz escolhas melhores sem precisar pensar tanto.</p>
          <p>Treina mesmo sem vontade.</p>
          <p>Começa a confiar mais em si.</p>
          <p>Essas mudanças não aparecem em números.</p>
          <p>Mas são justamente elas que tornam os resultados possíveis.</p>
          <p>Quem aprende a reconhecer essas pequenas vitórias cria algo muito mais importante do que motivação.</p>
          <p>Cria consistência.</p>
          <p>E pessoas consistentes continuam.</p>
        </article>
        <form class="lm2-plan-b" data-week-3-form>
          <h3>Olhe além da balança</h3>
          <p>Pense nas últimas semanas.</p>
          <p>Existe alguma mudança que aconteceu e que não pode ser medida pelo peso?</p>
          <p>Talvez você esteja mais organizado.</p>
          <p>Talvez esteja desistindo menos.</p>
          <p>Talvez esteja mais confiante.</p>
          <p>Talvez esteja conseguindo voltar mais rápido quando erra.</p>
          <p>Essas mudanças merecem ser reconhecidas.</p>
          <p>Porque são elas que sustentam os resultados futuros.</p>
          <label>Qual mudança você percebe em você desde que iniciou o Projeto LM?<textarea class="lm2-input" name="reflection" maxlength="300" required>${escapeHtml(state.week_3_reflection)}</textarea></label>
          <button class="lm2-primary-button" type="button" data-save-week-3-reflection>SALVAR REFLEXÃO</button>
          <label>Qual será sua resposta mínima para continuar observando essas mudanças?<textarea class="lm2-input" name="minimum_response" maxlength="300" required>${escapeHtml(state.week_3_minimum_response)}</textarea></label>
          <button class="lm2-primary-button" type="button" data-save-week-3-response>SALVAR RESPOSTA</button>
        </form>
        <p class="lm2-feedback" data-lm2-week-3-feedback>${state.week_3_reflection_completed ? 'Perceber sua evolução fortalece sua confiança. E confiança facilita continuar amanhã. Continue observando pequenas vitórias. Elas costumam aparecer antes dos grandes resultados.' : ''}</p>
        <p class="lm2-error" data-lm2-error role="alert"></p>
        <button class="lm2-primary-button" type="button" data-complete-week-3>CONCLUIR SEMANA 3</button>
        <button class="lm2-secondary-button" type="button" data-route="home">VOLTAR PARA HOME</button>
      </section>`;


    if (route === 'week-3-complete') root.innerHTML = `
      <section class="lm2-card" aria-labelledby="lm2-week-3-complete-title">
        <h1 id="lm2-week-3-complete-title">Semana 3 concluída.</h1>
        <p>Você percebeu que evolução vai muito além da balança.</p>
        <p>As pequenas mudanças que aconteceram nas últimas semanas são o que tornam os grandes resultados possíveis.</p>
        <p>Continue observando esses sinais.</p>
        <p>Eles mostram que você está construindo uma rotina capaz de durar.</p>
        <button class="lm2-primary-button" type="button" data-route="week-4-placeholder">Continuar para a Semana 4</button>
      </section>`;

    if (route === 'week-4-placeholder') root.innerHTML = `
      <section class="lm2-card" aria-labelledby="lm2-week-4-title">
        <h1 id="lm2-week-4-title">Continue mesmo sem motivação</h1>
        <h2>O que sustenta seus resultados não é a motivação. É a direção que você escolhe seguir.</h2>
        <article class="lm2-lesson">
          <h3>Aula</h3>
          <p>${state.week_4_video_completed ? 'Assistida' : 'Não assistida'}</p>
          <button class="lm2-primary-button" type="button" data-complete-week-4-video>${state.week_4_video_completed ? 'ASSISTIDA' : 'MARCAR COMO ASSISTIDA'}</button>
          <p>Se você chegou até aqui, provavelmente percebeu algo importante.</p>
          <p>A motivação nunca esteve presente todos os dias.</p>
          <p>Houve dias em que foi fácil.</p>
          <p>Outros em que tudo parecia mais difícil.</p>
          <p>E mesmo assim, você continuou.</p>
          <p>Esse sempre foi o objetivo do Projeto LM.</p>
          <p>Não fazer você depender da motivação.</p>
          <p>Mas mostrar que ela não precisa estar presente para que você continue.</p>
          <p>Motivação é passageira.</p>
          <p>Direção permanece.</p>
          <p>Daqui para frente ainda existirão dias difíceis.</p>
          <p>Ainda existirão imprevistos.</p>
          <p>Ainda existirão semanas em que nem tudo acontecerá como planejado.</p>
          <p>Mas agora você sabe que isso não significa recomeçar.</p>
          <p>Significa apenas ajustar e seguir.</p>
          <p>Você não termina este programa perfeito.</p>
          <p>Você termina preparado para continuar.</p>
        </article>
        <form class="lm2-plan-b" data-week-4-form>
          <h3>O que você leva daqui?</h3>
          <p>Pense em tudo o que aconteceu nas últimas semanas.</p>
          <p>Existe alguma ideia, hábito ou mudança de perspectiva que você deseja manter mesmo após o fim deste programa?</p>
          <p>Essa resposta será um lembrete da direção que você escolheu seguir.</p>
          <label>O que você quer continuar fazendo quando este programa terminar?<textarea class="lm2-input" name="reflection" maxlength="300" required>${escapeHtml(state.week_4_reflection)}</textarea></label>
          <button class="lm2-primary-button" type="button" data-save-week-4-reflection>SALVAR REFLEXÃO</button>
          <label>Qual será sua resposta mínima para seguir em frente nos dias difíceis?<textarea class="lm2-input" name="minimum_response" maxlength="300" required>${escapeHtml(state.week_4_minimum_response)}</textarea></label>
          <button class="lm2-primary-button" type="button" data-save-week-4-response>SALVAR RESPOSTA</button>
        </form>
        <p class="lm2-feedback" data-lm2-week-4-feedback>${state.week_4_reflection_completed ? 'Você não precisa fazer tudo perfeitamente. Precisa apenas continuar. Sempre que surgirem dias difíceis, lembre-se da direção que escolheu seguir.' : ''}</p>
        <p class="lm2-error" data-lm2-error role="alert"></p>
        <button class="lm2-primary-button" type="button" data-complete-week-4>CONCLUIR SEMANA 4</button>
        <button class="lm2-secondary-button" type="button" data-route="home">VOLTAR PARA HOME</button>
      </section>`;

    if (route === 'week-4-complete') root.innerHTML = `
      <section class="lm2-card" aria-labelledby="lm2-week-4-complete-title">
        <h1 id="lm2-week-4-complete-title">Semana 4 concluída.</h1>
        <p>Você chegou ao fim das quatro semanas do Projeto LM.</p>
        <p>Mais importante do que terminar este programa foi aprender que continuar é uma habilidade que pode ser construída.</p>
        <p>Os dias difíceis ainda existirão.</p>
        <p>Mas agora você sabe que eles não significam recomeçar.</p>
        <p>Eles significam apenas ajustar a rota e seguir em frente.</p>
        <button class="lm2-primary-button" type="button" data-route="program-completion">Finalizar programa</button>
      </section>`;

    if (route === 'program-completion') root.innerHTML = `
      <section class="lm2-card" aria-labelledby="lm2-program-completion-title">
        <h1 id="lm2-program-completion-title">Parabéns por chegar até aqui.</h1>
        <div class="lm2-subtitle">
          <p>O mais importante não foi terminar quatro semanas.</p>
          <p>Foi construir a capacidade de continuar.</p>
        </div>
        <p>Durante este programa você descobriu que:</p>
        <ul class="lm2-list">
          <li>Recomeçar não precisa fazer parte da sua rotina.</li>
          <li>Dias difíceis não significam fracasso.</li>
          <li>A evolução acontece antes da balança mostrar resultados.</li>
          <li>A direção é mais importante do que a motivação.</li>
        </ul>
        <p>Essas quatro ideias são a base para continuar evoluindo.</p>
        <p>O programa termina aqui.</p>
        <p>Mas a sua direção continua.</p>
        <div class="lm2-block">
          <p>Você não precisa mais provar que consegue começar.</p>
          <p>Agora sabe que consegue continuar.</p>
        </div>
        <p class="lm2-error" data-lm2-error role="alert"></p>
        <button class="lm2-primary-button" type="button" data-complete-program>Concluir Projeto LM</button>
      </section>`;

    if (route === 'premium-bridge') root.innerHTML = `
      <section class="lm2-card" aria-labelledby="lm2-premium-bridge-title">
        <h1 id="lm2-premium-bridge-title">Você aprendeu a continuar.</h1>
        <div class="lm2-subtitle">
          <p>Agora existe uma forma de continuar evoluindo com acompanhamento.</p>
        </div>
        <p>Durante as últimas quatro semanas você construiu algo muito importante.</p>
        <p>Aprendeu que motivação não é o que sustenta resultados.</p>
        <p>Aprendeu a lidar com dias difíceis.</p>
        <p>Aprendeu que pequenas mudanças acontecem antes da balança mostrar qualquer diferença.</p>
        <p>E, principalmente, aprendeu que consegue continuar.</p>
        <p>Se você deseja dar o próximo passo, existe um acompanhamento criado exatamente para isso.</p>
        <p>Na Consultoria Premium, o objetivo deixa de ser apenas construir consistência.</p>
        <p>Passa a ser evoluir continuamente com estratégia, ajustes e acompanhamento individual.</p>
        <article class="lm2-block" aria-labelledby="lm2-premium-card-title">
          <h2 id="lm2-premium-card-title">Consultoria Premium</h2>
          <p>Inclui</p>
          <ul class="lm2-list">
            <li>Treino personalizado</li>
            <li>Plano alimentar individualizado</li>
            <li>Ajustes contínuos</li>
            <li>Acompanhamento próximo</li>
            <li>Evolução baseada na sua rotina</li>
          </ul>
        </article>
        <button class="lm2-primary-button" type="button" data-premium-consulting-cta>Quero conhecer a Consultoria Premium</button>
        <button class="lm2-secondary-button" type="button" data-route="home">Agora não</button>
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


  function completeWeek3Video(root) {
    global.ProjectLm2State.updateState({ week_3_video_completed: true });
    render(root, global.ProjectLm2Router.getCurrentRoute());
  }

  function saveWeek3Reflection(root) {
    const value = root.querySelector('[data-week-3-form]')?.elements.reflection.value.trim();
    if (!value) return setError(root, 'Preencha sua reflexão.');
    global.ProjectLm2State.updateState({ week_3_reflection: value, week_3_reflection_completed: true });
    render(root, global.ProjectLm2Router.getCurrentRoute());
  }

  function saveWeek3Response(root) {
    const value = root.querySelector('[data-week-3-form]')?.elements.minimum_response.value.trim();
    if (!value) return setError(root, 'Preencha sua resposta mínima.');
    global.ProjectLm2State.updateState({ week_3_minimum_response: value, week_3_response_completed: true });
    render(root, global.ProjectLm2Router.getCurrentRoute());
  }

  function completeWeek3(root) {
    const state = global.ProjectLm2State.getState();
    if (!isWeek3Completed(state)) return setError(root, 'Assista à aula, salve sua reflexão e salve sua resposta mínima antes de concluir a Semana 3.');
    global.ProjectLm2State.updateState({ week_3_completed: true });
    routeTo(root, 'week-3-complete');
  }


  function completeWeek4Video(root) {
    global.ProjectLm2State.updateState({ week_4_video_completed: true });
    render(root, global.ProjectLm2Router.getCurrentRoute());
  }

  function saveWeek4Reflection(root) {
    const value = root.querySelector('[data-week-4-form]')?.elements.reflection.value.trim();
    if (!value) return setError(root, 'Preencha sua reflexão.');
    global.ProjectLm2State.updateState({ week_4_reflection: value, week_4_reflection_completed: true });
    render(root, global.ProjectLm2Router.getCurrentRoute());
  }

  function saveWeek4Response(root) {
    const value = root.querySelector('[data-week-4-form]')?.elements.minimum_response.value.trim();
    if (!value) return setError(root, 'Preencha sua resposta mínima.');
    global.ProjectLm2State.updateState({ week_4_minimum_response: value, week_4_response_completed: true });
    render(root, global.ProjectLm2Router.getCurrentRoute());
  }

  function completeWeek4(root) {
    const state = global.ProjectLm2State.getState();
    if (!isWeek4Completed(state)) return setError(root, 'Assista à aula, salve sua reflexão e salve sua resposta mínima antes de concluir a Semana 4.');
    global.ProjectLm2State.updateState({ week_4_completed: true });
    routeTo(root, 'week-4-complete');
  }

  function openPremiumConsulting() {
    global.location.href = premiumConsultingCtaUrl;
  }

  function completeProgram(root) {
    global.ProjectLm2State.updateState({ program_completed: true });
    routeTo(root, 'premium-bridge');
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
      if (target.hasAttribute('data-complete-week-3-video')) completeWeek3Video(root);
      if (target.hasAttribute('data-save-week-3-reflection')) saveWeek3Reflection(root);
      if (target.hasAttribute('data-save-week-3-response')) saveWeek3Response(root);
      if (target.hasAttribute('data-complete-week-3')) completeWeek3(root);
      if (target.hasAttribute('data-complete-week-4-video')) completeWeek4Video(root);
      if (target.hasAttribute('data-save-week-4-reflection')) saveWeek4Reflection(root);
      if (target.hasAttribute('data-save-week-4-response')) saveWeek4Response(root);
      if (target.hasAttribute('data-complete-week-4')) completeWeek4(root);
      if (target.hasAttribute('data-complete-program')) completeProgram(root);
      if (target.hasAttribute('data-premium-consulting-cta')) openPremiumConsulting();
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
