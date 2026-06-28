(() => {
  const MESSAGE_SELECTOR = '#messagesList .message[data-message-id]';

  function closeMenus() {
    document.querySelectorAll('.message-context-menu.is-open').forEach(menu => {
      menu.classList.remove('is-open', 'rebus-fixed-menu', 'opens-up');
      menu.style.left = '';
      menu.style.top = '';
    });
    document.querySelectorAll('.message-tools.is-pinned').forEach(tool => tool.classList.remove('is-pinned'));
    document.querySelectorAll('.message.has-menu-open').forEach(message => message.classList.remove('has-menu-open'));
  }

  function safeBottom() {
    const composer = document.querySelector('#page-chat .compose-box');
    const preview = document.getElementById('rebusComposerPreview') || document.querySelector('.rebus-reply-preview.is-visible');
    const composerTop = composer?.getBoundingClientRect?.().top || window.innerHeight;
    const previewTop = preview?.classList?.contains('is-visible') ? preview.getBoundingClientRect().top : composerTop;
    return Math.min(window.innerHeight - 12, composerTop - 12, previewTop - 12);
  }

  function openFixedMenu(message, point) {
    if (!message?.dataset?.messageId) return;
    const menu = message.querySelector(`.message-context-menu[data-menu-for="${CSS.escape(message.dataset.messageId)}"]`);
    if (!menu) return;

    closeMenus();
    message.classList.add('has-menu-open');
    menu.closest('.message-tools')?.classList.add('is-pinned');

    menu.classList.add('is-open', 'rebus-fixed-menu');
    menu.style.left = '0px';
    menu.style.top = '0px';

    menu.querySelectorAll('.message-menu-item').forEach(button => {
      const action = button.dataset.action;
      if (action === 'reply') button.disabled = false;
      if (action === 'edit') button.disabled = !message.classList.contains('outgoing');
    });

    const rect = menu.getBoundingClientRect();
    const gap = 10;
    const bottom = safeBottom();
    const x = point?.clientX ?? point?.x ?? message.getBoundingClientRect().right;
    const y = point?.clientY ?? point?.y ?? message.getBoundingClientRect().bottom;
    const left = Math.min(Math.max(gap, x - rect.width + 8), window.innerWidth - rect.width - gap);
    const openUp = bottom - y < rect.height + gap;
    const top = openUp ? y - rect.height - gap : y + gap;

    menu.classList.toggle('opens-up', openUp);
    menu.style.left = `${left}px`;
    menu.style.top = `${Math.max(gap, Math.min(top, bottom - rect.height))}px`;
  }

  function bind(scope = document) {
    scope.querySelectorAll?.(MESSAGE_SELECTOR)?.forEach(message => {
      if (message.dataset.nativeMenuFixed === '1') return;
      message.dataset.nativeMenuFixed = '1';

      message.addEventListener('contextmenu', event => {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation?.();
        openFixedMenu(message, event);
      }, true);
    });

    scope.querySelectorAll?.('.message-menu-toggle').forEach(button => {
      if (button.dataset.nativeMenuFixed === '1') return;
      button.dataset.nativeMenuFixed = '1';
      button.addEventListener('click', event => {
        const message = button.closest(MESSAGE_SELECTOR);
        if (!message) return;
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation?.();
        const rect = button.getBoundingClientRect();
        openFixedMenu(message, { clientX: rect.right, clientY: rect.bottom });
      }, true);
    });
  }

  document.addEventListener('click', event => {
    if (!event.target.closest?.('.message-context-menu, .message-menu-toggle, .message-corner-menu')) closeMenus();
  }, true);

  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') closeMenus();
  }, true);

  document.addEventListener('scroll', closeMenus, true);
  window.addEventListener('resize', closeMenus);

  function init() {
    bind(document);
    const list = document.getElementById('messagesList');
    if (!list || list.dataset.nativeMenuFixObserver === '1') return;
    list.dataset.nativeMenuFixObserver = '1';
    new MutationObserver(mutations => {
      mutations.forEach(mutation => mutation.addedNodes.forEach(node => {
        if (node instanceof HTMLElement) bind(node);
      }));
    }).observe(list, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
  document.addEventListener('click', () => window.setTimeout(init, 60), true);
})();
