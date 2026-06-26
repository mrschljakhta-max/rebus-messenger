const enterButton = document.getElementById('enterButton');
const loginPage = document.querySelector('.login-page');
const connectLayer = document.getElementById('connectLayer');
const connectText = document.getElementById('connectText');

const connectSteps = [
  'Перевірка доступу',
  'Підготовка захищеного контуру',
  'Підключення до REBUS Messenger'
];

let isConnecting = false;

enterButton?.addEventListener('click', () => {
  if (isConnecting) return;
  isConnecting = true;

  enterButton.classList.add('is-loading');
  enterButton.querySelector('span').textContent = 'Вхід…';
  loginPage?.classList.add('is-connecting');
  connectLayer?.classList.add('is-visible');
  connectLayer?.setAttribute('aria-hidden', 'false');

  let stepIndex = 0;
  connectText.textContent = connectSteps[stepIndex];

  const stepTimer = window.setInterval(() => {
    stepIndex += 1;
    if (stepIndex < connectSteps.length) {
      connectText.textContent = connectSteps[stepIndex];
    } else {
      window.clearInterval(stepTimer);
      connectText.textContent = 'Наступний етап — авторизація REBUS';
    }
  }, 720);
});
