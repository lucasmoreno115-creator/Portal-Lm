(function initializeProjectLm2App(global, document) {
  const premiumConsultingCtaUrl = 'https://wa.me/5514991174500?text=Ol%C3%A1%20Lucas,%20quero%20conhecer%20a%20Consultoria%20Premium.';

  const api = {
    onboarding: '/api/project-lm-2/onboarding',
    home: '/api/project-lm-2/home',
    week1VideoComplete: '/api/project-lm-2/week-1/video-complete',
    planB: '/api/project-lm-2/plan-b',
    progress: '/api/project-lm-2/progress',
    profile: '/api/project-lm-2/profile',
    weekStatus: '/api/project-lm-2/week-status',
    checkin: '/api/project-lm-2/checkin',
    week2VideoComplete: '/api/project-lm-2/week-2/video-complete',
    week2Reflection: '/api/project-lm-2/week-2/reflection',
    week2Status: '/api/project-lm-2/week-2/status',
    activateWeek2: '/api/project-lm-2/activate-week-2',
    activateWeek3: '/api/project-lm-2/activate-week-3',
    week3VideoComplete: '/api/project-lm-2/week-3/video-complete',
    week3Reflection: '/api/project-lm-2/week-3/reflection',
    week3Complete: '/api/project-lm-2/week-3/complete',
    week4VideoComplete: '/api/project-lm-2/week-4/video-complete',
    week4Reflection: '/api/project-lm-2/week-4/reflection',
    week4Complete: '/api/project-lm-2/week-4/complete',
    programCompletion: '/api/project-lm-2/program-completion',
    training: '/api/project-lm-2/training'
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


  function getAuth() {
    const storage = global.localStorage;
    if (!storage || typeof storage.getItem !== 'function') return { email: '', token: '' };
    return {
      email: storage.getItem('lm_student_email') || '',
      token: storage.getItem('lm_student_token') || ''
    };
  }

  function hasSession() {
    const auth = getAuth();
    return Boolean(auth.email && auth.token);
  }

  function redirectToLogin() {
    if (global.location) global.location.href = '/portal-login.html';
  }

  function requireSession() {
    if (hasSession()) return true;
    redirectToLogin();
    return false;
  }

  function getAuthHeaders() {
    const auth = getAuth();
    if (!auth.email || !auth.token) return {};
    return { 'x-student-email': auth.email, 'x-student-token': auth.token };
  }

  function requestLm2(url, options = {}) {
    if (!requireSession()) return Promise.reject(new Error('auth_required'));
    const headers = {
      ...getAuthHeaders(),
      ...(options.headers || {})
    };
    return global.fetch(url, { ...options, headers });
  }

  function escapeHtml(value) {
    return String(value || '').replace(/[&<>"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[char]));
  }

  function optionButton(name, value, label, selected) {
    const isSelected = selected === value;
    return `<button class="lm2-option${isSelected ? ' is-selected' : ''}" type="button" data-option-name="${name}" data-option-value="${value}" aria-pressed="${isSelected ? 'true' : 'false'}">${label}</button>`;
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
      goal: homeData.goal || currentState.goal,
      sex: homeData.sex || currentState.sex,
      weight_kg: homeData.weight_kg || currentState.weight_kg,
      height_cm: homeData.height_cm || currentState.height_cm,
      nutrition_plan_id: homeData.nutrition_plan_id || currentState.nutrition_plan_id,
      training_plan_id: homeData.training_plan_id || currentState.training_plan_id,
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
      week_3_available: Boolean(homeData.week_3_available || homeData.week_2_status?.next_week_available),
      week_3_video_completed: Boolean(homeData.week_3_video_completed),
      week_3_reflection: homeData.week_3_reflection || currentState.week_3_reflection,
      week_3_reflection_completed: Boolean(homeData.week_3_reflection_completed),
      week_3_minimum_response: homeData.week_3_minimum_response || currentState.week_3_minimum_response,
      week_3_response_completed: Boolean(homeData.week_3_response_completed),
      week_3_completed: Boolean(homeData.week_3_completed),
      week_4_video_completed: Boolean(homeData.week_4_video_completed),
      week_4_reflection: homeData.week_4_reflection || currentState.week_4_reflection,
      week_4_reflection_completed: Boolean(homeData.week_4_reflection_completed),
      week_4_minimum_response: homeData.week_4_minimum_response || currentState.week_4_minimum_response,
      week_4_response_completed: Boolean(homeData.week_4_response_completed),
      week_4_completed: Boolean(homeData.week_4_completed),
      program_completed: Boolean(homeData.program_completed),
      program_completed_at: homeData.program_completed_at || currentState.program_completed_at,
      premium_bridge_eligible: Boolean(homeData.premium_bridge_eligible)
    });
  }

  function isWeek3Completed(state) {
    return Boolean(state.week_3_video_completed && state.week_3_reflection_completed && state.week_3_response_completed);
  }

  function isWeek4Completed(state) {
    return Boolean(state.week_4_video_completed && state.week_4_reflection_completed && state.week_4_response_completed);
  }

  function getHomePrimaryRoute(state) {
    if (state.program_completed) return 'premium-bridge';
    if (state.week_4_completed) return 'week-4-complete';
    if (state.current_week >= 4 || state.week_3_completed) return 'week-4-placeholder';
    if (state.current_week >= 3 || state.week_3_available) return 'week-3-placeholder';
    if (state.next_action === 'week_1_complete') return 'week-complete';
    if (state.next_action === 'week_2_complete') return 'week-2-complete';
    if (state.next_action === 'daily_checkin') return 'daily-checkin';
    if (state.next_action && state.next_action.startsWith('week_2_')) return 'week-2';
    return 'week-1-placeholder';
  }

  function getHomePrimaryLabel(state) {
    if (state.program_completed) return 'CONTINUAR';
    if (state.week_4_completed) return 'CONTINUAR';
    if (state.current_week >= 4 || state.week_3_completed) return 'CONTINUAR';
    if (state.current_week >= 3 || state.week_3_available) return 'CONTINUAR';
    if (state.next_action === 'week_1_complete') return 'CONTINUAR PARA SEMANA 2';
    if (state.next_action === 'week_2_complete') return 'CONTINUAR PARA SEMANA 3';
    if (state.next_action === 'daily_checkin') return 'FAZER CHECK-IN';
    return 'CONTINUAR';
  }

  const trainingPlans = Object.freeze({
    gym_male: { title: 'Treino Academia · Masculino', session: 'Upper A', exercises: ['Supino reto', 'Remada baixa', 'Desenvolvimento sentado', 'Puxada alta', 'Elevação lateral', 'Rosca direta', 'Tríceps corda'] },
    gym_female: { title: 'Treino Academia · Feminino', session: 'Lower A', exercises: ['Agachamento livre', 'Leg press', 'Cadeira extensora', 'Mesa flexora', 'Elevação pélvica', 'Panturrilha em pé', 'Abdominal prancha'] },
    home: { title: 'Treino em Casa', session: 'Casa A', exercises: ['Agachamento livre', 'Flexão inclinada', 'Remada com mochila', 'Afundo alternado', 'Elevação pélvica', 'Prancha', 'Polichinelo controlado'] }
  });

  const remoteTrainingPlans = {};
  const defaultExercisePrescription = Object.freeze({ series: '4 séries', repetitions: '8–10 repetições', rest: '90s', videoUrl: '#' });

  function exerciseKey(name) {
    return String(name || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') || 'exercicio';
  }

  function formatLastResult(result) {
    if (!result || (!result.weight && !result.reps)) return '—';
    const weight = result.weight ? `${result.weight} kg` : '— kg';
    const reps = result.reps ? `${result.reps} reps` : '— reps';
    return `${weight} · ${reps}`;
  }

  function resolveTrainingPlan(state = global.ProjectLm2State.getState()) {
    return remoteTrainingPlans[state.training_plan_id] || trainingPlans[state.training_plan_id];
  }

  function normalizeTrainingPlan(payload = {}) {
    const exercises = Array.isArray(payload.exercises) ? payload.exercises.map(exercise => ({
      key: exercise.exercise_key,
      name: exercise.name,
      series: `${exercise.sets} séries`,
      repetitions: exercise.reps,
      rest: `${exercise.rest_seconds}s`,
      videoUrl: exercise.instruction_url || exercise.video_url || '#'
    })).filter(exercise => exercise.name) : [];
    return {
      title: payload.plan?.name || 'Treino Projeto LM',
      session: payload.session?.name || 'Upper A',
      exercises
    };
  }

  async function loadTrainingPlan(root) {
    const state = global.ProjectLm2State.getState();
    if (!state.training_plan_id || remoteTrainingPlans[state.training_plan_id]) return;
    try {
      const response = await requestLm2(api.training);
      if (!response.ok) throw new Error('training_failed');
      const payload = await response.json();
      const plan = normalizeTrainingPlan(payload.data || payload);
      if (plan.exercises.length > 0) {
        remoteTrainingPlans[state.training_plan_id] = plan;
        render(root, 'training');
      }
    } catch (error) {
      // Mantém o fallback local simples quando o endpoint de treino falhar.
    }
  }

  function getTrainingSession(plan = {}, state = global.ProjectLm2State.getState()) {
    const exercises = Array.isArray(plan.exercises) && plan.exercises.length > 0 ? plan.exercises : ['Supino reto', 'Remada baixa'];
    const currentIndex = Math.min(Math.max(Number(state.training_current_index) || 0, 0), Math.max(exercises.length - 1, 0));
    const rawExercise = exercises[currentIndex];
    const exerciseData = typeof rawExercise === 'object' && rawExercise !== null ? rawExercise : { name: rawExercise };
    const name = exerciseData.name;
    const key = exerciseData.key || exerciseKey(name);
    const previousResult = state.training_results?.[key] || {};
    return {
      title: plan.title || 'Treino Projeto LM',
      sessionName: plan.session || 'Upper A',
      currentIndex,
      totalExercises: exercises.length,
      isLastExercise: currentIndex >= exercises.length - 1,
      currentExercise: {
        key,
        name,
        ...defaultExercisePrescription,
        ...exerciseData,
        previousResult
      }
    };
  }

  function resolveNutritionPlan(state = global.ProjectLm2State.getState()) {
    return global.ProjectLm2NutritionNormalizer?.resolveNutritionPlan?.(state) || null;
  }

  function renderMealCard(meal) {
    const visibleFoods = meal.foods.slice(0, 3);
    const hiddenCount = Math.max(meal.foods.length - visibleFoods.length, 0);
    return `<button class="lm2-meal-card" type="button" data-meal-focus="${escapeHtml(meal.key)}" aria-label="Abrir ${escapeHtml(meal.name)}"><strong>${meal.icon} ${escapeHtml(meal.name)}</strong><span>${visibleFoods.map(food => escapeHtml(food.text)).join('</span><span>')}</span>${hiddenCount ? `<small>+${hiddenCount} itens</small>` : ''}</button>`;
  }

  function renderNutritionFocusPanel(meal, plan) {
    if (!meal) return '';
    const foods = meal.foods.map(food => `<li><span>${escapeHtml(food.name)}</span><strong>${escapeHtml(food.quantity)}</strong></li>`).join('');
    const substitutions = meal.foods.filter(food => food.substitutions.length > 0).map(food => `<div class="lm2-substitution-group"><strong>${escapeHtml(food.text)}</strong>${food.substitutions.map(item => `<span>↔ ${escapeHtml(item)}</span>`).join('')}</div>`).join('');
    const substitutionsSection = substitutions ? `<details class="lm2-substitutions"><summary>Substituições</summary>${substitutions}</details>` : '';
    const notes = plan.notes.length ? `<section class="lm2-nutrition-notes" aria-label="Observações"><h3>Observações</h3>${plan.notes.map(note => `<p>✔ ${escapeHtml(note)}</p>`).join('')}</section>` : '';
    return `<div class="lm2-focus-panel-backdrop" data-nutrition-focus-panel role="dialog" aria-modal="true" aria-labelledby="lm2-focus-panel-title"><article class="lm2-focus-panel"><button class="lm2-focus-panel-close" type="button" data-close-nutrition-focus aria-label="Fechar painel">×</button><p class="lm2-kicker">Plano Alimentar</p><h2 id="lm2-focus-panel-title">${meal.icon} ${escapeHtml(meal.name)}</h2><ul class="lm2-food-list">${foods}</ul>${substitutionsSection}${notes}</article></div>`;
  }

  function renderTrainingScreen(state) {
    const plan = resolveTrainingPlan(state);
    if (!plan) {
      return `
        <section class="lm2-card" aria-labelledby="lm2-training-title">
          <p class="lm2-kicker">Projeto LM · Modo Treino</p>
          <h1 id="lm2-training-title">Treino indisponível</h1>
          <p>Seu treino ainda não está disponível. Volte para a Home e tente novamente mais tarde.</p>
          <button class="lm2-primary-button" type="button" data-route="home">VOLTAR PARA HOME</button>
        </section>`;
    }

    if (state.training_current_index >= plan.exercises.length) {
      return `
        <section class="lm2-card lm2-training-complete" aria-labelledby="lm2-training-complete-title">
          <p class="lm2-kicker">Projeto LM · Modo Treino</p>
          <h1 id="lm2-training-complete-title">Treino concluído.</h1>
          <p>Hoje você fez o que precisava.</p>
          <button class="lm2-primary-button" type="button" data-finish-training>Voltar para Home</button>
        </section>`;
    }

    const session = getTrainingSession(plan, state);
    const exercise = session.currentExercise;
    return `
      <section class="lm2-training-mode" aria-labelledby="lm2-training-title">
        <article class="lm2-current-exercise" aria-label="Exercício atual">
          <h1 id="lm2-training-title">${escapeHtml(exercise.name)}</h1>
          <a class="lm2-video-button" href="${escapeHtml(exercise.videoUrl)}" target="_blank" rel="noopener">Vídeo de execução</a>
          <dl class="lm2-exercise-prescription">
            <div><dt>Séries</dt><dd>${escapeHtml(exercise.series)}</dd></div>
            <div><dt>Repetições</dt><dd>${escapeHtml(exercise.repetitions)}</dd></div>
            <div><dt>Descanso</dt><dd>${escapeHtml(exercise.rest)}</dd></div>
            <div><dt>Último resultado</dt><dd>${escapeHtml(formatLastResult(exercise.previousResult))}</dd></div>
          </dl>
        </article>

        <div class="lm2-training-primary-action">
          <button class="lm2-primary-button" type="button" data-open-exercise-result>Concluir exercício</button>
        </div>
      </section>`;
  }

  function showExerciseResultModal(root) {
    const state = global.ProjectLm2State.getState();
    const plan = resolveTrainingPlan(state);
    if (!plan) return;
    const exercise = getTrainingSession(plan, state).currentExercise;
    const previous = exercise.previousResult || {};
    root.querySelector('[data-exercise-result-modal]')?.remove();
    root.insertAdjacentHTML('beforeend', `<div class="lm2-modal-backdrop" data-exercise-result-modal role="dialog" aria-modal="true" aria-labelledby="lm2-result-title"><form class="lm2-modal" data-exercise-result-form><h2 id="lm2-result-title">Atualize seu resultado</h2><label>Peso da última série<input class="lm2-input" name="weight" inputmode="decimal" type="number" min="0" step="0.5" value="${escapeHtml(previous.weight || '')}"></label><label>Repetições da última série<input class="lm2-input" name="reps" inputmode="numeric" type="number" min="0" step="1" value="${escapeHtml(previous.reps || '')}"></label><p class="lm2-error" data-lm2-modal-error role="alert"></p><button class="lm2-primary-button" type="button" data-save-exercise-result>Salvar e continuar</button></form></div>`);
  }

  function saveExerciseResult(root) {
    const state = global.ProjectLm2State.getState();
    const plan = resolveTrainingPlan(state);
    if (!plan) return;
    const form = root.querySelector('[data-exercise-result-form]');
    const weight = form?.elements.weight.value.trim();
    const reps = form?.elements.reps.value.trim();
    if (!weight || !reps) {
      const error = root.querySelector('[data-lm2-modal-error]');
      if (error) error.textContent = 'Informe peso e repetições.';
      return;
    }
    const exercise = getTrainingSession(plan, state).currentExercise;
    const training_results = { ...(state.training_results || {}), [exercise.key]: { weight, reps } };
    const nextIndex = state.training_current_index + 1;
    global.ProjectLm2State.updateState({ training_results, training_current_index: nextIndex });
    root.querySelector('[data-exercise-result-modal]')?.remove();
    render(root, nextIndex >= plan.exercises.length ? 'training' : 'training');
  }

  function finishTraining(root) {
    global.ProjectLm2State.updateState({ training_current_index: 0 });
    routeTo(root, 'home');
  }

  function renderNutritionScreen(state) {
    const plan = resolveNutritionPlan(state);
    if (!plan) {
      return `
      <section class="lm2-card" aria-labelledby="lm2-nutrition-title">
        <p class="lm2-kicker">Projeto LM · Plano alimentar</p>
        <h1 id="lm2-nutrition-title">Plano Alimentar</h1>
        <article class="lm2-block"><h2>Plano alimentar indisponível</h2><p>Seu plano alimentar ainda não está disponível. Volte para a Home e tente novamente mais tarde.</p></article>
        <button class="lm2-primary-button" type="button" data-route="direction">VOLTAR PARA MINHA DIREÇÃO</button>
        <button class="lm2-secondary-button" type="button" data-route="home">VOLTAR PARA HOME</button>
      </section>`;
    }

    return `
      <section class="lm2-nutrition-overview" aria-labelledby="lm2-nutrition-title">
        <header class="lm2-nutrition-header">
          <p class="lm2-kicker">Projeto LM · ${escapeHtml(plan.title)}</p>
          <h1 id="lm2-nutrition-title">Plano Alimentar</h1>
          <p>Como será sua alimentação hoje.</p>
        </header>
        <div class="lm2-meals-grid" aria-label="Refeições do dia">
          ${plan.meals.map(renderMealCard).join('')}
        </div>
        <button class="lm2-secondary-button" type="button" data-route="home">VOLTAR PARA HOME</button>
      </section>`;
  }

  function showNutritionFocusPanel(root, mealKey) {
    const plan = resolveNutritionPlan();
    const meal = plan?.meals.find(item => item.key === mealKey);
    if (!meal) return;
    root.querySelector('[data-nutrition-focus-panel]')?.remove();
    root.insertAdjacentHTML('beforeend', renderNutritionFocusPanel(meal, plan));
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


  function getGreeting(date = new Date()) {
    const hour = date.getHours();
    if (hour < 12) return 'Bom dia';
    if (hour < 18) return 'Boa tarde';
    return 'Boa noite';
  }

  function getHomeContext(state) {
    if (!state.onboarding_completed) {
      return {
        status: 'first_access',
        eyebrow: 'Seu foco de hoje',
        title: 'Vamos criar sua direção com calma.',
        reason: 'Em poucos minutos, seu próximo passo fica claro e o método começa a trabalhar por você.',
        route: 'onboarding-name',
        cta: 'Começar agora',
        progress: 'Todo método começa com uma direção simples.',
        insight: 'Direção deixa o começo mais leve.'
      };
    }

    if (state.program_completed) {
      return {
        status: 'completed',
        eyebrow: 'Seu foco de hoje',
        title: 'Você concluiu a jornada. Agora vamos sustentar sua direção.',
        reason: 'O método agora é manter o que você construiu, sem pressa e sem recomeços.',
        route: getHomePrimaryRoute(state),
        cta: 'Ver próximo passo',
        progress: 'Você atravessou as 4 semanas e construiu uma base real.',
        insight: 'Você não termina perfeito. Você termina preparado para continuar.'
      };
    }

    if (state.current_week >= 4 || state.week_3_completed) {
      return {
        status: 'last_week',
        eyebrow: 'Seu foco de hoje',
        title: 'Hoje é dia de consolidar sua direção.',
        reason: 'A última etapa reforça o que sustenta o resultado: continuar com método.',
        route: getHomePrimaryRoute(state),
        cta: 'Continuar Jornada',
        progress: 'Você está na reta final. Cada passo agora consolida o hábito.',
        insight: 'Direção permanece mesmo quando a motivação oscila.'
      };
    }

    if (state.next_action === 'daily_checkin' || state.next_action === 'checkin_pending_placeholder') {
      return {
        status: state.continuity_days_count > 0 && state.continuity_days_count < Math.max(2, state.required_days_count - 1) ? 'returning' : 'active',
        eyebrow: 'Seu foco de hoje',
        title: 'Hoje, registre como você continuou.',
        reason: 'Um registro simples mostra que você está construindo consistência, um dia de cada vez.',
        route: 'daily-checkin',
        cta: 'Registrar meu dia',
        progress: `Você escolheu continuar em ${state.continuity_days_count} dos últimos ${state.required_days_count} dias.`,
        insight: 'Pessoas consistentes não acertam todos os dias. Elas apenas voltam mais rápido.'
      };
    }

    if (state.next_action === 'week_1_video' || state.next_action === 'week_2_video') {
      return {
        status: 'active',
        eyebrow: 'Seu foco de hoje',
        title: 'Hoje, assista à aula da semana.',
        reason: 'Ela mostra o porquê do próximo passo e deixa a prática mais simples.',
        route: getHomePrimaryRoute(state),
        cta: 'Assistir Aula',
        progress: `Você está construindo a Semana ${state.current_week} com consistência.`,
        insight: 'Clareza reduz esforço. Um passo bem escolhido já é progresso.'
      };
    }

    if (state.next_action === 'create_plan_b') {
      return {
        status: 'active',
        eyebrow: 'Seu foco de hoje',
        title: 'Hoje, prepare seu Plano B.',
        reason: 'Ele ajuda você a continuar mesmo quando o dia não sai como imaginou.',
        route: 'week-1',
        cta: 'Criar Plano B',
        progress: 'Ter uma resposta simples pronta aumenta sua confiança.',
        insight: 'Autonomia é saber o que fazer quando o dia não sai como planejado.'
      };
    }

    if (state.next_action === 'week_1_complete' || state.next_action === 'week_2_complete') {
      return {
        status: 'active',
        eyebrow: 'Seu foco de hoje',
        title: 'Vamos continuar exatamente de onde você parou.',
        reason: 'Você já deu o passo anterior. Agora basta seguir, sem recomeçar.',
        route: getHomePrimaryRoute(state),
        cta: 'Continuar Jornada',
        progress: 'Mais um passo concluído. Vamos continuar com calma.',
        insight: 'Continuidade é avançar com calma, não fazer tudo de uma vez.'
      };
    }

    return {
      status: 'active',
      eyebrow: 'Seu foco de hoje',
      title: 'Vamos continuar exatamente de onde você parou.',
      reason: nextActionLabel(state.next_action),
      route: getHomePrimaryRoute(state),
      cta: getHomePrimaryLabel(state),
      progress: `Você escolheu continuar em ${state.continuity_days_count} dos últimos ${state.required_days_count} dias.`,
      insight: 'Quando o próximo passo é claro, continuar fica mais leve.'
    };
  }

  function renderToolButton(route, icon, label, description) {
    return `<button class="lm2-tool-card" type="button" data-route="${route}" aria-label="${label}: ${description}"><span class="lm2-tool-icon" aria-hidden="true">${icon}</span><span>${label}</span><small>${description}</small></button>`;
  }

  function renderHomeScreen(state) {
    const context = getHomeContext(state);
    const studentName = state.name || 'aluno';
    return `
      <section class="lm2-home" aria-labelledby="lm2-home-title" data-home-status="${context.status}">
        <header class="lm2-home-header">
          <p>${getGreeting()}, ${escapeHtml(studentName)} 👋</p>
          <h1 id="lm2-home-title">Projeto LM</h1>
        </header>

        <article class="lm2-focus-card" aria-labelledby="lm2-focus-title" aria-label="Qual é a próxima melhor ação para este aluno hoje?">
          <p class="lm2-kicker">${escapeHtml(context.eyebrow)}</p>
          <h2 id="lm2-focus-title">${escapeHtml(context.title)}</h2>
          <p>${escapeHtml(context.reason)}</p>
          <button class="lm2-primary-button lm2-focus-cta" type="button" data-route="${context.route}">${escapeHtml(context.cta)}<span aria-hidden="true">→</span></button>
        </article>

        <article class="lm2-progress-card" aria-label="Resumo de progresso">
          <p>${escapeHtml(context.progress)}</p>
        </article>

        <section class="lm2-tools" aria-label="Acessos secundários do Projeto LM">
          <div class="lm2-tools-grid">
            ${renderToolButton('training', '↗', 'Treino', 'Seu plano')}
            ${renderToolButton('nutrition', '🍽', 'Plano Alimentar', 'Abrir Plano Alimentar')}
            ${renderToolButton('week-1', '◇', 'Plano B', 'Para imprevistos')}
            ${renderToolButton('library', '□', 'Biblioteca', 'Aulas')}
            ${renderToolButton('profile-edit', '○', 'Perfil', 'Seus dados')}
          </div>
        </section>

        <p class="lm2-insight">“${escapeHtml(context.insight)}”</p>
        <p class="lm2-error" data-lm2-error role="alert"></p>
      </section>`;
  }

  async function loadHome(root) {
    try {
      const [response, progressResponse] = await Promise.all([requestLm2(api.home), requestLm2(api.progress)]);
      if (!response.ok || !progressResponse.ok) throw new Error('home_failed');
      const home = await response.json();
      const progress = await progressResponse.json();
      const homeData = { ...(home.data || home), ...(progress.data || {}) };
      applyHomeData(homeData);
      render(root, homeData.onboarding_completed === false ? 'welcome' : 'home');
    } catch (error) {
      setError(root, 'Não foi possível carregar sua jornada. Tente novamente.');
    }
  }

  function render(root, route) {
    route = global.ProjectLm2Router.normalizeRoute(route);
    const state = global.ProjectLm2State.getState();
    root.dataset.lm2Route = route;
    root.dataset.lm2NextAction = state.next_action;

    if (route === 'welcome') root.innerHTML = copy.welcome;
    if (route === 'onboarding-name') root.innerHTML = `
      <section class="lm2-card" aria-labelledby="lm2-name-title">
        <h1 id="lm2-name-title">Como gostaria de ser chamado?</h1>
        <input class="lm2-input" name="name" data-lm2-name autocomplete="given-name" aria-label="Como gostaria de ser chamado?" value="${escapeHtml(state.name)}">
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
        <h1 id="lm2-weight-title">Qual seu peso e altura atuais?</h1>
        <label>Peso (kg)<input class="lm2-input" name="weight_kg" data-lm2-weight inputmode="decimal" type="number" min="1" step="0.1" aria-label="Qual seu peso atual?" value="${state.weight_kg || ''}"></label>
        <label>Altura (cm)<input class="lm2-input" name="height_cm" data-lm2-height inputmode="numeric" type="number" min="1" step="1" aria-label="Qual sua altura atual?" value="${state.height_cm || ''}"></label>
        <p class="lm2-error" data-lm2-error role="alert"></p>
        <button class="lm2-primary-button" type="button" data-create-direction>CRIAR MINHA DIREÇÃO</button>
      </section>`;
    if (route === 'direction-created') root.innerHTML = `
      <section class="lm2-card" aria-labelledby="lm2-direction-title">
        <h1 id="lm2-direction-title">Olá ${escapeHtml(state.name)}</h1>
        <p>Olá, ${escapeHtml(state.name)}. Sua direção está pronta: treino, plano alimentar e primeiros passos organizados. Mas lembre-se: o objetivo não é resolver tudo em 30 dias, e sim aprender a continuar por mais de 30 dias. É isso que constrói resultados de verdade.</p>
        <button class="lm2-primary-button" type="button" data-route="home">IR PARA MINHA JORNADA</button>
      </section>`;
    if (route === 'home-placeholder') route = 'home';
    if (route === 'home') root.innerHTML = renderHomeScreen(state);

    if (route === 'profile-edit') root.innerHTML = `
      <section class="lm2-card" aria-labelledby="lm2-profile-title">
        <h1 id="lm2-profile-title">Atualizar informações</h1>
        <form data-profile-form>
          <label>Nome<input class="lm2-input" name="name" value="${escapeHtml(state.name)}"></label>
          <label>Objetivo<input class="lm2-input" name="goal" value="${escapeHtml(state.goal)}"></label>
          <label>Sexo<div class="lm2-options">${optionButton('sex', 'male', 'male', state.sex)}${optionButton('sex', 'female', 'female', state.sex)}</div></label>
          <label>Peso (kg)<input class="lm2-input" name="weight_kg" type="number" step="0.1" value="${state.weight_kg || ''}"></label>
          <label>Altura (cm)<input class="lm2-input" name="height_cm" type="number" step="1" value="${state.height_cm || ''}"></label>
        </form>
        <p class="lm2-error" data-lm2-error role="alert"></p>
        <button class="lm2-primary-button" type="button" data-save-profile>Salvar informações</button>
        <button class="lm2-secondary-button" type="button" data-route="home">VOLTAR PARA HOME</button>
      </section>`;
    if (route === 'direction') root.innerHTML = `
      <section class="lm2-card" aria-labelledby="lm2-direction-tools-title">
        <h1 id="lm2-direction-tools-title">Minha Direção</h1>
        <p>As ferramentas que vão ajudar você a continuar.</p>
        <article class="lm2-block"><h2>Meu Treino</h2><p>Seu treino já foi definido para esta jornada.</p><button class="lm2-secondary-button" type="button" data-route="training">Abrir meu treino</button></article>
        <article class="lm2-block"><h2>Minha Alimentação</h2><p>Seu plano alimentar já foi definido para esta jornada.</p><button class="lm2-secondary-button" type="button" data-route="nutrition">Abrir meu plano alimentar</button></article>
        <article class="lm2-block"><h2>Meu Plano B</h2><p>Sua estratégia para continuar quando a vida não sair como planejado.</p><button class="lm2-secondary-button" type="button">EM BREVE</button></article>
        <button class="lm2-primary-button" type="button" data-route="home">VOLTAR PARA HOME</button>
      </section>`;
    if (route === 'training') root.innerHTML = renderTrainingScreen(state);
    if (route === 'training') loadTrainingPlan(root);
    if (route === 'nutrition') root.innerHTML = renderNutritionScreen(state);
    if (route === 'library') root.innerHTML = `
      <section class="lm2-card" aria-labelledby="lm2-library-title">
        <p class="lm2-kicker">Projeto LM · Biblioteca</p>
        <h1 id="lm2-library-title">Biblioteca</h1>
        <p>As aulas e conteúdos principais da sua jornada estão organizados dentro de cada semana.</p>
        <p>Volte para a Home quando quiser retomar a próxima melhor ação.</p>
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
        <p class="lm2-error" data-lm2-error role="alert"></p>
        <button class="lm2-primary-button" type="button" data-activate-week-3>IR PARA SEMANA 3</button>
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
    const height = Number(root.querySelector('[data-lm2-height]')?.value);
    if (!Number.isFinite(weight) || weight <= 0) return setError(root, 'Informe um peso válido.');
    if (!Number.isFinite(height) || height <= 0) return setError(root, 'Informe uma altura válida.');
    const state = global.ProjectLm2State.updateState({ weight_kg: weight, height_cm: height });
    try {
      const response = await requestLm2(api.onboarding, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: state.name, goal: state.goal, sex: state.sex, weight_kg: state.weight_kg, height_cm: state.height_cm }) });
      if (!response.ok) throw new Error('onboarding_failed');
      global.ProjectLm2State.updateState({ onboarding_completed: true });
      const homeResponse = await requestLm2(api.home);
      if (!homeResponse.ok) throw new Error('home_failed');
      const home = await homeResponse.json();
      applyHomeData(home.data || home);
      routeTo(root, 'direction-created');
    } catch (error) {
      setError(root, 'Não foi possível criar sua direção. Tente novamente.');
    }
  }

  function showActionRegisteredModal(root) {
    const existing = root.querySelector('[data-action-registered-modal]');
    if (existing) existing.remove();
    root.insertAdjacentHTML('beforeend', `<div class="lm2-modal-backdrop" data-action-registered-modal role="dialog" aria-modal="true" aria-labelledby="lm2-action-title"><div class="lm2-modal"><h2 id="lm2-action-title">Ação registrada</h2><p>O que deseja fazer agora?</p><button class="lm2-secondary-button" type="button" data-close-action-modal>Continuar editando</button><button class="lm2-primary-button" type="button" data-action-modal-home>Voltar para Home</button></div></div>`);
  }

  async function refreshHomeState(root, response, options = {}) {
    if (!response.ok) throw new Error('lm2_action_failed');
    const payload = await response.json();
    applyHomeData(payload.data || payload);
    render(root, global.ProjectLm2Router.getCurrentRoute());
    if (options.showActionModal) showActionRegisteredModal(root);
  }

  async function completeWeek1Video(root) {
    try {
      await refreshHomeState(root, await requestLm2(api.week1VideoComplete, { method: 'POST' }));
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
      await refreshHomeState(root, await requestLm2(api.planB, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }), { showActionModal: true });
    } catch (error) {
      setError(root, 'Não foi possível salvar seu Plano B.');
    }
  }

  async function activateWeek2(root) {
    try {
      const response = await requestLm2(api.activateWeek2, { method: 'POST' });
      if (!response.ok) throw new Error('activate_week_2_failed');
      const payload = await response.json();
      global.ProjectLm2State.updateState({ ...(payload.data || {}), current_week: 2, home_loaded: false });
      routeTo(root, 'week-2');
    } catch (error) {
      setError(root, 'Não foi possível ativar a Semana 2. Conclua os requisitos da Semana 1.');
    }
  }

  async function activateWeek3(root) {
    try {
      const response = await requestLm2(api.activateWeek3, { method: 'POST' });
      if (!response.ok) throw new Error('activate_week_3_failed');
      const payload = await response.json();
      global.ProjectLm2State.updateState({ ...(payload.data || {}), current_week: 3, week_3_available: true, home_loaded: false });
      routeTo(root, 'week-3-placeholder');
    } catch (error) {
      setError(root, 'Não foi possível ativar a Semana 3. Conclua os requisitos da Semana 2.');
    }
  }

  async function completeWeek2Video(root) {
    try {
      await refreshHomeState(root, await requestLm2(api.week2VideoComplete, { method: 'POST' }));
    } catch (error) {
      setError(root, 'Não foi possível marcar a aula da Semana 2 como assistida.');
    }
  }

  async function saveWeek2Reflection(root) {
    const value = root.querySelector('[data-week-2-form]')?.elements.reflection.value.trim();
    if (!value) return setError(root, 'Preencha sua reflexão.');
    try {
      await refreshHomeState(root, await requestLm2(api.week2Reflection, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ reflection: value }) }));
    } catch (error) {
      setError(root, 'Não foi possível salvar sua reflexão.');
    }
  }

  async function saveWeek2Response(root) {
    const value = root.querySelector('[data-week-2-form]')?.elements.minimum_response.value.trim();
    if (!value) return setError(root, 'Preencha sua resposta mínima.');
    try {
      await refreshHomeState(root, await requestLm2(api.week2Reflection, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ minimum_response: value }) }));
    } catch (error) {
      setError(root, 'Não foi possível salvar sua resposta mínima.');
    }
  }


  async function completeWeek3Video(root) {
    try {
      await refreshHomeState(root, await requestLm2(api.week3VideoComplete, { method: 'POST' }));
    } catch (error) {
      setError(root, 'Não foi possível marcar a aula da Semana 3 como assistida.');
    }
  }

  async function saveWeek3Reflection(root) {
    const value = root.querySelector('[data-week-3-form]')?.elements.reflection.value.trim();
    if (!value) return setError(root, 'Preencha sua reflexão.');
    try {
      await refreshHomeState(root, await requestLm2(api.week3Reflection, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ reflection: value }) }));
    } catch (error) {
      setError(root, 'Não foi possível salvar sua reflexão.');
    }
  }

  async function saveWeek3Response(root) {
    const value = root.querySelector('[data-week-3-form]')?.elements.minimum_response.value.trim();
    if (!value) return setError(root, 'Preencha sua resposta mínima.');
    try {
      await refreshHomeState(root, await requestLm2(api.week3Reflection, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ minimum_response: value }) }));
    } catch (error) {
      setError(root, 'Não foi possível salvar sua resposta mínima.');
    }
  }

  async function completeWeek3(root) {
    const state = global.ProjectLm2State.getState();
    if (!isWeek3Completed(state)) return setError(root, 'Assista à aula, salve sua reflexão e salve sua resposta mínima antes de concluir a Semana 3.');
    try {
      const response = await requestLm2(api.week3Complete, { method: 'POST' });
      if (!response.ok) throw new Error('week_3_complete_failed');
      const payload = await response.json();
      applyHomeData(payload.data || payload);
      routeTo(root, 'week-3-complete');
    } catch (error) {
      setError(root, 'Não foi possível concluir a Semana 3.');
    }
  }


  async function completeWeek4Video(root) {
    try {
      await refreshHomeState(root, await requestLm2(api.week4VideoComplete, { method: 'POST' }));
    } catch (error) {
      setError(root, 'Não foi possível marcar a aula da Semana 4 como assistida.');
    }
  }

  async function saveWeek4Reflection(root) {
    const value = root.querySelector('[data-week-4-form]')?.elements.reflection.value.trim();
    if (!value) return setError(root, 'Preencha sua reflexão.');
    try {
      await refreshHomeState(root, await requestLm2(api.week4Reflection, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ reflection: value }) }));
    } catch (error) {
      setError(root, 'Não foi possível salvar sua reflexão.');
    }
  }

  async function saveWeek4Response(root) {
    const value = root.querySelector('[data-week-4-form]')?.elements.minimum_response.value.trim();
    if (!value) return setError(root, 'Preencha sua resposta mínima.');
    try {
      await refreshHomeState(root, await requestLm2(api.week4Reflection, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ minimum_response: value }) }));
    } catch (error) {
      setError(root, 'Não foi possível salvar sua resposta mínima.');
    }
  }

  async function completeWeek4(root) {
    const state = global.ProjectLm2State.getState();
    if (!isWeek4Completed(state)) return setError(root, 'Assista à aula, salve sua reflexão e salve sua resposta mínima antes de concluir a Semana 4.');
    try {
      const response = await requestLm2(api.week4Complete, { method: 'POST' });
      if (!response.ok) throw new Error('week_4_complete_failed');
      const payload = await response.json();
      applyHomeData(payload.data || payload);
      routeTo(root, 'week-4-complete');
    } catch (error) {
      setError(root, 'Não foi possível concluir a Semana 4.');
    }
  }

  function openPremiumConsulting() {
    global.location.href = premiumConsultingCtaUrl;
  }

  async function completeProgram(root) {
    try {
      const response = await requestLm2(api.programCompletion, { method: 'POST' });
      if (!response.ok) throw new Error('program_completion_failed');
      const payload = await response.json();
      applyHomeData(payload.data || payload);
      routeTo(root, 'premium-bridge');
    } catch (error) {
      setError(root, 'Não foi possível concluir o Projeto LM.');
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
      const response = await requestLm2(api.checkin, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ answer }) });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error || 'Não foi possível registrar seu dia.');
      }
      const payload = await response.json();
      global.ProjectLm2State.updateState({ ...(payload.data || {}), today_checkin_completed: true, next_action: 'checkin_completed_today' });
      const feedback = root.querySelector('[data-lm2-feedback]');
      if (feedback) feedback.textContent = messages[answer];
      showActionRegisteredModal(root);
    } catch (error) {
      setError(root, error.message || 'Não foi possível registrar seu dia.');
    }
  }

  async function saveProfile(root) {
    const form = root.querySelector('[data-profile-form]');
    const body = {
      name: form?.elements.name.value.trim(),
      goal: form?.elements.goal.value.trim(),
      sex: global.ProjectLm2State.getState().sex,
      weight_kg: Number(form?.elements.weight_kg.value),
      height_cm: Number(form?.elements.height_cm.value)
    };
    if (!body.name || !body.goal || !body.sex || !Number.isFinite(body.weight_kg) || !Number.isFinite(body.height_cm)) return setError(root, 'Preencha nome, objetivo, sexo, peso e altura.');
    try {
      await refreshHomeState(root, await requestLm2(api.profile, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }));
      routeTo(root, 'home');
    } catch (error) {
      setError(root, 'Não foi possível atualizar suas informações.');
    }
  }

  function bind(root) {
    root.addEventListener('click', event => {
      const target = event.target.closest('button');
      if (!target) return;
      if (target.hasAttribute('data-close-action-modal')) return target.closest('[data-action-registered-modal]')?.remove();
      if (target.hasAttribute('data-action-modal-home')) { target.closest('[data-action-registered-modal]')?.remove(); return routeTo(root, 'home'); }
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
      if (target.hasAttribute('data-open-exercise-result')) showExerciseResultModal(root);
      if (target.hasAttribute('data-save-exercise-result')) saveExerciseResult(root);
      if (target.hasAttribute('data-finish-training')) finishTraining(root);
      if (target.hasAttribute('data-meal-focus')) showNutritionFocusPanel(root, target.dataset.mealFocus);
      if (target.hasAttribute('data-close-nutrition-focus')) target.closest('[data-nutrition-focus-panel]')?.remove();
      if (target.hasAttribute('data-create-direction')) submitOnboarding(root);
      if (target.hasAttribute('data-complete-week-1-video')) completeWeek1Video(root);
      if (target.hasAttribute('data-save-plan-b')) savePlanB(root);
      if (target.hasAttribute('data-activate-week-2')) activateWeek2(root);
      if (target.hasAttribute('data-activate-week-3')) activateWeek3(root);
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
      if (target.hasAttribute('data-save-profile')) saveProfile(root);
    });
  }

  function boot() {
    const root = document.querySelector('#project-lm-2-root');
    if (!root) return;
    if (!requireSession()) return;
    if (!root.dataset.lm2BoundClick) {
      root.dataset.lm2BoundClick = 'true';
      bind(root);
    }
    render(root, 'home');
    if (!root.dataset.lm2BoundHashchange) {
      root.dataset.lm2BoundHashchange = 'true';
      global.addEventListener('hashchange', () => render(root, global.ProjectLm2Router.getCurrentRoute()));
    }
  }

  global.ProjectLm2App = { boot, render, api, getAuthHeaders, hasSession, requireSession, requestLm2 };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})(window, document);
