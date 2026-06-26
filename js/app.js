const enterButton = document.getElementById('enterButton');

enterButton?.addEventListener('click', () => {
  enterButton.classList.add('is-loading');
  enterButton.querySelector('span').textContent = 'Підготовка входу…';

  window.setTimeout(() => {
    enterButton.querySelector('span').textContent = 'Увійти';
    enterButton.classList.remove('is-loading');
    alert('Наступний етап: підключення авторизації REBUS.');
  }, 650);
});
