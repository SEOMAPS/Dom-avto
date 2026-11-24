(() => {
  const banner = document.querySelector('[data-cookie-banner]');
  const dialog = document.querySelector('[data-cookie-dialog]');
  if (!banner || !dialog) return;

  const status = dialog.querySelector('[data-cookie-status]');
  const analyticsTemplate = document.querySelector('template[data-yandex-metrika]');
  const key = 'dom-avto-cookie-preference-v3';
  const lifetime = 180 * 24 * 60 * 60 * 1000;
  const labels = new Map([
    ['necessary', 'Принять обязательные'],
    ['all', 'Принять всё'],
    ['rejected', 'Отклонить']
  ]);
  let analyticsStarted = false;

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

  function clearAnalyticsCookies() {
    try {
      const names = document.cookie.split(';').map(item => item.trim().split('=')[0])
        .filter(name => name.startsWith('_ym_'));
      for (const name of names) {
        const expired = name + '=; Max-Age=0; path=/; SameSite=Lax';
        document.cookie = expired;
        document.cookie = expired + '; domain=' + location.hostname;
        document.cookie = expired + '; domain=.' + location.hostname;
      }
    } catch {}
  }

  function startAnalytics() {
    if (analyticsStarted || !analyticsTemplate) return;
    const source = analyticsTemplate.content.querySelector('script');
    if (!source) return;
    analyticsStarted = true;
    const script = document.createElement('script');
    script.id = 'dom-avto-yandex-metrika';
    script.textContent = source.textContent;
    document.head.appendChild(script);
  }

  let preference = readPreference();
  banner.hidden = preference !== null;
  if (preference === 'all') startAnalytics();
  else clearAnalyticsCookies();

  function rememberPreference(choice) {
    preference = choice;
    try {
      localStorage.setItem(key, JSON.stringify({ choice, expiresAt: Date.now() + lifetime }));
      sessionStorage.removeItem(key);
    } catch {
      try {
        sessionStorage.setItem(key, choice);
      } catch {}
    }
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
    if (choice === 'all') startAnalytics();
    else {
      clearAnalyticsCookies();
      if (analyticsStarted) window.location.reload();
    }
  });

  window.addEventListener('storage', (event) => {
    if (event.key !== key && event.key !== null) return;
    preference = readPreference();
    banner.hidden = preference !== null;
    if (preference === 'all') startAnalytics();
    else {
      clearAnalyticsCookies();
      if (analyticsStarted) window.location.reload();
    }
  });
})();
