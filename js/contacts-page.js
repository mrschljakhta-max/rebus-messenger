(() => {
  const SUPABASE_URL = 'https://aehedmvxpqxsmzxemkix.supabase.co';
  const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_8cJ1jnSyGOoAG8MOEXZtCA_cY72YAnh';
  const FAVORITES_KEY = 'rebus:messenger:favorite-contacts';
  const BLOCKED_KEY = 'rebus:messenger:blocked-contacts';

  const STATUS_META = {
    online: { label: 'Онлайн', icon: '🟢', className: 'online' },
    dnd: { label: 'Не турбувати', icon: '🟡', className: 'dnd' },
    busy: { label: 'Зайнятий', icon: '🔴', className: 'busy' },
    offline: { label: 'Не в мережі', icon: '⚪', className: 'offline' }
  };

  const state = {
    client: null,
    currentUser: null,
    contacts: [],
    recents: [],
    favorites: new Set(),
    blocked: new Set(),
    query: '',
    unitFilter: 'all',
    activeContactId: null,
    isLoading: false
  };

  const qs = (selector, root = document) => root.querySelector(selector);
  const esc = (value = '') => String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');

  function getInitials(name = '') {
    const clean = String(name || '').trim();
    if (!clean) return 'R';
    return clean.split(/\s+/).slice(0, 2).map(part => part[0]).join('').toUpperCase();
  }

  function getSyntheticStatus(seed = '') {
    const value = String(seed).split('').reduce((sum, ch) => sum + ch.charCodeAt(0), 0);
    return ['online', 'online', 'online', 'offline', 'busy', 'dnd'][value % 6];
  }

  function normalizeProfile(row = {}) {
    const id = row.user_id || row.id;
    const email = row.email || '';
    const name = row.full_name || email.split('@')[0] || 'Користувач REBUS';
    const role = row.role || 'USER';
    return {
      id,
      profileId: row.id || null,
      email,
      name,
      role,
      unit: role,
      callsign: '',
      title: role,
      status: getSyntheticStatus(id || email || name),
      unread: 0
    };
  }

  function loadSet(key) {
    try { return new Set(JSON.parse(localStorage.getItem(key) || '[]')); } catch { return new Set(); }
  }

  function saveSet(key, set) {
    localStorage.setItem(key, JSON.stringify(Array.from(set)));
  }

  function ensureClient() {
    if (state.client) return state.client;
    if (!window.supabase?.createClient) return null;
    state.client = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
    });
    return state.client;
  }

  async function ensureUser() {
    const client = ensureClient();
    if (!client) return null;
    const userResult = await client.auth.getUser();
    state.currentUser = userResult?.data?.user || null;
    return state.currentUser;
  }

  function contactHaystack(contact) {
    return `${contact.name} ${contact.email} ${contact.role} ${contact.unit} ${contact.callsign}`.toLowerCase();
  }

  function getFilteredContacts() {
    const q = state.query.trim().toLowerCase();
    return state.contacts
      .filter(contact => !state.blocked.has(contact.id))
      .filter(contact => !q || contactHaystack(contact).includes(q))
      .filter(contact => state.unitFilter === 'all' || contact.unit === state.unitFilter)
      .sort((a, b) => a.name.localeCompare(b.name, 'uk'));
  }

  function renderContactCard(contact) {
    const status = STATUS_META[contact.status] || STATUS_META.offline;
    const favorite = state.favorites.has(contact.id);
    return `
      <button type="button" class="contact-row-card" data-contact-id="${esc(contact.id)}" title="Відкрити чат">
        <span class="contact-avatar">${esc(getInitials(contact.name))}<i class="contact-presence-dot ${esc(status.className)}"></i></span>
        <span class="contact-main"><strong>${esc(contact.name)}</strong><em>${esc(contact.title || contact.email || 'Користувач REBUS')}</em><span>${status.icon} ${esc(status.label)}</span></span>
        <span class="contact-meta">${favorite ? '<i class="contact-favorite">★</i>' : ''}${contact.unread ? `<i class="contact-unread">${contact.unread}</i>` : ''}</span>
      </button>`;
  }

  function renderContactSection(icon, title, contacts) {
    if (!contacts.length) return '';
    return `<section class="contacts-section"><h3 class="contacts-section-title"><em>${icon}</em><span>${esc(title)}</span><span>${contacts.length}</span></h3><div class="contact-grid">${contacts.map(renderContactCard).join('')}</div></section>`;
  }

  function renderAlphabetSection(contacts) {
    if (!contacts.length) return '';
    const groups = new Map();
    contacts.forEach(contact => {
      const letter = (contact.name || '#').trim()[0]?.toUpperCase() || '#';
      if (!groups.has(letter)) groups.set(letter, []);
      groups.get(letter).push(contact);
    });
    const letters = Array.from(groups.keys()).sort((a, b) => a.localeCompare(b, 'uk'));
    return `<section class="contacts-section"><h3 class="contacts-section-title"><em>📒</em><span>Усі контакти</span><span>${contacts.length}</span></h3>${letters.map(letter => `<div class="alphabet-group"><div class="alphabet-letter">${esc(letter)}</div><div class="contact-grid">${groups.get(letter).map(renderContactCard).join('')}</div></div>`).join('')}</section>`;
  }

  function renderUnitFilters() {
    const host = qs('#contactsFilterList');
    if (!host) return;
    const units = Array.from(new Set(state.contacts.map(contact => contact.unit).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'uk'));
    const filteredTotal = getFilteredContacts().length;
    host.innerHTML = `<button type="button" class="contacts-filter-chip ${state.unitFilter === 'all' ? 'is-active' : ''}" data-unit-filter="all"><span>Усі підрозділи</span><span>${filteredTotal}</span></button>${units.map(unit => `<button type="button" class="contacts-filter-chip ${state.unitFilter === unit ? 'is-active' : ''}" data-unit-filter="${esc(unit)}"><span>${esc(unit)}</span><span>${state.contacts.filter(contact => contact.unit === unit && !state.blocked.has(contact.id)).length}</span></button>`).join('')}`;
  }

  function render() {
    const list = qs('#contactsListScroll');
    if (!list) return;
    renderUnitFilters();
    if (state.isLoading) {
      list.innerHTML = '<div class="contacts-empty">Завантаження контактів…</div>';
      return;
    }
    const filtered = getFilteredContacts();
    if (!filtered.length) {
      list.innerHTML = '<div class="contacts-empty">Контактів не знайдено. Спробуй оновити список або перевірити доступ до профілів.</div>';
      return;
    }
    const favoriteContacts = filtered.filter(contact => state.favorites.has(contact.id));
    const onlineContacts = filtered.filter(contact => contact.status === 'online' && !state.favorites.has(contact.id));
    const recentIds = new Set(state.recents.map(item => item.id));
    const recentContacts = filtered.filter(contact => recentIds.has(contact.id) && !state.favorites.has(contact.id));
    list.innerHTML = [
      renderContactSection('⭐', 'Обрані', favoriteContacts),
      renderContactSection('🟢', 'Онлайн', onlineContacts),
      renderContactSection('🕒', 'Нещодавні', recentContacts),
      renderAlphabetSection(filtered)
    ].join('');
  }

  async function loadRecents() {
    if (!state.client || !state.currentUser) return;
    const me = state.currentUser.id;
    const { data, error } = await state.client.from('messenger_messages').select('user_id,recipient_id,created_at').eq('channel', 'direct').or(`user_id.eq.${me},recipient_id.eq.${me}`).order('created_at', { ascending: false }).limit(60);
    if (error) {
      state.recents = [];
      return;
    }
    const seen = new Set();
    state.recents = [];
    (data || []).forEach(message => {
      const id = message.user_id === me ? message.recipient_id : message.user_id;
      if (!id || seen.has(id)) return;
      seen.add(id);
      state.recents.push({ id, at: message.created_at });
    });
  }

  async function loadContacts() {
    const list = qs('#contactsListScroll');
    state.isLoading = true;
    state.favorites = loadSet(FAVORITES_KEY);
    state.blocked = loadSet(BLOCKED_KEY);
    render();

    await ensureUser();
    if (!state.client) {
      state.contacts = [];
      state.isLoading = false;
      if (list) list.innerHTML = '<div class="contacts-empty">Supabase клієнт не завантажився.</div>';
      return;
    }

    const { data, error } = await state.client.from('rebus_profiles').select('id,user_id,email,full_name,role');
    if (error) {
      state.contacts = [];
      state.isLoading = false;
      if (list) list.innerHTML = `<div class="contacts-empty">Не вдалося завантажити контакти: ${esc(error.message)}</div>`;
      return;
    }

    const seen = new Set();
    state.contacts = (data || []).map(normalizeProfile)
      .filter(contact => contact.id && contact.id !== state.currentUser?.id)
      .filter(contact => {
        if (seen.has(contact.id)) return false;
        seen.add(contact.id);
        return true;
      });

    await loadRecents();
    state.isLoading = false;
    render();
  }

  function openChat(contact) {
    if (!contact) return;
    document.querySelector('[data-route="chat"]')?.click();
    setTimeout(() => {
      if (typeof window.selectDirectUser === 'function') {
        window.selectDirectUser(contact);
        return;
      }
      document.querySelector(`.direct-user[data-user-id="${CSS.escape(contact.id)}"]`)?.click();
    }, 220);
  }

  function openMenu(contactId, x, y) {
    const menu = qs('#contactsContextMenu');
    if (!menu) return;
    state.activeContactId = contactId;
    const isFavorite = state.favorites.has(contactId);
    menu.innerHTML = `<button type="button" data-contact-action="chat"><span>💬</span><em>Відкрити чат</em></button><button type="button" data-contact-action="favorite"><span>⭐</span><em>${isFavorite ? 'Прибрати з обраних' : 'Закріпити в обраних'}</em></button><button type="button" data-contact-action="profile"><span>👤</span><em>Переглянути профіль</em></button><button type="button" data-contact-action="share"><span>↗</span><em>Поділитися контактом</em></button><button type="button" class="is-danger" data-contact-action="block"><span>⛔</span><em>Заблокувати</em></button><button type="button" class="is-danger" data-contact-action="delete"><span>⌫</span><em>Видалити з контактів</em></button>`;
    menu.classList.add('is-open');
    menu.style.left = '0px';
    menu.style.top = '0px';
    const rect = menu.getBoundingClientRect();
    menu.style.left = `${Math.max(10, Math.min(x, window.innerWidth - rect.width - 10))}px`;
    menu.style.top = `${Math.max(10, Math.min(y, window.innerHeight - rect.height - 10))}px`;
  }

  function closeMenu() { qs('#contactsContextMenu')?.classList.remove('is-open'); }

  function toast(text) {
    const old = qs('.contacts-toast');
    old?.remove();
    const el = document.createElement('div');
    el.className = 'contacts-toast';
    el.textContent = text;
    Object.assign(el.style, { position: 'fixed', right: '24px', bottom: '24px', zIndex: '14000', padding: '12px 16px', borderRadius: '16px', color: '#fff', background: 'rgba(5,12,22,.96)', border: '1px solid rgba(255,255,255,.1)', boxShadow: '0 18px 44px rgba(0,0,0,.36)', fontWeight: '850' });
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 2400);
  }

  function handleMenuAction(action) {
    const contact = state.contacts.find(item => item.id === state.activeContactId);
    if (!contact) return;
    if (action === 'chat') openChat(contact);
    if (action === 'favorite') {
      state.favorites.has(contact.id) ? state.favorites.delete(contact.id) : state.favorites.add(contact.id);
      saveSet(FAVORITES_KEY, state.favorites);
      render();
    }
    if (action === 'profile') toast(`${contact.name}: ${contact.title || contact.email}`);
    if (action === 'share') {
      navigator.clipboard?.writeText(`${contact.name} — ${contact.email || contact.title || 'REBUS'}`);
      toast('Контакт скопійовано.');
    }
    if (action === 'block' || action === 'delete') {
      state.blocked.add(contact.id);
      saveSet(BLOCKED_KEY, state.blocked);
      render();
      toast(action === 'block' ? 'Контакт заблоковано локально.' : 'Контакт прибрано зі списку локально.');
    }
    closeMenu();
  }

  function bindEvents() {
    const root = qs('#page-contacts');
    if (!root || root.dataset.contactsReady === '1') return;
    root.dataset.contactsReady = '1';
    qs('#contactsSearchInput')?.addEventListener('input', event => { state.query = event.target.value || ''; render(); });
    qs('#contactsRefreshButton')?.addEventListener('click', loadContacts);
    qs('#contactsAddButton')?.addEventListener('click', () => toast('Додавання контакту буде підключено до прав адміністратора.'));
    root.addEventListener('click', event => {
      const filter = event.target.closest('[data-unit-filter]');
      if (filter) { state.unitFilter = filter.dataset.unitFilter || 'all'; render(); return; }
      const card = event.target.closest('.contact-row-card[data-contact-id]');
      if (card) openChat(state.contacts.find(item => item.id === card.dataset.contactId));
    });
    let pressTimer = null;
    root.addEventListener('pointerdown', event => {
      const card = event.target.closest('.contact-row-card[data-contact-id]');
      if (!card) return;
      clearTimeout(pressTimer);
      pressTimer = setTimeout(() => openMenu(card.dataset.contactId, event.clientX + 8, event.clientY + 8), 520);
    });
    ['pointerup', 'pointercancel', 'pointerleave'].forEach(type => root.addEventListener(type, () => clearTimeout(pressTimer)));
    root.addEventListener('contextmenu', event => {
      const card = event.target.closest('.contact-row-card[data-contact-id]');
      if (!card) return;
      event.preventDefault();
      openMenu(card.dataset.contactId, event.clientX + 8, event.clientY + 8);
    });
    document.addEventListener('click', event => {
      const action = event.target.closest('[data-contact-action]');
      if (action) { event.preventDefault(); handleMenuAction(action.dataset.contactAction); return; }
      if (!event.target.closest('#contactsContextMenu')) closeMenu();
    }, true);
    document.addEventListener('keydown', event => { if (event.key === 'Escape') closeMenu(); });
  }

  function init() { bindEvents(); if (qs('#page-contacts.is-active')) loadContacts(); }
  document.addEventListener('click', event => { if (event.target.closest('[data-route="contacts"]')) setTimeout(loadContacts, 160); }, true);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true }); else init();
})();
