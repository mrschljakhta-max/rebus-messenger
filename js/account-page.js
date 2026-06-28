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
    link.href = 'css/account.css?v=0.7.3';
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
    try { if (typeof getDisplayName === 'function') return getDisplayName(user); } catch {}
    return user?.user_metadata?.full_name || user?.user_metadata?.name || user?.email?.split('@')?.[0] || 'Користувач REBUS';
  }

  function getInitialsLocal(name = '') {
    try { if (typeof getInitials === 'function') return getInitials(name); } catch {}
    const parts = String(name).trim().split(/\s+/).filter(Boolean).slice(0, 2);
    return parts.map(item => item[0]).join('').toUpperCase() || 'R';
  }

  function getRole() {
    try { if (typeof getUserRole === 'function') return getUserRole(); } catch {}
    return 'USER';
  }

  function formatDate(value) {
    if (!value) return '—';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '—';
    return date.toLocaleString('uk-UA', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  }

  function getProvider(user) {
    const provider = user?.app_metadata?.provider || user?.identities?.[0]?.provider || 'google';
    if (provider === 'google') return 'Google';
    if (provider === 'azure') return 'Microsoft';
    if (provider === 'apple') return 'Apple';
    return provider.toUpperCase();
  }

  function getMfaStatus() {
    try { if (typeof isMessengerMfaVerified === 'function' && isMessengerMfaVerified()) return 'Активна'; } catch {}
    return 'Очікує перевірки';
  }

  function getAvatarUrl(user) {
    return pendingAvatarDataUrl || user?.user_metadata?.avatar_url || user?.user_metadata?.picture || '';
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

  function getProfileData(user) {
    const meta = user?.user_metadata || {};
    return {
      name: getName(user),
      email: safeText(user?.email),
      role: getRole(),
      provider: getProvider(user),
      createdAt: formatDate(user?.created_at),
      lastSignIn: formatDate(user?.last_sign_in_at),
      emailConfirmed: user?.email_confirmed_at ? 'Підтверджено' : 'Очікує',
      mfa: getMfaStatus(),
      userId: safeText(user?.id),
      callsign: safeText(meta.callsign || meta.nickname, 'Не вказано'),
      contour: safeText(meta.contour || meta.unit || meta.marker, 'Не призначено'),
      unit: safeText(meta.unit, 'Не вказано'),
      marker: safeText(meta.marker, 'Не вказано'),
      position: safeText(meta.position, 'Не вказано'),
      raw: {
        callsign: meta.callsign || meta.nickname || '',
        contour: meta.contour || '',
        unit: meta.unit || '',
        marker: meta.marker || '',
        position: meta.position || '',
        avatar: getAvatarUrl(user)
      }
    };
  }

  function editableInput(label, name, value, placeholder = '') {
    return `<label class="account-inline-field"><span>${label}</span><input name="${name}" type="text" value="${escapeAttr(value)}" placeholder="${escapeAttr(placeholder)}" /></label>`;
  }

  function buildUserDataSection(data) {
    if (editMode) {
      return `
        <section class="account-section account-editor" id="userDataSection">
          <div class="account-section-head">
            <h3>Дані користувача</h3>
            <button type="button" class="mini-edit-btn" id="cancelEditProfileButton">Скасувати</button>
          </div>
          <form id="accountEditForm" class="account-edit-form inline-editor-form">
            ${editableInput('Імʼя', 'full_name', data.name, 'Olexandr Shliakhta')}
            ${editableInput('Позивний', 'callsign', data.raw.callsign, 'Lavash')}
            ${editableInput('Контур', 'contour', data.raw.contour, 'REBUS DEV')}
            ${editableInput('Підрозділ', 'unit', data.raw.unit, 'Основний контур')}
            ${editableInput('Маркер файлів', 'marker', data.raw.marker, 'LAVASH')}
            ${editableInput('Посада', 'position', data.raw.position, 'Адміністратор контуру')}
            <label class="account-inline-field span-2"><span>URL аватарки</span><input name="avatar_url" type="url" value="${escapeAttr(data.raw.avatar)}" placeholder="https://..." /></label>
            <label class="account-inline-field span-2 account-file-picker"><span>Завантажити аватарку</span><input id="accountAvatarInput" type="file" accept="image/png,image/jpeg,image/webp,image/gif" /><em>Для великих фото пізніше підключимо Supabase Storage. Зараз краще до 900 КБ або URL.</em></label>
            <div class="account-edit-actions span-2"><button class="account-action-btn" type="submit">Зберегти</button><button class="account-action-btn secondary" type="button" id="cancelEditProfileButtonBottom">Скасувати</button></div>
            <p class="account-save-status span-2" id="accountSaveStatus"></p>
          </form>
        </section>`;
    }

    return `
      <section class="account-section" id="userDataSection">
        <div class="account-section-head"><h3>Дані користувача</h3><button type="button" class="mini-edit-btn icon-only" id="editProfileButtonInline" title="Редагувати дані">✎</button></div>
        <div class="account-info-grid">
          <div class="account-field"><span>Імʼя</span><strong>${safeText(data.name)}</strong></div>
          <div class="account-field"><span>Email</span><strong>${data.email}</strong></div>
          <div class="account-field"><span>Позивний</span><strong>${data.callsign}</strong></div>
          <div class="account-field"><span>Роль</span><strong>${data.role}</strong></div>
          <div class="account-field"><span>Контур</span><strong>${data.contour}</strong></div>
          <div class="account-field"><span>Підрозділ</span><strong>${data.unit}</strong></div>
          <div class="account-field"><span>Маркер</span><strong>${data.marker}</strong></div>
          <div class="account-field"><span>Посада</span><strong>${data.position}</strong></div>
          <div class="account-field"><span>ID користувача</span><strong title="${data.userId}">${data.userId}</strong></div>
          <div class="account-field"><span>Провайдер</span><strong>${data.provider}</strong></div>
          <div class="account-field"><span>Створений</span><strong>${data.createdAt}</strong></div>
          <div class="account-field"><span>Останній вхід</span><strong>${data.lastSignIn}</strong></div>
        </div>
      </section>`;
  }

  function buildFutureSections() {
    return `
      <section class="account-section account-soon-section"><div class="account-section-head"><h3>Пристрої</h3><span>Незабаром</span></div><div class="account-soon-grid"><div><b>Windows / Chrome</b><em>Поточний пристрій буде визначатись автоматично</em></div><div><b>Android</b><em>Мобільні сесії після підключення застосунку</em></div></div></section>
      <section class="account-section account-soon-section"><div class="account-section-head"><h3>Активні сесії</h3><span>Незабаром</span></div><div class="account-soon-grid"><div><b>Поточна сесія</b><em>Онлайн · браузер</em></div><div><b>Керування сесіями</b><em>Завершення входів на інших пристроях</em></div></div></section>
      <section class="account-section account-soon-section"><div class="account-section-head"><h3>Історія входів</h3><span>Незабаром</span></div><div class="account-soon-grid"><div><b>Останній вхід</b><em>Буде фіксуватись у журналі безпеки</em></div><div><b>Географія / пристрій</b><em>Після підключення серверної логіки</em></div></div></section>
      <section class="account-section account-soon-section"><div class="account-section-head"><h3>Ключі шифрування</h3><span>Незабаром</span></div><div class="account-soon-grid"><div><b>AES-256-GCM</b><em>Ключі повідомлень і файлів</em></div><div><b>Fingerprint</b><em>Короткий відбиток ключа користувача</em></div></div></section>`;
  }

  function buildAccountPage(user) {
    const data = getProfileData(user);
    const initials = getInitialsLocal(data.name);
    const mfaOk = data.mfa === 'Активна';
    const securityScore = mfaOk ? 98 : 82;

    return `
      <div class="account-dashboard ${editMode ? 'is-editing' : ''}">
        <aside class="account-hero">
          <div class="account-avatar-wrap"><div class="account-avatar-xl" id="accountAvatarXL">${initials}</div><button class="avatar-edit-btn" type="button" id="quickAvatarButton">Змінити фото</button></div>
          <h2 id="accountDisplayName">${safeText(data.name)}</h2>
          <p id="accountEmailMain">${data.email}</p>
          <p class="account-callsign">${data.callsign !== 'Не вказано' ? `Позивний: ${data.callsign}` : 'Позивний не вказано'}</p>
          <div class="account-badges"><span class="account-badge is-role">${data.role}</span><span class="account-badge is-ok">Online</span><span class="account-badge ${mfaOk ? 'is-ok' : 'is-warn'}">2FA: ${data.mfa}</span></div>
          <div class="account-actions"><button class="account-action-btn" type="button" id="editProfileButton">Редагувати профіль</button><button class="account-action-btn secondary" type="button" id="connectAccountButton">Підключити акаунт</button><button class="account-action-btn secondary" type="button" id="switchAccountButton">Змінити акаунт</button><button class="account-action-btn secondary" type="button" id="accountLogoutButton">Вийти</button></div>
        </aside>

        <div class="account-scroll-panel">
          <div class="account-main">
            ${buildUserDataSection(data)}
            <section class="account-section"><h3>Картка безпеки</h3><div class="security-list">
              <div class="security-row"><i>G</i><div><b>${data.provider} акаунт</b><em>${data.email}</em></div><span class="security-status">Підключено</span></div>
              <div class="security-row"><i>2F</i><div><b>Двофакторна перевірка</b><em>Захист входу до робочої зони</em></div><span class="security-status ${mfaOk ? '' : 'warn'}">${data.mfa}</span></div>
              <div class="security-row"><i>✉</i><div><b>Email</b><em>Підтвердження поштової адреси</em></div><span class="security-status ${data.emailConfirmed === 'Підтверджено' ? '' : 'warn'}">${data.emailConfirmed}</span></div>
              <div class="security-row"><i>🔐</i><div><b>AES-256-GCM</b><em>Підготовлено для захищених повідомлень і файлів</em></div><span class="security-status">${securityScore}%</span></div>
            </div></section>
            <section class="account-section"><div class="account-section-head"><h3>Підключені акаунти</h3><button type="button" class="mini-edit-btn" id="connectAccountButtonInline">Додати</button></div><div class="connected-account-card"><div class="provider-icon">G</div><div><strong>${data.provider}</strong><span>${data.email}</span></div><span class="security-status">Активний</span></div></section>
            ${buildFutureSections()}
          </div>
        </div>
      </div>`;
  }

  async function reconnectGoogle() {
    const client = window.supabaseClient || (typeof supabaseClient !== 'undefined' ? supabaseClient : null);
    if (!client) return;
    try { if (typeof signIn === 'function') { await signIn(); return; } } catch {}
    const redirectTo = typeof getMessengerRedirectUrl === 'function' ? getMessengerRedirectUrl() : 'https://mrschljakhta-max.github.io/rebus-messenger/';
    await client.auth.signInWithOAuth({ provider: 'google', options: { redirectTo } });
  }

  function readAvatarFile(file) {
    return new Promise((resolve, reject) => {
      if (!file) return resolve('');
      if (!file.type.startsWith('image/')) return reject(new Error('Оберіть файл зображення.'));
      if (file.size > MAX_INLINE_AVATAR_SIZE) return reject(new Error('Фото завелике. Оберіть зображення до 900 КБ або вставте URL.'));
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
      const metadata = { ...(currentUser?.user_metadata || {}), full_name: safeText(data.get('full_name'), getName(currentUser)), name: safeText(data.get('full_name'), getName(currentUser)), callsign: safeText(data.get('callsign'), ''), contour: safeText(data.get('contour'), ''), unit: safeText(data.get('unit'), ''), marker: safeText(data.get('marker'), ''), position: safeText(data.get('position'), '') };
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
        setSaveStatus('Аватарка готова. Натисніть “Зберегти”.');
      } catch (error) { setSaveStatus(error.message, true); }
    });
  }

  function openEditor() { editMode = true; renderAccount(); document.getElementById('userDataSection')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
  function cancelEditor() { pendingAvatarDataUrl = ''; editMode = false; renderAccount(); }

  function bindAccountButtons() {
    document.getElementById('connectAccountButton')?.addEventListener('click', reconnectGoogle);
    document.getElementById('connectAccountButtonInline')?.addEventListener('click', reconnectGoogle);
    document.getElementById('switchAccountButton')?.addEventListener('click', reconnectGoogle);
    document.getElementById('accountLogoutButton')?.addEventListener('click', () => { if (typeof signOut === 'function') signOut(); });
    document.getElementById('editProfileButton')?.addEventListener('click', openEditor);
    document.getElementById('editProfileButtonInline')?.addEventListener('click', openEditor);
    document.getElementById('quickAvatarButton')?.addEventListener('click', () => { editMode = true; renderAccount(); window.setTimeout(() => document.getElementById('accountAvatarInput')?.click(), 80); });
    document.getElementById('cancelEditProfileButton')?.addEventListener('click', cancelEditor);
    document.getElementById('cancelEditProfileButtonBottom')?.addEventListener('click', cancelEditor);
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
      page.innerHTML = `<div class="account-dashboard"><section class="account-section"><h3>Акаунт не підключено</h3><p class="muted">Увійдіть через Google, щоб побачити профіль REBUS Messenger.</p></section></div>`;
      return;
    }
    page.innerHTML = buildAccountPage(user);
    setAvatarVisual(document.getElementById('accountAvatarXL'), getAvatarUrl(user), getInitialsLocal(getName(user)));
    bindAccountButtons();
  }

  window.rebusRenderAccountPage = renderAccount;
  document.addEventListener('click', event => { if (event.target.closest?.('[data-route="account"]')) window.setTimeout(renderAccount, 80); }, true);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => window.setTimeout(renderAccount, 250), { once: true });
  else window.setTimeout(renderAccount, 250);
})();
