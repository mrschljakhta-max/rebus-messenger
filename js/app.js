const enterButton = document.getElementById('enterButton');
const loginPage = document.getElementById('loginPage');
const appShell = document.getElementById('appShell');
const navButtons = document.querySelectorAll('[data-route]');
const pageViews = document.querySelectorAll('[data-page]');
const rightPanel = document.getElementById('rightPanel');
const rightPanelToggle = document.getElementById('rightPanelToggle');

const labels = {
  account: 'Акаунт',
  chat: 'Чат',
  contours: 'Контур',
  library: 'Бібліотека',
  contacts: 'Контакти'
};

function showApp() {
  loginPage?.classList.add('is-leaving');
  enterButton?.classList.add('is-loading');
  enterButton.querySelector('span').textContent = 'Вхід…';

  window.setTimeout(() => {
    if (loginPage) loginPage.hidden = true;
    if (appShell) appShell.hidden = false;
    setRoute('chat');
  }, 520);
}

function showLogin() {
  if (appShell) appShell.hidden = true;
  if (loginPage) {
    loginPage.hidden = false;
    window.requestAnimationFrame(() => loginPage.classList.remove('is-leaving'));
  }
  if (enterButton) {
    enterButton.classList.remove('is-loading');
    enterButton.querySelector('span').textContent = 'Вхід';
  }
}

function setRoute(route) {
  if (route === 'logout') {
    showLogin();
    return;
  }

  pageViews.forEach(page => {
    const isTarget = page.dataset.page === route;
    page.hidden = !isTarget;
    page.classList.toggle('is-active', isTarget);
  });

  navButtons.forEach(button => {
    button.classList.toggle('is-active', button.dataset.route === route);
  });

  document.title = `${labels[route] || 'REBUS'} — REBUS Messenger`;
}

enterButton?.addEventListener('click', showApp);

navButtons.forEach(button => {
  button.addEventListener('click', () => setRoute(button.dataset.route));
});

rightPanelToggle?.addEventListener('click', () => {
  rightPanel?.classList.toggle('is-collapsed');
});
