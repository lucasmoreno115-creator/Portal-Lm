/* LEGACY - DO NOT EXTEND
   SUPERSEDED BY PROJECT LM V5 */
const PROJECT_LM_PLANS = {
  female: {
    label: 'Mulher',
    weeklyTraining: [
      ['Segunda', 'Lower A'],
      ['Terça', 'Upper A'],
      ['Quarta', 'Cardio'],
      ['Quinta', 'Lower B'],
      ['Sexta', 'Upper B']
    ]
  },
  male: {
    label: 'Homem',
    weeklyTraining: [
      ['Segunda', 'Upper A'],
      ['Terça', 'Lower A'],
      ['Quarta', 'Cardio'],
      ['Quinta', 'Upper B'],
      ['Sexta', 'Lower B']
    ]
  }
};

const PROJECT_LM_NUTRITION_PLANS = {
  M1: {
    calories: '1400–1500 kcal',
    meals: {
      'Café da manhã': ['2 ovos', '1 pão francês', '1 fruta'],
      'Lanche da manhã': ['Opção líquida: 170g iogurte proteico', 'Opção sólida: 1 fruta'],
      'Almoço': ['100g arroz cozido', '100g feijão', '100g proteína', 'Salada à vontade'],
      'Lanche da tarde': ['Opção líquida: 170g iogurte proteico', 'Opção sólida: 1 fruta'],
      'Jantar': ['100g arroz cozido', '100g feijão', '100g proteína', 'Salada à vontade']
    }
  },
  M2: {
    calories: '1500–1600 kcal',
    meals: {
      'Café da manhã': ['2 ovos', '1 pão francês', '1 fruta'],
      'Lanche da manhã': ['Opção líquida: 170g iogurte proteico', 'Opção sólida: 1 fruta'],
      'Almoço': ['120g arroz cozido', '100g feijão', '120g proteína', 'Salada à vontade'],
      'Lanche da tarde': ['Opção líquida: 170g iogurte proteico', 'Opção sólida: 1 fruta'],
      'Jantar': ['120g arroz cozido', '100g feijão', '120g proteína', 'Salada à vontade']
    }
  },
  M3: {
    calories: '1600–1800 kcal',
    meals: {
      'Café da manhã': ['3 ovos', '1 pão francês', '1 fruta'],
      'Lanche da manhã': ['Opção líquida: 170g iogurte proteico', 'Opção sólida: 1 fruta'],
      'Almoço': ['150g arroz cozido', '100g feijão', '130g proteína', 'Salada à vontade'],
      'Lanche da tarde': ['Opção líquida: 170g iogurte proteico', 'Opção sólida: 1 fruta'],
      'Jantar': ['150g arroz cozido', '100g feijão', '130g proteína', 'Salada à vontade']
    }
  },
  H1: {
    calories: '1600–1800 kcal',
    meals: {
      'Café da manhã': ['3 ovos', '1 pão francês', '1 fruta'],
      'Lanche da manhã': ['Opção líquida: 170g iogurte proteico', 'Opção sólida: 1 fruta'],
      'Almoço': ['150g arroz cozido', '100g feijão', '130g proteína', 'Salada à vontade'],
      'Lanche da tarde': ['Opção líquida: 170g iogurte proteico', 'Opção sólida: 1 fruta'],
      'Jantar': ['150g arroz cozido', '100g feijão', '130g proteína', 'Salada à vontade']
    }
  },
  H2: {
    calories: '1800–2000 kcal',
    meals: {
      'Café da manhã': ['3 ovos', '1 pão francês', '1 fruta'],
      'Lanche da manhã': ['Opção líquida: 170g iogurte proteico', 'Opção sólida: 1 fruta'],
      'Almoço': ['180g arroz cozido', '100g feijão', '150g proteína', 'Salada à vontade'],
      'Lanche da tarde': ['Opção líquida: 170g iogurte proteico', 'Opção sólida: 1 fruta'],
      'Jantar': ['180g arroz cozido', '100g feijão', '150g proteína', 'Salada à vontade']
    }
  },
  H3: {
    calories: '2000–2200 kcal',
    meals: {
      'Café da manhã': ['4 ovos', '1 pão francês', '1 fruta'],
      'Lanche da manhã': ['Opção líquida: 170g iogurte proteico', 'Opção sólida: 1 fruta'],
      'Almoço': ['220g arroz cozido', '100g feijão', '180g proteína', 'Salada à vontade'],
      'Lanche da tarde': ['Opção líquida: 170g iogurte proteico', 'Opção sólida: 1 fruta'],
      'Jantar': ['220g arroz cozido', '100g feijão', '180g proteína', 'Salada à vontade']
    }
  }
};

const PROJECT_LM_NUTRITION_EQUIVALENCES = {
  'Proteínas': {
    reference: 'Referência: 100g peito de frango cru',
    items: ['100g peito de frango', '100g patinho', '100g coxão mole', '120g peixe', '1 lata de atum', '3 ovos inteiros']
  },
  'Carboidratos': {
    reference: 'Referência: 100g arroz cozido',
    items: ['100g arroz cozido', '180g batata inglesa cozida', '130g batata-doce cozida', '100g macarrão cozido', '90g mandioca cozida', '80g cuscuz pronto', '2 fatias pão integral', '1 pão francês']
  },
  'Frutas': {
    items: ['1 banana', '1 maçã', '1 pera', '1 laranja', '150g mamão', '150g melão', '200g melancia', '120g manga']
  },
  'Gorduras': {
    reference: 'Referência: 10g azeite',
    items: ['10g azeite', '15g castanhas', '15g pasta de amendoim', '50g abacate']
  }
};

const PROJECT_LM_OFFICIAL_PLAN_B = [
  'Garantir proteína em pelo menos 2 refeições.',
  'Beber água.',
  'Fazer pelo menos 10 minutos de caminhada.',
  'Voltar ao plano na próxima refeição.'
];

const PROJECT_LM_ADHERENCE_RULES = [
  'Não tente ser perfeito.',
  'Não compense excessos ficando sem comer.',
  'Não espere segunda-feira para recomeçar.',
  'O Plano B faz parte do programa.',
  'Feito é melhor que perfeito.',
  'O objetivo é continuar.'
];

const PROJECT_LM_WORKOUTS = {
  'Lower A': ['Leg Press — 3x10-12', 'Mesa Flexora — 3x10-12', 'Cadeira Extensora — 3x12-15', 'Panturrilha Sentado — 3x12-15', 'Prancha — 3 séries'],
  'Upper A': ['Supino Máquina — 3x10-12', 'Puxada Frente — 3x10-12', 'Desenvolvimento Máquina — 3x10-12', 'Remada Baixa — 3x10-12', 'Rosca Máquina — 2x12', 'Tríceps Polia — 2x12'],
  'Lower B': ['Agachamento Smith — 3x10-12', 'Stiff — 3x10-12', 'Cadeira Extensora — 3x12-15', 'Mesa Flexora — 3x12-15', 'Panturrilha — 3x15'],
  'Upper B': ['Supino Inclinado Máquina — 3x10-12', 'Remada Articulada — 3x10-12', 'Elevação Lateral — 3x12-15', 'Pulldown — 3x10-12', 'Rosca Máquina — 2x12', 'Tríceps Polia — 2x12'],
  'Cardio': ['Plano Principal: 30 minutos caminhada', 'ou 30 minutos bicicleta', 'Plano B: 10 minutos caminhada']
};

function escapeHtml(value) {
  return String(value || '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[char]));
}

function listItems(items) {
  return `<ul class='planning-list'>${items.map((item) => `<li>🔹 ${escapeHtml(item)}</li>`).join('')}</ul>`;
}

function renderNutritionMeals(nutritionPlan) {
  return Object.entries(nutritionPlan.meals).map(([meal, items]) => `
    <div class='planning-day'>
      <p class='planning-day-title'>${escapeHtml(meal)}</p>
      ${listItems(items)}
    </div>
  `).join('');
}

function renderNutritionEquivalences() {
  return `
    <div class='planning-section-block'>
      <h3>Equivalências padrão</h3>
      ${Object.entries(PROJECT_LM_NUTRITION_EQUIVALENCES).map(([group, data]) => `
        <div class='planning-day'>
          <p class='planning-day-title'>${escapeHtml(group)}</p>
          ${data.reference ? `<p class='planning-reference'>${escapeHtml(data.reference)}</p>` : ''}
          ${listItems(data.items)}
        </div>
      `).join('')}
    </div>
  `;
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

  const nutritionPlanCode = profile.initialPlanCode || profile.initial_plan_code || profile.nutritionPlanCode || profile.nutrition_plan_code || '';
  const nutritionPlan = PROJECT_LM_NUTRITION_PLANS[nutritionPlanCode];
  const studentName = escapeHtml(profile.name || 'Aluno');
  const studentGoal = escapeHtml(profile.objective || profile.goal || 'Continuar por 30 dias');
  const safeWeightKg = escapeHtml(profile.weightKg || profile.weight_kg || 'Não informado');
  const safeHeightCm = escapeHtml(profile.heightCm || profile.height_cm || 'Não informada');
  const calories = escapeHtml(nutritionPlan?.calories || 'Não definida');

  document.getElementById('planningProfileSummary').innerHTML = `
    <p><strong>Plano inicial de ${studentName}</strong></p>
    <p><strong>Objetivo:</strong> ${studentGoal}</p>
    <p><strong>Peso:</strong> ${safeWeightKg} kg</p>
    <p><strong>Altura:</strong> ${safeHeightCm} cm</p>
    <p><strong>Faixa calórica:</strong> ${calories}</p>
  `;

  document.getElementById('todayTrainingPlan').innerHTML = renderTodayTraining(plan);

  document.getElementById('weeklyTrainingPlan').innerHTML = plan.weeklyTraining.map(([day, workout]) => `
    <div class='planning-day'>
      <p class='planning-day-title'>${escapeHtml(day)}: ${escapeHtml(workout)}</p>
      ${listItems(PROJECT_LM_WORKOUTS[workout] || [])}
    </details>
  `).join('');

  document.getElementById('nutritionPlan').innerHTML = nutritionPlan ? `
    ${renderNutritionMeals(nutritionPlan)}
    ${renderNutritionEquivalences()}
    <div class='planning-section-block'>
      <h3>Plano B oficial</h3>
      <p class='planning-card-label'>Se o dia sair do controle:</p>
      ${listItems(PROJECT_LM_OFFICIAL_PLAN_B)}
    </div>
    <div class='planning-section-block'>
      <h3>Regras de adesão</h3>
      ${listItems(PROJECT_LM_ADHERENCE_RULES)}
    </div>
  ` : `<p class='muted'>Seu plano alimentar inicial ainda não foi definido. Refaça o acesso ou fale com o suporte.</p>`;
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
