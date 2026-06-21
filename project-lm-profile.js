requireAuth();

if (!isProjectLm()) {
  window.location.href = 'portal.html';
}

const form = document.getElementById('projectLmProfileForm');
const submitButton = document.getElementById('submitProjectLmProfile');
const statusEl = document.getElementById('profileStatus');

async function redirectIfProfileExists() {
  const profile = await getProjectLmProfile();
  if (profile?.sex) window.location.href = 'projeto-lm-jornada.html';
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  const sex = new FormData(form).get('sex');
  submitButton.disabled = true;
  statusEl.textContent = 'Liberando seu planejamento...';

  try {
    await api('/project-lm/profile', {
      method: 'POST',
      body: JSON.stringify({ sex })
    });
    statusEl.textContent = 'Planejamento liberado.';
    window.setTimeout(() => {
      window.location.href = 'projeto-lm-jornada.html';
    }, 400);
  } catch (error) {
    statusEl.textContent = error.message || 'Não foi possível salvar sua escolha agora.';
    submitButton.disabled = false;
  }
});

redirectIfProfileExists().catch(() => {});
