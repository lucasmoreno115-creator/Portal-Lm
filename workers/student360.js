export function buildStudentSummary({ studentAccess, latestAnamnesis, latestCheckin, activeNutritionPlan, email }) {
  return {
    name: studentAccess?.name || latestAnamnesis?.student_name || latestCheckin?.student_name || activeNutritionPlan?.student_name || email,
    email,
    whatsapp: studentAccess?.whatsapp || latestAnamnesis?.student_phone || null,
    plan_type: studentAccess?.plan_type || 'Não cadastrado',
    status: studentAccess?.status || 'Sem acesso criado'
  };
}
