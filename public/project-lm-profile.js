/* LEGACY - DO NOT EXTEND
   SUPERSEDED BY PROJECT LM V5 */
requireAuth();

if (!isProjectLm()) {
  window.location.href = 'portal.html';
}

const form = document.getElementById('projectLmProfileForm');
const submitButton = document.getElementById('submitProjectLmProfile');
const statusEl = document.getElementById('profileStatus');

function parseDecimalInput(value) {
  const normalized = String(value || '').trim().replace(',', '.');
  return normalized ? Number(normalized) : NaN;
}

function isProjectLmProfileComplete(profile) {
  return Boolean(
    profile?.sex
      && (profile.weightKg || profile.weight_kg)
      && (profile.heightCm || profile.height_cm)
      && (profile.initialPlanCode || profile.nutritionPlanCode || profile.initial_plan_code || profile.nutrition_plan_code)
  );
}

async function redirectIfProfileExists() {
  const profile = await getProjectLmProfile();
  if (isProjectLmProfileComplete(profile)) window.location.href = '/project-lm-v5.html#project-lm/journey';
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  const data = new FormData(form);
  const payload = {
    name: String(data.get('name') || '').trim(),
    objective: String(data.get('objective') || '').trim(),
    sex: String(data.get('sex') || '').trim(),
    weightKg: parseDecimalInput(data.get('weightKg')),
    heightCm: parseDecimalInput(data.get('heightCm'))
  };

  submitButton.disabled = true;
  statusEl.textContent = 'Liberando seu planejamento...';

  try {
    await api('/project-lm/profile', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    statusEl.textContent = 'Planejamento liberado.';
    window.setTimeout(() => {
      window.location.href = '/project-lm-v5.html#project-lm/journey';
    }, 400);
  } catch (error) {
    statusEl.textContent = error.message || 'Não foi possível salvar seus dados agora.';
    submitButton.disabled = false;
  }
});

redirectIfProfileExists().catch(() => {});
