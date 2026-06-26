const enterButton = document.getElementById('enterButton');

enterButton?.addEventListener('click', () => {
  enterButton.classList.add('is-loading');
  enterButton.querySelector('span').textContent = 'Вхід…';

  window.setTimeout(() => {
    enterButton.querySelector('span').textContent = 'Вхід';
    enterButton.classList.remove('is-loading');
    alert('Наступний етап: підключення авторизації REBUS.');
  }, 650);
});
