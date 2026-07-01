(() => {
  const MESSAGE_SELECTOR = '#messagesList .message[data-message-id]';
  const PREVIEW_ID = 'rebusComposerPreview';
  const MENU_ID = 'rebusReliableMessageContextMenu';
  const MENU_WIDTH = 224;
  const GAP = 10;

  let activeReply = null;
  let activeEdit = null;

  const ACTIONS = [
    { action: 'reply', label: 'Відповісти', icon: '↩' },
    { action: 'copy', label: 'Копіювати', icon: '▣' },
    { action: 'edit', label: 'Редагувати', icon: '☻', ownOnly: true },
    { action: 'forward', label: 'Переслати', icon: '↷', disabled: true },
    { action: 'pin', label: 'Закріпити', icon: '⚑', disabled: true },
    { action: 'mark', label: 'Позначити', icon: '☆', disabled: true },
    { action: 'report', label: 'Поскаржитися', icon: '▱', disabled: true },
    { action: 'delete', label: 'Видалити', icon: '⌫', ownOnly: true }
  ];

  function esc(value = '') {
    return String(value)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  function client() {
    try { if (typeof supabaseClient !== 'undefined') return supabaseClient; } catch {}
    return window.supabaseClient || window.rebusSupabaseClient || null;
  }

  function currentUserId() {
    try { if (typeof currentUser !== 'undefined' && currentUser?.id) return currentUser.id; } catch {}
    return window.currentUser?.id || null;
  }

  function messageById(id) {
    if (!id) return null;
    return document.querySelector(`#messagesList .message[data-message-id="${CSS.escape(id)}"]`);
  }

  function msgText(message) {
    return message?.querySelector?.('.message-body')?.textContent?.trim()
      || message?.querySelector?.('span:not(.message-status)')?.textContent?.trim()
      || '';
  }

  function msgAuthor(message) {
    return message?.querySelector?.('b')?.textContent?.trim() || 'Користувач';
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(value, max));
  }

  function ensureStyle() {
    if (document.getElementById('rebus-reliable-message-menu-style')) return;
    const style = document.createElement('style');
    style.id = 'rebus-reliable-message-menu-style';
    style.textContent = `
      #page-chat .message[data-message-id] {
        position: relative !important;
        overflow: visible !important;
        min-width: 84px !important;
      }
      #page-chat .message[data-message-id].incoming { padding-right: 30px !important; }
      #page-chat .message[data-message-id].outgoing { padding-left: 30px !important; }
      #page-chat .message-corner-menu {
        position: absolute !important;
        top: 8px !important;
        z-index: 45 !important;
        width: 18px !important;
        height: 18px !important;
        min-width: 18px !important;
        padding: 0 !important;
        border: 0 !important;
        border-radius: 0 !important;
        background: transparent !important;
        box-shadow: none !important;
        outline: 0 !important;
        opacity: 0 !important;
        pointer-events: none !important;
        cursor: pointer !important;
        font-size: 0 !important;
        line-height: 0 !important;
        color: rgba(244,251,255,.82) !important;
      }
      #page-chat .message.incoming .message-corner-menu { right: 9px !important; }
      #page-chat .message.outgoing .message-corner-menu { left: 9px !important; }
      #page-chat .message-corner-menu::before {
        content: "";
        position: absolute;
        inset: 1px;
        background: currentColor;
        clip-path: polygon(12% 28%, 50% 66%, 88% 28%, 100% 40%, 50% 90%, 0 40%);
      }
      #page-chat .message:hover .message-corner-menu,
      #page-chat .message.has-menu-open .message-corner-menu,
      #page-chat .message.has-side-hover .message-corner-menu {
        opacity: .95 !important;
        pointer-events: auto !important;
      }
      #page-chat .message-corner-menu:hover { color: #fff !important; }
      #${MENU_ID} {
        position: fixed !important;
        z-index: 120000 !important;
        display: none !important;
        flex-direction: column !important;
        width: ${MENU_WIDTH}px !important;
        min-width: ${MENU_WIDTH}px !important;
        max-width: ${MENU_WIDTH}px !important;
        max-height: calc(100vh - 20px) !important;
        overflow: hidden auto !important;
        padding: 8px !important;
        margin: 0 !important;
        inset: auto !important;
        transform: none !important;
        border: 1px solid rgba(255,255,255,.12) !important;
        border-radius: 18px !important;
        background: rgba(5, 12, 22, .98) !important;
        box-shadow: 0 24px 70px rgba(0,0,0,.55), 0 0 26px rgba(0,216,255,.10) !important;
        backdrop-filter: blur(18px) saturate(1.08) !important;
        pointer-events: auto !important;
      }
      #${MENU_ID}.is-open { display: flex !important; }
      #${MENU_ID} .message-menu-item {
        min-height: 42px !important;
        display: flex !important;
        align-items: center !important;
        gap: 12px !important;
        width: 100% !important;
        padding: 0 12px !important;
        border: 0 !important;
        border-radius: 12px !important;
        background: transparent !important;
        color: rgba(244,251,255,.94) !important;
        cursor: pointer !important;
        text-align: left !important;
      }
      #${MENU_ID} .message-menu-item:hover:not(:disabled) {
        background: rgba(0,216,255,.09) !important;
        color: #fff !important;
      }
      #${MENU_ID} .message-menu-item:disabled {
        opacity: .36 !important;
        cursor: default !important;
      }
      #${MENU_ID} .message-menu-item span {
        width: 18px !important;
        min-width: 18px !important;
        text-align: center !important;
      }
      #${MENU_ID} .message-menu-item em {
        font-style: normal !important;
        font-weight: 850 !important;
        white-space: nowrap !important;
      }
      .rebus-composer-preview {
        display: none;
        align-items: center;
        gap: 10px;
        margin: 0 0 8px;
        padding: 10px 12px;
        border: 1px solid rgba(0,216,255,.16);
        border-radius: 16px;
        color: rgba(244,251,255,.88);
        background: rgba(255,255,255,.055);
      }
      .rebus-composer-preview.is-visible { display: flex; }
      .rebus-composer-preview .preview-line { width: 3px; align-self: stretch; border-radius: 99px; background: #00d8ff; }
      .rebus-composer-preview .preview-content { min-width: 0; display: grid; gap: 2px; }
      .rebus-composer-preview .preview-content strong { color: #00d8ff; font-size: 12px; }
      .rebus-composer-preview .preview-content span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 12px; opacity: .78; }
      .rebus-composer-preview button { margin-left: auto; border: 0; background: transparent; color: #fff; cursor: pointer; font-size: 18px; }
    `;
    document.head.appendChild(style);
  }

  function ensureMenu() {
    ensureStyle();
    let menu = document.getElementById(MENU_ID);
    if (menu) return menu;
    menu = document.createElement('div');
    menu.id = MENU_ID;
    menu.className = 'message-context-menu rebus-reliable-context-menu';
    menu.setAttribute('role', 'menu');
    document.body.appendChild(menu);
    return menu;
  }

  function closeMenus() {
    const menu = document.getElementById(MENU_ID);
    menu?.classList.remove('is-open');
    document.querySelectorAll('.message-context-menu.is-open').forEach(item => item.classList.remove('is-open'));
    document.querySelectorAll('.message-tools.is-pinned').forEach(item => item.classList.remove('is-pinned'));
    document.querySelectorAll('.message.has-menu-open').forEach(item => item.classList.remove('has-menu-open'));
    try { openMessageMenuId = null; } catch {}
  }

  function renderMenu(menu, message) {
    const id = message.dataset.messageId;
    const isOwn = message.classList.contains('outgoing');
    menu.dataset.menuFor = id;
    menu.innerHTML = ACTIONS.map(item => {
      const disabled = item.disabled || (item.ownOnly && !isOwn);
      return `
        <button type="button" class="message-menu-item" data-action="${esc(item.action)}" data-message-id="${esc(id)}" ${disabled ? 'disabled' : ''}>
          <span>${esc(item.icon)}</span>
          <em>${esc(item.label)}</em>
        </button>
      `;
    }).join('');
  }

  function positionMenu(menu, message) {
    menu.style.left = '-9999px';
    menu.style.top = '-9999px';
    menu.classList.add('is-open');

    const rect = message.getBoundingClientRect();
    const vw = document.documentElement.clientWidth || window.innerWidth;
    const vh = document.documentElement.clientHeight || window.innerHeight;
    const isOutgoing = message.classList.contains('outgoing');
    const height = Math.min(menu.scrollHeight || 320, vh - GAP * 2);

    const rightPlace = rect.right + 12;
    const leftPlace = rect.left - MENU_WIDTH - 12;
    let left = isOutgoing ? leftPlace : rightPlace;

    if (left < GAP || left + MENU_WIDTH > vw - GAP) {
      left = isOutgoing ? rightPlace : leftPlace;
    }
    left = clamp(left, GAP, vw - MENU_WIDTH - GAP);

    let top = rect.top;
    if (top + height > vh - GAP) top = rect.bottom - height;
    top = clamp(top, GAP, Math.max(GAP, vh - height - GAP));

    menu.style.left = `${Math.round(left)}px`;
    menu.style.top = `${Math.round(top)}px`;
    menu.style.maxHeight = `${Math.max(160, vh - GAP * 2)}px`;
  }

  function openFixedMenu(messageOrId) {
    const message = typeof messageOrId === 'string' ? messageById(messageOrId) : messageOrId;
    if (!message?.dataset?.messageId) return;
    closeMenus();
    const menu = ensureMenu();
    renderMenu(menu, message);
    message.classList.add('has-menu-open');
    message.querySelector('.message-tools')?.classList.add('is-pinned');
    positionMenu(menu, message);
    try { openMessageMenuId = message.dataset.messageId; } catch {}
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

  function clearModes() {
    activeReply = null;
    activeEdit = null;
    document.getElementById(PREVIEW_ID)?.classList.remove('is-visible');
    const send = document.getElementById('sendMessageButton');
    if (send) send.textContent = 'Надіслати';
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
    const supa = client();
    const uid = currentUserId();
    if (!supa || !uid) return;
    try {
      const { error } = await supa.from('messenger_messages').update({ body }).eq('id', activeEdit.id).eq('user_id', uid);
      if (error) throw error;
      const message = messageById(activeEdit.id);
      const bodyNode = message?.querySelector('.message-body') || message?.querySelector('span:not(.message-status)');
      if (bodyNode) bodyNode.textContent = body;
      message?.classList.add('is-edited-message');
      if (input) input.value = '';
      clearModes();
    } catch (error) {
      alert(`Не вдалося відредагувати повідомлення: ${error.message || error}`);
    }
  }

  async function copyMessage(message) {
    const text = msgText(message);
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const area = document.createElement('textarea');
      area.value = text;
      document.body.appendChild(area);
      area.select();
      document.execCommand('copy');
      area.remove();
    }
  }

  async function deleteMessage(message) {
    if (!message?.classList?.contains('outgoing')) return;
    const supa = client();
    const uid = currentUserId();
    if (!supa || !uid) return;
    const id = message.dataset.messageId;
    const { error } = await supa.from('messenger_messages').delete().eq('id', id).eq('user_id', uid);
    if (error) {
      alert(`Не вдалося видалити повідомлення: ${error.message}`);
      return;
    }
    message.remove();
    try { renderedMessageIds.delete(id); } catch {}
  }

  function addCorner(message) {
    if (!message || message.dataset.coreCornerReady === '1') return;
    message.dataset.coreCornerReady = '1';
    if (!message.querySelector('.message-corner-menu')) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'message-corner-menu';
      button.setAttribute('aria-label', 'Дії з повідомленням');
      button.addEventListener('pointerdown', event => {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation?.();
        openFixedMenu(message);
      }, true);
      button.addEventListener('click', event => {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation?.();
        openFixedMenu(message);
      }, true);
      message.appendChild(button);
    }
  }

  function stripNativeReceiptTooltips(scope = document) {
    scope.querySelectorAll?.('.message-status[title]').forEach(status => {
      const nativeTitle = status.getAttribute('title');
      if (nativeTitle && !status.dataset.tooltip) status.dataset.tooltip = nativeTitle;
      status.removeAttribute('title');
      status.setAttribute('aria-label', status.dataset.tooltip || status.textContent.trim());
    });
  }

  function bind(scope = document) {
    ensureStyle();
    stripNativeReceiptTooltips(scope);
    scope.querySelectorAll?.(MESSAGE_SELECTOR)?.forEach(addCorner);
    if (scope.matches?.(MESSAGE_SELECTOR)) addCorner(scope);
  }

  document.addEventListener('pointerdown', event => {
    const trigger = event.target.closest?.('.message-corner-menu, .message-menu-toggle');
    if (!trigger) return;
    const message = event.target.closest?.(MESSAGE_SELECTOR);
    if (!message) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation?.();
    openFixedMenu(message);
  }, true);

  document.addEventListener('click', event => {
    const trigger = event.target.closest?.('.message-corner-menu, .message-menu-toggle');
    if (trigger) {
      const message = event.target.closest?.(MESSAGE_SELECTOR);
      if (message) {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation?.();
        openFixedMenu(message);
      }
      return;
    }

    const item = event.target.closest?.(`#${MENU_ID} .message-menu-item`);
    if (item) {
      const message = messageById(item.dataset.messageId);
      if (!message || item.disabled) return;
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation?.();
      closeMenus();
      if (item.dataset.action === 'reply') startReply(message);
      if (item.dataset.action === 'copy') copyMessage(message);
      if (item.dataset.action === 'edit') startEdit(message);
      if (item.dataset.action === 'delete') deleteMessage(message);
      return;
    }

    if (activeEdit && event.target.closest?.('#sendMessageButton')) {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation?.();
      saveEdit();
      return;
    }

    if (!event.target.closest?.(`#${MENU_ID}, .message-context-menu, .message-corner-menu, .message-menu-toggle, .message-status`)) {
      closeMenus();
    }
  }, true);

  document.addEventListener('contextmenu', event => {
    const message = event.target.closest?.(MESSAGE_SELECTOR);
    if (!message) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation?.();
    openFixedMenu(message);
  }, true);

  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') { clearModes(); closeMenus(); }
    if (activeEdit && event.key === 'Enter' && !event.shiftKey && event.target?.id === 'messageInput') {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation?.();
      saveEdit();
    }
  }, true);

  window.addEventListener('resize', closeMenus);
  document.addEventListener('scroll', event => {
    if (event.target?.closest?.(`#${MENU_ID}`)) return;
    closeMenus();
  }, true);

  window.openMessageContextMenu = openFixedMenu;
  window.RebusContextMenuRescue = { open: openFixedMenu, close: closeMenus };

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
  window.setTimeout(init, 1800);
})();
