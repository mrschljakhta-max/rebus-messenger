(() => {
  const MESSAGE_SELECTOR = '#messagesList .message[data-message-id]';
  const TOOL_SELECTOR = '.message-tools';
  const SIDE_ZONE_WIDTH = 92;
  const REACTION_STYLE_ID = 'rebus-reactions-hover-style';
  let activeMessage = null;
  let hideTimer = null;

  function ensureReactionStyles() {
    if (document.getElementById(REACTION_STYLE_ID)) return;
    const link = document.createElement('link');
    link.id = REACTION_STYLE_ID;
    link.rel = 'stylesheet';
    link.href = 'css/reactions-hover.css';
    document.head.appendChild(link);
  }

  function getTool(message) {
    return message?.querySelector?.(TOOL_SELECTOR) || null;
  }

  function clearMessage(message) {
    if (!message) return;
    if (
      message.classList.contains('has-menu-open') ||
      message.classList.contains('has-reaction-open') ||
      getTool(message)?.classList.contains('is-reaction-open') ||
      getTool(message)?.classList.contains('is-pinned')
    ) {
      return;
    }
    message.classList.remove('has-side-hover');
    getTool(message)?.classList.remove('is-hovered');
    if (activeMessage === message) activeMessage = null;
  }

  function activateMessage(message) {
    if (!message) return;
    window.clearTimeout(hideTimer);
    if (activeMessage && activeMessage !== message) clearMessage(activeMessage);
    activeMessage = message;
    message.classList.add('has-side-hover');
    getTool(message)?.classList.add('is-hovered');
  }

  function pointerIsInSideZone(message, clientX, clientY) {
    const rect = message.getBoundingClientRect();
    const inVerticalRange = clientY >= rect.top - 4 && clientY <= rect.bottom + 4;
    if (!inVerticalRange) return false;

    if (message.classList.contains('outgoing')) {
      return clientX >= rect.left - SIDE_ZONE_WIDTH && clientX <= rect.left;
    }

    return clientX >= rect.right && clientX <= rect.right + SIDE_ZONE_WIDTH;
  }

  ensureReactionStyles();

  document.addEventListener('pointermove', event => {
    const tool = event.target.closest?.(TOOL_SELECTOR);
    if (tool) {
      activateMessage(tool.closest('.message'));
      return;
    }

    const messages = document.querySelectorAll(MESSAGE_SELECTOR);
    let hovered = null;

    for (const message of messages) {
      if (pointerIsInSideZone(message, event.clientX, event.clientY)) {
        hovered = message;
        break;
      }
    }

    if (hovered) {
      activateMessage(hovered);
      return;
    }

    if (activeMessage) {
      window.clearTimeout(hideTimer);
      hideTimer = window.setTimeout(() => clearMessage(activeMessage), 120);
    }
  }, true);

  document.addEventListener('pointerdown', event => {
    if (event.target.closest?.(TOOL_SELECTOR)) return;
    if (activeMessage && !event.target.closest?.('.message')) clearMessage(activeMessage);
  }, true);

  document.addEventListener('scroll', () => {
    if (activeMessage) clearMessage(activeMessage);
  }, true);
})();
