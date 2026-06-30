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

  function exposeSupabaseSingleton() {
    try {
      if (typeof supabaseClient !== 'undefined' && supabaseClient) {
        window.supabaseClient = supabaseClient;
        window.rebusSupabaseClient = supabaseClient;
      }

      if (!window.supabase?.createClient || window.__rebusSupabaseSingletonReady === '1') return;
      const originalCreateClient = window.supabase.createClient.bind(window.supabase);
      window.__rebusSupabaseSingletonReady = '1';

      window.supabase.createClient = function rebusCreateClient(url, key, options) {
        if (window.rebusSupabaseClient || window.supabaseClient) {
          return window.rebusSupabaseClient || window.supabaseClient;
        }
        const client = originalCreateClient(url, key, options);
        window.rebusSupabaseClient = client;
        window.supabaseClient = client;
        return client;
      };
    } catch (error) {
      console.warn('[REBUS] Supabase singleton setup skipped:', error);
    }
  }

  function validRoute(route) {
    return Boolean(route && route !== 'logout' && document.querySelector(`[data-page="${CSS.escape(route)}"]`));
  }

  function getActiveRoute() {
    return document.querySelector('[data-page].is-active')?.dataset.page || null;
  }

  function getPreferredRoute() {
    const saved = sessionStorage.getItem(ROUTE_KEY);
    if (validRoute(saved)) return saved;
    const active = getActiveRoute();
    return validRoute(active) ? active : 'chat';
  }

  function emitRouteReady(route) {
    document.dispatchEvent(new CustomEvent('rebus:route-change', { detail: { route } }));
    if (route === 'contacts') document.dispatchEvent(new CustomEvent('rebus:contacts-visible'));
    if (route === 'settings') document.dispatchEvent(new CustomEvent('rebus:settings-visible'));
  }

  function activateStaticRoute(route) {
    if (!validRoute(route)) return;
    document.querySelectorAll('[data-page]').forEach(page => {
      const isActive = page.dataset.page === route;
      page.hidden = !isActive;
      page.classList.toggle('is-active', isActive);
    });
    document.querySelectorAll('[data-route]').forEach(button => {
      button.classList.toggle('is-active', button.dataset.route === route);
    });
    document.title = `${ROUTE_LABELS[route] || 'REBUS'} — REBUS Messenger`;
    emitRouteReady(route);
  }

  function installRouteController() {
    if (window.__rebusRouteControllerReady === '1') return;
    window.__rebusRouteControllerReady = '1';

    const originalSetRoute = typeof setRoute === 'function' ? setRoute : null;
    const originalSignOut = typeof signOut === 'function' ? signOut : null;

    window.RebusRoute = {
      go(route) {
        if (route === 'logout') {
          sessionStorage.removeItem(ROUTE_KEY);
          if (originalSignOut) originalSignOut();
          return;
        }
        if (!validRoute(route)) route = 'chat';
        sessionStorage.setItem(ROUTE_KEY, route);
        if (route === 'chat' && originalSetRoute) originalSetRoute('chat');
        else activateStaticRoute(route);
      },
      current: getActiveRoute,
      activate: activateStaticRoute
    };

    try {
      setRoute = function rebusSetRoute(route) {
        window.RebusRoute.go(route);
      };
      showApp = function rebusShowApp() {
        const loginPage = document.getElementById('loginPage');
        const mfaPage = document.getElementById('mfaPage');
        const appShell = document.getElementById('appShell');
        if (loginPage) loginPage.hidden = true;
        if (mfaPage) mfaPage.hidden = true;
        if (appShell) appShell.hidden = false;
        window.RebusRoute.go(getPreferredRoute());
      };
    } catch (error) {
      console.warn('[REBUS] Route controller patch skipped:', error);
    }

    document.addEventListener('click', event => {
      const button = event.target.closest('[data-route]');
      const route = button?.dataset?.route;
      if (!route) return;
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation?.();
      window.RebusRoute.go(route);
      document.querySelector('.left-nav')?.classList.add('is-auto-collapsed');
    }, true);

    window.addEventListener('pageshow', () => {
      const saved = sessionStorage.getItem(ROUTE_KEY);
      if (validRoute(saved)) window.setTimeout(() => window.RebusRoute.go(saved), 120);
    });
  }

  exposeSupabaseSingleton();
  installRouteController();
})();
