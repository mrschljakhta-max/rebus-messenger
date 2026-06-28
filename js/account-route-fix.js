(() => {
  function activateAccountPage() {
    const accountPage = document.getElementById('page-account');
    if (!accountPage) return;

    document.querySelectorAll('.page-view').forEach(page => {
      const active = page.id === 'page-account';
      page.hidden = !active;
      page.classList.toggle('is-active', active);
    });

    document.querySelectorAll('[data-route]').forEach(item => {
      item.classList.toggle('is-active', item.dataset.route === 'account');
    });

    if (typeof window.rebusRenderAccountPage === 'function' && !accountPage.querySelector('.account-page-shell')) {
      window.rebusRenderAccountPage();
    }
  }

  function holdAccountPage() {
    const start = Date.now();
    activateAccountPage();
    const timer = window.setInterval(() => {
      activateAccountPage();
      if (Date.now() - start > 2400) window.clearInterval(timer);
    }, 100);
  }

  document.addEventListener('submit', event => {
    if (event.target && event.target.id === 'accountEditForm') {
      holdAccountPage();
      window.setTimeout(holdAccountPage, 400);
    }
  }, true);
})();
