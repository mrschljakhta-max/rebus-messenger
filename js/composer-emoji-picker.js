(() => {
  const EMOJI_GROUPS = [
    {
      label: 'Популярні',
      items: ['😀', '😄', '😂', '🤣', '😊', '😍', '😎', '🤔', '😮', '😢', '😡', '🫡']
    },
    {
      label: 'Дії',
      items: ['👍', '👎', '👏', '🙌', '🤝', '🙏', '👌', '💪', '👀', '✍️', '📌', '✅']
    },
    {
      label: 'Службові',
      items: ['⚡', '🔥', '🚨', '🛡️', '📎', '📍', '🧭', '📡', '🔒', '🔐', '🕒', '📋']
    },
    {
      label: 'Символи',
      items: ['❤️', '💙', '💛', '⭐', '✨', '❗', '❓', '➕', '➖', '⬆️', '⬇️', '➡️']
    }
  ];

  const ALL_EMOJIS = EMOJI_GROUPS.flatMap(group => group.items);
  let picker = null;
  let activeGroupIndex = 0;

  function getElements() {
    return {
      button: document.getElementById('composerEmojiButton'),
      input: document.getElementById('messageInput'),
      composeBox: document.querySelector('.compose-box')
    };
  }

  function insertEmoji(input, emoji) {
    if (!input || input.disabled) return;
    const start = input.selectionStart ?? input.value.length;
    const end = input.selectionEnd ?? start;
    input.value = `${input.value.slice(0, start)}${emoji}${input.value.slice(end)}`;
    input.focus();
    const nextPosition = start + emoji.length;
    input.selectionStart = input.selectionEnd = nextPosition;
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }

  function closePicker() {
    if (!picker) return;
    picker.classList.remove('is-open');
    const { button } = getElements();
    button?.setAttribute('aria-expanded', 'false');
  }

  function togglePicker() {
    const { button, input } = getElements();
    if (!button || !input || input.disabled) return;
    ensurePicker();
    const isOpen = picker.classList.toggle('is-open');
    button.setAttribute('aria-expanded', String(isOpen));
    if (isOpen) {
      renderGroup(activeGroupIndex);
      setTimeout(() => picker.querySelector('.rebus-emoji-search')?.focus(), 20);
    }
  }

  function renderGroup(index, filter = '') {
    if (!picker) return;
    activeGroupIndex = index;
    const grid = picker.querySelector('.rebus-emoji-grid');
    const tabs = picker.querySelectorAll('.rebus-emoji-tab');
    const normalizedFilter = filter.trim().toLowerCase();
    const source = normalizedFilter ? ALL_EMOJIS : EMOJI_GROUPS[index].items;
    const items = source.filter(item => !normalizedFilter || item.includes(normalizedFilter));

    tabs.forEach((tab, tabIndex) => {
      tab.classList.toggle('is-active', tabIndex === index && !normalizedFilter);
    });

    grid.innerHTML = items.map(emoji => `
      <button class="rebus-emoji-item" type="button" data-emoji="${emoji}" aria-label="Додати емодзі ${emoji}">${emoji}</button>
    `).join('') || '<div class="rebus-emoji-empty">Нічого не знайдено</div>';
  }

  function ensurePicker() {
    if (picker) return picker;

    const { composeBox, button } = getElements();
    if (!composeBox || !button) return null;

    picker = document.createElement('div');
    picker.className = 'rebus-emoji-picker';
    picker.setAttribute('role', 'dialog');
    picker.setAttribute('aria-label', 'Вибір емодзі');
    picker.innerHTML = `
      <div class="rebus-emoji-head">
        <strong>Емодзі</strong>
        <button class="rebus-emoji-close" type="button" aria-label="Закрити">×</button>
      </div>
      <input class="rebus-emoji-search" type="search" placeholder="Пошук емодзі…" aria-label="Пошук емодзі" />
      <div class="rebus-emoji-tabs" role="tablist">
        ${EMOJI_GROUPS.map((group, index) => `
          <button class="rebus-emoji-tab${index === activeGroupIndex ? ' is-active' : ''}" type="button" data-group-index="${index}">${group.label}</button>
        `).join('')}
      </div>
      <div class="rebus-emoji-grid" aria-label="Набір емодзі"></div>
    `;

    composeBox.appendChild(picker);
    button.setAttribute('aria-haspopup', 'dialog');
    button.setAttribute('aria-expanded', 'false');

    picker.querySelector('.rebus-emoji-close')?.addEventListener('click', closePicker);
    picker.querySelector('.rebus-emoji-search')?.addEventListener('input', event => {
      renderGroup(activeGroupIndex, event.target.value || '');
    });

    picker.querySelectorAll('.rebus-emoji-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        const search = picker.querySelector('.rebus-emoji-search');
        if (search) search.value = '';
        renderGroup(Number(tab.dataset.groupIndex || 0));
      });
    });

    picker.addEventListener('click', event => {
      const emojiButton = event.target.closest('.rebus-emoji-item');
      if (!emojiButton) return;
      insertEmoji(getElements().input, emojiButton.dataset.emoji || emojiButton.textContent || '');
    });

    renderGroup(activeGroupIndex);
    return picker;
  }

  document.addEventListener('click', event => {
    const { button } = getElements();
    if (!button) return;

    if (event.target.closest('#composerEmojiButton')) {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      togglePicker();
      return;
    }

    if (picker?.classList.contains('is-open') && !event.target.closest('.rebus-emoji-picker')) {
      closePicker();
    }
  }, true);

  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') closePicker();
  });
})();
