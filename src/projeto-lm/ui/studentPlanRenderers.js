const LOAD_ERROR_MESSAGE = 'Não foi possível carregar este plano agora. Tente novamente em instantes.';

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[char]));
}


function formatPrescription(exercise) {
  const sets = escapeHtml(exercise?.sets);
  const reps = escapeHtml(exercise?.reps);
  if (!sets && !reps) return '';
  if (!sets) return reps;
  if (!reps) return sets;
  return `${sets} × ${reps}`;
}

function formatRest(rest) {
  return escapeHtml(String(rest ?? '').replace(/segundos?/gi, 's').replace(/\s+a\s+/gi, '–').replace(/\s+/g, ' ').trim());
}

function estimateWorkoutDuration(workout) {
  if (workout?.cardio?.minutes) return `${escapeHtml(workout.cardio.minutes)} min + treino`;
  const count = Array.isArray(workout?.exercises) ? workout.exercises.length : 0;
  if (count >= 5) return '50–60 min';
  if (count >= 4) return '40–50 min';
  if (count >= 3) return '30–40 min';
  return '20–30 min';
}

function list(items) {
  const safeItems = Array.isArray(items) ? items.filter(Boolean) : [];
  if (!safeItems.length) return '';
  return `<ul>${safeItems.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>`;
}

export function renderPlanError() {
  return `<p class="lm2-plan-error" role="alert">${LOAD_ERROR_MESSAGE}</p>`;
}

export function logPlanError(error, env = globalThis?.process?.env?.NODE_ENV) {
  if (env === 'development') console.error(error);
}

export function renderNutritionPlan(plan) {
  if (!plan || !Array.isArray(plan.meals)) return renderPlanError();
  return `<section class="lm2-nutrition-overview lm2-engine-plan" aria-labelledby="lm2-nutrition-title"><header class="lm2-nutrition-header"><p class="lm2-kicker">Projeto LM · Plano alimentar</p><h1 id="lm2-nutrition-title">${escapeHtml(plan.title || 'Plano Alimentar')}</h1>${plan.guidance ? `<p>${escapeHtml(plan.guidance)}</p>` : ''}</header><div class="lm2-engine-meals">${plan.meals.map((meal) => `<article class="lm2-engine-card"><h2>${escapeHtml(meal.name || meal.slot_name || 'Refeição')}</h2><h3>Alimentos:</h3><ul>${(meal.foods || []).map((food) => `<li>${escapeHtml(food.name)} — ${escapeHtml(food.quantity)}</li>`).join('')}</ul>${(meal.foods || []).some((food) => Array.isArray(food.substitutions) && food.substitutions.length) ? `<h3>Substituições:</h3><ul>${meal.foods.filter((food) => food.substitutions?.length).map((food) => `<li>${escapeHtml(food.name)} pode ser trocado por ${escapeHtml(food.substitutions.join(', '))}.</li>`).join('')}</ul>` : ''}${meal.plan_b?.length ? `<h3>Plano B:</h3>${list(meal.plan_b)}` : ''}${meal.notes ? `<h3>Observação:</h3><p>${escapeHtml(meal.notes)}</p>` : ''}</article>`).join('')}</div></section>`;
}


export function renderWeeklyPlan(weeklyPlan) {
  if (!weeklyPlan?.today || !Array.isArray(weeklyPlan.nextWorkouts)) return renderPlanError();
  const todayText = weeklyPlan.today.message || (weeklyPlan.today.type === 'cardio' ? '40 a 60 minutos em ritmo leve a moderado.' : 'Esse é o foco do seu treino de hoje.');
  return `<section class="lm2-weekly-plan lm2-engine-plan" aria-labelledby="lm2-weekly-title"><header class="lm2-nutrition-header"><p class="lm2-kicker">Projeto LM · Semana de treino</p><h1 id="lm2-weekly-title">Hoje</h1><h2>${escapeHtml(weeklyPlan.today.label || weeklyPlan.today.title || 'Treino de hoje')}</h2><p>${escapeHtml(todayText)}</p></header>${weeklyPlan.nextWorkouts.length ? `<div class="lm2-engine-card"><h2>Próximos treinos</h2><ul>${weeklyPlan.nextWorkouts.map((day) => `<li>${escapeHtml(day.label)} — ${escapeHtml(day.title)}</li>`).join('')}</ul></div>` : ''}</section>`;
}


export function renderWeeklyConsistency(result) {
  const visible = result?.student_visible || result;
  if (!visible?.title || !visible?.body || !visible?.progressLabel || !visible?.nextAction) return renderPlanError();
  return `<section class="lm2-weekly-consistency lm2-engine-plan" aria-labelledby="lm2-weekly-consistency-title"><header class="lm2-nutrition-header"><p class="lm2-kicker">Continuidade da semana</p><h1 id="lm2-weekly-consistency-title">Continuidade da semana</h1><p>${escapeHtml(visible.progressLabel)}</p></header><article class="lm2-engine-card"><h2>${escapeHtml(visible.title)}</h2><p>${escapeHtml(visible.body)}</p><h3>Próximo passo:</h3><p>${escapeHtml(visible.nextAction)}</p></article></section>`;
}


export function renderContinuityCheckin(checkin) {
  const visible = checkin?.student_visible || checkin;
  if (!visible?.title || !visible?.body || !visible?.nextAction) return renderPlanError();
  return `<section class="lm2-continuity-checkin lm2-engine-plan" aria-labelledby="lm2-continuity-title"><header class="lm2-nutrition-header"><p class="lm2-kicker">Projeto LM · Check-in de continuidade</p><h1 id="lm2-continuity-title">${escapeHtml(visible.title)}</h1><p>${escapeHtml(visible.body)}</p></header><article class="lm2-engine-card"><h2>Próximo passo</h2><p>${escapeHtml(visible.nextAction)}</p></article></section>`;
}

export function renderWorkoutPlan(workout) {
  if (workout?.rest_day) return `<section class="lm2-workout-premium lm2-engine-plan" aria-labelledby="lm2-training-title"><header class="lm2-workout-hero"><p class="lm2-kicker">Treino de Hoje</p><h1 id="lm2-training-title">${escapeHtml(workout.display_name || 'Descanso ativo')}</h1><p class="lm2-workout-subtitle">${escapeHtml(workout.guidance || 'Hoje é dia de descanso. Uma caminhada leve já é suficiente.')}</p></header></section>`;
  if (!workout || !Array.isArray(workout.exercises)) return renderPlanError();
  const exerciseCount = workout.exercises.length;
  const title = escapeHtml(workout.display_name || workout.title || 'Treino Projeto LM');
  return `<section class="lm2-workout-premium lm2-engine-plan" aria-labelledby="lm2-training-title"><header class="lm2-workout-hero"><div><p class="lm2-kicker">Treino de Hoje</p><h1 id="lm2-training-title">${title}</h1><p class="lm2-workout-subtitle">${exerciseCount} ${exerciseCount === 1 ? 'exercício' : 'exercícios'}</p><p class="lm2-workout-duration">Duração estimada • ${estimateWorkoutDuration(workout)}</p></div><a class="lm2-workout-start" href="#training">Começar treino</a></header>${workout.observations ? `<aside class="lm2-workout-note lm2-workout-note--quiet"><strong>Direção</strong><p>${escapeHtml(workout.observations)}</p></aside>` : ''}<div class="lm2-workout-progress-shell" aria-hidden="true"><span></span><span></span><span></span></div><div class="lm2-workout-list">${workout.exercises.map((exercise, index) => `<article class="lm2-workout-card"><div class="lm2-workout-card-index">${index + 1}</div><div class="lm2-workout-card-body"><h2>${escapeHtml(exercise.name)}</h2><div class="lm2-workout-prescription"><strong>${formatPrescription(exercise)}</strong><span>Descanso • ${formatRest(exercise.rest)}</span></div>${exercise.observations ? `<aside class="lm2-workout-tip"><strong>💡 Dica</strong><p>${escapeHtml(exercise.observations)}</p></aside>` : ''}${exercise.substitutions?.length ? `<p class="lm2-workout-secondary">Substituição: ${escapeHtml(exercise.substitutions.join(', '))}.</p>` : ''}${exercise.video ? `<a class="lm2-video-button" href="${escapeHtml(exercise.video)}" target="_blank" rel="noopener">Vídeo de execução</a>` : ''}</div></article>`).join('')}${workout.cardio ? `<article class="lm2-workout-card lm2-workout-card--support"><div class="lm2-workout-card-index">+</div><div class="lm2-workout-card-body"><h2>Cardio</h2><div class="lm2-workout-prescription"><strong>${escapeHtml(workout.cardio.minutes)} min</strong><span>Ritmo moderado</span></div>${workout.cardio.guidance ? `<aside class="lm2-workout-tip"><strong>💡 Dica</strong><p>${escapeHtml(workout.cardio.guidance)}</p></aside>` : ''}${workout.cardio.mobility ? `<p class="lm2-workout-secondary">${escapeHtml(workout.cardio.mobility)}</p>` : ''}</div></article>` : ''}</div>${workout.progression ? `<aside class="lm2-workout-note"><strong>Progresso futuro</strong><p>${escapeHtml(workout.progression)}</p></aside>` : ''}</section>`;
}
