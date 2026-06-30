(() => {
  const COLLAPSE_CLASS = 'is-auto-collapsed';

  function getNav() {
    return document.querySelector('.left-nav');
  }

  function collapseNav() {
    const nav = getNav();
    if (!nav) return;
    nav.classList.add(COLLAPSE_CLASS);
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
  }

  function unlockNav() {
    getNav()?.classList.remove(COLLAPSE_CLASS);
  }

  document.addEventListener('click', event => {
    const routeButton = event.target.closest('[data-route]');
    if (!routeButton || routeButton.dataset.route === 'logout') return;
    window.setTimeout(collapseNav, 80);
  }, true);

  document.addEventListener('keydown', event => {
    const routeButton = event.target.closest?.('[data-route]');
    if (!routeButton || routeButton.dataset.route === 'logout') return;
    if (event.key === 'Enter' || event.key === ' ') window.setTimeout(collapseNav, 80);
  }, true);

  function bindNav() {
    const nav = getNav();
    if (!nav || nav.dataset.autoCollapseReady === '1') return;
    nav.dataset.autoCollapseReady = '1';
    nav.addEventListener('pointerleave', unlockNav);
    nav.addEventListener('pointerenter', () => {
      if (!nav.matches(':focus-within')) unlockNav();
    });
    nav.addEventListener('focusin', () => {
      if (!nav.classList.contains(COLLAPSE_CLASS)) return;
      window.setTimeout(() => {
        if (!nav.matches(':hover')) unlockNav();
      }, 120);
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bindNav, { once: true });
  else bindNav();
  window.setTimeout(bindNav, 500);
})();
