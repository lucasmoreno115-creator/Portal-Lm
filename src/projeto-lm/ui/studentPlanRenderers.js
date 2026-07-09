const LOAD_ERROR_MESSAGE = 'Não foi possível carregar este plano agora. Tente novamente em instantes.';

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[char]));
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


export function renderContinuityCheckin(checkin) {
  const visible = checkin?.student_visible || checkin;
  if (!visible?.title || !visible?.body || !visible?.nextAction) return renderPlanError();
  return `<section class="lm2-continuity-checkin lm2-engine-plan" aria-labelledby="lm2-continuity-title"><header class="lm2-nutrition-header"><p class="lm2-kicker">Projeto LM · Check-in de continuidade</p><h1 id="lm2-continuity-title">${escapeHtml(visible.title)}</h1><p>${escapeHtml(visible.body)}</p></header><article class="lm2-engine-card"><h2>Próximo passo</h2><p>${escapeHtml(visible.nextAction)}</p></article></section>`;
}

export function renderWorkoutPlan(workout) {
  if (workout?.rest_day) return `<section class="lm2-training-mode lm2-engine-plan" aria-labelledby="lm2-training-title"><header class="lm2-nutrition-header"><p class="lm2-kicker">Projeto LM · Treino</p><h1 id="lm2-training-title">${escapeHtml(workout.display_name || 'Descanso ativo')}</h1><p>${escapeHtml(workout.guidance || 'Hoje é dia de descanso. Uma caminhada leve já é suficiente.')}</p></header></section>`;
  if (!workout || !Array.isArray(workout.exercises)) return renderPlanError();
  return `<section class="lm2-training-mode lm2-engine-plan" aria-labelledby="lm2-training-title"><header class="lm2-nutrition-header"><p class="lm2-kicker">Projeto LM · Treino</p><h1 id="lm2-training-title">${escapeHtml(workout.display_name || workout.title || 'Treino Projeto LM')}</h1>${workout.observations ? `<p>${escapeHtml(workout.observations)}</p>` : ''}</header><div class="lm2-engine-workout">${workout.exercises.map((exercise) => `<article class="lm2-engine-card"><h2>${escapeHtml(exercise.name)}</h2><p>${escapeHtml(exercise.sets)} séries</p><p>${escapeHtml(exercise.reps)} repetições</p><p>Descanso: ${escapeHtml(exercise.rest)}</p>${exercise.video ? `<a class="lm2-video-button" href="${escapeHtml(exercise.video)}" target="_blank" rel="noopener">Vídeo de execução</a>` : ''}${exercise.observations ? `<h3>Observação:</h3><p>${escapeHtml(exercise.observations)}</p>` : ''}${exercise.substitutions?.length ? `<h3>Substituições:</h3><p>${escapeHtml(exercise.substitutions.join(', '))}.</p>` : ''}</article>`).join('')}${workout.cardio ? `<article class="lm2-engine-card"><h2>Cardio:</h2><p>${escapeHtml(workout.cardio.minutes)} minutos em ritmo moderado.</p>${workout.cardio.guidance ? `<p>${escapeHtml(workout.cardio.guidance)}</p>` : ''}${workout.cardio.mobility ? `<p>${escapeHtml(workout.cardio.mobility)}</p>` : ''}</article>` : ''}${workout.progression ? `<article class="lm2-engine-card"><h2>Progressão:</h2><p>${escapeHtml(workout.progression)}</p></article>` : ''}</div></section>`;
}
