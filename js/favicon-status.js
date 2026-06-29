(() => {
  const ONLINE_ICON = 'assets/icons/rebus-online.svg?v=0.8.3';
  const OFFLINE_ICON = 'assets/icons/rebus-offline.svg?v=0.8.3';
  let isSignedIn = false;

  function ensureIconLink() {
    let link = document.querySelector('link[rel="icon"]') || document.querySelector('link[rel*="icon"]');
    if (!link) {
      link = document.createElement('link');
      link.rel = 'icon';
      document.head.appendChild(link);
    }
    link.type = 'image/svg+xml';
    return link;
  }

  function setFavicon(online) {
    const link = ensureIconLink();
    const href = online ? ONLINE_ICON : OFFLINE_ICON;
    if (!link.href.endsWith(href)) link.href = href;
  }

  async function detectSession() {
    try {
      const client = window.supabaseClient || (typeof supabaseClient !== 'undefined' ? supabaseClient : null);
      if (!client?.auth?.getSession) {
        setFavicon(false);
        return;
      }
      const { data } = await client.auth.getSession();
      isSignedIn = Boolean(data?.session?.user);
      setFavicon(isSignedIn && navigator.onLine !== false);
    } catch {
      setFavicon(false);
    }
  }

  function bindAuthState() {
    try {
      const client = window.supabaseClient || (typeof supabaseClient !== 'undefined' ? supabaseClient : null);
      if (!client?.auth?.onAuthStateChange || window.__rebusFaviconAuthBound === '1') return;
      window.__rebusFaviconAuthBound = '1';
      client.auth.onAuthStateChange((event, session) => {
        if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED' || session?.user) {
          isSignedIn = Boolean(session?.user || isSignedIn);
          setFavicon(isSignedIn && navigator.onLine !== false);
        }
        if (event === 'SIGNED_OUT') {
          isSignedIn = false;
          setFavicon(false);
        }
      });
    } catch {}
  }

  function refreshConnectionState() {
    setFavicon(isSignedIn && navigator.onLine !== false);
  }

  setFavicon(false);
  window.addEventListener('online', refreshConnectionState);
  window.addEventListener('offline', refreshConnectionState);

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      bindAuthState();
      detectSession();
    }, { once: true });
  } else {
    bindAuthState();
    detectSession();
  }

  window.setTimeout(() => {
    bindAuthState();
    detectSession();
  }, 700);
})();
