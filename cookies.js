(() => {
  const banner = document.querySelector('[data-cookie-banner]');
  const dialog = document.querySelector('[data-cookie-dialog]');
  if (!banner || !dialog) return;

  const status = dialog.querySelector('[data-cookie-status]');
  const key = 'dom-avto-cookie-preference-v2';
  const lifetime = 180 * 24 * 60 * 60 * 1000;
  const labels = new Map([
    ['necessary', 'Принять обязательные'],
    ['all', 'Принять'],
    ['rejected', 'Отклонить']
  ]);

  function readPreference() {
    try {
      const preference = JSON.parse(localStorage.getItem(key));
      if (labels.has(preference?.choice) && preference.expiresAt > Date.now()) return preference.choice;
    } catch {}
    try {
      const choice = sessionStorage.getItem(key);
      if (labels.has(choice)) return choice;
    } catch {}
    return null;
  }

  let preference = readPreference();
  banner.hidden = preference !== null;

  const map = document.getElementById('meeting-map-frame');
  const showMap = document.querySelector('[data-show-map]');
  function displayMap(visible) {
    if (!map || !showMap) return;
    if (visible && !map.hasAttribute('src')) map.src = map.dataset.src;
    if (!visible) map.removeAttribute('src');
    map.hidden = !visible;
    showMap.hidden = visible;
  }

  showMap?.addEventListener('click', (event) => {
    if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    displayMap(true);
    map.focus();
  });
  displayMap(preference === 'all');

  function rememberPreference(choice) {
    preference = choice;
    displayMap(choice === 'all');
    try {
      localStorage.setItem(key, JSON.stringify({ choice, expiresAt: Date.now() + lifetime }));
    } catch {
      try {
        sessionStorage.setItem(key, choice);
      } catch {}
      banner.hidden = true;
      return;
    }
    try {
      sessionStorage.removeItem(key);
    } catch {}
    banner.hidden = true;
  }

  document.addEventListener('click', (event) => {
    const trigger = event.target.closest('[data-cookie-open], [data-cookie-choice], [data-cookie-policy-link]');
    if (!trigger || event.defaultPrevented || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

    if (trigger.hasAttribute('data-cookie-policy-link')) {
      if (dialog.open) dialog.close();
      return;
    }

    if (trigger.hasAttribute('data-cookie-open')) {
      if (typeof dialog.showModal !== 'function') return;
      event.preventDefault();
      status.textContent = preference ? 'Текущий выбор — «' + labels.get(preference) + '».' : 'Вы ещё не выбрали настройки.';
      if (!dialog.open) dialog.showModal();
      return;
    }

    const choice = trigger.dataset.cookieChoice;
    if (!labels.has(choice)) return;
    rememberPreference(choice);
    if (dialog.open) dialog.close();
  });
})();
