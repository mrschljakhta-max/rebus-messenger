(() => {
  const MENU_ID = 'rebusFinalMessageContextMenu';
  const MESSAGE_SELECTOR = '#messagesList .message[data-message-id]';
  const WIDTH = 224;
  const GAP = 10;
  let openedAt = 0;

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
    return document.querySelector(`${MESSAGE_SELECTOR}[data-message-id="${CSS.escape(id)}"]`);
  }

  function getMessageFromEvent(event) {
    return event.target.closest?.(MESSAGE_SELECTOR);
  }

  function msgText(message) {
    return message?.querySelector?.('.message-body')?.textContent?.trim() || '';
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(value, max));
  }

  function ensureStyle() {
    if (document.getElementById('rebus-final-message-context-menu-style')) return;
    const style = document.createElement('style');
    style.id = 'rebus-final-message-context-menu-style';
    style.textContent = `
      #page-chat .message[data-message-id] {
        position: relative !important;
        overflow: visible !important;
      }
      #page-chat .message[data-message-id].incoming { padding-right: 30px !important; }
      #page-chat .message[data-message-id].outgoing { padding-left: 30px !important; }
      #page-chat .message-corner-menu {
        position: absolute !important;
        top: 8px !important;
        z-index: 80 !important;
        width: 20px !important;
        height: 20px !important;
        min-width: 20px !important;
        padding: 0 !important;
        border: 0 !important;
        background: transparent !important;
        box-shadow: none !important;
        outline: 0 !important;
        opacity: 0 !important;
        pointer-events: none !important;
        cursor: pointer !important;
        color: rgba(244,251,255,.88) !important;
        font-size: 0 !important;
        line-height: 0 !important;
      }
      #page-chat .message.incoming .message-corner-menu { right: 8px !important; }
      #page-chat .message.outgoing .message-corner-menu { left: 8px !important; }
      #page-chat .message-corner-menu::before {
        content: "" !important;
        position: absolute !important;
        inset: 2px !important;
        background: currentColor !important;
        clip-path: polygon(12% 28%, 50% 66%, 88% 28%, 100% 40%, 50% 90%, 0 40%) !important;
      }
      #page-chat .message:hover .message-corner-menu,
      #page-chat .message.has-menu-open .message-corner-menu,
      #page-chat .message.has-side-hover .message-corner-menu {
        opacity: 1 !important;
        pointer-events: auto !important;
      }
      #${MENU_ID} {
        position: fixed !important;
        z-index: 2147483000 !important;
        display: none !important;
        flex-direction: column !important;
        width: ${WIDTH}px !important;
        min-width: ${WIDTH}px !important;
        max-width: ${WIDTH}px !important;
        max-height: calc(100vh - 20px) !important;
        overflow: hidden auto !important;
        padding: 8px !important;
        margin: 0 !important;
        inset: auto !important;
        transform: none !important;
        opacity: 1 !important;
        visibility: visible !important;
        pointer-events: auto !important;
        border: 1px solid rgba(255,255,255,.12) !important;
        border-radius: 18px !important;
        background: rgba(5,12,22,.985) !important;
        box-shadow: 0 24px 70px rgba(0,0,0,.58), 0 0 26px rgba(0,216,255,.10) !important;
        backdrop-filter: blur(18px) saturate(1.08) !important;
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
    `;
    document.head.appendChild(style);
  }

  function ensureMenu() {
    ensureStyle();
    let menu = document.getElementById(MENU_ID);
    if (menu) return menu;
    menu = document.createElement('div');
    menu.id = MENU_ID;
    menu.setAttribute('role', 'menu');
    document.body.appendChild(menu);
    return menu;
  }

  function closeMenu() {
    const menu = document.getElementById(MENU_ID);
    menu?.classList.remove('is-open');
    document.querySelectorAll('.message.has-menu-open').forEach(item => item.classList.remove('has-menu-open'));
    document.querySelectorAll('.message-tools.is-pinned').forEach(item => item.classList.remove('is-pinned'));
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

  function positionMenu(menu, message, event) {
    const rect = message.getBoundingClientRect();
    const vw = document.documentElement.clientWidth || window.innerWidth;
    const vh = document.documentElement.clientHeight || window.innerHeight;
    const isOwn = message.classList.contains('outgoing');

    menu.style.left = '-9999px';
    menu.style.top = '-9999px';
    menu.classList.add('is-open');

    const height = Math.min(menu.scrollHeight || 340, vh - GAP * 2);
    let left;

    if (event?.type === 'contextmenu' && Number.isFinite(event.clientX)) {
      left = event.clientX;
    } else {
      const rightSide = rect.right + 12;
      const leftSide = rect.left - WIDTH - 12;
      left = isOwn ? leftSide : rightSide;
      if (left < GAP || left + WIDTH > vw - GAP) left = isOwn ? rightSide : leftSide;
    }

    let top = Number.isFinite(event?.clientY) ? event.clientY - 8 : rect.top;
    left = clamp(left, GAP, Math.max(GAP, vw - WIDTH - GAP));
    if (top + height > vh - GAP) top = rect.bottom - height;
    top = clamp(top, GAP, Math.max(GAP, vh - height - GAP));

    menu.style.left = `${Math.round(left)}px`;
    menu.style.top = `${Math.round(top)}px`;
    menu.style.maxHeight = `${Math.max(160, vh - GAP * 2)}px`;
  }

  function openForMessage(message, event = null) {
    if (!message?.dataset?.messageId) return;
    closeMenu();
    const menu = ensureMenu();
    renderMenu(menu, message);
    message.classList.add('has-menu-open');
    message.querySelector('.message-tools')?.classList.add('is-pinned');
    positionMenu(menu, message, event);
    openedAt = Date.now();
    try { openMessageMenuId = message.dataset.messageId; } catch {}
  }

  function ensureCorners(scope = document) {
    ensureStyle();
    scope.querySelectorAll?.(MESSAGE_SELECTOR)?.forEach(message => {
      if (String(message.dataset.messageId || '').startsWith('local-')) return;
      let button = message.querySelector('.message-corner-menu');
      if (!button) {
        button = document.createElement('button');
        button.type = 'button';
        button.className = 'message-corner-menu';
        button.setAttribute('aria-label', 'Дії повідомлення');
        message.appendChild(button);
      }
      button.dataset.finalMenuReady = '1';
    });
  }

  async function copyMessage(message) {
    const text = msgText(message);
    if (!text) return;
    try { await navigator.clipboard.writeText(text); }
    catch {
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

  function startReply(message) {
    if (window.RebusMessageActions?.reply) return window.RebusMessageActions.reply(message);
    const input = document.getElementById('messageInput');
    input?.focus();
  }

  function startEdit(message) {
    if (!message?.classList?.contains('outgoing')) return;
    const input = document.getElementById('messageInput');
    if (!input) return;
    input.disabled = false;
    input.value = msgText(message);
    input.focus();
    input.setSelectionRange?.(input.value.length, input.value.length);
  }

  function handleOpenEvent(event) {
    const trigger = event.target.closest?.('.message-corner-menu, .message-menu-toggle');
    if (!trigger) return;
    const message = getMessageFromEvent(event);
    if (!message) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation?.();
    openForMessage(message, event);
  }

  document.addEventListener('pointerdown', handleOpenEvent, true);
  document.addEventListener('click', event => {
    const trigger = event.target.closest?.('.message-corner-menu, .message-menu-toggle');
    if (trigger) return handleOpenEvent(event);

    const item = event.target.closest?.(`#${MENU_ID} .message-menu-item`);
    if (item) {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation?.();
      const message = messageById(item.dataset.messageId);
      if (!message || item.disabled) return;
      closeMenu();
      if (item.dataset.action === 'reply') startReply(message);
      if (item.dataset.action === 'copy') copyMessage(message);
      if (item.dataset.action === 'edit') startEdit(message);
      if (item.dataset.action === 'delete') deleteMessage(message);
      return;
    }

    if (Date.now() - openedAt < 180) return;
    if (!event.target.closest?.(`#${MENU_ID}, .message-context-menu, .message-corner-menu, .message-menu-toggle`)) closeMenu();
  }, true);

  document.addEventListener('contextmenu', event => {
    const message = getMessageFromEvent(event);
    if (!message) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation?.();
    openForMessage(message, event);
  }, true);

  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') closeMenu();
  }, true);
  window.addEventListener('resize', closeMenu);

  window.openMessageContextMenu = (messageId) => openForMessage(messageById(messageId));
  window.closeMessageMenus = closeMenu;
  window.RebusFinalMessageMenu = { open: openForMessage, close: closeMenu, refresh: () => ensureCorners(document) };

  function init() {
    ensureCorners(document);
    const list = document.getElementById('messagesList');
    if (list && list.dataset.finalMenuObserver !== '1') {
      list.dataset.finalMenuObserver = '1';
      new MutationObserver(mutations => {
        mutations.forEach(mutation => mutation.addedNodes.forEach(node => {
          if (node instanceof HTMLElement) ensureCorners(node);
        }));
        ensureCorners(document);
      }).observe(list, { childList: true, subtree: true });
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
  setTimeout(init, 300);
  setTimeout(init, 900);
  setInterval(() => ensureCorners(document), 1500);
})();
