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

async function redirectIfProfileExists() {
  const profile = await getProjectLmProfile();
  if (profile?.sex) window.location.href = 'projeto-lm-jornada.html';
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  const data = new FormData(form);
  const payload = {
    name: String(data.get('name') || '').trim(),
    goal: String(data.get('goal') || '').trim(),
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
      window.location.href = 'projeto-lm-jornada.html';
    }, 400);
  } catch (error) {
    statusEl.textContent = error.message || 'Não foi possível salvar seus dados agora.';
    submitButton.disabled = false;
  }
});

redirectIfProfileExists().catch(() => {});
