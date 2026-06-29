(() => {
  let activeQuickFilter = 'all';

  const qs = (selector, root = document) => root.querySelector(selector);
  const qsa = (selector, root = document) => Array.from(root.querySelectorAll(selector));

  function esc(value = '') {
    return String(value)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  function initials(name = '') {
    const clean = String(name || '').trim();
    if (!clean) return 'R';
    return clean.split(/\s+/).slice(0, 2).map(part => part[0]).join('').toUpperCase();
  }

  function getCardData(card) {
    return {
      id: card?.dataset?.contactId || '',
      name: card?.querySelector('.contact-main strong')?.textContent?.trim() || 'Користувач REBUS',
      title: card?.querySelector('.contact-main em')?.textContent?.trim() || 'REBUS',
      status: card?.querySelector('.contact-main span')?.textContent?.trim() || '⚪ Не в мережі',
      isFavorite: !!card?.querySelector('.contact-favorite'),
      isOnline: card?.querySelector('.contact-presence-dot')?.classList?.contains('online') || false
    };
  }

  function showToast(text) {
    const old = qs('.contacts-toast');
    old?.remove();
    const toast = document.createElement('div');
    toast.className = 'contacts-toast';
    toast.textContent = text;
    Object.assign(toast.style, {
      position: 'fixed', right: '24px', bottom: '24px', zIndex: '16000', padding: '12px 16px',
      borderRadius: '16px', color: '#fff', background: 'rgba(5,12,22,.96)', border: '1px solid rgba(255,255,255,.1)',
      boxShadow: '0 18px 44px rgba(0,0,0,.36)', fontWeight: '850'
    });
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 2400);
  }

  function ensureQuickPanel() {
    const list = qs('#contactsListScroll');
    if (!list || qs('.contacts-quick-panel', list)) return;
    const panel = document.createElement('div');
    panel.className = 'contacts-quick-panel';
    panel.innerHTML = `
      <button type="button" class="contacts-quick-chip is-active" data-contact-quick="all">📒 Усі</button>
      <button type="button" class="contacts-quick-chip" data-contact-quick="online">🟢 Онлайн</button>
      <button type="button" class="contacts-quick-chip" data-contact-quick="favorites">⭐ Обрані</button>
      <button type="button" class="contacts-quick-chip" data-contact-quick="recent">🕒 Нещодавні</button>
    `;
    list.prepend(panel);
  }

  function ensureServiceContacts() {
    const list = qs('#contactsListScroll');
    if (!list || qs('.contacts-service-section', list)) return;
    const empty = qs('.contacts-empty', list);
    const service = document.createElement('section');
    service.className = 'contacts-service-section';
    service.innerHTML = `
      <h3 class="contacts-section-title"><em>🛡️</em><span>Службові контакти</span><span>3</span></h3>
      <div class="contacts-service-grid">
        <button type="button" class="service-contact-card" data-service-contact="support"><i>?</i><span><strong>Підтримка REBUS</strong><span>Технічна допомога</span></span></button>
        <button type="button" class="service-contact-card" data-service-contact="admin"><i>A</i><span><strong>Адміністратор</strong><span>Доступи та ролі</span></span></button>
        <button type="button" class="service-contact-card" data-service-contact="duty"><i>Ч</i><span><strong>Черговий контуру</strong><span>Оперативний контакт</span></span></button>
      </div>
    `;
    if (empty) empty.insertAdjacentElement('afterend', service);
    else list.prepend(service);
  }

  function ensureFastActions() {
    qsa('#contactsListScroll .contact-row-card').forEach(card => {
      if (qs('.contact-fast-actions', card)) return;
      const actions = document.createElement('span');
      actions.className = 'contact-fast-actions';
      actions.innerHTML = `
        <button type="button" data-fast-contact-action="chat" title="Чат">💬</button>
        <button type="button" data-fast-contact-action="profile" title="Профіль">👤</button>
        <button type="button" data-fast-contact-action="call" title="Дзвінок">☎</button>
      `;
      card.appendChild(actions);
    });
  }

  function ensureAlphabetRail() {
    const shell = qs('.contacts-list-shell');
    const list = qs('#contactsListScroll');
    if (!shell || !list) return;
    shell.style.position = 'relative';
    let rail = qs('.contacts-alphabet-rail', shell);
    const letters = qsa('.alphabet-letter', list).map(el => el.textContent.trim()).filter(Boolean);
    if (!letters.length) {
      rail?.remove();
      return;
    }
    if (!rail) {
      rail = document.createElement('div');
      rail.className = 'contacts-alphabet-rail';
      shell.appendChild(rail);
    }
    rail.innerHTML = Array.from(new Set(letters)).map(letter => `<button type="button" data-letter-jump="${esc(letter)}">${esc(letter)}</button>`).join('');
  }

  function applyQuickFilter() {
    const list = qs('#contactsListScroll');
    if (!list) return;
    qsa('.contacts-quick-chip', list).forEach(chip => chip.classList.toggle('is-active', chip.dataset.contactQuick === activeQuickFilter));
    qsa('.contact-row-card', list).forEach(card => {
      const data = getCardData(card);
      let show = true;
      if (activeQuickFilter === 'online') show = data.isOnline;
      if (activeQuickFilter === 'favorites') show = data.isFavorite;
      if (activeQuickFilter === 'recent') show = !!card.closest('.contacts-section')?.querySelector('.contacts-section-title span:nth-child(2)')?.textContent?.includes('Нещодавні');
      card.style.display = show ? '' : 'none';
    });
  }

  function openProfile(card) {
    const data = getCardData(card);
    let modal = qs('#contactsProfileModal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'contactsProfileModal';
      modal.className = 'contacts-profile-modal';
      document.body.appendChild(modal);
    }
    modal.innerHTML = `
      <div class="contacts-profile-card" role="dialog" aria-label="Профіль контакту">
        <div class="contacts-profile-head">
          <div class="contacts-profile-avatar">${esc(initials(data.name))}</div>
          <div><strong>${esc(data.name)}</strong><span>${esc(data.title)}</span></div>
          <button type="button" class="contacts-profile-close" aria-label="Закрити">×</button>
        </div>
        <div class="contacts-profile-body">
          <div class="contacts-profile-row"><em>Статус</em><span>${esc(data.status)}</span></div>
          <div class="contacts-profile-row"><em>Роль/підрозділ</em><span>${esc(data.title)}</span></div>
          <div class="contacts-profile-row"><em>Контур</em><span>Буде синхронізовано з контурами</span></div>
          <div class="contacts-profile-row"><em>Позначки</em><span>${data.isFavorite ? '⭐ Обраний' : 'Без позначок'}</span></div>
        </div>
        <div class="contacts-profile-actions">
          <button type="button" data-profile-action="chat">Відкрити чат</button>
          <button type="button" data-profile-action="copy">Скопіювати</button>
        </div>
      </div>
    `;
    modal.classList.add('is-open');
    modal.dataset.contactId = data.id;
    modal.dataset.contactName = data.name;
  }

  function openContactChat(contactId) {
    if (!contactId) return;
    document.querySelector('[data-route="chat"]')?.click();
    setTimeout(() => document.querySelector(`.direct-user[data-user-id="${CSS.escape(contactId)}"]`)?.click(), 220);
  }

  function enhance() {
    const list = qs('#contactsListScroll');
    if (!list) return;
    ensureQuickPanel();
    ensureServiceContacts();
    ensureFastActions();
    ensureAlphabetRail();
    applyQuickFilter();
  }

  document.addEventListener('click', event => {
    const quick = event.target.closest('[data-contact-quick]');
    if (quick) {
      activeQuickFilter = quick.dataset.contactQuick || 'all';
      enhance();
      return;
    }

    const service = event.target.closest('[data-service-contact]');
    if (service) {
      showToast('Службовий контакт підготуємо після підключення службових профілів.');
      return;
    }

    const jump = event.target.closest('[data-letter-jump]');
    if (jump) {
      const letter = jump.dataset.letterJump;
      const target = qsa('#contactsListScroll .alphabet-letter').find(el => el.textContent.trim() === letter);
      target?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }

    const fast = event.target.closest('[data-fast-contact-action]');
    if (fast) {
      event.preventDefault();
      event.stopPropagation();
      const card = fast.closest('.contact-row-card');
      if (fast.dataset.fastContactAction === 'chat') openContactChat(card?.dataset.contactId);
      if (fast.dataset.fastContactAction === 'profile') openProfile(card);
      if (fast.dataset.fastContactAction === 'call') showToast('Аудіодзвінок буде підключено на етапі WebRTC.');
      return;
    }

    if (event.target.closest('.contacts-profile-close') || event.target.id === 'contactsProfileModal') {
      qs('#contactsProfileModal')?.classList.remove('is-open');
      return;
    }

    const profileAction = event.target.closest('[data-profile-action]');
    if (profileAction) {
      const modal = qs('#contactsProfileModal');
      if (profileAction.dataset.profileAction === 'chat') openContactChat(modal?.dataset.contactId);
      if (profileAction.dataset.profileAction === 'copy') {
        navigator.clipboard?.writeText(modal?.dataset.contactName || 'Контакт REBUS');
        showToast('Контакт скопійовано.');
      }
      modal?.classList.remove('is-open');
    }
  }, true);

  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') qs('#contactsProfileModal')?.classList.remove('is-open');
  });

  const observer = new MutationObserver(() => {
    clearTimeout(window.__rebusContactsEnhanceTimer);
    window.__rebusContactsEnhanceTimer = setTimeout(enhance, 80);
  });

  function init() {
    const list = qs('#contactsListScroll');
    if (list && !list.dataset.enhanceObserved) {
      list.dataset.enhanceObserved = '1';
      observer.observe(list, { childList: true, subtree: true });
    }
    enhance();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
  document.addEventListener('click', event => {
    if (event.target.closest('[data-route="contacts"]')) setTimeout(init, 220);
  }, true);
})();
