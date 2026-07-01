(() => {
  const STORAGE_KEY = 'rebus:messenger:active-route';
  const VALID_ROUTES = new Set(['account', 'chat', 'contours', 'library', 'contacts', 'settings']);
  const LABELS = {
    account: 'Акаунт',
    chat: 'Чат',
    contours: 'Контур',
    library: 'Бібліотека',
    contacts: 'Контакти',
    settings: 'Налаштування'
  };

  let activeRoute = normalize(localStorage.getItem(STORAGE_KEY)) || 'chat';
  let applying = false;
  let restoreTimer = null;

  function normalize(route) {
    return VALID_ROUTES.has(route) ? route : null;
  }

  function appIsVisible() {
    const shell = document.getElementById('appShell');
    return Boolean(shell && !shell.hidden);
  }

  function currentDomRoute() {
    return document.querySelector('.page-view.is-active[data-page]')?.dataset.page || null;
  }

  function applyRoute(route) {
    const next = normalize(route) || 'chat';
    const previous = currentDomRoute();
    activeRoute = next;
    localStorage.setItem(STORAGE_KEY, next);

    applying = true;
    document.querySelectorAll('[data-page]').forEach(page => {
      const isTarget = page.dataset.page === next;
      page.hidden = !isTarget;
      page.classList.toggle('is-active', isTarget);
    });

    document.querySelectorAll('[data-route]').forEach(button => {
      if (button.dataset.route === 'logout') return;
      button.classList.toggle('is-active', button.dataset.route === next);
    });

    document.title = `${LABELS[next] || 'REBUS'} — REBUS Messenger`;

    if (next === 'contacts') {
      document.dispatchEvent(new CustomEvent('rebus:contacts-visible'));
      window.RebusContacts?.load?.({ force: true });
    }

    document.dispatchEvent(new CustomEvent('rebus:route-change', { detail: { route: next, previous, stable: true } }));
    requestAnimationFrame(() => { applying = false; });
  }

  function scheduleRestore() {
    if (applying || !appIsVisible()) return;
    clearTimeout(restoreTimer);
    restoreTimer = setTimeout(() => {
      if (!appIsVisible()) return;
      const domRoute = currentDomRoute();
      if (domRoute && domRoute !== activeRoute) applyRoute(activeRoute);
    }, 40);
  }

  document.addEventListener('click', event => {
    const routeButton = event.target.closest?.('[data-route]');
    if (!routeButton) return;
    const route = routeButton.dataset.route;
    if (route === 'logout') return;
    if (!normalize(route)) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation?.();
    applyRoute(route);
  }, true);

  document.addEventListener('keydown', event => {
    const routeButton = event.target.closest?.('[data-route]');
    if (!routeButton) return;
    const route = routeButton.dataset.route;
    if (!normalize(route) || !['Enter', ' '].includes(event.key)) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation?.();
    applyRoute(route);
  }, true);

  function init() {
    activeRoute = normalize(localStorage.getItem(STORAGE_KEY)) || currentDomRoute() || 'chat';
    if (appIsVisible()) applyRoute(activeRoute);

    const shell = document.getElementById('appShell');
    if (shell && shell.dataset.routeStabilityObserved !== '1') {
      shell.dataset.routeStabilityObserved = '1';
      new MutationObserver(scheduleRestore).observe(shell, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['hidden', 'class']
      });
    }
  }

  window.RebusRouter = {
    set: applyRoute,
    get: () => activeRoute,
    restore: () => applyRoute(activeRoute)
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
  window.addEventListener('pageshow', () => setTimeout(init, 80));
  setTimeout(init, 500);
})();
