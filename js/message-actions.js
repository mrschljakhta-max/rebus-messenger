(() => {
  const USER_SELECTOR = '.direct-user[data-user-id]';
  const TYPING_TEXT = 'друкує повідомлення…';

  let typingChannel = null;
  let typingTimer = null;
  const remoteTypingTimers = new Map();

  function getConversationKeySafe() {
    try {
      if (!currentUser || !selectedPeer) return null;
      if (typeof makeConversationKey === 'function') return makeConversationKey(currentUser.id, selectedPeer.id);
      return [currentUser.id, selectedPeer.id].filter(Boolean).sort().join('_');
    } catch {
      return null;
    }
  }

  function setUserTyping(userId, isTyping) {
    const row = document.querySelector(`${USER_SELECTOR}[data-user-id="${CSS.escape(userId)}"]`);
    if (!row) return;
    const meta = row.querySelector('.direct-user-main em');
    if (!meta) return;
    if (!row.dataset.originalMeta) row.dataset.originalMeta = meta.textContent || '';
    if (isTyping) {
      row.classList.add('is-typing');
      meta.textContent = TYPING_TEXT;
    } else {
      row.classList.remove('is-typing');
      meta.textContent = row.dataset.originalMeta || meta.textContent;
    }
  }

  function showRemoteTyping(userId) {
    if (!userId || userId === currentUser?.id) return;
    setUserTyping(userId, true);
    window.clearTimeout(remoteTypingTimers.get(userId));
    const timer = window.setTimeout(() => setUserTyping(userId, false), 2200);
    remoteTypingTimers.set(userId, timer);
  }

  async function ensureTypingChannel() {
    if (!supabaseClient || !currentUser || !selectedPeer) return;
    const key = getConversationKeySafe();
    if (!key) return;
    const channelName = `rebus-typing-${key}`;
    if (typingChannel?.topic === `realtime:${channelName}`) return;
    if (typingChannel) {
      try { await supabaseClient.removeChannel(typingChannel); } catch {}
      typingChannel = null;
    }
    typingChannel = supabaseClient.channel(channelName, { config: { broadcast: { self: false } } });
    typingChannel
      .on('broadcast', { event: 'typing' }, payload => {
        const userId = payload?.payload?.user_id;
        if (payload?.payload?.conversation_key === key) showRemoteTyping(userId);
      })
      .subscribe();
  }

  function bindTypingBroadcast() {
    const input = document.getElementById('messageInput');
    if (!input || input.dataset.broadcastTypingBound === '1') return;
    input.dataset.broadcastTypingBound = '1';
    input.addEventListener('input', async () => {
      if (!input.value.trim()) return;
      await ensureTypingChannel();
      if (!typingChannel || !currentUser || !selectedPeer) return;
      window.clearTimeout(typingTimer);
      typingTimer = window.setTimeout(() => {
        const key = getConversationKeySafe();
        if (!key) return;
        typingChannel.send({
          type: 'broadcast',
          event: 'typing',
          payload: {
            user_id: currentUser.id,
            user_name: typeof getDisplayName === 'function' ? getDisplayName(currentUser) : currentUser.email,
            conversation_key: key
          }
        });
      }, 120);
    });
  }

  function closeFixedMenus() {
    document.querySelectorAll('.message-context-menu.is-open').forEach(menu => {
      menu.classList.remove('is-open', 'rebus-fixed-menu', 'opens-up');
      menu.style.left = '';
      menu.style.top = '';
    });
    document.querySelectorAll('.message.has-menu-open').forEach(message => message.classList.remove('has-menu-open'));
    document.querySelectorAll('.message-tools.is-pinned').forEach(tool => tool.classList.remove('is-pinned'));
  }

  function positionMenu(menu, trigger, message) {
    if (!menu || !trigger) return;
    menu.classList.add('rebus-fixed-menu');
    const triggerRect = trigger.getBoundingClientRect();
    const messageRect = message.getBoundingClientRect();
    const menuWidth = Math.min(224, window.innerWidth - 24);
    const menuHeight = Math.min(420, window.innerHeight - 24);
    const isOutgoing = message.classList.contains('outgoing');

    let left = isOutgoing ? messageRect.left - menuWidth - 12 : messageRect.right + 12;
    if (left < 12) left = Math.max(12, triggerRect.left - menuWidth + 26);
    if (left + menuWidth > window.innerWidth - 12) left = window.innerWidth - menuWidth - 12;

    let top = triggerRect.top - 8;
    if (top + menuHeight > window.innerHeight - 12) {
      top = Math.max(12, window.innerHeight - menuHeight - 12);
      menu.classList.add('opens-up');
    }

    menu.style.left = `${left}px`;
    menu.style.top = `${top}px`;
  }

  function openMessageMenuFromCorner(message, trigger, event) {
    if (!message?.dataset.messageId) return;
    event?.preventDefault();
    event?.stopPropagation();
    const menu = message.querySelector(`[data-menu-for="${CSS.escape(message.dataset.messageId)}"]`);
    if (!menu) return;
    closeFixedMenus();
    menu.classList.add('is-open');
    message.classList.add('has-menu-open');
    message.querySelector('.message-tools')?.classList.add('is-pinned');
    positionMenu(menu, trigger, message);
  }

  function bindMessageCornerMenus() {
    document.querySelectorAll('#page-chat .messages-list .message[data-message-id]').forEach(message => {
      if (message.dataset.cornerMenuBound === '1') return;
      if (String(message.dataset.messageId || '').startsWith('local-')) return;
      message.dataset.cornerMenuBound = '1';

      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'message-corner-menu';
      button.setAttribute('aria-label', 'Відкрити меню повідомлення');
      button.setAttribute('title', 'Дії з повідомленням');
      message.appendChild(button);

      button.addEventListener('click', event => openMessageMenuFromCorner(message, button, event));
      message.addEventListener('contextmenu', event => openMessageMenuFromCorner(message, button, event));
    });
  }

  function observe() {
    bindTypingBroadcast();
    ensureTypingChannel();
    bindMessageCornerMenus();
  }

  const messagesList = document.getElementById('messagesList');
  if (messagesList) {
    const observer = new MutationObserver(() => bindMessageCornerMenus());
    observer.observe(messagesList, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', observe, { once: true });
  else observe();
  document.addEventListener('click', event => {
    if (!event.target.closest('.message-context-menu') && !event.target.closest('.message-corner-menu')) {
      window.setTimeout(closeFixedMenus, 0);
    }
    window.setTimeout(observe, 80);
  }, true);
})();
