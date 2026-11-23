(() => {
  const dialog = document.querySelector('#telegram-dialog');
  if (!dialog || typeof dialog.showModal !== 'function') return;

  let menuOpener = null;
  document.addEventListener('click', (event) => {
    const trigger = event.target.closest('[data-telegram-cta]');
    if (!trigger || event.defaultPrevented || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    if (dialog.open) return;
    menuOpener = trigger.closest('#site-menu') ? document.querySelector('#menu-toggle') : null;
    dialog.showModal();
  });

  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) dialog.close();
  });

  dialog.addEventListener('close', () => {
    menuOpener?.focus({ preventScroll: true });
    menuOpener = null;
  });
})();
