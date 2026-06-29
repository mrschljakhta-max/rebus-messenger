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

  function observe() {
    bindTypingBroadcast();
    ensureTypingChannel();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', observe, { once: true });
  else observe();
  document.addEventListener('click', () => window.setTimeout(observe, 80), true);
})();
