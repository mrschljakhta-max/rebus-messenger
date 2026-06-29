(() => {
  const ROUTE_KEY = 'rebus:messenger:last-route';
  const ROUTE_LABELS = {
    account: 'Акаунт',
    chat: 'Чат',
    contours: 'Контур',
    library: 'Бібліотека',
    contacts: 'Контакти',
    settings: 'Налаштування'
  };

  function isValidRoute(route) {
    return !!route && route !== 'logout' && !!document.querySelector(`[data-page="${CSS.escape(route)}"]`);
  }

  function activateRoute(route) {
    if (!isValidRoute(route)) return;

    document.querySelectorAll('[data-page]').forEach(page => {
      const active = page.dataset.page === route;
      page.hidden = !active;
      page.classList.toggle('is-active', active);
    });

    document.querySelectorAll('[data-route]').forEach(button => {
      button.classList.toggle('is-active', button.dataset.route === route);
    });

    document.title = `${ROUTE_LABELS[route] || 'REBUS'} — REBUS Messenger`;

    if (route === 'settings') {
      document.dispatchEvent(new CustomEvent('rebus:route-settings'));
    }
    if (route === 'contacts') {
      document.dispatchEvent(new CustomEvent('rebus:route-contacts'));
    }
  }

  function enforceRoute(route, duration = 1800) {
    if (!isValidRoute(route)) return;
    const start = Date.now();
    activateRoute(route);
    const timer = window.setInterval(() => {
      const active = document.querySelector('[data-page].is-active')?.dataset.page;
      if (active !== route) activateRoute(route);
      if (Date.now() - start > duration) window.clearInterval(timer);
    }, 120);
  }

  document.addEventListener('click', event => {
    const button = event.target.closest('[data-route]');
    const route = button?.dataset?.route;
    if (!isValidRoute(route)) return;
    sessionStorage.setItem(ROUTE_KEY, route);
    window.setTimeout(() => enforceRoute(route), 0);
    window.setTimeout(() => enforceRoute(route, 1200), 260);
  }, true);

  window.addEventListener('pageshow', () => {
    const saved = sessionStorage.getItem(ROUTE_KEY);
    if (isValidRoute(saved)) window.setTimeout(() => enforceRoute(saved, 900), 260);
  });

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible') return;
    const saved = sessionStorage.getItem(ROUTE_KEY);
    if (isValidRoute(saved)) window.setTimeout(() => enforceRoute(saved, 900), 120);
  });
})();
