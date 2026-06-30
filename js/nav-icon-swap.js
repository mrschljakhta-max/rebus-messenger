(() => {
  const ICONS = {
    chat: ['assets/icons/nav/chat.png', 'assets/icons/nav/chat-active.svg'],
    contours: ['assets/icons/nav/people.png', 'assets/icons/nav/people-active.svg'],
    library: ['assets/icons/nav/book.svg', 'assets/icons/nav/book-active.svg'],
    contacts: ['assets/icons/nav/contact-book.png', 'assets/icons/nav/contact-book-active.svg'],
    settings: ['assets/icons/nav/settings.svg', 'assets/icons/nav/settings-active.svg']
  };

  function setupIcon(button) {
    const route = button?.dataset?.route;
    const img = button?.querySelector?.('.nav-icon img');
    if (!route || !img || !ICONS[route]) return;
    img.dataset.defaultIcon = ICONS[route][0];
    img.dataset.activeIcon = ICONS[route][1];
  }

  function refreshIcons() {
    document.querySelectorAll('[data-route]').forEach(button => {
      setupIcon(button);
      const img = button.querySelector('.nav-icon img');
      if (!img?.dataset?.defaultIcon) return;
      const active = button.classList.contains('is-active');
      const next = active ? img.dataset.activeIcon : img.dataset.defaultIcon;
      if (!img.getAttribute('src')?.includes(next)) img.setAttribute('src', next);
      img.classList.toggle('is-active-icon', active);
    });
  }

  function init() {
    refreshIcons();
    const nav = document.querySelector('.left-nav');
    if (nav && nav.dataset.iconSwapReady !== '1') {
      nav.dataset.iconSwapReady = '1';
      new MutationObserver(refreshIcons).observe(nav, { attributes: true, subtree: true, attributeFilter: ['class'] });
    }
  }

  window.RebusNavIcons = { refresh: refreshIcons };
  document.addEventListener('rebus:route-change', refreshIcons);
  document.addEventListener('click', event => {
    if (event.target.closest('[data-route]')) setTimeout(refreshIcons, 0);
  }, true);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
  window.setTimeout(init, 250);
  window.setTimeout(init, 900);
})();
