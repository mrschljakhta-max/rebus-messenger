(() => {
  const MESSAGE_SELECTOR = '#messagesList .message[data-message-id]';
  const STYLE_ID = 'rebus-forced-message-arrow-style';
  const ONLINE_FAVICON = 'assets/icons/rebus-online.svg?v=0.8.3';
  const OFFLINE_FAVICON = 'assets/icons/rebus-offline.svg?v=0.8.3';
  let faviconSignedIn = false;

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
        if (window.rebusSupabaseClient || window.supabaseClient) return window.rebusSupabaseClient || window.supabaseClient;
        const client = originalCreateClient(url, key, options);
        window.rebusSupabaseClient = client;
        window.supabaseClient = client;
        return client;
      };
    } catch {}
  }

  function loadAsset(tag, id, attrs) {
    if (document.getElementById(id)) return;
    const node = document.createElement(tag);
    node.id = id;
    Object.entries(attrs).forEach(([key, value]) => node.setAttribute(key, value));
    (tag === 'script' ? document.body : document.head).appendChild(node);
  }

  function ensureFeatureAssets() {
    loadAsset('link', 'rebus-nav-auto-collapse-style', { rel: 'stylesheet', href: 'css/nav-auto-collapse.css?v=0.9.5' });
    loadAsset('link', 'rebus-nav-active-icon-style', { rel: 'stylesheet', href: 'css/nav-active-icon.css?v=0.9.7' });
    loadAsset('script', 'rebus-nav-auto-collapse-script', { src: 'js/nav-auto-collapse.js?v=0.9.5', defer: 'defer' });
    loadAsset('script', 'rebus-nav-icon-swap-script', { src: 'js/nav-icon-swap.js?v=0.9.7', defer: 'defer' });
    loadAsset('link', 'rebus-chat-calendar-style', { rel: 'stylesheet', href: 'css/chat-calendar.css?v=0.8.8' });
    loadAsset('script', 'rebus-chat-calendar-script', { src: 'js/chat-calendar.js?v=0.8.8', defer: 'defer' });
    loadAsset('script', 'rebus-reaction-single-limit-script', { src: 'js/reaction-single-limit.js?v=1.0.0', defer: 'defer' });
    loadAsset('script', 'rebus-context-menu-rescue-script', { src: 'js/context-menu-rescue.js?v=1.0.0', defer: 'defer' });
    loadAsset('script', 'rebus-final-message-context-menu-script', { src: 'js/message-context-menu-final.js?v=1.0.0', defer: 'defer' });
    loadAsset('link', 'rebus-peer-sidebar-style', { rel: 'stylesheet', href: 'css/chat-peer-sidebar.css?v=0.8.5' });
    loadAsset('script', 'rebus-peer-sidebar-script', { src: 'js/chat-peer-sidebar.js?v=0.8.5', defer: 'defer' });
  }

  function setFavicon(online) {
    let link = document.querySelector('link[rel="icon"]') || document.querySelector('link[rel*="icon"]');
    if (!link) { link = document.createElement('link'); link.rel = 'icon'; document.head.appendChild(link); }
    link.type = 'image/svg+xml';
    link.href = online ? ONLINE_FAVICON : OFFLINE_FAVICON;
  }

  function getAvatarUrl(user) {
    const meta = user?.user_metadata || {};
    return meta.avatar_url || meta.picture || meta.photo_url || meta.avatar || '';
  }

  function safeCssUrl(value = '') { return String(value).replaceAll('"', '%22').replaceAll('\\', '%5C'); }

  function setAccountStatusLogo(online) {
    const logo = document.querySelector('.account-card .account-logo');
    if (!logo) return;
    logo.classList.remove('has-user-avatar');
    logo.classList.add('is-status-logo');
    logo.textContent = '';
    logo.style.backgroundImage = `url("${online ? ONLINE_FAVICON : OFFLINE_FAVICON}")`;
    logo.style.backgroundSize = 'cover';
    logo.style.backgroundPosition = 'center';
    logo.style.backgroundRepeat = 'no-repeat';
  }

  function setSelfCardAvatar(user) {
    const avatar = document.querySelector('#directSelfCard .direct-self-avatar');
    if (!avatar) return;
    const avatarUrl = getAvatarUrl(user);
    if (avatarUrl) {
      avatar.classList.add('has-user-avatar');
      avatar.textContent = '';
      avatar.style.backgroundImage = `url("${safeCssUrl(avatarUrl)}")`;
      avatar.style.backgroundSize = 'cover';
      avatar.style.backgroundPosition = 'center';
      avatar.style.backgroundRepeat = 'no-repeat';
      return;
    }
    avatar.classList.remove('has-user-avatar');
    avatar.style.backgroundImage = '';
    avatar.style.backgroundSize = '';
    avatar.style.backgroundPosition = '';
    avatar.style.backgroundRepeat = '';
    avatar.textContent = 'R';
  }

  async function refreshFaviconAndAvatar() {
    try {
      const client = window.supabaseClient || (typeof supabaseClient !== 'undefined' ? supabaseClient : null);
      if (!client?.auth?.getSession) {
        faviconSignedIn = false; setFavicon(false); setAccountStatusLogo(false); setSelfCardAvatar(null); return;
      }
      const { data } = await client.auth.getSession();
      const user = data?.session?.user || null;
      faviconSignedIn = Boolean(user);
      const online = faviconSignedIn && navigator.onLine !== false;
      setFavicon(online); setAccountStatusLogo(online); setSelfCardAvatar(user);
    } catch {
      faviconSignedIn = false; setFavicon(false); setAccountStatusLogo(false); setSelfCardAvatar(null);
    }
  }

  function bindFaviconAuth() {
    try {
      const client = window.supabaseClient || (typeof supabaseClient !== 'undefined' ? supabaseClient : null);
      if (!client?.auth?.onAuthStateChange || window.__rebusFaviconBound === '1') return;
      window.__rebusFaviconBound = '1';
      client.auth.onAuthStateChange((event, session) => {
        if (event === 'SIGNED_OUT') { faviconSignedIn = false; setFavicon(false); setAccountStatusLogo(false); setSelfCardAvatar(null); return; }
        if (session?.user || event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
          faviconSignedIn = Boolean(session?.user || faviconSignedIn);
          const online = faviconSignedIn && navigator.onLine !== false;
          setFavicon(online); setAccountStatusLogo(online); setSelfCardAvatar(session?.user || null);
        }
      });
    } catch {}
  }

  function ensureStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      .account-card .account-logo.is-status-logo { overflow: hidden !important; color: transparent !important; background-color: rgba(255,255,255,.05) !important; box-shadow: 0 0 24px rgba(255,36,56,.22) !important; }
      #directSelfCard .direct-self-avatar.has-user-avatar { color: transparent !important; overflow: hidden !important; background-color: rgba(255,255,255,.08) !important; box-shadow: 0 0 24px rgba(0,216,255,.16), 0 0 24px rgba(255,36,56,.16) !important; }
      #page-chat .message[data-message-id] { position: relative !important; min-width: 84px !important; }
      #page-chat .message[data-message-id].incoming { padding-right: 30px !important; }
      #page-chat .message[data-message-id].outgoing { padding-left: 30px !important; }
      #page-chat .message-corner-menu { position: absolute !important; top: 8px !important; z-index: 40 !important; width: 16px !important; height: 16px !important; min-width: 16px !important; padding: 0 !important; border: 0 !important; border-radius: 0 !important; background: transparent !important; box-shadow: none !important; outline: 0 !important; opacity: 0 !important; pointer-events: none !important; cursor: pointer !important; font-size: 0 !important; line-height: 0 !important; color: rgba(244,251,255,.76) !important; }
      #page-chat .message.incoming .message-corner-menu { right: 9px !important; }
      #page-chat .message.outgoing .message-corner-menu { left: 9px !important; }
      #page-chat .message-corner-menu::before { content: ""; position: absolute; inset: 1px; background: currentColor; clip-path: polygon(12% 28%, 50% 66%, 88% 28%, 100% 40%, 50% 90%, 0 40%); }
      #page-chat .message:hover .message-corner-menu, #page-chat .message.has-menu-open .message-corner-menu, #page-chat .message.has-side-hover .message-corner-menu { opacity: .9 !important; pointer-events: auto !important; }
      #page-chat .message-corner-menu:hover { color: #fff !important; }
    `;
    document.head.appendChild(style);
  }

  function openMenu(message) {
    if (!message) return;
    if (window.RebusFinalMessageMenu?.open) { window.RebusFinalMessageMenu.open(message); return; }
    if (window.RebusContextMenuRescue?.open) { window.RebusContextMenuRescue.open(message); return; }
    if (typeof openMessageContextMenu === 'function') { openMessageContextMenu(message.dataset.messageId, message); return; }
    message.querySelector('.message-menu-toggle')?.click();
  }

  function ensureButtons(scope = document) {
    scope.querySelectorAll?.(MESSAGE_SELECTOR)?.forEach(message => {
      if (message.querySelector('.message-corner-menu')) return;
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'message-corner-menu';
      button.setAttribute('aria-label', 'Дії повідомлення');
      button.addEventListener('click', event => { event.preventDefault(); event.stopPropagation(); openMenu(message); }, true);
      message.appendChild(button);
    });
  }

  function init() {
    exposeSupabaseSingleton();
    ensureFeatureAssets();
    bindFaviconAuth();
    refreshFaviconAndAvatar();
    ensureStyle();
    ensureButtons(document);
    const list = document.getElementById('messagesList');
    if (!list || list.dataset.arrowForceReady === '1') return;
    list.dataset.arrowForceReady = '1';
    new MutationObserver(mutations => {
      mutations.forEach(mutation => mutation.addedNodes.forEach(node => { if (node instanceof HTMLElement) ensureButtons(node); }));
      ensureButtons(document);
    }).observe(list, { childList: true, subtree: true });
  }

  exposeSupabaseSingleton();
  setFavicon(false);
  setAccountStatusLogo(false);
  window.addEventListener('online', () => { const online = faviconSignedIn; setFavicon(online); setAccountStatusLogo(online); });
  window.addEventListener('offline', () => { setFavicon(false); setAccountStatusLogo(false); });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true }); else init();
  window.setTimeout(init, 300);
  window.setTimeout(init, 900);
  window.setTimeout(init, 1800);
})();