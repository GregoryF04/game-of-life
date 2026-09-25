(() => {
  const buttons = document.querySelectorAll('[data-fullscreen-target]');
  if (!buttons.length) return;

  function updateLabels() {
    buttons.forEach(button => {
      const active = document.fullscreenElement;
      button.textContent = active ? 'Exit fullscreen' : 'Fullscreen';
      button.setAttribute('aria-pressed', String(Boolean(active)));
    });
  }

  buttons.forEach(button => button.addEventListener('click', async () => {
    const target = document.querySelector(button.dataset.fullscreenTarget);
    if (!target) return;
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await target.requestFullscreen();
    } catch (error) {
      console.error('Fullscreen unavailable:', error);
    }
    updateLabels();
  }));

  document.addEventListener('fullscreenchange', updateLabels);
  updateLabels();
})();
