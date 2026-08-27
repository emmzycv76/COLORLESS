/* COLORLESS — unobtrusive save status helper */
(function () {
  const el = document.getElementById('saveStatus');
  if (!el) return;

  let timer;
  window.colorlessSaveStatus = {
    saving() {
      clearTimeout(timer);
      el.textContent = 'Saving…';
      el.className = 'save-status saving';
    },
    saved() {
      clearTimeout(timer);
      el.textContent = '✓ Saved';
      el.className = 'save-status saved';
      timer = setTimeout(() => { el.style.opacity = '.55'; }, 1200);
    }
  };

  el.style.opacity = '.55';
})();