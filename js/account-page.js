(() => {
  const PAGE_ID = 'page-account';
  const ACCOUNT_STYLE_ID = 'rebus-account-style';
  const MAX_INLINE_AVATAR_SIZE = 900 * 1024;
  let editMode = false;
  let pendingAvatarDataUrl = '';

  function ensureAccountStyle() {
    if (document.getElementById(ACCOUNT_STYLE_ID)) return;
    const link = document.createElement('link');
    link.id = ACCOUNT_STYLE_ID;
    link.rel = 'stylesheet';
    link.href = 'css/account.css?v=0.7.1';
    document.head.appendChild(link);
  }

  function safeText(value, fallback = '—') {
    const clean = value == null ? '' : String(value).trim();
    return clean || fallback;
  }

  function escapeAttr(value = '') {
    return String(value)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
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

  function getMeta(user, key, fallback = '') {
    return user?.user_metadata?.[key] || fallback;
  }

  function getAvatarUrl(user) {
    return pendingAvatarDataUrl
      || user?.user_metadata?.avatar_url
      || user?.user_metadata?.picture
      || '';
  }

  function setAvatarVisual(element, avatarUrl, initials) {
    if (!element) return;
    if (avatarUrl) {
      element.style.backgroundImage = `url('${avatarUrl}')`;
      element.style.backgroundSize = 'cover';
      element.style.backgroundPosition = 'center';
      element.style.color = 'transparent';
    } else {
      element.style.backgroundImage = '';
      element.style.color = '';
      element.textContent = initials;
    }
  }

  function buildEditableFields(user) {
    const meta = user?.user_metadata || {};
    const name = getName(user);
    const callsign = meta.callsign || meta.nickname || '';
    const contour = meta.contour || '';
    const unit = meta.unit || '';
    const marker = meta.marker || '';
    const position = meta.position || '';
    const avatar = getAvatarUrl(user);

    return `
      <section class="account-section account-editor" id="accountEditorSection">
        <div class="account-section-head">
          <h3>Редагування профілю</h3>
          <span>Дані зберігаються в Supabase Auth metadata</span>
        </div>
        <form id="accountEditForm" class="account-edit-form">
          <label>
            <span>Імʼя / назва профілю</span>
            <input name="full_name" type="text" value="${escapeAttr(name)}" autocomplete="name" />
          </label>
          <label>
            <span>Позивний</span>
            <input name="callsign" type="text" value="${escapeAttr(callsign)}" placeholder="Наприклад: Lavash" />
          </label>
          <label>
            <span>Контур</span>
            <input name="contour" type="text" value="${escapeAttr(contour)}" placeholder="Наприклад: REBUS DEV" />
          </label>
          <label>
            <span>Підрозділ / група</span>
            <input name="unit" type="text" value="${escapeAttr(unit)}" placeholder="Наприклад: Основний контур" />
          </label>
          <label>
            <span>Маркер файлів</span>
            <input name="marker" type="text" value="${escapeAttr(marker)}" placeholder="Наприклад: LAVASH" />
          </label>
          <label>
            <span>Посада / роль у контурі</span>
            <input name="position" type="text" value="${escapeAttr(position)}" placeholder="Наприклад: Адміністратор контуру" />
          </label>
          <label class="span-2">
            <span>URL аватарки</span>
            <input name="avatar_url" type="url" value="${escapeAttr(avatar)}" placeholder="https://..." />
          </label>
          <label class="span-2 account-file-picker">
            <span>Завантажити аватарку з компʼютера</span>
            <input id="accountAvatarInput" type="file" accept="image/png,image/jpeg,image/webp,image/gif" />
            <em>Поки зберігаємо як metadata. Для великих фото пізніше підключимо Supabase Storage.</em>
          </label>
          <div class="account-edit-actions span-2">
            <button class="account-action-btn" type="submit">Зберегти зміни</button>
            <button class="account-action-btn secondary" type="button" id="cancelEditProfileButton">Скасувати</button>
          </div>
          <p class="account-save-status span-2" id="accountSaveStatus"></p>
        </form>
      </section>
    `;
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
    const callsign = safeText(getMeta(user, 'callsign') || getMeta(user, 'nickname'), 'Не вказано');
    const contour = safeText(getMeta(user, 'contour') || getMeta(user, 'unit') || getMeta(user, 'marker'), 'Не призначено');
    const unit = safeText(getMeta(user, 'unit'), 'Не вказано');
    const marker = safeText(getMeta(user, 'marker'), 'Не вказано');
    const position = safeText(getMeta(user, 'position'), 'Не вказано');
    const avatarUrl = getAvatarUrl(user);
    const initials = getInitialsLocal(name);
    const mfaOk = mfa === 'Активна';
    const securityScore = mfaOk ? 98 : 82;

    return `
      <div class="account-dashboard ${editMode ? 'is-editing' : ''}">
        <aside class="account-hero">
          <div class="account-avatar-wrap">
            <div class="account-avatar-xl" id="accountAvatarXL">${initials}</div>
            <button class="avatar-edit-btn" type="button" id="quickAvatarButton">Змінити фото</button>
          </div>
          <h2 id="accountDisplayName">${safeText(name)}</h2>
          <p id="accountEmailMain">${email}</p>
          <p class="account-callsign">${callsign !== 'Не вказано' ? `Позивний: ${callsign}` : 'Позивний не вказано'}</p>

          <div class="account-badges">
            <span class="account-badge is-role">${role}</span>
            <span class="account-badge is-ok">Online</span>
            <span class="account-badge ${mfaOk ? 'is-ok' : 'is-warn'}">2FA: ${mfa}</span>
          </div>

          <div class="account-actions">
            <button class="account-action-btn" type="button" id="editProfileButton">Редагувати профіль</button>
            <button class="account-action-btn secondary" type="button" id="connectAccountButton">Підключити акаунт</button>
            <button class="account-action-btn secondary" type="button" id="switchAccountButton">Змінити акаунт</button>
            <button class="account-action-btn secondary" type="button" id="accountLogoutButton">Вийти</button>
          </div>
        </aside>

        <div class="account-main">
          ${editMode ? buildEditableFields(user) : ''}

          <section class="account-section">
            <div class="account-section-head">
              <h3>Дані користувача</h3>
              <button type="button" class="mini-edit-btn" id="editProfileButtonInline">Редагувати</button>
            </div>
            <div class="account-info-grid">
              <div class="account-field"><span>Імʼя</span><strong>${safeText(name)}</strong></div>
              <div class="account-field"><span>Email</span><strong>${email}</strong></div>
              <div class="account-field"><span>Позивний</span><strong>${callsign}</strong></div>
              <div class="account-field"><span>Роль</span><strong>${role}</strong></div>
              <div class="account-field"><span>Контур</span><strong>${contour}</strong></div>
              <div class="account-field"><span>Підрозділ</span><strong>${unit}</strong></div>
              <div class="account-field"><span>Маркер</span><strong>${marker}</strong></div>
              <div class="account-field"><span>Посада</span><strong>${position}</strong></div>
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
            <div class="account-section-head">
              <h3>Підключені акаунти</h3>
              <button type="button" class="mini-edit-btn" id="connectAccountButtonInline">Додати</button>
            </div>
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

  function readAvatarFile(file) {
    return new Promise((resolve, reject) => {
      if (!file) return resolve('');
      if (!file.type.startsWith('image/')) return reject(new Error('Оберіть файл зображення.'));
      if (file.size > MAX_INLINE_AVATAR_SIZE) {
        return reject(new Error('Фото завелике для metadata. Оберіть зображення до 900 КБ або вставте URL.'));
      }
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(new Error('Не вдалося прочитати файл.'));
      reader.readAsDataURL(file);
    });
  }

  function setSaveStatus(text, isError = false) {
    const node = document.getElementById('accountSaveStatus');
    if (!node) return;
    node.textContent = text;
    node.classList.toggle('is-error', isError);
  }

  async function saveProfile(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const avatarInput = document.getElementById('accountAvatarInput');
    const button = form.querySelector('button[type="submit"]');

    try {
      if (button) button.disabled = true;
      setSaveStatus('Зберігаю зміни…');

      const fileAvatar = await readAvatarFile(avatarInput?.files?.[0]);
      const avatarUrl = fileAvatar || pendingAvatarDataUrl || safeText(data.get('avatar_url'), '');
      const metadata = {
        ...(currentUser?.user_metadata || {}),
        full_name: safeText(data.get('full_name'), getName(currentUser)),
        name: safeText(data.get('full_name'), getName(currentUser)),
        callsign: safeText(data.get('callsign'), ''),
        contour: safeText(data.get('contour'), ''),
        unit: safeText(data.get('unit'), ''),
        marker: safeText(data.get('marker'), ''),
        position: safeText(data.get('position'), '')
      };

      if (avatarUrl) metadata.avatar_url = avatarUrl;

      const { data: result, error } = await supabaseClient.auth.updateUser({ data: metadata });
      if (error) throw error;

      currentUser = result?.user || { ...currentUser, user_metadata: metadata };
      pendingAvatarDataUrl = '';
      editMode = false;
      if (typeof updateAccountUi === 'function') updateAccountUi(currentUser);
      renderAccount();
    } catch (error) {
      console.warn('[REBUS] Profile save failed:', error);
      setSaveStatus(error.message || 'Не вдалося зберегти профіль.', true);
    } finally {
      if (button) button.disabled = false;
    }
  }

  function bindAvatarPreview() {
    const avatarInput = document.getElementById('accountAvatarInput');
    avatarInput?.addEventListener('change', async () => {
      try {
        const dataUrl = await readAvatarFile(avatarInput.files?.[0]);
        if (!dataUrl) return;
        pendingAvatarDataUrl = dataUrl;
        const name = document.querySelector('[name="full_name"]')?.value || getName(currentUser);
        setAvatarVisual(document.getElementById('accountAvatarXL'), dataUrl, getInitialsLocal(name));
        const avatarUrlInput = document.querySelector('[name="avatar_url"]');
        if (avatarUrlInput) avatarUrlInput.value = dataUrl;
        setSaveStatus('Аватарка готова. Натисніть “Зберегти зміни”.');
      } catch (error) {
        setSaveStatus(error.message, true);
      }
    });
  }

  function bindAccountButtons() {
    document.getElementById('connectAccountButton')?.addEventListener('click', reconnectGoogle);
    document.getElementById('connectAccountButtonInline')?.addEventListener('click', reconnectGoogle);
    document.getElementById('switchAccountButton')?.addEventListener('click', reconnectGoogle);
    document.getElementById('accountLogoutButton')?.addEventListener('click', () => {
      if (typeof signOut === 'function') signOut();
    });

    const openEditor = () => {
      editMode = true;
      renderAccount();
      document.getElementById('accountEditorSection')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };

    document.getElementById('editProfileButton')?.addEventListener('click', openEditor);
    document.getElementById('editProfileButtonInline')?.addEventListener('click', openEditor);
    document.getElementById('quickAvatarButton')?.addEventListener('click', () => {
      editMode = true;
      renderAccount();
      window.setTimeout(() => document.getElementById('accountAvatarInput')?.click(), 80);
    });

    document.getElementById('cancelEditProfileButton')?.addEventListener('click', () => {
      pendingAvatarDataUrl = '';
      editMode = false;
      renderAccount();
    });

    document.getElementById('accountEditForm')?.addEventListener('submit', saveProfile);
    bindAvatarPreview();

    const avatarUrlInput = document.querySelector('[name="avatar_url"]');
    avatarUrlInput?.addEventListener('input', () => {
      const name = document.querySelector('[name="full_name"]')?.value || getName(currentUser);
      setAvatarVisual(document.getElementById('accountAvatarXL'), avatarUrlInput.value.trim(), getInitialsLocal(name));
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
    const avatarUrl = getAvatarUrl(user);
    setAvatarVisual(document.getElementById('accountAvatarXL'), avatarUrl, getInitialsLocal(getName(user)));
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
