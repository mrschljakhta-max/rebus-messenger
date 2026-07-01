(() => {
  const MENU_ID = 'rebusReliableMessageContextMenu';
  const WIDTH = 224;
  const GAP = 10;
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
    return String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#039;');
  }

  function ensureStyle() {
    if (document.getElementById('rebus-context-menu-rescue-style')) return;
    const style = document.createElement('style');
    style.id = 'rebus-context-menu-rescue-style';
    style.textContent = `
      #${MENU_ID} {
        position: fixed !important;
        z-index: 120000 !important;
        width: ${WIDTH}px !important;
        min-width: ${WIDTH}px !important;
        max-width: ${WIDTH}px !important;
        max-height: calc(100vh - 20px) !important;
        overflow: hidden auto !important;
        display: none !important;
        flex-direction: column !important;
        padding: 8px !important;
        border: 1px solid rgba(255,255,255,.12) !important;
        border-radius: 18px !important;
        background: rgba(5, 12, 22, .98) !important;
        box-shadow: 0 24px 70px rgba(0,0,0,.55), 0 0 26px rgba(0,216,255,.10) !important;
        backdrop-filter: blur(18px) saturate(1.08) !important;
        transform: none !important;
        inset: auto !important;
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
    `;
    document.head.appendChild(style);
  }

  function getMessageFromEvent(event) {
    return event.target.closest?.('#messagesList .message[data-message-id]')
      || event.target.closest?.('.message[data-message-id]');
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(value, max));
  }

  function ensureMenu() {
    ensureStyle();
    let menu = document.getElementById(MENU_ID);
    if (menu) return menu;
    menu = document.createElement('div');
    menu.id = MENU_ID;
    menu.className = 'message-context-menu rebus-rescue-context-menu';
    menu.setAttribute('role', 'menu');
    document.body.appendChild(menu);
    return menu;
  }

  function close() {
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
    const leftPlace = rect.left - WIDTH - 12;
    let left = isOutgoing ? leftPlace : rightPlace;

    if (left < GAP || left + WIDTH > vw - GAP) {
      left = isOutgoing ? rightPlace : leftPlace;
    }
    left = clamp(left, GAP, vw - WIDTH - GAP);

    let top = rect.top;
    if (top + height > vh - GAP) top = rect.bottom - height;
    top = clamp(top, GAP, Math.max(GAP, vh - height - GAP));

    menu.style.left = `${Math.round(left)}px`;
    menu.style.top = `${Math.round(top)}px`;
    menu.style.maxHeight = `${Math.max(160, vh - GAP * 2)}px`;
  }

  function openForMessage(message) {
    if (!message?.dataset?.messageId) return;
    close();
    const menu = ensureMenu();
    renderMenu(menu, message);
    message.classList.add('has-menu-open');
    message.querySelector('.message-tools')?.classList.add('is-pinned');
    positionMenu(menu, message);
    try { openMessageMenuId = message.dataset.messageId; } catch {}
  }

  document.addEventListener('pointerdown', event => {
    const trigger = event.target.closest?.('.message-corner-menu, .message-menu-toggle');
    if (!trigger) return;
    const message = getMessageFromEvent(event);
    if (!message) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation?.();
    openForMessage(message);
  }, true);

  document.addEventListener('click', event => {
    const trigger = event.target.closest?.('.message-corner-menu, .message-menu-toggle');
    if (trigger) {
      const message = getMessageFromEvent(event);
      if (message) {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation?.();
        openForMessage(message);
      }
      return;
    }
    if (!event.target.closest?.(`#${MENU_ID}, .message-context-menu, .message-corner-menu, .message-menu-toggle`)) close();
  }, true);

  document.addEventListener('contextmenu', event => {
    const message = getMessageFromEvent(event);
    if (!message) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation?.();
    openForMessage(message);
  }, true);

  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') close();
  }, true);

  window.addEventListener('resize', close);
  document.addEventListener('scroll', event => {
    if (event.target?.closest?.(`#${MENU_ID}`)) return;
    close();
  }, true);

  window.RebusContextMenuRescue = { open: openForMessage, close };
})();
