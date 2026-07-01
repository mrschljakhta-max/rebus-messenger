(() => {
  const CHANNEL_NAME = 'rebus-direct-typing';
  const TYPING_TTL = 3200;
  const SEND_THROTTLE = 650;
  const STOP_DELAY = 1400;

  let channel = null;
  let channelReady = false;
  let currentUser = null;
  let lastSentAt = 0;
  let stopTimer = null;
  let pendingPayload = null;
  const typingUsers = new Map();

  function client() {
    return window.rebusSupabaseClient || window.supabaseClient || (typeof supabaseClient !== 'undefined' ? supabaseClient : null);
  }

  function selectedPeerObject() {
    try {
      if (typeof selectedPeer !== 'undefined' && selectedPeer?.id) return selectedPeer;
    } catch {}
    const card = document.querySelector('#page-chat .direct-user.is-selected[data-user-id], #page-chat .direct-user.is-active[data-user-id]');
    if (!card) return null;
    return {
      id: card.dataset.userId,
      name: card.querySelector('.direct-user-main strong')?.textContent?.trim() || 'Користувач',
      email: card.querySelector('.direct-user-main em')?.textContent?.trim() || ''
    };
  }

  function selectedPeerId() {
    return selectedPeerObject()?.id || null;
  }

  function selectedPeerName() {
    return selectedPeerObject()?.name
      || document.querySelector('#directChatHead strong')?.textContent?.trim()
      || 'Користувач';
  }

  function dots() {
    return '<span class="typing-dots" aria-hidden="true"><i></i><i></i><i></i></span>';
  }

  function ensureBubble() {
    const list = document.getElementById('messagesList');
    if (!list) return null;
    let bubble = document.getElementById('directTypingBubble');
    if (!bubble) {
      bubble = document.createElement('div');
      bubble.id = 'directTypingBubble';
      bubble.className = 'direct-typing-bubble';
      bubble.setAttribute('aria-live', 'polite');
      list.appendChild(bubble);
    }
    return bubble;
  }

  function ensureCardPills() {
    document.querySelectorAll('#page-chat .direct-user[data-user-id]').forEach(card => {
      if (card.querySelector('.direct-typing-pill')) return;
      const pill = document.createElement('span');
      pill.className = 'direct-typing-pill';
      pill.innerHTML = `${dots()}<span>друкує…</span>`;
      card.appendChild(pill);
    });
  }

  function updateUi() {
    ensureCardPills();
    const now = Date.now();
    const activePeer = selectedPeerId();
    let activeTyping = false;

    typingUsers.forEach((info, id) => {
      if (!info?.until || info.until < now) typingUsers.delete(id);
    });

    document.querySelectorAll('#page-chat .direct-user[data-user-id]').forEach(card => {
      const id = card.dataset.userId;
      const isTyping = typingUsers.has(id);
      card.classList.toggle('is-typing', isTyping);
      if (id === activePeer && isTyping) activeTyping = true;
    });

    const bubble = ensureBubble();
    const head = document.getElementById('directChatHead');
    if (bubble) {
      if (activePeer && activeTyping) {
        bubble.innerHTML = `${selectedPeerName()} друкує ${dots()}`;
        bubble.classList.add('is-visible');
        bubble.parentElement?.appendChild(bubble);
      } else {
        bubble.classList.remove('is-visible');
      }
    }

    head?.classList.toggle('is-typing', Boolean(activePeer && activeTyping));
    const headStatus = head?.querySelector('span');
    if (headStatus) {
      if (activePeer && activeTyping) {
        if (!headStatus.dataset.defaultText) headStatus.dataset.defaultText = headStatus.textContent || '';
        headStatus.textContent = 'друкує…';
      } else if (headStatus.dataset.defaultText) {
        headStatus.textContent = headStatus.dataset.defaultText;
        delete headStatus.dataset.defaultText;
      }
    }
  }

  async function flushPending() {
    if (!channelReady || !channel || !pendingPayload) return;
    const payload = pendingPayload;
    pendingPayload = null;
    try {
      await channel.send({ type: 'broadcast', event: 'typing', payload });
    } catch (error) {
      console.warn('[REBUS] typing send skipped:', error?.message || error);
    }
  }

  async function ensureChannel() {
    const supa = client();
    if (!supa?.channel || !supa?.auth?.getUser) return null;
    if (channel) return channel;

    const { data } = await supa.auth.getUser();
    currentUser = data?.user || null;
    if (!currentUser?.id) return null;

    channel = supa.channel(CHANNEL_NAME, {
      config: {
        broadcast: { self: false, ack: true }
      }
    });

    channel.on('broadcast', { event: 'typing' }, payload => {
      const item = payload?.payload || {};
      if (!item.from || item.from === currentUser.id || item.to !== currentUser.id) return;
      if (item.typing) typingUsers.set(item.from, { until: Date.now() + TYPING_TTL, name: item.name || 'Користувач' });
      else typingUsers.delete(item.from);
      updateUi();
    });

    channel.subscribe(status => {
      channelReady = status === 'SUBSCRIBED';
      if (channelReady) flushPending();
    });

    return channel;
  }

  async function sendTyping(typing) {
    const peerId = selectedPeerId();
    if (!peerId) return;
    await ensureChannel();
    if (!currentUser?.id) return;

    const payload = {
      from: currentUser.id,
      to: peerId,
      name: currentUser.user_metadata?.full_name || currentUser.email || 'REBUS',
      typing: Boolean(typing),
      at: new Date().toISOString()
    };

    if (!channelReady || !channel) {
      pendingPayload = payload;
      return;
    }

    try {
      await channel.send({ type: 'broadcast', event: 'typing', payload });
    } catch (error) {
      console.warn('[REBUS] typing send failed:', error?.message || error);
      pendingPayload = payload;
    }
  }

  function scheduleStop() {
    clearTimeout(stopTimer);
    stopTimer = setTimeout(() => sendTyping(false), STOP_DELAY);
  }

  function handleInput() {
    const input = document.getElementById('messageInput');
    if (!input || input.disabled || !selectedPeerId()) return;
    const hasText = Boolean(input.value.trim());
    if (!hasText) {
      sendTyping(false);
      return;
    }
    const now = Date.now();
    if (now - lastSentAt > SEND_THROTTLE) {
      lastSentAt = now;
      sendTyping(true);
    }
    scheduleStop();
  }

  function bindInput() {
    const input = document.getElementById('messageInput');
    if (!input) return;
    if (input.dataset.typingBound !== '1') {
      input.dataset.typingBound = '1';
      input.addEventListener('input', handleInput);
      input.addEventListener('keyup', handleInput);
      input.addEventListener('paste', () => setTimeout(handleInput, 0));
      input.addEventListener('blur', () => sendTyping(false));
      input.addEventListener('keydown', event => {
        if (event.key === 'Enter') setTimeout(() => sendTyping(false), 80);
      });
    }
  }

  function init() {
    bindInput();
    ensureChannel();
    ensureCardPills();
    updateUi();
  }

  window.RebusTyping = {
    refresh: updateUi,
    start: ensureChannel,
    stop: () => sendTyping(false),
    testIncoming: id => {
      const peer = id || selectedPeerId() || document.querySelector('#page-chat .direct-user[data-user-id]')?.dataset.userId;
      if (!peer) return;
      typingUsers.set(peer, { until: Date.now() + TYPING_TTL, name: 'Користувач' });
      updateUi();
    }
  };

  document.addEventListener('rebus:route-change', event => {
    if (!event.detail?.route || event.detail.route === 'chat') setTimeout(init, 80);
  });
  document.addEventListener('click', event => {
    if (event.target.closest('[data-route="chat"], .direct-user[data-user-id]')) {
      setTimeout(() => { sendTyping(false); init(); }, 120);
    }
  }, true);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') sendTyping(false);
    else init();
  });
  window.addEventListener('beforeunload', () => sendTyping(false));
  setInterval(updateUi, 700);

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
  setTimeout(init, 700);
  setTimeout(init, 1800);
})();
