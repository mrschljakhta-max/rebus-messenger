(() => {
  const PAGE_ID = 'page-account';
  const ACCOUNT_STYLE_ID = 'rebus-account-style';

  function ensureAccountStyle() {
    if (document.getElementById(ACCOUNT_STYLE_ID)) return;
    const link = document.createElement('link');
    link.id = ACCOUNT_STYLE_ID;
    link.rel = 'stylesheet';
    link.href = 'css/account.css?v=0.7.0';
    document.head.appendChild(link);
  }

  function safeText(value, fallback = '—') {
    const clean = value == null ? '' : String(value).trim();
    return clean || fallback;
  }

  function getName(user) {
    try {
      if (typeof getDisplayName === 'function') return getDisplayName(user);
    } catch {}
    return user?.user_metadata?.full_name
      || user?.user_metadata?.name
      || user?.email?.split('@')?.[0]
      || 'Користувач REBUS';
  }

  function getInitialsLocal(name = '') {
    try {
      if (typeof getInitials === 'function') return getInitials(name);
    } catch {}
    const parts = String(name).trim().split(/\s+/).filter(Boolean).slice(0, 2);
    return parts.map(item => item[0]).join('').toUpperCase() || 'R';
  }

  function getRole() {
    try {
      if (typeof getUserRole === 'function') return getUserRole();
    } catch {}
    return 'USER';
  }

  function formatDate(value) {
    if (!value) return '—';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '—';
    return date.toLocaleString('uk-UA', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  function getProvider(user) {
    const provider = user?.app_metadata?.provider || user?.identities?.[0]?.provider || 'google';
    if (provider === 'google') return 'Google';
    if (provider === 'azure') return 'Microsoft';
    if (provider === 'apple') return 'Apple';
    return provider.toUpperCase();
  }

  function getMfaStatus() {
    try {
      if (typeof isMessengerMfaVerified === 'function' && isMessengerMfaVerified()) return 'Активна';
    } catch {}
    return 'Очікує перевірки';
  }

  function buildAccountPage(user) {
    const name = getName(user);
    const email = safeText(user?.email);
    const role = getRole();
    const provider = getProvider(user);
    const createdAt = formatDate(user?.created_at);
    const lastSignIn = formatDate(user?.last_sign_in_at);
    const emailConfirmed = user?.email_confirmed_at ? 'Підтверджено' : 'Очікує';
    const mfa = getMfaStatus();
    const userId = safeText(user?.id);
    const contour = safeText(user?.user_metadata?.contour || user?.user_metadata?.unit || user?.user_metadata?.marker, 'Не призначено');
    const avatarUrl = user?.user_metadata?.avatar_url || user?.user_metadata?.picture || '';
    const initials = getInitialsLocal(name);
    const mfaOk = mfa === 'Активна';
    const securityScore = mfaOk ? 98 : 82;

    return `
      <div class="account-dashboard">
        <aside class="account-hero">
          <div class="account-avatar-xl" id="accountAvatarXL" ${avatarUrl ? `style="background-image:url('${avatarUrl}');background-size:cover;background-position:center;color:transparent;"` : ''}>${initials}</div>
          <h2 id="accountDisplayName">${safeText(name)}</h2>
          <p id="accountEmailMain">${email}</p>

          <div class="account-badges">
            <span class="account-badge is-role">${role}</span>
            <span class="account-badge is-ok">Online</span>
            <span class="account-badge ${mfaOk ? 'is-ok' : 'is-warn'}">2FA: ${mfa}</span>
          </div>

          <div class="account-actions">
            <button class="account-action-btn" type="button" id="connectAccountButton">Підключити акаунт</button>
            <button class="account-action-btn secondary" type="button" id="switchAccountButton">Змінити акаунт</button>
            <button class="account-action-btn secondary" type="button" id="accountLogoutButton">Вийти</button>
          </div>
        </aside>

        <div class="account-main">
          <section class="account-section">
            <h3>Дані користувача</h3>
            <div class="account-info-grid">
              <div class="account-field"><span>Імʼя</span><strong>${safeText(name)}</strong></div>
              <div class="account-field"><span>Email</span><strong>${email}</strong></div>
              <div class="account-field"><span>Роль</span><strong>${role}</strong></div>
              <div class="account-field"><span>Контур</span><strong>${contour}</strong></div>
              <div class="account-field"><span>ID користувача</span><strong title="${userId}">${userId}</strong></div>
              <div class="account-field"><span>Провайдер</span><strong>${provider}</strong></div>
              <div class="account-field"><span>Створений</span><strong>${createdAt}</strong></div>
              <div class="account-field"><span>Останній вхід</span><strong>${lastSignIn}</strong></div>
            </div>
          </section>

          <section class="account-section">
            <h3>Картка безпеки</h3>
            <div class="security-list">
              <div class="security-row">
                <i>G</i>
                <div><b>${provider} акаунт</b><em>${email}</em></div>
                <span class="security-status">Підключено</span>
              </div>
              <div class="security-row">
                <i>2F</i>
                <div><b>Двофакторна перевірка</b><em>Захист входу до робочої зони</em></div>
                <span class="security-status ${mfaOk ? '' : 'warn'}">${mfa}</span>
              </div>
              <div class="security-row">
                <i>✉</i>
                <div><b>Email</b><em>Підтвердження поштової адреси</em></div>
                <span class="security-status ${emailConfirmed === 'Підтверджено' ? '' : 'warn'}">${emailConfirmed}</span>
              </div>
              <div class="security-row">
                <i>🔐</i>
                <div><b>AES-256-GCM</b><em>Підготовлено для захищених повідомлень і файлів</em></div>
                <span class="security-status">${securityScore}%</span>
              </div>
            </div>
          </section>

          <section class="account-section">
            <h3>Підключені акаунти</h3>
            <div class="connected-account-card">
              <div class="provider-icon">G</div>
              <div><strong>${provider}</strong><span>${email}</span></div>
              <span class="security-status">Активний</span>
            </div>
          </section>
        </div>
      </div>
    `;
  }

  async function reconnectGoogle() {
    if (!window.supabaseClient && !supabaseClient) return;
    try {
      if (typeof signIn === 'function') {
        await signIn();
        return;
      }
    } catch {}
    const client = window.supabaseClient || supabaseClient;
    const redirectTo = typeof getMessengerRedirectUrl === 'function'
      ? getMessengerRedirectUrl()
      : 'https://mrschljakhta-max.github.io/rebus-messenger/';
    await client.auth.signInWithOAuth({ provider: 'google', options: { redirectTo } });
  }

  function bindAccountButtons() {
    document.getElementById('connectAccountButton')?.addEventListener('click', reconnectGoogle);
    document.getElementById('switchAccountButton')?.addEventListener('click', reconnectGoogle);
    document.getElementById('accountLogoutButton')?.addEventListener('click', () => {
      if (typeof signOut === 'function') signOut();
    });
  }

  function renderAccount() {
    ensureAccountStyle();
    const page = document.getElementById(PAGE_ID);
    if (!page) return;

    const user = typeof currentUser !== 'undefined' ? currentUser : null;
    if (!user) {
      page.innerHTML = `
        <div class="account-dashboard">
          <section class="account-section">
            <h3>Акаунт не підключено</h3>
            <p class="muted">Увійдіть через Google, щоб побачити профіль REBUS Messenger.</p>
          </section>
        </div>`;
      return;
    }

    page.innerHTML = buildAccountPage(user);
    bindAccountButtons();
  }

  window.rebusRenderAccountPage = renderAccount;

  document.addEventListener('click', event => {
    if (event.target.closest?.('[data-route="account"]')) {
      window.setTimeout(renderAccount, 80);
    }
  }, true);

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => window.setTimeout(renderAccount, 250), { once: true });
  } else {
    window.setTimeout(renderAccount, 250);
  }
})();
