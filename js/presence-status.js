(() => {
  const CHANNEL_NAME = 'rebus-online-users';
  const ONLINE_TEXT = 'Онлайн';
  const OFFLINE_TEXT = 'Не в мережі';
  const onlineIds = new Set();
  const lastSeen = new Map();
  let channel = null;
  let currentUserId = null;
  let started = false;

  function client() {
    return window.rebusSupabaseClient || window.supabaseClient || (typeof supabaseClient !== 'undefined' ? supabaseClient : null);
  }

  function setText(node, online) {
    if (!node) return;
    const icon = node.querySelector('i');
    node.textContent = '';
    if (icon) node.appendChild(icon);
    else {
      const i = document.createElement('i');
      node.appendChild(i);
    }
    node.appendChild(document.createTextNode(online ? ONLINE_TEXT : OFFLINE_TEXT));
    node.classList.toggle('is-online', online);
    node.classList.toggle('is-offline', !online);
  }

  function updateDirectUsers() {
    document.querySelectorAll('.direct-user[data-user-id]').forEach(card => {
      const id = card.dataset.userId;
      const online = onlineIds.has(id);
      card.classList.toggle('is-presence-online', online);
      card.classList.toggle('is-presence-offline', !online);
      setText(card.querySelector('.direct-user-presence'), online);
      card.dataset.presence = online ? 'online' : 'offline';
    });
  }

  function updateChatHead() {
    const selected = document.querySelector('.direct-user.is-selected[data-user-id]');
    const node = document.querySelector('#directChatHead .peer-online');
    if (!node) return;
    const id = selected?.dataset?.userId;
    const online = Boolean(id && onlineIds.has(id));
    setText(node, online);
  }

  function updateContacts() {
    document.querySelectorAll('[data-contact-id], .contact-row-card').forEach(card => {
      const id = card.dataset.contactId || card.dataset.userId;
      if (!id) return;
      const online = onlineIds.has(id);
      card.classList.toggle('is-presence-online', online);
      card.classList.toggle('is-presence-offline', !online);
      setText(card.querySelector('.contact-presence, .contact-status'), online);
      card.dataset.presence = online ? 'online' : 'offline';
    });
  }

  function updateSelf() {
    const self = document.getElementById('directSelfCard');
    if (!self) return;
    const online = Boolean(currentUserId && onlineIds.has(currentUserId));
    self.classList.toggle('is-presence-online', online);
    const em = self.querySelector('.direct-self-main em');
    if (em) em.textContent = online ? ONLINE_TEXT : OFFLINE_TEXT;
  }

  function refreshDom() {
    updateDirectUsers();
    updateChatHead();
    updateContacts();
    updateSelf();
    document.dispatchEvent(new CustomEvent('rebus:presence-updated', { detail: { onlineIds: Array.from(onlineIds) } }));
  }

  function readPresenceState() {
    if (!channel?.presenceState) return;
    onlineIds.clear();
    const state = channel.presenceState();
    Object.entries(state || {}).forEach(([key, entries]) => {
      if (key) onlineIds.add(key);
      (entries || []).forEach(entry => {
        const id = entry.user_id || entry.id || key;
        if (id) onlineIds.add(id);
        if (id && entry.online_at) lastSeen.set(id, entry.online_at);
      });
    });
    refreshDom();
  }

  async function startPresence() {
    if (started) return;
    const supa = client();
    if (!supa?.auth?.getUser || !supa?.channel) return;

    const { data } = await supa.auth.getUser();
    const user = data?.user;
    if (!user?.id) return;

    started = true;
    currentUserId = user.id;

    try {
      if (channel?.unsubscribe) await channel.unsubscribe();
    } catch {}

    channel = supa.channel(CHANNEL_NAME, {
      config: { presence: { key: user.id } }
    });

    channel
      .on('presence', { event: 'sync' }, readPresenceState)
      .on('presence', { event: 'join' }, readPresenceState)
      .on('presence', { event: 'leave' }, readPresenceState)
      .subscribe(async status => {
        if (status !== 'SUBSCRIBED') return;
        await channel.track({
          user_id: user.id,
          email: user.email || '',
          name: user.user_metadata?.full_name || user.email || 'REBUS',
          online_at: new Date().toISOString(),
          tab_id: `${Date.now()}-${Math.random().toString(16).slice(2)}`
        });
        readPresenceState();
      });
  }

  function stopPresence() {
    try { channel?.untrack?.(); } catch {}
    try { channel?.unsubscribe?.(); } catch {}
    channel = null;
    started = false;
    onlineIds.clear();
    refreshDom();
  }

  function observeDom() {
    const root = document.getElementById('appShell') || document.body;
    if (!root || root.dataset.presenceObserved === '1') return;
    root.dataset.presenceObserved = '1';
    new MutationObserver(() => {
      clearTimeout(window.__rebusPresenceDomTimer);
      window.__rebusPresenceDomTimer = setTimeout(refreshDom, 80);
    }).observe(root, { childList: true, subtree: true });
  }

  function bindAuth() {
    const supa = client();
    if (!supa?.auth?.onAuthStateChange || window.__rebusPresenceAuthBound === '1') return;
    window.__rebusPresenceAuthBound = '1';
    supa.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') stopPresence();
      if (session?.user && (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED' || event === 'INITIAL_SESSION')) {
        startPresence();
      }
    });
  }

  function init() {
    observeDom();
    bindAuth();
    startPresence();
    refreshDom();
  }

  window.RebusPresence = {
    onlineIds,
    isOnline: id => onlineIds.has(id),
    refresh: refreshDom,
    start: startPresence,
    stop: stopPresence
  };

  document.addEventListener('rebus:route-change', () => setTimeout(refreshDom, 80));
  document.addEventListener('rebus:contacts-visible', () => setTimeout(refreshDom, 80));
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') startPresence();
  });
  window.addEventListener('beforeunload', () => {
    try { channel?.untrack?.(); } catch {}
  });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
  setTimeout(init, 700);
  setTimeout(init, 1800);
})();
