const SUPABASE_URL = 'https://aehedmvxpqxsmzxemkix.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_8cJ1jnSyGOoAG8MOEXZtCA_cY72YAnh';
const MESSENGER_APP_URL = 'https://mrschljakhta-max.github.io/rebus-messenger/';

const enterButton = document.getElementById('enterButton');
const loginPage = document.getElementById('loginPage');
const mfaPage = document.getElementById('mfaPage');
const mfaForm = document.getElementById('mfaForm');
const mfaCode = document.getElementById('mfaCode');
const mfaText = document.getElementById('mfaText');
const mfaStatus = document.getElementById('mfaStatus');
const mfaSubmitButton = document.getElementById('mfaSubmitButton');
const mfaBackButton = document.getElementById('mfaBackButton');
const appShell = document.getElementById('appShell');
const navButtons = document.querySelectorAll('[data-route]');
const pageViews = document.querySelectorAll('[data-page]');
const rightPanel = document.getElementById('rightPanel');
const rightPanelToggle = document.getElementById('rightPanelToggle');
const messagesList = document.getElementById('messagesList');
const messageInput = document.getElementById('messageInput');
const sendMessageButton = document.getElementById('sendMessageButton');
const channelButtons = document.querySelectorAll('[data-channel]');

const supabaseClient = window.supabase?.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true
  }
});

const labels = {
  account: 'Акаунт',
  chat: 'Чат',
  contours: 'Контур',
  library: 'Бібліотека',
  contacts: 'Контакти'
};

const channelLabels = {
  general: 'Загальний чат',
  operators: 'Оператори',
  service: 'Службові повідомлення'
};

let currentUser = null;
let currentChannel = 'general';
let realtimeChannel = null;
let renderedMessageIds = new Set();
let activeMfaFactorId = null;
let activeMfaChallengeId = null;
let mfaMode = 'local-gate';

function getDisplayName(user) {
  return user?.user_metadata?.full_name
    || user?.user_metadata?.name
    || user?.email?.split('@')?.[0]
    || 'Користувач REBUS';
}

function getUserRole() {
  return 'SUPER-ADMIN';
}

function escapeHtml(value = '') {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function formatTime(value) {
  const date = value ? new Date(value) : new Date();
  return date.toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' });
}

function getMfaStorageKey(user = currentUser) {
  return user?.id ? `rebus:messenger:mfa:${user.id}` : 'rebus:messenger:mfa:unknown';
}

function isMessengerMfaVerified(user = currentUser) {
  return sessionStorage.getItem(getMfaStorageKey(user)) === 'verified';
}

function markMessengerMfaVerified(user = currentUser) {
  sessionStorage.setItem(getMfaStorageKey(user), 'verified');
}

function clearMessengerMfaVerified(user = currentUser) {
  if (user?.id) sessionStorage.removeItem(getMfaStorageKey(user));
}

function setLoginButtonState(isLoading, text = 'Вхід') {
  if (!enterButton) return;
  enterButton.classList.toggle('is-loading', isLoading);
  const span = enterButton.querySelector('span');
  if (span) span.textContent = text;
}

function hideAllRoots() {
  if (loginPage) loginPage.hidden = true;
  if (mfaPage) mfaPage.hidden = true;
  if (appShell) appShell.hidden = true;
}

function showApp() {
  hideAllRoots();
  if (appShell) appShell.hidden = false;
  setRoute('chat');
}

function showLogin() {
  hideAllRoots();
  if (loginPage) {
    loginPage.hidden = false;
    window.requestAnimationFrame(() => loginPage.classList.remove('is-leaving'));
  }
  setLoginButtonState(false, 'Вхід');
}

function showMfaGate(message = 'Підтвердіть доступ до робочої зони месенджера.') {
  hideAllRoots();
  if (mfaPage) mfaPage.hidden = false;
  if (mfaText) mfaText.textContent = message;
  if (mfaStatus) mfaStatus.textContent = 'Очікується код 2FA.';
  if (mfaCode) {
    mfaCode.value = '';
    setTimeout(() => mfaCode.focus(), 80);
  }
}

function updateAccountUi(user) {
  const name = getDisplayName(user);
  const email = user?.email || '';
  const role = getUserRole();

  document.querySelectorAll('.account-info strong, .profile-card h2').forEach(el => { el.textContent = name; });
  document.querySelectorAll('.account-info span, .profile-card p').forEach(el => { el.textContent = email; });
  document.querySelectorAll('.account-info em, .role-pill').forEach(el => { el.textContent = role; });
}

function setRoute(route) {
  if (route === 'logout') {
    signOut();
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

  if (route === 'chat' && currentUser) {
    loadMessages();
  }
}


function getMessengerRedirectUrl() {
  const { origin, pathname, hostname } = window.location;

  // GitHub Pages production URL for REBUS Messenger.
  if (hostname === 'mrschljakhta-max.github.io') {
    return `${origin}/rebus-messenger/`;
  }

  // Local development remains possible.
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return `${origin}${pathname}`;
  }

  // Safety fallback: never return old REBUS Secure pages such as
  // rebus-secure.com/verify-2fa.html for Messenger OAuth.
  return MESSENGER_APP_URL;
}

async function signIn() {
  if (!supabaseClient) {
    alert('Supabase client не завантажився. Перевір підключення CDN.');
    return;
  }

  setLoginButtonState(true, 'Вхід…');

  const redirectTo = getMessengerRedirectUrl();
  const { error } = await supabaseClient.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo,
      queryParams: {
        access_type: 'offline',
        prompt: 'select_account'
      }
    }
  });

  if (error) {
    console.error('[REBUS] Login error:', error);
    alert(`Не вдалося розпочати вхід: ${error.message}`);
    setLoginButtonState(false, 'Вхід');
  }
}

async function signOut() {
  if (realtimeChannel && supabaseClient) {
    await supabaseClient.removeChannel(realtimeChannel);
    realtimeChannel = null;
  }
  clearMessengerMfaVerified(currentUser);
  await supabaseClient?.auth.signOut();
  currentUser = null;
  renderedMessageIds.clear();
  if (messagesList) messagesList.innerHTML = '';
  showLogin();
}

function renderSystemMessage(text) {
  if (!messagesList) return;
  messagesList.innerHTML = `
    <div class="message incoming system-message">
      <b>Система</b>
      <span>${escapeHtml(text)}</span>
    </div>
  `;
}

function getMessageStatusLabel(message, isOwn) {
  if (!isOwn) return '';

  if (message.__status === 'sending') return '○ Відправляється';
  if (message.__status === 'failed') return '! Помилка';
  if (message.__readCount > 0) return '✓✓ Прочитано';
  if (message.__receivedCount > 0) return '✓✓ Отримано';
  return '✓ Надіслано';
}

function getMessageStatusClass(message, isOwn) {
  if (!isOwn) return '';
  if (message.__status === 'sending') return 'is-sending';
  if (message.__status === 'failed') return 'is-failed';
  if (message.__readCount > 0) return 'is-read';
  if (message.__receivedCount > 0) return 'is-received';
  return 'is-sent';
}

function appendMessage(message, options = {}) {
  if (!messagesList || !message) return null;
  if (!options.replace && message.id && renderedMessageIds.has(message.id)) return null;

  if (options.replace && options.replaceId) {
    const oldNode = messagesList.querySelector(`[data-message-id="${CSS.escape(options.replaceId)}"]`);
    if (oldNode) oldNode.remove();
    renderedMessageIds.delete(options.replaceId);
  }

  if (message.id) renderedMessageIds.add(message.id);

  const isOwn = currentUser && message.user_id === currentUser.id;
  const statusLabel = getMessageStatusLabel(message, isOwn);
  const statusClass = getMessageStatusClass(message, isOwn);
  const el = document.createElement('div');
  el.className = `message ${isOwn ? 'outgoing' : 'incoming'} ${statusClass}`.trim();
  if (message.id) el.dataset.messageId = message.id;
  el.innerHTML = `
    <b>${escapeHtml(isOwn ? 'Ви' : (message.user_name || message.user_email || 'Користувач'))}</b>
    <span>${escapeHtml(message.body)}</span>
    <small class="message-meta">
      <span>${formatTime(message.created_at)}</span>
      ${statusLabel ? `<em class="message-status" title="${escapeHtml(statusLabel)}">${escapeHtml(statusLabel)}</em>` : ''}
    </small>
  `;
  messagesList.appendChild(el);
  messagesList.scrollTop = messagesList.scrollHeight;
  return el;
}

async function loadReceiptsForOwnMessages(messages = []) {
  if (!supabaseClient || !currentUser || !messages?.length) return messages;

  const ownIds = messages
    .filter(message => message.user_id === currentUser.id && message.id)
    .map(message => message.id);

  if (!ownIds.length) return messages;

  const { data, error } = await supabaseClient
    .from('message_receipts')
    .select('message_id, user_id, received_at, read_at')
    .in('message_id', ownIds)
    .neq('user_id', currentUser.id);

  if (error) {
    console.warn('[REBUS] Receipt summary skipped:', error.message);
    return messages;
  }

  const summary = new Map();
  data?.forEach(receipt => {
    const item = summary.get(receipt.message_id) || { received: 0, read: 0 };
    if (receipt.received_at) item.received += 1;
    if (receipt.read_at) item.read += 1;
    summary.set(receipt.message_id, item);
  });

  return messages.map(message => {
    const item = summary.get(message.id);
    if (!item) return message;
    return {
      ...message,
      __receivedCount: item.received,
      __readCount: item.read
    };
  });
}

async function markIncomingMessagesRead(messages = []) {
  if (!supabaseClient || !currentUser || !messages?.length) return;

  const incoming = messages.filter(message => message.id && message.user_id !== currentUser.id);
  if (!incoming.length) return;

  const now = new Date().toISOString();
  const rows = incoming.map(message => ({
    message_id: message.id,
    user_id: currentUser.id,
    received_at: now,
    read_at: now
  }));

  const { error } = await supabaseClient
    .from('message_receipts')
    .upsert(rows, { onConflict: 'message_id,user_id' });

  if (error) console.warn('[REBUS] Read receipts skipped:', error.message);
}

async function loadMessages() {
  if (!supabaseClient || !currentUser || !messagesList) return;

  messagesList.innerHTML = '';
  renderedMessageIds.clear();
  renderSystemMessage('Завантаження повідомлень…');

  const { data, error } = await supabaseClient
    .from('messenger_messages')
    .select('id, contour_id, channel, user_id, user_email, user_name, body, created_at')
    .eq('channel', currentChannel)
    .is('contour_id', null)
    .order('created_at', { ascending: true })
    .limit(100);

  messagesList.innerHTML = '';

  if (error) {
    console.error('[REBUS] Load messages error:', error);
    renderSystemMessage(`Не вдалося завантажити повідомлення: ${error.message}`);
    return;
  }

  if (!data?.length) {
    renderSystemMessage(`Канал «${channelLabels[currentChannel]}» готовий. Напишіть перше повідомлення.`);
    return;
  }

  const messagesWithReceipts = await loadReceiptsForOwnMessages(data);
  messagesWithReceipts.forEach(appendMessage);
  await markIncomingMessagesRead(data);
}

async function sendMessage() {
  if (!supabaseClient || !currentUser) {
    alert('Спочатку потрібно увійти в REBUS Messenger.');
    return;
  }

  const body = messageInput?.value?.trim();
  if (!body) return;

  const tempId = `local-${Date.now()}`;
  const createdAt = new Date().toISOString();

  const optimisticMessage = {
    id: tempId,
    contour_id: null,
    channel: currentChannel,
    user_id: currentUser.id,
    user_email: currentUser.email,
    user_name: getDisplayName(currentUser),
    body,
    created_at: createdAt,
    __status: 'sending'
  };

  if (messageInput) messageInput.value = '';
  appendMessage(optimisticMessage);
  sendMessageButton.disabled = true;

  const payload = {
    contour_id: null,
    channel: currentChannel,
    user_id: currentUser.id,
    user_email: currentUser.email,
    user_name: getDisplayName(currentUser),
    body
  };

  const { data, error } = await supabaseClient
    .from('messenger_messages')
    .insert(payload)
    .select('id, contour_id, channel, user_id, user_email, user_name, body, created_at')
    .single();

  sendMessageButton.disabled = false;

  if (error) {
    console.error('[REBUS] Send message error:', error);
    appendMessage({ ...optimisticMessage, __status: 'failed' }, { replace: true, replaceId: tempId });
    alert(`Не вдалося надіслати повідомлення: ${error.message}`);
    return;
  }

  appendMessage(data, { replace: true, replaceId: tempId });
}

async function subscribeToMessages() {
  if (!supabaseClient || !currentUser) return;

  if (realtimeChannel) {
    await supabaseClient.removeChannel(realtimeChannel);
    realtimeChannel = null;
  }

  realtimeChannel = supabaseClient
    .channel(`rebus-messages-${currentChannel}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'messenger_messages',
        filter: `channel=eq.${currentChannel}`
      },
      async payload => {
        appendMessage(payload.new);
        await markIncomingMessagesRead([payload.new]);
      }
    )
    .subscribe(status => {
      console.log('[REBUS] Realtime status:', status);
    });
}

function setActiveChannel(channel) {
  currentChannel = channel;
  channelButtons.forEach(button => {
    button.classList.toggle('is-selected', button.dataset.channel === channel);
  });
  loadMessages();
  subscribeToMessages();
}

async function startMessengerMfaChallenge() {
  activeMfaFactorId = null;
  activeMfaChallengeId = null;
  mfaMode = 'local-gate';

  try {
    const { data, error } = await supabaseClient.auth.mfa.listFactors();
    if (error) throw error;

    const factor = data?.totp?.find(item => item.status === 'verified');
    if (!factor) {
      showMfaGate('Для цього акаунта в Supabase ще немає TOTP-фактора. Тимчасово діє внутрішній Messenger 2FA gate.');
      if (mfaStatus) mfaStatus.textContent = 'Введіть будь-який 6-значний код для проходження внутрішнього gate. Наступним етапом підключимо реальну TOTP-перевірку.';
      return;
    }

    const challenge = await supabaseClient.auth.mfa.challenge({ factorId: factor.id });
    if (challenge.error) throw challenge.error;

    activeMfaFactorId = factor.id;
    activeMfaChallengeId = challenge.data.id;
    mfaMode = 'supabase-totp';
    showMfaGate('Введіть 6-значний код із застосунку автентифікації для REBUS Messenger.');
  } catch (error) {
    console.error('[REBUS] MFA challenge error:', error);
    showMfaGate('Не вдалося підготувати Supabase MFA. Тимчасово відкрито внутрішній Messenger 2FA gate.');
    if (mfaStatus) mfaStatus.textContent = error?.message || 'Помилка підготовки MFA.';
  }
}

async function verifyMessengerMfa(code) {
  if (!/^\d{6}$/.test(code)) {
    if (mfaStatus) mfaStatus.textContent = 'Введіть рівно 6 цифр.';
    return;
  }

  if (mfaSubmitButton) mfaSubmitButton.disabled = true;
  if (mfaStatus) mfaStatus.textContent = 'Перевірка коду…';

  try {
    if (mfaMode === 'supabase-totp' && activeMfaFactorId && activeMfaChallengeId) {
      const { error } = await supabaseClient.auth.mfa.verify({
        factorId: activeMfaFactorId,
        challengeId: activeMfaChallengeId,
        code
      });
      if (error) throw error;
    }

    markMessengerMfaVerified(currentUser);
    if (mfaStatus) mfaStatus.textContent = 'Доступ підтверджено.';
    showApp();
    await loadMessages();
    await subscribeToMessages();
  } catch (error) {
    console.error('[REBUS] MFA verify error:', error);
    if (mfaStatus) mfaStatus.textContent = `Код не підтверджено: ${error.message}`;
  } finally {
    if (mfaSubmitButton) mfaSubmitButton.disabled = false;
  }
}

async function enterMessengerAfterAuth(user) {
  currentUser = user;
  updateAccountUi(currentUser);

  if (isMessengerMfaVerified(currentUser)) {
    showApp();
    await loadMessages();
    await subscribeToMessages();
    return;
  }

  await startMessengerMfaChallenge();
}

async function initAuth() {
  if (!supabaseClient) {
    console.error('[REBUS] Supabase не ініціалізувався.');
    showLogin();
    return;
  }

  const { data, error } = await supabaseClient.auth.getSession();
  if (error) console.error('[REBUS] Session error:', error);

  currentUser = data?.session?.user || null;

  if (currentUser) {
    await enterMessengerAfterAuth(currentUser);
  } else {
    showLogin();
  }

  supabaseClient.auth.onAuthStateChange((_event, session) => {
    const nextUser = session?.user || null;
    if (nextUser) {
      enterMessengerAfterAuth(nextUser);
    } else {
      currentUser = null;
      showLogin();
    }
  });
}

enterButton?.addEventListener('click', signIn);

mfaForm?.addEventListener('submit', event => {
  event.preventDefault();
  verifyMessengerMfa(mfaCode?.value?.trim() || '');
});

mfaBackButton?.addEventListener('click', signOut);

navButtons.forEach(button => {
  button.addEventListener('click', () => setRoute(button.dataset.route));
});

rightPanelToggle?.addEventListener('click', () => {
  rightPanel?.classList.toggle('is-collapsed');
});

channelButtons.forEach(button => {
  button.addEventListener('click', () => setActiveChannel(button.dataset.channel));
});

sendMessageButton?.addEventListener('click', sendMessage);
messageInput?.addEventListener('keydown', event => {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault();
    sendMessage();
  }
});

mfaCode?.addEventListener('input', () => {
  mfaCode.value = mfaCode.value.replace(/\D/g, '').slice(0, 6);
});

initAuth();
