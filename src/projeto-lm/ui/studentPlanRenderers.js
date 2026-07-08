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

export function renderWorkoutPlan(workout) {
  if (!workout || !Array.isArray(workout.exercises)) return renderPlanError();
  return `<section class="lm2-training-mode lm2-engine-plan" aria-labelledby="lm2-training-title"><header class="lm2-nutrition-header"><p class="lm2-kicker">Projeto LM · Treino</p><h1 id="lm2-training-title">${escapeHtml(workout.display_name || workout.title || 'Treino Projeto LM')}</h1>${workout.observations ? `<p>${escapeHtml(workout.observations)}</p>` : ''}</header><div class="lm2-engine-workout">${workout.exercises.map((exercise) => `<article class="lm2-engine-card"><h2>${escapeHtml(exercise.name)}</h2><p>${escapeHtml(exercise.sets)} séries</p><p>${escapeHtml(exercise.reps)} repetições</p><p>Descanso: ${escapeHtml(exercise.rest)}</p>${exercise.video ? `<a class="lm2-video-button" href="${escapeHtml(exercise.video)}" target="_blank" rel="noopener">Vídeo de execução</a>` : ''}${exercise.observations ? `<h3>Observação:</h3><p>${escapeHtml(exercise.observations)}</p>` : ''}${exercise.substitutions?.length ? `<h3>Substituições:</h3><p>${escapeHtml(exercise.substitutions.join(', '))}.</p>` : ''}</article>`).join('')}${workout.cardio ? `<article class="lm2-engine-card"><h2>Cardio:</h2><p>${escapeHtml(workout.cardio.minutes)} minutos em ritmo moderado.</p>${workout.cardio.guidance ? `<p>${escapeHtml(workout.cardio.guidance)}</p>` : ''}${workout.cardio.mobility ? `<p>${escapeHtml(workout.cardio.mobility)}</p>` : ''}</article>` : ''}${workout.progression ? `<article class="lm2-engine-card"><h2>Progressão:</h2><p>${escapeHtml(workout.progression)}</p></article>` : ''}</div></section>`;
}
