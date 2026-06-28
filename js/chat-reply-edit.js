(() => {
  const MESSAGE_SELECTOR = '#messagesList .message[data-message-id]';
  const PREVIEW_ID = 'rebusComposerPreview';
  let activeEdit = null;
  let activeReply = null;

  function getId(message) {
    return message?.dataset?.messageId || '';
  }

  function getText(message) {
    return message?.querySelector?.('.message-body')?.textContent?.trim() || '';
  }

  function getAuthor(message) {
    return message?.querySelector?.('b')?.textContent?.trim() || 'Користувач';
  }

  function isOwn(message) {
    return message?.classList?.contains('outgoing');
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
    preview.querySelector('button').addEventListener('click', () => {
      if (activeEdit) cancelEdit();
      else clearReply();
    });
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

  function clearPreview() {
    const preview = document.getElementById(PREVIEW_ID);
    preview?.classList.remove('is-visible');
    if (preview) preview.dataset.mode = '';
  }

  function startReply(message) {
    activeEdit = null;
    activeReply = { id: getId(message), author: getAuthor(message), text: getText(message) };
    showPreview('reply', `Відповідь: ${activeReply.author}`, activeReply.text);
    document.getElementById('messageInput')?.focus();
  }

  function clearReply() {
    activeReply = null;
    clearPreview();
  }

  function startEdit(message) {
    if (!isOwn(message)) return;
    const input = document.getElementById('messageInput');
    if (!input) return;
    const text = getText(message);
    activeReply = null;
    activeEdit = { id: getId(message), text };
    showPreview('edit', 'Редагування повідомлення', text);
    input.disabled = false;
    input.value = text;
    input.focus();
    input.setSelectionRange?.(text.length, text.length);
    const send = document.getElementById('sendMessageButton');
    if (send) send.textContent = 'Зберегти';
  }

  function cancelEdit() {
    activeEdit = null;
    clearPreview();
    const input = document.getElementById('messageInput');
    if (input) input.value = '';
    const send = document.getElementById('sendMessageButton');
    if (send) send.textContent = 'Надіслати';
  }

  function markEdited(message) {
    message?.classList?.add('is-edited-message');
    const meta = message?.querySelector?.('.message-meta');
    if (meta && !meta.querySelector('.message-edited-label')) {
      meta.insertAdjacentHTML('afterbegin', '<span class="message-edited-label">ред.</span>');
    }
  }

  async function saveEdit() {
    if (!activeEdit) return;
    const input = document.getElementById('messageInput');
    const text = input?.value?.trim() || '';
    if (!text) return;
    const message = document.querySelector(`#messagesList .message[data-message-id="${CSS.escape(activeEdit.id)}"]`);
    if (!message || !isOwn(message)) return;
    const send = document.getElementById('sendMessageButton');
    if (send) send.disabled = true;
    try {
      const { error } = await supabaseClient.from('messenger_messages').update({ body: text }).eq('id', activeEdit.id).eq('user_id', currentUser.id);
      if (error) throw error;
      const body = message.querySelector('.message-body');
      if (body) body.textContent = text;
      markEdited(message);
      cancelEdit();
    } catch (error) {
      alert(`Не вдалося відредагувати повідомлення: ${error.message || error}`);
    } finally {
      if (send) send.disabled = false;
    }
  }

  function addCorner(message) {
    if (!message || message.dataset.cornerActionReady === '1' || !getId(message)) return;
    message.dataset.cornerActionReady = '1';
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'message-corner-menu';
    button.textContent = '⌄';
    button.title = 'Дії повідомлення';
    button.addEventListener('click', event => {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation?.();
      const toggle = message.querySelector('.message-menu-toggle');
      if (toggle) toggle.click();
    }, true);
    message.appendChild(button);
  }

  function patchMenuButtons(scope = document) {
    scope.querySelectorAll?.('.message-menu-item').forEach(button => {
      if (button.dataset.replyEditPatch === '1') return;
      button.dataset.replyEditPatch = '1';
      const action = button.dataset.action;
      const messageId = button.dataset.messageId;
      if (action === 'reply') button.disabled = false;
      if (action === 'edit') {
        const message = document.querySelector(`#messagesList .message[data-message-id="${CSS.escape(messageId)}"]`);
        button.disabled = !isOwn(message);
      }
      button.addEventListener('click', event => {
        const message = document.querySelector(`#messagesList .message[data-message-id="${CSS.escape(messageId)}"]`);
        if (!message) return;
        if (action === 'reply') {
          event.preventDefault();
          event.stopPropagation();
          event.stopImmediatePropagation?.();
          startReply(message);
        }
        if (action === 'edit' && isOwn(message)) {
          event.preventDefault();
          event.stopPropagation();
          event.stopImmediatePropagation?.();
          startEdit(message);
        }
      }, true);
    });
  }

  function enhance(scope = document) {
    scope.querySelectorAll?.(MESSAGE_SELECTOR)?.forEach(addCorner);
    patchMenuButtons(scope);
  }

  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') {
      if (activeEdit) cancelEdit();
      else if (activeReply) clearReply();
    }
    if (activeEdit && event.key === 'Enter' && !event.shiftKey && event.target?.id === 'messageInput') {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation?.();
      saveEdit();
    }
  }, true);

  document.addEventListener('click', event => {
    if (activeEdit && event.target?.closest?.('#sendMessageButton')) {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation?.();
      saveEdit();
      return;
    }
    if (activeReply && event.target?.closest?.('#sendMessageButton')) {
      window.setTimeout(clearReply, 150);
    }
  }, true);

  function init() {
    enhance(document);
    const list = document.getElementById('messagesList');
    if (!list || list.dataset.replyEditObserver === '1') return;
    list.dataset.replyEditObserver = '1';
    new MutationObserver(mutations => {
      mutations.forEach(mutation => mutation.addedNodes.forEach(node => {
        if (node instanceof HTMLElement) enhance(node);
      }));
    }).observe(list, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
  document.addEventListener('click', () => window.setTimeout(init, 80), true);
})();
