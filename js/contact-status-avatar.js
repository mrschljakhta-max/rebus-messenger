(() => {
  const STATUS = {
    online: { label: 'Онлайн', className: 'online' },
    dnd: { label: 'Не турбувати', className: 'dnd' },
    busy: { label: 'Не в мережі', className: 'offline' },
    offline: { label: 'Не в мережі', className: 'offline' }
  };

  function detectStatus(card, dot) {
    if (card?.classList?.contains('is-presence-online') || card?.dataset?.presence === 'online') return 'online';
    const text = card?.querySelector('.contact-main > span')?.textContent?.toLowerCase() || '';
    if (text.includes('онлайн')) return 'online';
    if (text.includes('турб')) return 'dnd';
    if (text.includes('зайнят')) return 'offline';
    if (dot?.classList?.contains('online')) return 'online';
    if (dot?.classList?.contains('dnd')) return 'dnd';
    return 'offline';
  }

  function normalizeCard(card) {
    const avatar = card?.querySelector?.('.contact-avatar');
    if (!avatar) return;
    let dot = avatar.querySelector('.contact-presence-dot');
    if (!dot) {
      dot = document.createElement('i');
      dot.className = 'contact-presence-dot offline';
      avatar.appendChild(dot);
    }

    const key = detectStatus(card, dot);
    const meta = STATUS[key] || STATUS.offline;
    dot.classList.remove('online', 'dnd', 'busy', 'offline');
    dot.classList.add(meta.className);
    dot.dataset.statusLabel = meta.label;
    dot.setAttribute('title', meta.label);
    dot.setAttribute('aria-label', meta.label);

    const statusText = card.querySelector('.contact-main > span');
    if (statusText) statusText.setAttribute('aria-hidden', 'true');
  }

  function refresh() {
    document.querySelectorAll('#contactsListScroll .contact-row-card').forEach(normalizeCard);
  }

  function init() {
    refresh();
    const list = document.getElementById('contactsListScroll');
    if (!list || list.dataset.avatarStatusObserved === '1') return;
    list.dataset.avatarStatusObserved = '1';
    new MutationObserver(() => {
      clearTimeout(window.__rebusContactAvatarStatusTimer);
      window.__rebusContactAvatarStatusTimer = setTimeout(refresh, 60);
    }).observe(list, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'data-presence'] });
  }

  window.RebusContactAvatarStatus = { refresh };
  document.addEventListener('rebus:contacts-visible', () => setTimeout(init, 80));
  document.addEventListener('rebus:contacts-rendered', () => setTimeout(init, 80));
  document.addEventListener('rebus:presence-updated', () => setTimeout(refresh, 80));
  document.addEventListener('click', event => {
    if (event.target.closest('[data-route="contacts"]')) setTimeout(init, 180);
  }, true);

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
  setTimeout(init, 700);
})();
