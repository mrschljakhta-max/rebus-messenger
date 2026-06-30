(() => {
  const COLLAPSE_CLASS = 'is-auto-collapsed';
  let collapseTimer = null;

  function getNav() {
    return document.querySelector('.left-nav');
  }

  function blurInsideNav(nav) {
    if (document.activeElement instanceof HTMLElement && nav?.contains(document.activeElement)) {
      document.activeElement.blur();
    }
  }

  function collapseNav() {
    const nav = getNav();
    if (!nav) return;
    window.clearTimeout(collapseTimer);
    nav.classList.add(COLLAPSE_CLASS);
    blurInsideNav(nav);
  }

  function expandNav() {
    const nav = getNav();
    if (!nav) return;
    window.clearTimeout(collapseTimer);
    nav.classList.remove(COLLAPSE_CLASS);
  }

  function scheduleCollapse(delay = 80) {
    window.clearTimeout(collapseTimer);
    collapseTimer = window.setTimeout(collapseNav, delay);
  }

  document.addEventListener('click', event => {
    const routeButton = event.target.closest('[data-route]');
    if (!routeButton || routeButton.dataset.route === 'logout') return;
    scheduleCollapse(70);
  }, true);

  document.addEventListener('keydown', event => {
    const routeButton = event.target.closest?.('[data-route]');
    if (!routeButton || routeButton.dataset.route === 'logout') return;
    if (event.key === 'Enter' || event.key === ' ') scheduleCollapse(70);
  }, true);

  function bindNav() {
    const nav = getNav();
    if (!nav || nav.dataset.autoCollapseReady === '1') return;
    nav.dataset.autoCollapseReady = '1';

    // Головна логіка: наведення розгортає, відведення завжди згортає.
    nav.addEventListener('pointerenter', expandNav);
    nav.addEventListener('pointerleave', () => scheduleCollapse(30));

    // Якщо фокус випадково залишився на кнопці після кліку, не даємо :focus-within тримати меню відкритим.
    nav.addEventListener('focusout', () => {
      if (!nav.matches(':hover')) scheduleCollapse(60);
    });

    // Стартовий стан — згорнутий.
    collapseNav();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bindNav, { once: true });
  else bindNav();
  window.setTimeout(bindNav, 500);
})();
