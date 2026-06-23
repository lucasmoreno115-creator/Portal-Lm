const PROJECT_LM_PLANS = {
  female: {
    label: 'Projeto LM Mulher',
    calories: '1600 kcal',
    weeklyTraining: [
      ['Segunda', 'Lower A'],
      ['Terça', 'Upper A'],
      ['Quarta', 'Cardio'],
      ['Quinta', 'Lower B'],
      ['Sexta', 'Upper B']
    ],
    meals: {
      'Café da manhã': ['2 ovos', '1 pão francês', 'Café sem açúcar'],
      'Almoço': ['3 colheres arroz', '1 concha feijão', '1 filé de frango', 'Salada'],
      'Lanche': ['Iogurte proteico', '1 fruta'],
      'Jantar': ['3 colheres arroz', '1 concha feijão', '1 filé de frango', 'Salada']
    }
  },
  male: {
    label: 'Projeto LM Homem',
    calories: '2000 kcal',
    weeklyTraining: [
      ['Segunda', 'Upper A'],
      ['Terça', 'Lower A'],
      ['Quarta', 'Cardio'],
      ['Quinta', 'Upper B'],
      ['Sexta', 'Lower B']
    ],
    meals: {
      'Café da manhã': ['3 ovos', '2 fatias pão integral', 'Café sem açúcar'],
      'Almoço': ['4 colheres arroz', '1 concha feijão', '2 filés de frango', 'Salada'],
      'Lanche': ['Iogurte proteico', '1 fruta'],
      'Jantar': ['4 colheres arroz', '1 concha feijão', '2 filés de frango', 'Salada']
    }
  }
};

const PROJECT_LM_WORKOUTS = {
  'Lower A': ['Leg Press — 3x10-12', 'Mesa Flexora — 3x10-12', 'Cadeira Extensora — 3x12-15', 'Panturrilha Sentado — 3x12-15', 'Prancha — 3 séries'],
  'Upper A': ['Supino Máquina — 3x10-12', 'Puxada Frente — 3x10-12', 'Desenvolvimento Máquina — 3x10-12', 'Remada Baixa — 3x10-12', 'Rosca Máquina — 2x12', 'Tríceps Polia — 2x12'],
  'Lower B': ['Agachamento Smith — 3x10-12', 'Stiff — 3x10-12', 'Cadeira Extensora — 3x12-15', 'Mesa Flexora — 3x12-15', 'Panturrilha — 3x15'],
  'Upper B': ['Supino Inclinado Máquina — 3x10-12', 'Remada Articulada — 3x10-12', 'Elevação Lateral — 3x12-15', 'Pulldown — 3x10-12', 'Rosca Máquina — 2x12', 'Tríceps Polia — 2x12'],
  'Cardio': ['Plano Principal: 30 minutos caminhada', 'ou 30 minutos bicicleta', 'Plano B: 10 minutos caminhada']
};

function listItems(items) {
  return `<ul class='planning-list'>${items.map((item) => `<li>🔹 ${item}</li>`).join('')}</ul>`;
}

function getTodayTraining(weeklyTraining, today = new Date()) {
  const weekday = today.getDay();
  if (weekday === 0 || weekday === 6) return null;
  return weeklyTraining[weekday - 1] || null;
}

function renderTodayTraining(plan) {
  const weekdays = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
  const today = new Date();
  const todayTraining = getTodayTraining(plan.weeklyTraining, today);

  if (!todayTraining) {
    return `
      <p class='planning-day-title'>Hoje é ${weekdays[today.getDay()]}</p>
      <p>Hoje não tem treino obrigatório.</p>
      <p>Se quiser manter o processo vivo, faça uma caminhada leve ou apenas siga o plano alimentar.</p>
    `;
  }

  const [, workout] = todayTraining;
  const todayWorkout = workout === 'Cardio' ? 'Cardio LM' : workout;
  return `
    <p class='planning-day-title'>Hoje é ${weekdays[today.getDay()]}</p>
    <p class='planning-card-label'>Treino de hoje:</p>
    <p class='planning-today-workout'>${todayWorkout}</p>
  `;
}

function renderProjectLmPlanning(profile) {
  const plan = PROJECT_LM_PLANS[profile?.sex];
  if (!plan) return;

  document.getElementById('planningProfileSummary').innerHTML = `
    <p class='planning-profile-name'><strong>${plan.label} · ${plan.calories}</strong></p>
    <p>Esse plano não precisa ser perfeito. Ele precisa ser executável.</p>
    <p>A missão não é fazer tudo perfeito.<br>A missão é continuar.</p>
  `;

  document.getElementById('todayTrainingPlan').innerHTML = renderTodayTraining(plan);

  document.getElementById('weeklyTrainingPlan').innerHTML = plan.weeklyTraining.map(([day, workout]) => `
    <details class='planning-day'>
      <summary class='planning-day-title'>${day} — ${workout}</summary>
      ${listItems(PROJECT_LM_WORKOUTS[workout] || [])}
    </details>
  `).join('');

  document.getElementById('nutritionPlan').innerHTML = Object.entries(plan.meals).map(([meal, items]) => `
    <div class='planning-day'>
      <p class='planning-day-title'>${meal}</p>
      ${listItems(items)}
    </div>
  `).join('');
}

async function loadProjectLmPlanning() {
  const profile = await getProjectLmProfile();
  if (!profile?.sex) {
    window.location.href = 'project-lm-profile.html';
    return;
  }
  renderProjectLmPlanning(profile);
}

loadProjectLmPlanning().catch(() => {
  window.location.href = 'project-lm-profile.html';
});
