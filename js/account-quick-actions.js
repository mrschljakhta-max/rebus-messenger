(() => {
  const ACTIONS = [
    { id: 'accountQuickChat', icon: 'assets/icons/account/brand-hipchat.svg', title: 'Відкрити чат', route: 'chat', primary: true },
    { id: 'accountQuickProfile', icon: 'assets/icons/account/user-check.svg', title: 'Дані профілю', target: 'userDataSection' },
    { id: 'accountQuickCall', icon: 'assets/icons/account/call.svg', title: 'Аудіодзвінок', note: 'Аудіодзвінок буде підключено пізніше.' },
    { id: 'accountQuickVideo', icon: 'assets/icons/account/video-call.svg', title: 'Відеодзвінок', note: 'Відеодзвінок буде підключено пізніше.' }
  ];

  function toast(text) {
    const old = document.querySelector('.account-quick-toast');
    old?.remove();
    const el = document.createElement('div');
    el.className = 'account-quick-toast';
    el.textContent = text;
    Object.assign(el.style, {
      position: 'fixed', right: '24px', bottom: '24px', zIndex: '17000', padding: '12px 16px',
      borderRadius: '16px', color: '#fff', background: 'rgba(5,12,22,.96)',
      border: '1px solid rgba(255,255,255,.1)', boxShadow: '0 18px 44px rgba(0,0,0,.36)', fontWeight: '850'
    });
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 2400);
  }

  function buildActions() {
    return `<div class="account-quick-actions" id="accountQuickActions" aria-label="Швидкі дії акаунта">${ACTIONS.map(action => `<button type="button" class="account-quick-action ${action.primary ? 'is-primary' : ''}" data-account-quick="${action.id}" title="${action.title}" aria-label="${action.title}"><img src="${action.icon}" alt="" /></button>`).join('')}</div>`;
  }

  function inject() {
    const hero = document.querySelector('#page-account .account-hero');
    if (!hero) return;
    const badges = hero.querySelector('.account-badges');
    if (!badges || hero.querySelector('#accountQuickActions')) return;
    badges.insertAdjacentHTML('afterend', buildActions());
  }

  function handleAction(id) {
    const action = ACTIONS.find(item => item.id === id);
    if (!action) return;
    if (action.route) {
      document.querySelector(`[data-route="${action.route}"]`)?.click();
      return;
    }
    if (action.target) {
      document.getElementById(action.target)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }
    if (action.note) toast(action.note);
  }

  document.addEventListener('click', event => {
    const button = event.target.closest('[data-account-quick]');
    if (!button) return;
    event.preventDefault();
    handleAction(button.dataset.accountQuick);
  }, true);

  function init() {
    inject();
    const page = document.getElementById('page-account');
    if (page && page.dataset.quickActionsObserved !== '1') {
      page.dataset.quickActionsObserved = '1';
      new MutationObserver(() => {
        clearTimeout(window.__rebusAccountQuickActionsTimer);
        window.__rebusAccountQuickActionsTimer = setTimeout(inject, 80);
      }).observe(page, { childList: true, subtree: true });
    }
  }

  document.addEventListener('rebus:route-change', event => {
    if (event.detail?.route === 'account') setTimeout(init, 100);
  });
  document.addEventListener('click', event => {
    if (event.target.closest('[data-route="account"]')) setTimeout(init, 120);
  }, true);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true }); else init();
  setTimeout(init, 700);
})();
