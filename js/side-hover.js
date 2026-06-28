(() => {
  const MESSAGE_SELECTOR = '#messagesList .message[data-message-id]';
  const TOOL_SELECTOR = '.message-tools';
  const SIDE_ZONE_WIDTH = 92;
  const STYLES = [
    ['rebus-reactions-hover-style', 'css/reactions-hover.css'],
    ['rebus-chat-polish-style', 'css/chat-polish.css']
  ];
  const SCRIPTS = [
    ['rebus-message-actions-script', 'js/message-actions.js']
  ];
  let activeMessage = null;
  let hideTimer = null;
  let polishObserver = null;

  function ensureStyles() {
    STYLES.forEach(([id, href]) => {
      if (document.getElementById(id)) return;
      const link = document.createElement('link');
      link.id = id;
      link.rel = 'stylesheet';
      link.href = href;
      document.head.appendChild(link);
    });
  }

  function ensureScripts() {
    SCRIPTS.forEach(([id, src]) => {
      if (document.getElementById(id)) return;
      const script = document.createElement('script');
      script.id = id;
      script.src = src;
      script.defer = true;
      document.body.appendChild(script);
    });
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

  function smoothScrollMessages() {
    const list = document.getElementById('messagesList');
    if (!list) return;
    window.requestAnimationFrame(() => {
      list.scrollTo({ top: list.scrollHeight, behavior: 'smooth' });
    });
  }

  function flashMessage(message) {
    if (!message) return;
    message.classList.remove('is-highlighted');
    void message.offsetWidth;
    message.classList.add('is-highlighted');
    window.setTimeout(() => message.classList.remove('is-highlighted'), 1900);
  }

  function ensureTypingIndicator() {
    const list = document.getElementById('messagesList');
    if (!list || document.getElementById('typingIndicator')) return;
    const indicator = document.createElement('div');
    indicator.id = 'typingIndicator';
    indicator.className = 'typing-indicator';
    indicator.innerHTML = '<span>Користувач друкує</span><span class="typing-dots" aria-hidden="true"><i></i><i></i><i></i></span>';
    list.appendChild(indicator);
  }

  function bindMessageClickHighlight(scope = document) {
    scope.querySelectorAll?.(MESSAGE_SELECTOR)?.forEach(message => {
      if (message.dataset.polishClickBound === '1') return;
      message.dataset.polishClickBound = '1';
      message.addEventListener('click', event => {
        if (event.target.closest('button, input, a, .message-tools, .reaction-chip')) return;
        flashMessage(message);
      });
    });
  }

  function bindLocalTypingPreview() {
    const input = document.getElementById('messageInput');
    const indicator = document.getElementById('typingIndicator');
    if (!input || !indicator || input.dataset.polishTypingBound === '1') return;
    input.dataset.polishTypingBound = '1';
    let timer = null;
    input.addEventListener('input', () => {
      // Temporary local preview until real remote typing events are connected to Supabase Broadcast.
      if (!input.value.trim()) {
        indicator.classList.remove('is-visible');
        return;
      }
      indicator.classList.add('is-visible');
      window.clearTimeout(timer);
      timer = window.setTimeout(() => indicator.classList.remove('is-visible'), 900);
    });
  }

  function initPolishObserver() {
    const list = document.getElementById('messagesList');
    if (!list || polishObserver) return;

    ensureTypingIndicator();
    bindMessageClickHighlight(document);
    bindLocalTypingPreview();

    polishObserver = new MutationObserver(mutations => {
      let hasNewMessage = false;
      mutations.forEach(mutation => {
        mutation.addedNodes.forEach(node => {
          if (!(node instanceof HTMLElement)) return;
          if (node.matches?.('.message')) hasNewMessage = true;
          if (node.querySelector?.('.message')) hasNewMessage = true;
          bindMessageClickHighlight(node);
        });
      });
      ensureTypingIndicator();
      bindLocalTypingPreview();
      if (hasNewMessage) smoothScrollMessages();
    });

    polishObserver.observe(list, { childList: true, subtree: true });
  }

  function patchSingleReactionPerUser() {
    if (window.__rebusSingleReactionPatch === '1') return;
    window.__rebusSingleReactionPatch = '1';

    try {
      toggleReaction = async function patchedToggleReaction(messageId, reaction = '👍') {
        if (!supabaseClient || !currentUser || !messageId || !reaction) return;

        const current = getMessageReactionState({ id: messageId });
        const alreadyReacted = current.myReactions?.has(reaction);

        const removeCurrent = await supabaseClient
          .from('message_reactions')
          .delete()
          .eq('message_id', messageId)
          .eq('user_id', currentUser.id);

        if (removeCurrent.error) {
          console.warn('[REBUS] Reaction replace/remove failed:', removeCurrent.error.message);
          alert(`Не вдалося змінити реакцію: ${removeCurrent.error.message}`);
          return;
        }

        if (!alreadyReacted) {
          const { error } = await supabaseClient
            .from('message_reactions')
            .insert({
              message_id: messageId,
              user_id: currentUser.id,
              reaction
            });

          if (error) {
            console.warn('[REBUS] Reaction add failed:', error.message);
            alert(`Не вдалося додати реакцію: ${error.message}`);
            return;
          }
        }

        await refreshReactionForMessage(messageId);
      };
    } catch (error) {
      console.warn('[REBUS] Single reaction patch skipped:', error);
    }
  }

  ensureStyles();
  ensureScripts();
  patchSingleReactionPerUser();

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

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initPolishObserver, { once: true });
  } else {
    initPolishObserver();
  }
})();
