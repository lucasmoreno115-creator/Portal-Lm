(function initializeProjectLm2NutritionData(global) {
  const nutritionPlans = Object.freeze({
    M1: {
      title: 'Plano M1',
      meals: {
        'Café da manhã': ['2 ovos', '1 pão francês', '1 fruta'],
        'Lanche da manhã': ['Opção líquida: 170g iogurte proteico', 'Opção sólida: 1 fruta'],
        'Almoço': ['100g arroz cozido', '100g feijão', '100g proteína', 'Salada à vontade'],
        'Lanche da tarde': ['Opção líquida: 170g iogurte proteico', 'Opção sólida: 1 fruta'],
        'Jantar': ['100g arroz cozido', '100g feijão', '100g proteína', 'Salada à vontade']
      }
    },
    M2: {
      title: 'Plano M2',
      meals: {
        'Café da manhã': ['2 ovos', '1 pão francês', '1 fruta'],
        'Lanche da manhã': ['Opção líquida: 170g iogurte proteico', 'Opção sólida: 1 fruta'],
        'Almoço': ['120g arroz cozido', '100g feijão', '120g proteína', 'Salada à vontade'],
        'Lanche da tarde': ['Opção líquida: 170g iogurte proteico', 'Opção sólida: 1 fruta'],
        'Jantar': ['120g arroz cozido', '100g feijão', '120g proteína', 'Salada à vontade']
      }
    },
    M3: {
      title: 'Plano M3',
      meals: {
        'Café da manhã': ['3 ovos', '1 pão francês', '1 fruta'],
        'Lanche da manhã': ['Opção líquida: 170g iogurte proteico', 'Opção sólida: 1 fruta'],
        'Almoço': ['150g arroz cozido', '100g feijão', '130g proteína', 'Salada à vontade'],
        'Lanche da tarde': ['Opção líquida: 170g iogurte proteico', 'Opção sólida: 1 fruta'],
        'Jantar': ['150g arroz cozido', '100g feijão', '130g proteína', 'Salada à vontade']
      }
    },
    H1: {
      title: 'Plano H1',
      meals: {
        'Café da manhã': ['3 ovos', '1 pão francês', '1 fruta'],
        'Lanche da manhã': ['Opção líquida: 170g iogurte proteico', 'Opção sólida: 1 fruta'],
        'Almoço': ['150g arroz cozido', '100g feijão', '130g proteína', 'Salada à vontade'],
        'Lanche da tarde': ['Opção líquida: 170g iogurte proteico', 'Opção sólida: 1 fruta'],
        'Jantar': ['150g arroz cozido', '100g feijão', '130g proteína', 'Salada à vontade']
      }
    },
    H2: {
      title: 'Plano H2',
      meals: {
        'Café da manhã': ['3 ovos', '1 pão francês', '1 fruta'],
        'Lanche da manhã': ['Opção líquida: 170g iogurte proteico', 'Opção sólida: 1 fruta'],
        'Almoço': ['180g arroz cozido', '100g feijão', '150g proteína', 'Salada à vontade'],
        'Lanche da tarde': ['Opção líquida: 170g iogurte proteico', 'Opção sólida: 1 fruta'],
        'Jantar': ['180g arroz cozido', '100g feijão', '150g proteína', 'Salada à vontade']
      }
    },
    H3: {
      title: 'Plano H3',
      meals: {
        'Café da manhã': ['4 ovos', '1 pão francês', '1 fruta'],
        'Lanche da manhã': ['Opção líquida: 170g iogurte proteico', 'Opção sólida: 1 fruta'],
        'Almoço': ['220g arroz cozido', '100g feijão', '180g proteína', 'Salada à vontade'],
        'Lanche da tarde': ['Opção líquida: 170g iogurte proteico', 'Opção sólida: 1 fruta'],
        'Jantar': ['220g arroz cozido', '100g feijão', '180g proteína', 'Salada à vontade']
      }
    }
  });

  const nutritionEquivalenceGroups = Object.freeze({
    Proteínas: ['100g peito de frango', '100g patinho', '100g coxão mole', '120g peixe', '1 lata de atum', '3 ovos inteiros'],
    Carboidratos: ['100g arroz cozido', '180g batata inglesa cozida', '130g batata-doce cozida', '100g macarrão cozido', '90g mandioca cozida', '80g cuscuz pronto', '2 fatias pão integral', '1 pão francês'],
    Frutas: ['1 banana', '1 maçã', '1 pera', '1 laranja', '150g mamão', '150g melão', '200g melancia', '120g manga']
  });

  const nutritionMealIcons = Object.freeze({
    'Café da manhã': '☀️',
    'Lanche da manhã': '🍎',
    Almoço: '🍛',
    'Lanche da tarde': '🍎',
    Jantar: '🌙'
  });

  const nutritionPlanNotes = Object.freeze(['Não tente ser perfeito.', 'Não espere segunda-feira para recomeçar.', 'O objetivo é continuar.']);

  global.ProjectLm2NutritionData = Object.freeze({
    nutritionPlans,
    nutritionEquivalenceGroups,
    nutritionMealIcons,
    nutritionPlanNotes
  });
})(window);
