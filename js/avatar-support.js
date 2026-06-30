(() => {
  const STYLE_ID = 'rebus-avatar-support-style';
  const PROFILE_TABLE = 'rebus_profiles';
  const PROFILE_COLUMNS = 'id,user_id,email,full_name,role,avatar_url';
  const avatarByUserId = new Map();
  const avatarByEmail = new Map();
  let loadPromise = null;
  let avatarColumnMissing = false;

  function injectStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      .direct-user-avatar.has-avatar,
      .direct-chat-avatar.has-avatar,
      .contact-avatar.has-avatar,
      .settings-avatar.has-avatar,
      #directSelfCard .direct-self-avatar.has-avatar {
        color: transparent !important;
        background-size: cover !important;
        background-position: center !important;
        background-repeat: no-repeat !important;
        overflow: hidden !important;
      }
      .direct-user-avatar.has-avatar img,
      .direct-chat-avatar.has-avatar img,
      .contact-avatar.has-avatar img,
      .settings-avatar.has-avatar img,
      #directSelfCard .direct-self-avatar.has-avatar img {
        width: 100% !important;
        height: 100% !important;
        object-fit: cover !important;
        border-radius: inherit !important;
        display: block !important;
      }
    `;
    document.head.appendChild(style);
  }

  function getClient() {
    return window.rebusSupabaseClient || window.supabaseClient || (typeof supabaseClient !== 'undefined' ? supabaseClient : null);
  }

  function normalizeUrl(value = '') {
    const url = String(value || '').trim();
    if (!url || url === 'null' || url === 'undefined') return '';
    return url;
  }

  function safeCssUrl(value = '') {
    return String(value).replaceAll('"', '%22').replaceAll('\\', '%5C');
  }

  function applyAvatar(node, url) {
    if (!node || !url || node.dataset.avatarApplied === url) return;
    node.dataset.avatarApplied = url;
    node.classList.add('has-avatar');
    node.textContent = '';
    node.style.backgroundImage = `url("${safeCssUrl(url)}")`;
  }

  function rememberProfile(profile) {
    const url = normalizeUrl(profile?.avatar_url);
    if (!url) return;
    if (profile.user_id) avatarByUserId.set(profile.user_id, url);
    if (profile.id) avatarByUserId.set(profile.id, url);
    if (profile.email) avatarByEmail.set(String(profile.email).toLowerCase(), url);
  }

  async function loadProfiles() {
    if (loadPromise) return loadPromise;
    loadPromise = (async () => {
      const client = getClient();
      if (!client?.from || avatarColumnMissing) return;
      const { data, error } = await client.from(PROFILE_TABLE).select(PROFILE_COLUMNS);
      if (error) {
        if (String(error.message || '').toLowerCase().includes('avatar_url')) {
          avatarColumnMissing = true;
          console.info('[REBUS] avatar_url column is not available yet. Run: alter table rebus_profiles add column avatar_url text;');
        } else {
          console.warn('[REBUS] Avatar profiles skipped:', error.message);
        }
        return;
      }
      (data || []).forEach(rememberProfile);
    })().finally(() => { loadPromise = null; });
    return loadPromise;
  }

  async function syncOwnGoogleAvatar() {
    const client = getClient();
    if (!client?.auth?.getUser || avatarColumnMissing) return;
    try {
      const { data } = await client.auth.getUser();
      const user = data?.user;
      const meta = user?.user_metadata || {};
      const url = normalizeUrl(meta.avatar_url || meta.picture || meta.photo_url || meta.avatar);
      if (!user?.id || !url) return;
      avatarByUserId.set(user.id, url);
      if (user.email) avatarByEmail.set(user.email.toLowerCase(), url);
      await client.from(PROFILE_TABLE).update({ avatar_url: url }).eq('user_id', user.id);
    } catch (error) {
      if (String(error?.message || '').toLowerCase().includes('avatar_url')) avatarColumnMissing = true;
    }
  }

  function decorateDirectUsers() {
    document.querySelectorAll('.direct-user[data-user-id]').forEach(card => {
      const id = card.dataset.userId;
      const email = card.querySelector('.direct-user-main em')?.textContent?.trim()?.toLowerCase();
      const url = avatarByUserId.get(id) || avatarByEmail.get(email);
      if (url) applyAvatar(card.querySelector('.direct-user-avatar'), url);
    });
  }

  function decorateChatHead() {
    const active = document.querySelector('.direct-user.is-selected[data-user-id]');
    const headAvatar = document.querySelector('#directChatHead .direct-chat-avatar');
    if (!active || !headAvatar) return;
    const id = active.dataset.userId;
    const email = active.querySelector('.direct-user-main em')?.textContent?.trim()?.toLowerCase();
    const url = avatarByUserId.get(id) || avatarByEmail.get(email);
    if (url) applyAvatar(headAvatar, url);
  }

  function decorateContacts() {
    document.querySelectorAll('.contact-row-card[data-contact-id]').forEach(card => {
      const id = card.dataset.contactId;
      const nameOrEmail = card.querySelector('.contact-main em')?.textContent?.trim()?.toLowerCase();
      const url = avatarByUserId.get(id) || avatarByEmail.get(nameOrEmail);
      if (url) applyAvatar(card.querySelector('.contact-avatar'), url);
    });
  }

  function decorateSettings() {
    const email = document.getElementById('settingsEmail')?.textContent?.trim()?.toLowerCase();
    const url = avatarByEmail.get(email);
    if (url) applyAvatar(document.getElementById('settingsAvatar'), url);
  }

  function decorateSelfCard() {
    const email = document.querySelector('#directSelfCard .direct-self-main strong')?.textContent?.trim()?.toLowerCase();
    const url = avatarByEmail.get(email);
    if (url) applyAvatar(document.querySelector('#directSelfCard .direct-self-avatar'), url);
  }

  async function refreshAvatars() {
    injectStyle();
    await syncOwnGoogleAvatar();
    await loadProfiles();
    decorateDirectUsers();
    decorateChatHead();
    decorateContacts();
    decorateSettings();
    decorateSelfCard();
  }

  function observe() {
    const targets = ['directUsersList', 'directChatHead', 'contactsListScroll', 'page-settings'];
    targets.forEach(id => {
      const node = document.getElementById(id);
      if (!node || node.dataset.avatarObserved === '1') return;
      node.dataset.avatarObserved = '1';
      new MutationObserver(() => {
        clearTimeout(window.__rebusAvatarTimer);
        window.__rebusAvatarTimer = setTimeout(refreshAvatars, 80);
      }).observe(node, { childList: true, subtree: true, characterData: true });
    });
  }

  function init() {
    observe();
    refreshAvatars();
  }

  document.addEventListener('rebus:route-change', init);
  document.addEventListener('rebus:contacts-visible', init);
  document.addEventListener('rebus:settings-visible', init);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
  window.setTimeout(init, 700);
  window.setTimeout(init, 1800);
})();
