(() => {
  const ICONS = {
    all: 'assets/icons/contacts/users.svg',
    online: 'assets/icons/contacts/wifi.svg',
    favorites: 'assets/icons/contacts/user-star.svg',
    recent: 'assets/icons/contacts/clock-hour-10.svg'
  };
  const LABELS = {
    all: 'Усі',
    online: 'Онлайн',
    favorites: 'Обрані',
    recent: 'Нещодавні'
  };

  function applyIcons() {
    document.querySelectorAll('#contactsListScroll [data-contact-quick]').forEach(button => {
      const key = button.dataset.contactQuick;
      if (!ICONS[key] || button.dataset.svgIconReady === '1') return;
      button.dataset.svgIconReady = '1';
      button.innerHTML = `<img src="${ICONS[key]}" alt="" /><span>${LABELS[key] || button.textContent.trim()}</span>`;
    });
  }

  function init() {
    applyIcons();
    const list = document.getElementById('contactsListScroll');
    if (!list || list.dataset.filterIconsObserved === '1') return;
    list.dataset.filterIconsObserved = '1';
    new MutationObserver(() => {
      clearTimeout(window.__rebusContactsFilterIconsTimer);
      window.__rebusContactsFilterIconsTimer = setTimeout(applyIcons, 40);
    }).observe(list, { childList: true, subtree: true });
  }

  document.addEventListener('rebus:contacts-visible', () => setTimeout(init, 80));
  document.addEventListener('rebus:contacts-rendered', () => setTimeout(init, 80));
  document.addEventListener('click', event => {
    if (event.target.closest('[data-route="contacts"]')) setTimeout(init, 180);
  }, true);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
  setTimeout(init, 700);
})();
