(() => {
  const MESSAGE_SELECTOR = '#messagesList .message[data-message-id]';
  const PREVIEW_ID = 'rebusComposerPreview';
  let activeReply = null;
  let activeEdit = null;
  let pendingReply = null;

  function esc(value = '') {
    return String(value)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  function messageById(id) {
    if (!id) return null;
    return document.querySelector(`#messagesList .message[data-message-id="${CSS.escape(id)}"]`);
  }

  function msgText(message) {
    return message?.querySelector?.('.message-body')?.textContent?.trim() || '';
  }

  function msgAuthor(message) {
    return message?.querySelector?.('b')?.textContent?.trim() || 'Користувач';
  }

  function ensurePreview() {
    const compose = document.querySelector('#page-chat .compose-box');
    if (!compose) return null;
    let preview = document.getElementById(PREVIEW_ID);
    if (preview) return preview;
    preview = document.createElement('div');
    preview.id = PREVIEW_ID;
    preview.className = 'rebus-composer-preview';
    preview.innerHTML = '<div class="preview-line"></div><div class="preview-content"><strong></strong><span></span></div><button type="button">×</button>';
    compose.parentElement.insertBefore(preview, compose);
    preview.querySelector('button').addEventListener('click', clearModes);
    return preview;
  }

  function showPreview(mode, title, text) {
    const preview = ensurePreview();
    if (!preview) return;
    preview.dataset.mode = mode;
    preview.querySelector('strong').textContent = title;
    preview.querySelector('span').textContent = text || 'Повідомлення';
    preview.classList.add('is-visible');
  }

  function hidePreview() {
    const preview = document.getElementById(PREVIEW_ID);
    preview?.classList.remove('is-visible');
    if (preview) preview.dataset.mode = '';
  }

  function clearModes() {
    activeReply = null;
    activeEdit = null;
    hidePreview();
    const send = document.getElementById('sendMessageButton');
    if (send) send.textContent = 'Надіслати';
  }

  function attachReply(el, reply) {
    if (!el || !reply || el.dataset.replyQuoteAttached === '1') return;
    const anchor = el.querySelector('b');
    if (!anchor) return;
    const quote = document.createElement('div');
    quote.className = 'message-reply-quote';
    quote.innerHTML = `<strong>${esc(reply.author)}</strong><span>${esc(reply.text || 'Повідомлення')}</span>`;
    anchor.insertAdjacentElement('afterend', quote);
    el.dataset.replyQuoteAttached = '1';
  }

  function replyForMessage(message) {
    if (message?.__reply) return message.__reply;
    if (!pendingReply) return null;
    if (Date.now() > pendingReply.until) {
      pendingReply = null;
      return null;
    }
    if (message?.user_id && pendingReply.userId && message.user_id !== pendingReply.userId) return null;
    if ((message?.body || '').trim() !== pendingReply.body) return null;
    return pendingReply;
  }

  function patchAppendMessage() {
    if (window.__rebusAppendPatched === '1' || typeof window.appendMessage !== 'function') return;
    window.__rebusAppendPatched = '1';
    const original = window.appendMessage;
    window.appendMessage = function patchedAppendMessage(message, options = {}) {
      const reply = replyForMessage(message);
      const el = original.call(this, message, options);
      if (el && reply) attachReply(el, reply);
      return el;
    };
    try { appendMessage = window.appendMessage; } catch {}
  }

  function closeMenus() {
    document.querySelectorAll('.message-context-menu.is-open').forEach(menu => {
      menu.classList.remove('is-open', 'rebus-fixed-menu', 'opens-up');
      menu.style.left = '';
      menu.style.top = '';
    });
    document.querySelectorAll('.message-tools.is-pinned').forEach(tool => tool.classList.remove('is-pinned'));
    document.querySelectorAll('.message.has-menu-open').forEach(message => message.classList.remove('has-menu-open'));
    try { openMessageMenuId = null; } catch {}
  }

  function safeBottom() {
    const composer = document.querySelector('#page-chat .compose-box');
    const preview = document.getElementById(PREVIEW_ID);
    const composerTop = composer?.getBoundingClientRect?.().top || window.innerHeight;
    const previewTop = preview?.classList.contains('is-visible') ? preview.getBoundingClientRect().top : composerTop;
    return Math.min(window.innerHeight - 10, composerTop - 10, previewTop - 10);
  }

  function openFixedMenu(messageId) {
    const message = messageById(messageId);
    const menu = document.querySelector(`.message-context-menu[data-menu-for="${CSS.escape(messageId)}"]`);
    if (!message || !menu) return;

    closeMenus();
    menu.classList.add('is-open', 'rebus-fixed-menu');
    message.classList.add('has-menu-open');
    menu.closest('.message-tools')?.classList.add('is-pinned');

    menu.querySelectorAll('.message-menu-item').forEach(button => {
      if (button.dataset.action === 'reply') button.disabled = false;
      if (button.dataset.action === 'edit') button.disabled = !message.classList.contains('outgoing');
    });

    menu.style.left = '0px';
    menu.style.top = '0px';
    const messageRect = message.getBoundingClientRect();
    const menuRect = menu.getBoundingClientRect();
    const gap = 8;
    const bottom = safeBottom();
    const isOutgoing = message.classList.contains('outgoing');
    const leftBase = isOutgoing ? messageRect.left - menuRect.width - 8 : messageRect.right + 8;
    const left = Math.min(Math.max(gap, leftBase), window.innerWidth - menuRect.width - gap);
    const y = messageRect.bottom;
    const openUp = bottom - y < menuRect.height + gap;
    const top = openUp ? messageRect.top - menuRect.height - gap : messageRect.bottom + gap;

    menu.classList.toggle('opens-up', openUp);
    menu.style.left = `${left}px`;
    menu.style.top = `${Math.max(gap, Math.min(top, bottom - menuRect.height))}px`;
    try { openMessageMenuId = messageId; } catch {}
  }

  function patchMenu() {
    if (window.__rebusMenuPatched === '1' || typeof window.openMessageContextMenu !== 'function') return;
    window.__rebusMenuPatched = '1';
    window.openMessageContextMenu = function patchedOpenMessageContextMenu(messageId) {
      openFixedMenu(messageId);
    };
    try { openMessageContextMenu = window.openMessageContextMenu; } catch {}
  }

  function startReply(message) {
    activeEdit = null;
    activeReply = {
      id: message.dataset.messageId,
      author: msgAuthor(message),
      text: msgText(message)
    };
    showPreview('reply', `Відповідь: ${activeReply.author}`, activeReply.text);
    const input = document.getElementById('messageInput');
    input?.focus();
  }

  function startEdit(message) {
    if (!message?.classList?.contains('outgoing')) return;
    activeReply = null;
    activeEdit = { id: message.dataset.messageId, text: msgText(message) };
    showPreview('edit', 'Редагування повідомлення', activeEdit.text);
    const input = document.getElementById('messageInput');
    if (input) {
      input.disabled = false;
      input.value = activeEdit.text;
      input.focus();
      input.setSelectionRange?.(input.value.length, input.value.length);
    }
    const send = document.getElementById('sendMessageButton');
    if (send) send.textContent = 'Зберегти';
  }

  async function saveEdit() {
    if (!activeEdit) return;
    const input = document.getElementById('messageInput');
    const body = input?.value?.trim() || '';
    if (!body) return;
    const message = messageById(activeEdit.id);
    try {
      const { error } = await supabaseClient
        .from('messenger_messages')
        .update({ body })
        .eq('id', activeEdit.id)
        .eq('user_id', currentUser.id);
      if (error) throw error;
      const bodyNode = message?.querySelector('.message-body');
      if (bodyNode) bodyNode.textContent = body;
      message?.classList.add('is-edited-message');
      if (input) input.value = '';
      clearModes();
    } catch (error) {
      alert(`Не вдалося відредагувати повідомлення: ${error.message || error}`);
    }
  }

  function addCorner(message) {
    if (!message || message.dataset.coreCornerReady === '1') return;
    message.dataset.coreCornerReady = '1';
    if (!message.querySelector('.message-corner-menu')) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'message-corner-menu';
      button.textContent = '⌄';
      button.addEventListener('click', event => {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation?.();
        openFixedMenu(message.dataset.messageId);
      }, true);
      message.appendChild(button);
    }
  }

  function bind(scope = document) {
    patchAppendMessage();
    patchMenu();
    scope.querySelectorAll?.(MESSAGE_SELECTOR)?.forEach(addCorner);
  }

  document.addEventListener('click', event => {
    const menuItem = event.target.closest?.('.message-menu-item');
    if (menuItem) {
      const message = messageById(menuItem.dataset.messageId);
      if (menuItem.dataset.action === 'reply' && message) {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation?.();
        closeMenus();
        startReply(message);
      }
      if (menuItem.dataset.action === 'edit' && message?.classList.contains('outgoing')) {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation?.();
        closeMenus();
        startEdit(message);
      }
      return;
    }

    if (activeEdit && event.target.closest?.('#sendMessageButton')) {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation?.();
      saveEdit();
      return;
    }

    if (activeReply && event.target.closest?.('#sendMessageButton')) {
      const body = document.getElementById('messageInput')?.value?.trim() || '';
      if (body) {
        pendingReply = { ...activeReply, body, userId: window.currentUser?.id || undefined, until: Date.now() + 30000 };
      }
      window.setTimeout(clearModes, 80);
      return;
    }

    if (!event.target.closest?.('.message-context-menu, .message-menu-toggle, .message-corner-menu')) {
      closeMenus();
    }
  }, true);

  document.addEventListener('contextmenu', event => {
    const message = event.target.closest?.(MESSAGE_SELECTOR);
    if (!message) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation?.();
    openFixedMenu(message.dataset.messageId);
  }, true);

  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') clearModes();
    if (activeEdit && event.key === 'Enter' && !event.shiftKey && event.target?.id === 'messageInput') {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation?.();
      saveEdit();
    }
  }, true);

  function init() {
    bind(document);
    const list = document.getElementById('messagesList');
    if (list && list.dataset.coreOverrideReady !== '1') {
      list.dataset.coreOverrideReady = '1';
      new MutationObserver(mutations => {
        mutations.forEach(mutation => mutation.addedNodes.forEach(node => {
          if (node instanceof HTMLElement) bind(node);
        }));
      }).observe(list, { childList: true, subtree: true });
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
  window.setTimeout(init, 300);
  window.setTimeout(init, 900);
})();
