(() => {
  const STATUS = {
    online: { label: 'Онлайн', className: 'online' },
    dnd: { label: 'Не турбувати', className: 'dnd' },
    busy: { label: 'Не в мережі', className: 'offline' },
    offline: { label: 'Не в мережі', className: 'offline' }
  };

  function getOnlineIds() {
    return window.RebusPresence?.onlineIds || new Set();
  }

  function statusFromCard(card) {
    const id = card?.dataset?.userId;
    if (id && getOnlineIds().has(id)) return 'online';
    if (card?.classList?.contains('is-presence-online') || card?.dataset?.presence === 'online') return 'online';
    const text = card?.querySelector('.direct-user-presence')?.textContent?.toLowerCase() || '';
    if (text.includes('онлайн')) return 'online';
    if (text.includes('турб')) return 'dnd';
    return 'offline';
  }

  function setDot(avatar, key) {
    if (!avatar) return;
    let dot = avatar.querySelector(':scope > .direct-avatar-status-dot');
    if (!dot) {
      dot = document.createElement('i');
      dot.className = 'direct-avatar-status-dot offline';
      avatar.appendChild(dot);
    }
    const meta = STATUS[key] || STATUS.offline;
    dot.classList.remove('online', 'dnd', 'busy', 'offline');
    dot.classList.add(meta.className);
    dot.dataset.statusLabel = meta.label;
    dot.setAttribute('title', meta.label);
    dot.setAttribute('aria-label', meta.label);
  }

  function normalizeDirectUser(card) {
    const key = statusFromCard(card);
    setDot(card?.querySelector('.direct-user-avatar'), key);
    const status = card?.querySelector('.direct-user-presence');
    if (status) status.setAttribute('aria-hidden', 'true');
  }

  function normalizeChatHead() {
    const active = document.querySelector('.direct-user.is-selected[data-user-id]');
    const avatar = document.querySelector('#directChatHead .direct-chat-avatar');
    if (!active || !avatar) return;
    setDot(avatar, statusFromCard(active));
  }

  function normalizeSelf() {
    const avatar = document.querySelector('#directSelfCard .direct-self-avatar');
    const self = document.getElementById('directSelfCard');
    if (!avatar || !self) return;
    const online = self.classList.contains('is-presence-online') || /онлайн/i.test(self.textContent || '');
    setDot(avatar, online ? 'online' : 'offline');
  }

  function refresh() {
    document.querySelectorAll('#page-chat .direct-user[data-user-id]').forEach(normalizeDirectUser);
    normalizeChatHead();
    normalizeSelf();
  }

  function init() {
    refresh();
    const targets = ['directUsersList', 'directChatHead', 'directSelfCard'];
    targets.forEach(id => {
      const node = document.getElementById(id);
      if (!node || node.dataset.chatAvatarStatusObserved === '1') return;
      node.dataset.chatAvatarStatusObserved = '1';
      new MutationObserver(() => {
        clearTimeout(window.__rebusChatAvatarStatusTimer);
        window.__rebusChatAvatarStatusTimer = setTimeout(refresh, 60);
      }).observe(node, { childList: true, subtree: true, attributes: true, characterData: true, attributeFilter: ['class', 'data-presence'] });
    });
  }

  window.RebusChatAvatarStatus = { refresh };
  document.addEventListener('rebus:route-change', event => {
    if (!event.detail?.route || event.detail.route === 'chat') setTimeout(init, 80);
  });
  document.addEventListener('rebus:presence-updated', () => setTimeout(refresh, 80));
  document.addEventListener('click', event => {
    if (event.target.closest('[data-route="chat"]')) setTimeout(init, 120);
  }, true);

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
  setTimeout(init, 700);
  setTimeout(init, 1800);
})();
