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
const rightPanelToggle = null;
const messagesList = document.getElementById('messagesList');
const messageInput = document.getElementById('messageInput');
const sendMessageButton = document.getElementById('sendMessageButton');
const channelButtons = document.querySelectorAll('[data-channel]');
const userSearchInput = document.getElementById('userSearchInput');
const directUsersList = document.getElementById('directUsersList');
const directChatHead = document.getElementById('directChatHead');
const directSelfCard = document.getElementById('directSelfCard');
const composerEmojiButton = document.getElementById('composerEmojiButton');

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
let currentChannel = 'direct';
let selectedPeer = null;
let directUsers = [];
let realtimeChannel = null;
let renderedMessageIds = new Set();
let reactionSummary = new Map();
let openMessageMenuId = null;
let openReactionPaletteId = null;
let lastRenderedDay = null;

const QUICK_REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🙏'];
const MESSAGE_MENU_ITEMS = [
  { action: 'reply', label: 'Відповісти', icon: '↩' },
  { action: 'copy', label: 'Копіювати', icon: '▣' },
  { action: 'edit', label: 'Редагувати', icon: '☻' },
  { action: 'forward', label: 'Переслати', icon: '↷' },
  { action: 'pin', label: 'Закріпити', icon: '⚑' },
  { action: 'mark', label: 'Позначити', icon: '☆' },
  { action: 'report', label: 'Поскаржитися', icon: '▱' },
  { action: 'delete', label: 'Видалити', icon: '⌫' }
];
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

function formatDateTime(value) {
  if (!value) return '';
  const date = new Date(value);
  return date.toLocaleString('uk-UA', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function formatMessageDay(value) {
  const date = value ? new Date(value) : new Date();
  const now = new Date();
  const start = d => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const diff = Math.round((start(now) - start(date)) / 86400000);
  if (diff === 0) return 'Сьогодні';
  if (diff === 1) return 'Вчора';
  return date.toLocaleDateString('uk-UA', { day: '2-digit', month: 'long', year: 'numeric' });
}

function makeConversationKey(userA, userB) {
  return [userA, userB].filter(Boolean).sort().join('_');
}

function getInitials(name = '') {
  const clean = String(name || '').trim();
  if (!clean) return 'R';
  const parts = clean.split(/\s+/).slice(0, 2);
  return parts.map(part => part[0]).join('').toUpperCase();
}

function normalizeProfile(row = {}) {
  const id = row.user_id || row.auth_user_id || row.uid || row.id;
  const profileId = row.id || null;
  const email = row.email || '';
  const name = row.full_name || row.display_name || row.name || email?.split('@')?.[0] || 'Користувач REBUS';
  const role = row.role || row.user_role || 'USER';
  return { id, profileId, email, name, role };
}

function isSameDirectConversation(message, peer = selectedPeer) {
  if (!message || !currentUser || !peer) return false;
  const me = currentUser.id;
  const other = peer.id;

  return (
    message.channel === 'direct'
    && (
      (message.user_id === me && message.recipient_id === other)
      || (message.user_id === other && message.recipient_id === me)
      || message.conversation_key === makeConversationKey(me, other)
    )
  );
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
  if (directSelfCard) {
    const avatar = directSelfCard.querySelector('.direct-self-avatar');
    const strong = directSelfCard.querySelector('strong');
    const status = directSelfCard.querySelector('em');
    if (avatar) avatar.textContent = getInitials(name);
    if (strong) strong.textContent = name;
    if (status) status.textContent = 'Онлайн';
  }
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
    loadDirectUsers();
    if (selectedPeer) {
      loadMessages();
      subscribeToMessages();
    } else {
      renderSystemMessage('Оберіть користувача зліва, щоб почати індивідуальне листування.');
    }
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

function getMessageReadTooltip(message, statusLabel) {
  if (!statusLabel || !statusLabel.includes('Прочитано')) return statusLabel || '';
  if (message.__readAt) {
    return `Прочитано: ${formatDateTime(message.__readAt)}`;
  }
  return 'Прочитано отримувачем';
}


function getMessageReactionState(message) {
  const empty = { total: 0, byReaction: {}, myReactions: new Set() };
  if (!message?.id || String(message.id).startsWith('local-')) return empty;
  return reactionSummary.get(message.id) || empty;
}

function normalizeReactionState(rows = []) {
  const state = { total: 0, byReaction: {}, myReactions: new Set() };
  rows.forEach(item => {
    const reaction = item.reaction || '👍';
    if (!state.byReaction[reaction]) {
      state.byReaction[reaction] = { count: 0, likedByMe: false };
    }
    state.byReaction[reaction].count += 1;
    state.total += 1;
    if (item.user_id === currentUser?.id) {
      state.byReaction[reaction].likedByMe = true;
      state.myReactions.add(reaction);
    }
  });
  return state;
}

function getReactionTooltip(reaction, data) {
  const count = data?.count || 0;
  if (!count) return reaction;
  if (data?.likedByMe && count === 1) return `Ваша реакція ${reaction}`;
  if (data?.likedByMe) return `Ви і ще ${count - 1}: ${reaction}`;
  return `${reaction} ${count}`;
}

function renderMessageReactionChips(message) {
  if (!message?.id || String(message.id).startsWith('local-')) return '';
  const state = getMessageReactionState(message);
  const chips = Object.entries(state.byReaction || {})
    .filter(([, data]) => data.count > 0)
    .sort((a, b) => b[1].count - a[1].count)
    .map(([reaction, data]) => `
      <button class="reaction-chip${data.likedByMe ? ' is-own-reaction' : ''}" type="button" data-message-id="${escapeHtml(message.id)}" data-reaction="${escapeHtml(reaction)}" title="${escapeHtml(getReactionTooltip(reaction, data))}">
        <span>${escapeHtml(reaction)}</span>
        ${data.count > 1 ? `<em>${data.count}</em>` : ''}
      </button>
    `)
    .join('');
  if (!chips) return '';
  return `<div class="message-reactions-row">${chips}</div>`;
}

function renderMessageTools(message, isOwn) {
  if (!message?.id || String(message.id).startsWith('local-')) return '';
  const reactions = QUICK_REACTIONS.map(reaction => `
    <button type="button" class="quick-reaction" data-message-id="${escapeHtml(message.id)}" data-reaction="${escapeHtml(reaction)}" title="${escapeHtml(reaction)}">${escapeHtml(reaction)}</button>
  `).join('');

  const menuItems = MESSAGE_MENU_ITEMS.map(item => {
    const disabled = (!isOwn && ['edit', 'delete'].includes(item.action)) || ['reply', 'forward', 'pin', 'mark', 'report'].includes(item.action);
    return `
      <button type="button" class="message-menu-item" data-action="${item.action}" data-message-id="${escapeHtml(message.id)}" ${disabled ? 'disabled' : ''}>
        <span>${escapeHtml(item.icon)}</span>
        <em>${escapeHtml(item.label)}</em>
      </button>
    `;
  }).join('');

  return `
    <div class="message-tools" aria-hidden="false">
      <button type="button" class="message-emoji-trigger" data-message-id="${escapeHtml(message.id)}" title="Реакція">☺</button>
      <div class="quick-reactions-bar" data-palette-for="${escapeHtml(message.id)}">
        ${reactions}
        <button type="button" class="message-menu-toggle" data-message-id="${escapeHtml(message.id)}" title="Більше реакцій і дії">+</button>
      </div>
      <div class="message-context-menu" data-menu-for="${escapeHtml(message.id)}">
        ${menuItems}
      </div>
    </div>
  `;
}

function updateReactionButton(messageId) {
  if (!messagesList || !messageId) return;
  const node = messagesList.querySelector(`[data-message-id="${CSS.escape(messageId)}"]`);
  if (!node) return;
  const row = node.querySelector('.message-reactions-row');
  const message = { id: messageId };
  const html = renderMessageReactionChips(message);
  if (row && html) {
    row.outerHTML = html;
  } else if (row && !html) {
    row.remove();
  } else if (!row && html) {
    node.insertAdjacentHTML('beforeend', html);
  }
  bindMessageReactionEvents(node);
}

async function loadReactionsForMessages(messages = []) {
  if (!supabaseClient || !currentUser || !messages?.length) return messages;

  const ids = messages
    .filter(message => message.id && !String(message.id).startsWith('local-'))
    .map(message => message.id);

  if (!ids.length) return messages;

  const { data, error } = await supabaseClient
    .from('message_reactions')
    .select('message_id, user_id, reaction')
    .in('message_id', ids);

  if (error) {
    console.warn('[REBUS] Reactions skipped:', error.message);
    return messages;
  }

  const grouped = new Map();
  data?.forEach(item => {
    const rows = grouped.get(item.message_id) || [];
    rows.push(item);
    grouped.set(item.message_id, rows);
  });

  ids.forEach(id => reactionSummary.set(id, normalizeReactionState(grouped.get(id) || [])));
  return messages;
}

async function refreshReactionForMessage(messageId) {
  if (!supabaseClient || !currentUser || !messageId) return;

  const { data, error } = await supabaseClient
    .from('message_reactions')
    .select('message_id, user_id, reaction')
    .eq('message_id', messageId);

  if (error) {
    console.warn('[REBUS] Refresh reaction skipped:', error.message);
    return;
  }

  reactionSummary.set(messageId, normalizeReactionState(data || []));
  updateReactionButton(messageId);
}

async function toggleReaction(messageId, reaction = '👍') {
  if (!supabaseClient || !currentUser || !messageId || !reaction) return;

  const current = getMessageReactionState({ id: messageId });
  const alreadyReacted = current.myReactions?.has(reaction);

  if (alreadyReacted) {
    const { error } = await supabaseClient
      .from('message_reactions')
      .delete()
      .eq('message_id', messageId)
      .eq('user_id', currentUser.id)
      .eq('reaction', reaction);

    if (error) {
      console.warn('[REBUS] Reaction remove failed:', error.message);
      alert(`Не вдалося прибрати реакцію: ${error.message}`);
      return;
    }
  } else {
    const { error } = await supabaseClient
      .from('message_reactions')
      .upsert({
        message_id: messageId,
        user_id: currentUser.id,
        reaction
      }, { onConflict: 'message_id,user_id,reaction' });

    if (error) {
      console.warn('[REBUS] Reaction add failed:', error.message);
      alert(`Не вдалося додати реакцію: ${error.message}`);
      return;
    }
  }

  await refreshReactionForMessage(messageId);
}

async function copyMessageText(messageId) {
  const node = messagesList?.querySelector(`[data-message-id="${CSS.escape(messageId)}"]`);
  const text = node?.querySelector('.message-body')?.textContent || '';
  if (!text) return;
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const area = document.createElement('textarea');
    area.value = text;
    document.body.appendChild(area);
    area.select();
    document.execCommand('copy');
    area.remove();
  }
}

async function deleteOwnMessage(messageId) {
  if (!supabaseClient || !currentUser || !messageId) return;
  const node = messagesList?.querySelector(`[data-message-id="${CSS.escape(messageId)}"]`);
  if (!node?.classList.contains('outgoing')) return;
  const { error } = await supabaseClient
    .from('messenger_messages')
    .delete()
    .eq('id', messageId)
    .eq('user_id', currentUser.id);
  if (error) {
    alert(`Не вдалося видалити повідомлення: ${error.message}`);
    return;
  }
  node.remove();
  renderedMessageIds.delete(messageId);
}

function closeReactionPalettes() {
  openReactionPaletteId = null;
  document.querySelectorAll('.quick-reactions-bar.is-open').forEach(bar => bar.classList.remove('is-open'));
  document.querySelectorAll('.message-tools.is-reaction-open').forEach(tool => tool.classList.remove('is-reaction-open'));
  document.querySelectorAll('.message.has-reaction-open').forEach(message => message.classList.remove('has-reaction-open'));
}

function closeMessageMenus() {
  openMessageMenuId = null;
  document.querySelectorAll('.message-context-menu.is-open').forEach(menu => menu.classList.remove('is-open'));
  document.querySelectorAll('.message-tools.is-pinned').forEach(tool => tool.classList.remove('is-pinned'));
  document.querySelectorAll('.message.has-menu-open').forEach(message => message.classList.remove('has-menu-open'));
  closeReactionPalettes();
}

function openReactionPalette(messageId, scope = messagesList) {
  if (!messageId || !scope) return;
  const bar = scope.querySelector(`[data-palette-for="${CSS.escape(messageId)}"]`);
  if (!bar) return;
  closeReactionPalettes();
  openReactionPaletteId = messageId;
  bar.classList.add('is-open');
  bar.closest('.message-tools')?.classList.add('is-reaction-open');
  bar.closest('.message')?.classList.add('has-reaction-open');
}


function openMessageContextMenu(messageId, scope = messagesList) {
  if (!messageId || !scope) return;
  const menu = scope.querySelector(`[data-menu-for="${CSS.escape(messageId)}"]`);
  if (!menu) return;
  closeMessageMenus();
  openMessageMenuId = messageId;
  menu.classList.add('is-open');
  menu.closest('.message-tools')?.classList.add('is-pinned');
  menu.closest('.message')?.classList.add('has-menu-open');
}

function bindMessageReactionEvents(scope) {
  const messageNode = scope.classList?.contains('message') ? scope : scope.closest?.('.message');
  if (messageNode && messageNode.dataset.messageId && messageNode.dataset.menuBound !== '1') {
    messageNode.dataset.menuBound = '1';
    messageNode.addEventListener('contextmenu', event => {
      event.preventDefault();
      event.stopPropagation();
      openMessageContextMenu(messageNode.dataset.messageId, messageNode);
    });
    messageNode.addEventListener('mouseleave', () => {
      if (!messageNode.classList.contains('has-menu-open')) {
        const tool = messageNode.querySelector('.message-tools');
        window.clearTimeout(tool?._hideTimer);
        if (tool) tool._hideTimer = window.setTimeout(() => tool.classList.remove('is-hovered'), 260);
      }
    });
    messageNode.addEventListener('mouseenter', () => {
      const tool = messageNode.querySelector('.message-tools');
      if (tool) {
        window.clearTimeout(tool._hideTimer);
        tool.classList.add('is-hovered');
      }
    });
  }

  scope.querySelectorAll('.message-emoji-trigger').forEach(button => {
    if (button.dataset.bound === '1') return;
    button.dataset.bound = '1';
    button.addEventListener('click', event => {
      event.preventDefault();
      event.stopPropagation();
      const messageId = button.dataset.messageId;
      const shouldOpen = openReactionPaletteId !== messageId;
      closeReactionPalettes();
      closeMessageMenus();
      if (shouldOpen) openReactionPalette(messageId, scope);
    });
  });

  scope.querySelectorAll('.quick-reaction, .reaction-chip').forEach(button => {
    if (button.dataset.bound === '1') return;
    button.dataset.bound = '1';
    button.addEventListener('click', event => {
      event.preventDefault();
      event.stopPropagation();
      toggleReaction(button.dataset.messageId, button.dataset.reaction);
      closeMessageMenus();
    });
  });

  scope.querySelectorAll('.message-menu-toggle').forEach(button => {
    if (button.dataset.bound === '1') return;
    button.dataset.bound = '1';
    button.addEventListener('click', event => {
      event.preventDefault();
      event.stopPropagation();
      const messageId = button.dataset.messageId;
      const shouldOpen = openMessageMenuId !== messageId;
      closeMessageMenus();
      if (shouldOpen) openMessageContextMenu(messageId, scope);
    });
  });

  scope.querySelectorAll('.message-menu-item').forEach(button => {
    if (button.dataset.bound === '1') return;
    button.dataset.bound = '1';
    button.addEventListener('click', event => {
      event.preventDefault();
      event.stopPropagation();
      if (button.disabled) return;
      const { action, messageId } = button.dataset;
      if (action === 'copy') copyMessageText(messageId);
      if (action === 'delete') deleteOwnMessage(messageId);
      closeMessageMenus();
    });
  });
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

  const messageDay = formatMessageDay(message.created_at);
  if (!options.replace && messageDay && messageDay !== lastRenderedDay) {
    const divider = document.createElement('div');
    divider.className = 'message-day-divider';
    divider.innerHTML = `<span>${escapeHtml(messageDay)}</span>`;
    messagesList.appendChild(divider);
    lastRenderedDay = messageDay;
  }

  const isOwn = currentUser && message.user_id === currentUser.id;
  const statusLabel = getMessageStatusLabel(message, isOwn);
  const statusClass = getMessageStatusClass(message, isOwn);
  const statusTooltip = getMessageReadTooltip(message, statusLabel);
  const el = document.createElement('div');
  el.className = `message ${isOwn ? 'outgoing' : 'incoming'} ${statusClass}`.trim();
  if (message.id) el.dataset.messageId = message.id;
  el.innerHTML = `
    ${renderMessageTools(message, isOwn)}
    <b>${escapeHtml(isOwn ? 'Ви' : (message.user_name || message.user_email || 'Користувач'))}</b>
    <span class="message-body">${escapeHtml(message.body)}</span>
    <small class="message-meta">
      <span>${formatTime(message.created_at)}</span>
      ${statusLabel ? `<em class="message-status" title="${escapeHtml(statusTooltip)}" data-tooltip="${escapeHtml(statusTooltip)}">${escapeHtml(statusLabel)}</em>` : ''}
    </small>
    ${renderMessageReactionChips(message)}
  `;

  const statusEl = el.querySelector('.message-status');
  if (statusEl) {
    statusEl.addEventListener('click', event => {
      event.stopPropagation();
      document.querySelectorAll('.message-status.is-tooltip-open').forEach(item => {
        if (item !== statusEl) item.classList.remove('is-tooltip-open');
      });
      statusEl.classList.toggle('is-tooltip-open');
      window.clearTimeout(statusEl._tooltipTimer);
      statusEl._tooltipTimer = window.setTimeout(() => {
        statusEl.classList.remove('is-tooltip-open');
      }, 3500);
    });
  }

  bindMessageReactionEvents(el);

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
    const item = summary.get(receipt.message_id) || { received: 0, read: 0, readAt: null };
    if (receipt.received_at) item.received += 1;
    if (receipt.read_at) {
      item.read += 1;
      if (!item.readAt || new Date(receipt.read_at) > new Date(item.readAt)) {
        item.readAt = receipt.read_at;
      }
    }
    summary.set(receipt.message_id, item);
  });

  return messages.map(message => {
    const item = summary.get(message.id);
    if (!item) return message;
    return {
      ...message,
      __receivedCount: item.received,
      __readCount: item.read,
      __readAt: item.readAt
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

function updateDirectChatHead(peer) {
  if (!directChatHead) return;

  if (!peer) {
    directChatHead.innerHTML = `
      <div class="direct-chat-avatar">R</div>
      <div class="direct-chat-title">
        <strong>Оберіть користувача</strong>
        <span>Індивідуальне листування REBUS</span>
      </div>
      <div class="direct-chat-actions" aria-hidden="true">
        <button type="button" disabled><img src="assets/icons/header/search.png" alt="" /></button><button type="button" disabled><img src="assets/icons/header/telephone.png" alt="" /></button><button type="button" disabled><img src="assets/icons/header/video.png" alt="" /></button><button type="button" disabled><img src="assets/icons/header/more.png" alt="" /></button>
      </div>
    `;
    return;
  }

  directChatHead.innerHTML = `
    <div class="direct-chat-avatar">${escapeHtml(getInitials(peer.name))}</div>
    <div class="direct-chat-title">
      <strong>${escapeHtml(peer.name)}</strong>
      <span class="peer-online"><i></i> Онлайн</span>
    </div>
    <div class="direct-chat-actions" aria-label="Дії чату">
      <button type="button" title="Пошук у чаті"><img src="assets/icons/header/search.png" alt="" /></button>
      <button type="button" title="Аудіодзвінок"><img src="assets/icons/header/telephone.png" alt="" /></button>
      <button type="button" title="Відеодзвінок"><img src="assets/icons/header/video.png" alt="" /></button>
      <button type="button" title="Додатково"><img src="assets/icons/header/more.png" alt="" /></button>
    </div>
  `;
}

function setComposeEnabled(enabled) {
  if (messageInput) {
    messageInput.disabled = !enabled;
    messageInput.placeholder = enabled ? 'Напишіть повідомлення…' : 'Оберіть користувача для листування…';
  }
  if (sendMessageButton) sendMessageButton.disabled = !enabled;
  if (composerEmojiButton) composerEmojiButton.disabled = !enabled;
}

function renderDirectUsers(filter = '') {
  if (!directUsersList) return;
  const q = filter.trim().toLowerCase();
  const users = directUsers.filter(user => {
    const haystack = `${user.name} ${user.email} ${user.role}`.toLowerCase();
    return !q || haystack.includes(q);
  });

  if (!users.length) {
    directUsersList.innerHTML = '<div class="direct-empty">Користувачів не знайдено.</div>';
    return;
  }

  directUsersList.innerHTML = '';
  users.forEach(user => {
    const item = document.createElement('button');
    item.type = 'button';
    item.className = `direct-user ${selectedPeer?.id === user.id ? 'is-selected' : ''}`;
    item.dataset.userId = user.id;
    item.innerHTML = `
      <span class="direct-user-avatar">${escapeHtml(getInitials(user.name))}</span>
      <span class="direct-user-main">
        <strong>${escapeHtml(user.name)}</strong>
        <em>${escapeHtml(user.email || user.role || 'Користувач REBUS')}</em>
      </span>
      <span class="direct-user-presence"><i></i>Онлайн</span>
    `;
    item.addEventListener('click', () => selectDirectUser(user));
    directUsersList.appendChild(item);
  });
}

async function loadDirectUsers() {
  if (!supabaseClient || !currentUser || !directUsersList) return;

  directUsersList.innerHTML = '<div class="direct-empty">Завантаження користувачів…</div>';

  const { data, error } = await supabaseClient
    .from('rebus_profiles')
    .select('id,user_id,email,full_name,role');

  if (error) {
    console.error('[REBUS] Load users error:', error);
    directUsers = [];
    directUsersList.innerHTML = `<div class="direct-empty">Не вдалося завантажити користувачів: ${escapeHtml(error.message)}</div>`;
    return;
  }

  const seen = new Set();
  directUsers = (data || [])
    .map(normalizeProfile)
    .filter(user => user.id && user.id !== currentUser.id)
    .filter(user => {
      const key = user.id || user.email;
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => a.name.localeCompare(b.name, 'uk'));

  renderDirectUsers(userSearchInput?.value || '');
}

async function selectDirectUser(user) {
  selectedPeer = user;
  updateDirectChatHead(user);
  setComposeEnabled(true);
  renderDirectUsers(userSearchInput?.value || '');
  await loadMessages();
  await subscribeToMessages();
  messageInput?.focus();
}

async function loadMessages() {
  if (!supabaseClient || !currentUser || !messagesList) return;

  messagesList.innerHTML = '';
  renderedMessageIds.clear();
  reactionSummary.clear();
  lastRenderedDay = null;

  if (!selectedPeer) {
    updateDirectChatHead(null);
    setComposeEnabled(false);
    renderSystemMessage('Оберіть користувача зліва, щоб почати індивідуальне листування.');
    return;
  }

  setComposeEnabled(true);
  renderSystemMessage('Завантаження повідомлень…');

  const me = currentUser.id;
  const peer = selectedPeer.id;
  const pairFilter = `and(user_id.eq.${me},recipient_id.eq.${peer}),and(user_id.eq.${peer},recipient_id.eq.${me})`;
  const { data, error } = await supabaseClient
    .from('messenger_messages')
    .select('id, contour_id, recipient_id, conversation_key, channel, user_id, user_email, user_name, body, created_at')
    .eq('channel', 'direct')
    .or(pairFilter)
    .order('created_at', { ascending: true })
    .limit(100);

  messagesList.innerHTML = '';

  if (error) {
    console.error('[REBUS] Load direct messages error:', error);
    renderSystemMessage(`Не вдалося завантажити повідомлення: ${error.message}`);
    return;
  }

  if (!data?.length) {
    renderSystemMessage(`Почніть індивідуальне листування з ${selectedPeer.name}.`);
    return;
  }

  const messagesWithReceipts = await loadReceiptsForOwnMessages(data);
  const messagesWithReactions = await loadReactionsForMessages(messagesWithReceipts);
  messagesWithReactions.forEach(appendMessage);
  await markIncomingMessagesRead(data);
}

async function sendMessage() {
  if (!supabaseClient || !currentUser) {
    alert('Спочатку потрібно увійти в REBUS Messenger.');
    return;
  }

  if (!selectedPeer) {
    renderSystemMessage('Оберіть користувача зліва, щоб почати індивідуальне листування.');
    return;
  }

  const body = messageInput?.value?.trim();
  if (!body) return;

  const tempId = `local-${Date.now()}`;
  const createdAt = new Date().toISOString();
  const conversationKey = makeConversationKey(currentUser.id, selectedPeer.id);

  const optimisticMessage = {
    id: tempId,
    contour_id: null,
    recipient_id: selectedPeer.id,
    conversation_key: conversationKey,
    channel: 'direct',
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
    recipient_id: selectedPeer.id,
    conversation_key: conversationKey,
    channel: 'direct',
    user_id: currentUser.id,
    user_email: currentUser.email,
    user_name: getDisplayName(currentUser),
    body
  };

  const { data, error } = await supabaseClient
    .from('messenger_messages')
    .insert(payload)
    .select('id, contour_id, recipient_id, conversation_key, channel, user_id, user_email, user_name, body, created_at')
    .single();

  sendMessageButton.disabled = false;

  if (error) {
    console.error('[REBUS] Send direct message error:', error);
    appendMessage({ ...optimisticMessage, __status: 'failed' }, { replace: true, replaceId: tempId });
    alert(`Не вдалося надіслати повідомлення: ${error.message}`);
    return;
  }

  reactionSummary.set(data.id, { total: 0, byReaction: {}, myReactions: new Set() });
  appendMessage(data, { replace: true, replaceId: tempId });
}

async function subscribeToMessages() {
  if (!supabaseClient || !currentUser || !selectedPeer) return;

  if (realtimeChannel) {
    await supabaseClient.removeChannel(realtimeChannel);
    realtimeChannel = null;
  }

  const conversationKey = makeConversationKey(currentUser.id, selectedPeer.id);
  realtimeChannel = supabaseClient
    .channel(`rebus-direct-${conversationKey}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'messenger_messages'
      },
      async payload => {
        if (!isSameDirectConversation(payload.new)) return;
        appendMessage(payload.new);
        await markIncomingMessagesRead([payload.new]);
      }
    )
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'messenger_messages'
      },
      async payload => {
        if (!isSameDirectConversation(payload.new)) return;
        appendMessage(payload.new, { replace: true, replaceId: payload.new.id });
      }
    )
    .on(
      'postgres_changes',
      {
        event: 'DELETE',
        schema: 'public',
        table: 'messenger_messages'
      },
      async payload => {
        const id = payload.old?.id;
        if (!id) return;
        const node = messagesList?.querySelector(`[data-message-id="${CSS.escape(id)}"]`);
        if (node) node.remove();
        renderedMessageIds.delete(id);
      }
    )
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'message_reactions'
      },
      async payload => {
        const messageId = payload.new?.message_id || payload.old?.message_id;
        if (!messageId || !renderedMessageIds.has(messageId)) return;
        await refreshReactionForMessage(messageId);
      }
    )
    .subscribe(status => {
      console.log('[REBUS] Direct realtime status:', status);
    });
}

function setActiveChannel(channel) {
  currentChannel = channel;
  channelButtons.forEach(button => {
    button.classList.toggle('is-selected', button.dataset.channel === channel);
  });
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
    await loadDirectUsers();
    if (selectedPeer) {
      await loadMessages();
      await subscribeToMessages();
    }
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
    await loadDirectUsers();
    if (selectedPeer) {
      await loadMessages();
      await subscribeToMessages();
    }
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

userSearchInput?.addEventListener('input', () => {
  renderDirectUsers(userSearchInput.value || '');
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


document.addEventListener('click', closeMessageMenus);
document.addEventListener('keydown', event => {
  if (event.key === 'Escape') closeMessageMenus();
});


if (composerEmojiButton) {
  composerEmojiButton.addEventListener('click', () => {
    if (!messageInput || messageInput.disabled) return;
    const start = messageInput.selectionStart ?? messageInput.value.length;
    const end = messageInput.selectionEnd ?? start;
    messageInput.value = `${messageInput.value.slice(0, start)}😊${messageInput.value.slice(end)}`;
    messageInput.focus();
    messageInput.selectionStart = messageInput.selectionEnd = start + 2;
  });
}
