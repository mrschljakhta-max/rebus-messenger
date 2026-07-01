(() => {
  const MESSAGE_SELECTOR = '#messagesList .message[data-message-id]';
  const PREVIEW_ID = 'rebusComposerPreview';
  const MENU_WIDTH = 224;
  const MENU_GAP = 12;
  let activeReply = null;
  let activeEdit = null;
  let pendingReply = null;

  function esc(value = '') {
    return String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#039;');
  }

  function messageById(id) {
    if (!id) return null;
    return document.querySelector(`#messagesList .message[data-message-id="${CSS.escape(id)}"]`);
  }

  function msgText(message) { return message?.querySelector?.('.message-body')?.textContent?.trim() || ''; }
  function msgAuthor(message) { return message?.querySelector?.('b')?.textContent?.trim() || 'Користувач'; }

  function ensureMenuStyle() {
    if (document.getElementById('rebus-message-context-menu-fix-style')) return;
    const style = document.createElement('style');
    style.id = 'rebus-message-context-menu-fix-style';
    style.textContent = `
      body > .message-context-menu.rebus-fixed-menu {
        position: fixed !important;
        z-index: 10080 !important;
        display: flex !important;
        flex-direction: column !important;
        width: ${MENU_WIDTH}px !important;
        min-width: ${MENU_WIDTH}px !important;
        max-width: ${MENU_WIDTH}px !important;
        max-height: calc(100vh - 20px) !important;
        overflow: hidden auto !important;
        transform: none !important;
        inset: auto !important;
        margin: 0 !important;
        pointer-events: auto !important;
        opacity: 1 !important;
        visibility: visible !important;
        border: 1px solid rgba(255,255,255,.10) !important;
        border-radius: 16px !important;
        background: rgba(5, 12, 22, .97) !important;
        box-shadow: 0 24px 70px rgba(0,0,0,.48), 0 0 24px rgba(0,216,255,.08) !important;
        backdrop-filter: blur(16px) saturate(1.08) !important;
      }
      body > .message-context-menu.rebus-fixed-menu .message-menu-item {
        min-height: 42px !important;
        display: flex !important;
        align-items: center !important;
        gap: 12px !important;
        width: 100% !important;
        padding: 0 14px !important;
        border: 0 !important;
        background: transparent !important;
        color: rgba(244,251,255,.92) !important;
        cursor: pointer !important;
        text-align: left !important;
      }
      body > .message-context-menu.rebus-fixed-menu .message-menu-item:hover:not(:disabled) {
        background: rgba(0,216,255,.08) !important;
        color: #fff !important;
      }
      body > .message-context-menu.rebus-fixed-menu .message-menu-item:disabled {
        opacity: .38 !important;
        cursor: default !important;
      }
      body > .message-context-menu.rebus-fixed-menu .message-menu-item span {
        width: 18px !important;
        min-width: 18px !important;
        text-align: center !important;
      }
      body > .message-context-menu.rebus-fixed-menu .message-menu-item em {
        font-style: normal !important;
        font-weight: 850 !important;
        white-space: nowrap !important;
      }
    `;
    document.head.appendChild(style);
  }

  function stripNativeReceiptTooltips(scope = document) {
    scope.querySelectorAll?.('.message-status[title]').forEach(status => {
      const nativeTitle = status.getAttribute('title');
      if (nativeTitle && !status.dataset.tooltip) status.dataset.tooltip = nativeTitle;
      status.removeAttribute('title');
      status.setAttribute('aria-label', status.dataset.tooltip || status.textContent.trim());
    });
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
    if (Date.now() > pendingReply.until) { pendingReply = null; return null; }
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
      if (el) stripNativeReceiptTooltips(el);
      if (el && reply) attachReply(el, reply);
      if (el) window.setTimeout(() => bind(el), 0);
      return el;
    };
    try { appendMessage = window.appendMessage; } catch {}
  }

  function closeMenus() {
    document.querySelectorAll('.message-context-menu.is-open').forEach(menu => {
      menu.classList.remove('is-open', 'rebus-fixed-menu', 'opens-up');
      menu.style.left = '';
      menu.style.top = '';
      menu.style.right = '';
      menu.style.bottom = '';
      menu.style.width = '';
      menu.style.minWidth = '';
      menu.style.maxWidth = '';
      menu.style.position = '';
    });
    document.querySelectorAll('.message-tools.is-pinned').forEach(tool => tool.classList.remove('is-pinned'));
    document.querySelectorAll('.message.has-menu-open').forEach(message => message.classList.remove('has-menu-open'));
    try { openMessageMenuId = null; } catch {}
  }

  function prepareMenuForBody(menu, message) {
    if (!menu || !message) return;
    menu.dataset.menuFor = message.dataset.messageId;
    if (menu.parentElement !== document.body) document.body.appendChild(menu);
    const isOutgoing = message.classList.contains('outgoing');
    menu.querySelectorAll('.message-menu-item').forEach(button => {
      const action = button.dataset.action;
      button.dataset.messageId = message.dataset.messageId;
      if (action === 'reply' || action === 'copy') button.disabled = false;
      if (action === 'edit' || action === 'delete') button.disabled = !isOutgoing;
    });
  }

  function clamp(value, min, max) { return Math.max(min, Math.min(value, max)); }

  function openFixedMenu(messageId) {
    ensureMenuStyle();
    const message = messageById(messageId);
    const menu = document.querySelector(`.message-context-menu[data-menu-for="${CSS.escape(messageId)}"]`);
    if (!message || !menu) return;

    closeMenus();
    prepareMenuForBody(menu, message);

    menu.style.position = 'fixed';
    menu.style.width = `${MENU_WIDTH}px`;
    menu.style.minWidth = `${MENU_WIDTH}px`;
    menu.style.maxWidth = `${MENU_WIDTH}px`;
    menu.style.left = '-9999px';
    menu.style.top = '-9999px';
    menu.style.right = 'auto';
    menu.style.bottom = 'auto';
    menu.classList.add('is-open', 'rebus-fixed-menu');
    message.classList.add('has-menu-open');

    const messageRect = message.getBoundingClientRect();
    const viewportW = document.documentElement.clientWidth || window.innerWidth;
    const viewportH = document.documentElement.clientHeight || window.innerHeight;
    const gap = 10;
    const menuHeight = Math.min(menu.scrollHeight || menu.getBoundingClientRect().height || 320, viewportH - gap * 2);
    const isOutgoing = message.classList.contains('outgoing');

    const spaceLeft = messageRect.left - gap;
    const spaceRight = viewportW - messageRect.right - gap;
    let left;

    if (isOutgoing) {
      left = spaceLeft >= MENU_WIDTH + MENU_GAP ? messageRect.left - MENU_WIDTH - MENU_GAP : messageRect.right + MENU_GAP;
    } else {
      left = spaceRight >= MENU_WIDTH + MENU_GAP ? messageRect.right + MENU_GAP : messageRect.left - MENU_WIDTH - MENU_GAP;
    }

    if (left + MENU_WIDTH > viewportW - gap) left = viewportW - MENU_WIDTH - gap;
    if (left < gap) left = gap;

    let top = messageRect.top;
    const maxTop = viewportH - menuHeight - gap;
    if (top > maxTop) {
      top = messageRect.bottom - menuHeight;
      menu.classList.add('opens-up');
    }
    top = clamp(top, gap, Math.max(gap, maxTop));

    menu.style.left = `${Math.round(left)}px`;
    menu.style.top = `${Math.round(top)}px`;
    menu.style.maxHeight = `${Math.max(160, viewportH - gap * 2)}px`;
    try { openMessageMenuId = messageId; } catch {}
  }

  function patchMenu() {
    if (window.__rebusMenuPatched === '1' || typeof window.openMessageContextMenu !== 'function') return;
    window.__rebusMenuPatched = '1';
    window.openMessageContextMenu = function patchedOpenMessageContextMenu(messageId) { openFixedMenu(messageId); };
    try { openMessageContextMenu = window.openMessageContextMenu; } catch {}
  }

  function startReply(message) {
    activeEdit = null;
    activeReply = { id: message.dataset.messageId, author: msgAuthor(message), text: msgText(message) };
    showPreview('reply', `Відповідь: ${activeReply.author}`, activeReply.text);
    document.getElementById('messageInput')?.focus();
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
      const { error } = await supabaseClient.from('messenger_messages').update({ body }).eq('id', activeEdit.id).eq('user_id', currentUser.id);
      if (error) throw error;
      const bodyNode = message?.querySelector('.message-body');
      if (bodyNode) bodyNode.textContent = body;
      message?.classList.add('is-edited-message');
      if (input) input.value = '';
      clearModes();
    } catch (error) { alert(`Не вдалося відредагувати повідомлення: ${error.message || error}`); }
  }

  function addCorner(message) {
    if (!message || message.dataset.coreCornerReady === '1') return;
    message.dataset.coreCornerReady = '1';
    if (!message.querySelector('.message-corner-menu')) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'message-corner-menu';
      button.textContent = '⌄';
      button.setAttribute('aria-label', 'Дії з повідомленням');
      button.addEventListener('pointerdown', event => { event.preventDefault(); event.stopPropagation(); event.stopImmediatePropagation?.(); }, true);
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
    ensureMenuStyle();
    patchAppendMessage();
    patchMenu();
    stripNativeReceiptTooltips(scope);
    scope.querySelectorAll?.(MESSAGE_SELECTOR)?.forEach(addCorner);
    if (scope.matches?.(MESSAGE_SELECTOR)) addCorner(scope);
  }

  document.addEventListener('click', event => {
    const menuItem = event.target.closest?.('.message-menu-item');
    if (menuItem) {
      const message = messageById(menuItem.dataset.messageId);
      if (menuItem.dataset.action === 'reply' && message) { event.preventDefault(); event.stopPropagation(); event.stopImmediatePropagation?.(); closeMenus(); startReply(message); }
      if (menuItem.dataset.action === 'edit' && message?.classList.contains('outgoing')) { event.preventDefault(); event.stopPropagation(); event.stopImmediatePropagation?.(); closeMenus(); startEdit(message); }
      return;
    }
    if (activeEdit && event.target.closest?.('#sendMessageButton')) { event.preventDefault(); event.stopPropagation(); event.stopImmediatePropagation?.(); saveEdit(); return; }
    if (activeReply && event.target.closest?.('#sendMessageButton')) {
      const body = document.getElementById('messageInput')?.value?.trim() || '';
      if (body) pendingReply = { ...activeReply, body, userId: window.currentUser?.id || undefined, until: Date.now() + 30000 };
      window.setTimeout(clearModes, 80);
      return;
    }
    if (!event.target.closest?.('.message-context-menu, .message-menu-toggle, .message-corner-menu, .message-status')) closeMenus();
  }, true);

  document.addEventListener('contextmenu', event => {
    const message = event.target.closest?.(MESSAGE_SELECTOR);
    if (!message) return;
    event.preventDefault(); event.stopPropagation(); event.stopImmediatePropagation?.();
    openFixedMenu(message.dataset.messageId);
  }, true);

  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') { clearModes(); closeMenus(); }
    if (activeEdit && event.key === 'Enter' && !event.shiftKey && event.target?.id === 'messageInput') { event.preventDefault(); event.stopPropagation(); event.stopImmediatePropagation?.(); saveEdit(); }
  }, true);

  window.addEventListener('resize', closeMenus);
  document.addEventListener('scroll', event => {
    if (event.target?.closest?.('.message-context-menu')) return;
    closeMenus();
  }, true);

  function init() {
    bind(document);
    const list = document.getElementById('messagesList');
    if (list && list.dataset.coreOverrideReady !== '1') {
      list.dataset.coreOverrideReady = '1';
      new MutationObserver(mutations => { mutations.forEach(mutation => mutation.addedNodes.forEach(node => { if (node instanceof HTMLElement) bind(node); })); }).observe(list, { childList: true, subtree: true });
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
  window.setTimeout(init, 300);
  window.setTimeout(init, 900);
})();