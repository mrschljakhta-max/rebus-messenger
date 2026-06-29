(() => {
  const MESSAGE_SELECTOR = '#messagesList .message[data-message-id]';
  const STYLE_ID = 'rebus-forced-message-arrow-style';

  function ensureStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      #page-chat .message[data-message-id] { position: relative !important; min-width: 84px !important; }
      #page-chat .message[data-message-id].incoming { padding-right: 30px !important; }
      #page-chat .message[data-message-id].outgoing { padding-left: 30px !important; }
      #page-chat .message-corner-menu {
        position: absolute !important;
        top: 8px !important;
        z-index: 40 !important;
        width: 16px !important;
        height: 16px !important;
        min-width: 16px !important;
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
        color: rgba(244,251,255,.76) !important;
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
        opacity: .9 !important;
        pointer-events: auto !important;
      }
      #page-chat .message-corner-menu:hover { color: #fff !important; }
    `;
    document.head.appendChild(style);
  }

  function openMenu(message) {
    if (!message) return;
    if (typeof openMessageContextMenu === 'function') {
      openMessageContextMenu(message.dataset.messageId, message);
      return;
    }
    message.querySelector('.message-menu-toggle')?.click();
  }

  function ensureButtons(scope = document) {
    scope.querySelectorAll?.(MESSAGE_SELECTOR)?.forEach(message => {
      if (message.querySelector('.message-corner-menu')) return;
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'message-corner-menu';
      button.setAttribute('aria-label', 'Дії повідомлення');
      button.addEventListener('click', event => {
        event.preventDefault();
        event.stopPropagation();
        openMenu(message);
      }, true);
      message.appendChild(button);
    });
  }

  function init() {
    ensureStyle();
    ensureButtons(document);
    const list = document.getElementById('messagesList');
    if (!list || list.dataset.arrowForceReady === '1') return;
    list.dataset.arrowForceReady = '1';
    new MutationObserver(mutations => {
      mutations.forEach(mutation => mutation.addedNodes.forEach(node => {
        if (node instanceof HTMLElement) ensureButtons(node);
      }));
      ensureButtons(document);
    }).observe(list, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
  window.setTimeout(init, 300);
  window.setTimeout(init, 900);
})();
