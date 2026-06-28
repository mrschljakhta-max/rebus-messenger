(() => {
  const MESSAGE_SELECTOR = '#messagesList .message[data-message-id]';
  const USER_SELECTOR = '.direct-user[data-user-id]';
  const MENU_ID = 'rebusMessageContextMenu';
  const REPLY_CLASS = 'rebus-reply-preview';
  const TYPING_TEXT = 'друкує повідомлення…';

  let menuMessage = null;
  let typingChannel = null;
  let typingTimer = null;
  let remoteTypingTimers = new Map();
  let activeReply = null;

  function html(value = '') {
    return String(value)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  function getMessageBody(message) {
    return message?.querySelector?.('.message-body')?.textContent?.trim() || '';
  }

  function getMessageAuthor(message) {
    return message?.querySelector?.('b')?.textContent?.trim() || 'Користувач';
  }

  function getMenu() {
    let menu = document.getElementById(MENU_ID);
    if (menu) return menu;

    menu = document.createElement('div');
    menu.id = MENU_ID;
    menu.className = 'rebus-message-menu';
    menu.innerHTML = `
      <button type="button" data-action="reply"><span>↩</span><em>Відповісти</em></button>
      <button type="button" data-action="react"><span>☻</span><em>Реагувати</em></button>
      <button type="button" data-action="pin"><span>⌖</span><em>Закріпити</em></button>
      <button type="button" data-action="mark"><span>☆</span><em>Позначити</em></button>
      <button type="button" data-action="delete"><span>⌫</span><em>Видалити</em></button>
    `;
    document.body.appendChild(menu);

    menu.addEventListener('click', event => {
      const button = event.target.closest('button[data-action]');
      if (!button || !menuMessage) return;
      event.preventDefault();
      event.stopPropagation();
      runAction(button.dataset.action, menuMessage);
      hideMenu();
    });

    return menu;
  }

  function hideMenu() {
    const menu = document.getElementById(MENU_ID);
    if (menu) menu.classList.remove('is-open', 'opens-up');
    document.querySelectorAll('.message.has-menu-open').forEach(item => item.classList.remove('has-menu-open'));
    menuMessage = null;
  }

  function getComposerSafeTop() {
    const composer = document.querySelector('#page-chat .compose-box');
    const preview = document.querySelector(`.${REPLY_CLASS}.is-visible`);
    const composerTop = composer?.getBoundingClientRect?.().top || window.innerHeight;
    const previewTop = preview?.getBoundingClientRect?.().top || composerTop;
    return Math.min(composerTop, previewTop, window.innerHeight);
  }

  function positionMenu(menu, x, y) {
    const gap = 12;
    const composerTop = getComposerSafeTop();
    const safeBottom = Math.min(window.innerHeight - gap, composerTop - gap);

    menu.style.left = '0px';
    menu.style.top = '0px';
    menu.style.maxHeight = `${Math.max(160, safeBottom - gap)}px`;
    menu.classList.remove('opens-up');
    menu.classList.add('is-open');

    const rect = menu.getBoundingClientRect();
    const left = Math.min(Math.max(gap, x), window.innerWidth - rect.width - gap);
    const spaceBelow = safeBottom - y;
    const shouldOpenUp = spaceBelow < rect.height + gap;
    const preferredTop = shouldOpenUp ? y - rect.height - gap : y + gap;
    const top = Math.min(Math.max(gap, preferredTop), safeBottom - rect.height);

    menu.classList.toggle('opens-up', shouldOpenUp);
    menu.style.left = `${left}px`;
    menu.style.top = `${Math.max(gap, top)}px`;
  }

  function openMenu(message, event) {
    if (!message?.dataset?.messageId) return;
    event.preventDefault();
    event.stopPropagation();

    hideMenu();
    menuMessage = message;
    message.classList.add('has-menu-open');

    const menu = getMenu();
    const deleteButton = menu.querySelector('[data-action="delete"]');
    if (deleteButton) deleteButton.disabled = !message.classList.contains('outgoing');
    positionMenu(menu, event.clientX, event.clientY);
  }

  function ensureReplyPreview() {
    const compose = document.querySelector('#page-chat .compose-box');
    if (!compose) return null;

    let preview = document.querySelector(`.${REPLY_CLASS}`);
    if (preview) return preview;

    preview = document.createElement('div');
    preview.className = REPLY_CLASS;
    preview.innerHTML = `
      <div><strong></strong><span></span></div>
      <button type="button" aria-label="Скасувати відповідь">×</button>
    `;
    compose.parentElement?.insertBefore(preview, compose);
    preview.querySelector('button')?.addEventListener('click', clearReplyPreview);
    return preview;
  }

  function setReplyPreview(message) {
    const preview = ensureReplyPreview();
    if (!preview) return;
    activeReply = {
      id: message.dataset.messageId,
      author: getMessageAuthor(message),
      body: getMessageBody(message)
    };
    preview.querySelector('strong').textContent = `Відповідь: ${activeReply.author}`;
    preview.querySelector('span').textContent = activeReply.body || 'Повідомлення';
    preview.classList.add('is-visible');
    document.getElementById('messageInput')?.focus();
  }

  function clearReplyPreview() {
    activeReply = null;
    document.querySelector(`.${REPLY_CLASS}`)?.classList.remove('is-visible');
  }

  async function deleteMessage(message) {
    const id = message?.dataset?.messageId;
    if (!id || !message.classList.contains('outgoing')) return;

    try {
      if (typeof deleteOwnMessage === 'function') {
        await deleteOwnMessage(id);
        return;
      }
    } catch (error) {
      console.warn('[REBUS] Native delete failed, fallback:', error);
    }

    const { error } = await supabaseClient
      .from('messenger_messages')
      .delete()
      .eq('id', id)
      .eq('user_id', currentUser.id);

    if (error) alert(`Не вдалося видалити повідомлення: ${error.message}`);
    else message.remove();
  }

  function openReactionPaletteFor(message) {
    const trigger = message?.querySelector?.('.message-emoji-trigger');
    if (trigger) trigger.click();
  }

  function togglePin(message) {
    message.classList.toggle('is-pinned-message');
  }

  function toggleMark(message) {
    message.classList.toggle('is-marked-message');
  }

  function runAction(action, message) {
    if (action === 'reply') setReplyPreview(message);
    if (action === 'react') openReactionPaletteFor(message);
    if (action === 'pin') togglePin(message);
    if (action === 'mark') toggleMark(message);
    if (action === 'delete') deleteMessage(message);
  }

  function bindContextMenus(scope = document) {
    scope.querySelectorAll?.(MESSAGE_SELECTOR)?.forEach(message => {
      if (message.dataset.contextMenuBound === '1') return;
      message.dataset.contextMenuBound = '1';
      message.addEventListener('contextmenu', event => openMenu(message, event));
    });
  }

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

  function observeMessagesAndUsers() {
    const messages = document.getElementById('messagesList');
    if (messages && messages.dataset.actionsObserverBound !== '1') {
      messages.dataset.actionsObserverBound = '1';
      bindContextMenus(messages);
      new MutationObserver(mutations => {
        mutations.forEach(mutation => {
          mutation.addedNodes.forEach(node => {
            if (node instanceof HTMLElement) bindContextMenus(node);
          });
        });
      }).observe(messages, { childList: true, subtree: true });
    }

    bindTypingBroadcast();
    ensureTypingChannel();
  }

  document.addEventListener('click', event => {
    if (!event.target.closest(`#${MENU_ID}`)) hideMenu();
  });

  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') hideMenu();
  });

  window.addEventListener('resize', hideMenu);
  document.addEventListener('scroll', hideMenu, true);

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', observeMessagesAndUsers, { once: true });
  } else {
    observeMessagesAndUsers();
  }

  document.addEventListener('click', () => {
    // Re-check after user switches conversation.
    window.setTimeout(observeMessagesAndUsers, 80);
  }, true);
})();
