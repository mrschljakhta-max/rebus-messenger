(() => {
  const COLLAPSE_CLASS = 'is-auto-collapsed';
  let collapseTimer = null;

  function loadAsset(tag, id, attrs) {
    if (document.getElementById(id)) return;
    const node = document.createElement(tag);
    node.id = id;
    Object.entries(attrs).forEach(([key, value]) => node.setAttribute(key, value));
    (tag === 'script' ? document.body : document.head).appendChild(node);
  }

  function ensureExtraAssets() {
    loadAsset('link', 'rebus-mfa-enrollment-style', {
      rel: 'stylesheet',
      href: 'css/mfa-enrollment.css?v=1.0.0'
    });
    loadAsset('script', 'rebus-mfa-enrollment-script', {
      src: 'js/mfa-enrollment-fix.js?v=1.0.0',
      defer: 'defer'
    });
    loadAsset('link', 'rebus-contacts-filter-icons-style', {
      rel: 'stylesheet',
      href: 'css/contacts-filter-icons.css?v=1.0.0'
    });
    loadAsset('script', 'rebus-contacts-filter-icons-script', {
      src: 'js/contacts-filter-icons.js?v=1.0.0',
      defer: 'defer'
    });
    loadAsset('link', 'rebus-contact-status-avatar-style', {
      rel: 'stylesheet',
      href: 'css/contact-status-avatar.css?v=1.0.0'
    });
    loadAsset('script', 'rebus-contact-status-avatar-script', {
      src: 'js/contact-status-avatar.js?v=1.0.0',
      defer: 'defer'
    });
    loadAsset('link', 'rebus-chat-status-avatar-style', {
      rel: 'stylesheet',
      href: 'css/chat-status-avatar.css?v=1.0.0'
    });
    loadAsset('script', 'rebus-chat-status-avatar-script', {
      src: 'js/chat-status-avatar.js?v=1.0.0',
      defer: 'defer'
    });
  }

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
    ensureExtraAssets();
    const nav = getNav();
    if (!nav || nav.dataset.autoCollapseReady === '1') return;
    nav.dataset.autoCollapseReady = '1';

    nav.addEventListener('pointerenter', expandNav);
    nav.addEventListener('pointerleave', () => scheduleCollapse(30));

    nav.addEventListener('focusout', () => {
      if (!nav.matches(':hover')) scheduleCollapse(60);
    });

    collapseNav();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bindNav, { once: true });
  else bindNav();
  window.setTimeout(bindNav, 500);
})();