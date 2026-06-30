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

  const originalSetRoute = typeof setRoute === 'function' ? setRoute : null;
  const originalSignOut = typeof signOut === 'function' ? signOut : null;

  let activeRouteLock = null;
  let routeLockUntil = 0;
  let routeGuardTimer = null;

  function validRoute(route) {
    return !!route && route !== 'logout' && !!document.querySelector(`[data-page="${CSS.escape(route)}"]`);
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
    if (route === 'settings') setTimeout(loadProfile, 60);
    if (route === 'contacts') document.dispatchEvent(new CustomEvent('rebus:contacts-visible'));
  }

  function activateStaticRoute(route) {
    if (!validRoute(route)) return;

    document.querySelectorAll('[data-page]').forEach(page => {
      const active = page.dataset.page === route;
      page.hidden = !active;
      page.classList.toggle('is-active', active);
    });

    document.querySelectorAll('[data-route]').forEach(button => {
      button.classList.toggle('is-active', button.dataset.route === route);
    });

    document.title = `${ROUTE_LABELS[route] || 'REBUS'} — REBUS Messenger`;
    emitRouteReady(route);
  }

  function setRouteLock(route, duration = 2600) {
    activeRouteLock = validRoute(route) ? route : null;
    routeLockUntil = activeRouteLock ? Date.now() + duration : 0;
    if (!activeRouteLock) return;

    clearInterval(routeGuardTimer);
    routeGuardTimer = setInterval(() => {
      if (!activeRouteLock || Date.now() > routeLockUntil) {
        clearInterval(routeGuardTimer);
        routeGuardTimer = null;
        activeRouteLock = null;
        return;
      }
      if (getActiveRoute() !== activeRouteLock) activateStaticRoute(activeRouteLock);
    }, 80);
  }

  function navigate(route, options = {}) {
    if (route === 'logout') {
      sessionStorage.removeItem(ROUTE_KEY);
      if (originalSignOut) originalSignOut();
      return;
    }

    if (!validRoute(route)) route = 'chat';
    sessionStorage.setItem(ROUTE_KEY, route);

    if (route === 'chat' && originalSetRoute) originalSetRoute('chat');
    else activateStaticRoute(route);

    if (!options.noLock) setRouteLock(route, options.lockDuration || 2600);
  }

  function installRoutePatch() {
    try {
      setRoute = function patchedSetRoute(route) {
        navigate(route, { lockDuration: 1800 });
      };
      showApp = function patchedShowApp() {
        const loginPage = document.getElementById('loginPage');
        const mfaPage = document.getElementById('mfaPage');
        const appShell = document.getElementById('appShell');
        if (loginPage) loginPage.hidden = true;
        if (mfaPage) mfaPage.hidden = true;
        if (appShell) appShell.hidden = false;
        navigate(getPreferredRoute(), { lockDuration: 1800 });
      };
    } catch (error) {
      console.warn('[REBUS] Route patch failed:', error);
    }
  }

  document.addEventListener('click', event => {
    const button = event.target.closest('[data-route]');
    const route = button?.dataset?.route;
    if (!route) return;

    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation?.();
    navigate(route, { lockDuration: 2800 });
  }, true);

  window.addEventListener('pageshow', () => {
    const saved = sessionStorage.getItem(ROUTE_KEY);
    if (validRoute(saved)) setTimeout(() => navigate(saved, { lockDuration: 900 }), 250);
  });

  const SUPABASE_URL = 'https://aehedmvxpqxsmzxemkix.supabase.co';
  const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_8cJ1jnSyGOoAG8MOEXZtCA_cY72YAnh';
  const SETTINGS_KEY = 'rebus:messenger:settings';

  const defaultSettings = {
    presence: 'online',
    scale: '100',
    animations: true,
    messageSound: true,
    pushNotifications: true,
    popups: true
  };

  const qs = (selector, root = document) => root.querySelector(selector);

  function loadSettings() {
    try { return { ...defaultSettings, ...JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}') }; }
    catch { return { ...defaultSettings }; }
  }

  function saveSettings(settings) {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  }

  function initials(name = '') {
    const clean = String(name || '').trim();
    if (!clean) return 'R';
    return clean.split(/\s+/).slice(0, 2).map(part => part[0]).join('').toUpperCase();
  }

  function toast(text) {
    const old = qs('.settings-toast');
    old?.remove();
    const el = document.createElement('div');
    el.className = 'settings-toast';
    el.textContent = text;
    Object.assign(el.style, {
      position: 'fixed', right: '24px', bottom: '24px', zIndex: '17000', padding: '12px 16px', borderRadius: '16px',
      color: '#fff', background: 'rgba(5,12,22,.96)', border: '1px solid rgba(255,255,255,.1)',
      boxShadow: '0 18px 44px rgba(0,0,0,.36)', fontWeight: '850'
    });
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 2400);
  }

  function applySettings(settings) {
    document.documentElement.style.setProperty('--rebus-ui-scale', `${settings.scale}%`);
    document.body.classList.toggle('rebus-reduce-motion', !settings.animations);
    const pill = qs('#settingsPresencePill');
    if (pill) pill.textContent = settings.presence === 'online' ? '🟢 Онлайн' : settings.presence === 'dnd' ? '🟡 Не турбувати' : settings.presence === 'busy' ? '🔴 Зайнятий' : '⚪ Не в мережі';
  }

  async function loadProfile() {
    if (!window.supabase?.createClient) return;
    const client = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } });
    const userResult = await client.auth.getUser();
    const user = userResult?.data?.user;
    if (!user) return;

    let profile = null;
    try {
      const result = await client.from('rebus_profiles').select('id,user_id,email,full_name,role').eq('user_id', user.id).maybeSingle();
      profile = result?.data || null;
    } catch {}

    const name = profile?.full_name || user.user_metadata?.full_name || user.email?.split('@')[0] || 'Користувач REBUS';
    const email = profile?.email || user.email || 'account@rebus';
    const role = profile?.role || 'USER';
    const avatar = qs('#settingsAvatar');
    const nameNode = qs('#settingsName');
    const emailNode = qs('#settingsEmail');
    const roleNode = qs('#settingsRole');
    if (avatar) avatar.textContent = initials(name);
    if (nameNode) nameNode.textContent = name;
    if (emailNode) emailNode.textContent = email;
    if (roleNode) roleNode.textContent = role;
  }

  function bindSettings() {
    const root = qs('#page-settings');
    if (!root || root.dataset.settingsReady === '1') return;
    root.dataset.settingsReady = '1';

    const settings = loadSettings();
    const presence = qs('#settingsPresence');
    const scale = qs('#settingsScale');
    const animations = qs('#settingsAnimations');
    const messageSound = qs('#settingsMessageSound');
    const push = qs('#settingsPush');
    const popups = qs('#settingsPopups');

    if (presence) presence.value = settings.presence;
    if (scale) scale.value = settings.scale;
    if (animations) animations.checked = settings.animations;
    if (messageSound) messageSound.checked = settings.messageSound;
    if (push) push.checked = settings.pushNotifications;
    if (popups) popups.checked = settings.popups;
    applySettings(settings);

    root.addEventListener('change', () => {
      const next = {
        presence: presence?.value || 'online',
        scale: scale?.value || '100',
        animations: !!animations?.checked,
        messageSound: !!messageSound?.checked,
        pushNotifications: !!push?.checked,
        popups: !!popups?.checked
      };
      saveSettings(next);
      applySettings(next);
      toast('Налаштування збережено локально.');
    });

    root.addEventListener('click', event => {
      const action = event.target.closest('[data-settings-action]')?.dataset.settingsAction;
      if (!action) return;
      if (action === 'password') toast('Зміну пароля підключимо через Supabase Auth.');
      if (action === '2fa') toast('2FA вже використовується при вході. Панель керування додамо окремо.');
      if (action === 'sessions') toast('Активні сесії підключимо через security-модуль.');
      if (action === 'clear-cache') {
        localStorage.removeItem(SETTINGS_KEY);
        toast('Локальні налаштування очищено.');
        setTimeout(() => location.reload(), 700);
      }
    });
  }

  function init() {
    installRoutePatch();
    bindSettings();
    if (qs('#page-settings.is-active')) loadProfile();
  }

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible') return;
    const saved = sessionStorage.getItem(ROUTE_KEY);
    if (validRoute(saved)) setTimeout(() => navigate(saved, { lockDuration: 900 }), 120);
  });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
