(() => {
  const SIDEBAR_ID = 'rebusPeerSidebar';
  const BACKDROP_ID = 'rebusPeerSidebarBackdrop';

  function esc(value = '') {
    return String(value)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  function getInitialsSafe(name = '') {
    try {
      if (typeof getInitials === 'function') return getInitials(name);
    } catch {}
    const clean = String(name || '').trim();
    if (!clean) return 'R';
    return clean.split(/\s+/).slice(0, 2).map(part => part[0]).join('').toUpperCase();
  }

  function getPeer() {
    try {
      if (typeof selectedPeer !== 'undefined' && selectedPeer) return selectedPeer;
    } catch {}
    const selected = document.querySelector('.direct-user.is-selected');
    if (!selected) return null;
    return {
      id: selected.dataset.userId || '',
      name: selected.querySelector('strong')?.textContent?.trim() || 'Користувач REBUS',
      email: selected.querySelector('.direct-user-main em')?.textContent?.trim() || '',
      role: 'USER'
    };
  }

  function getAvatarUrl(peer) {
    return peer?.avatar_url || peer?.picture || peer?.photo_url || peer?.avatar || peer?.metadata?.avatar_url || '';
  }

  function ensureSidebar() {
    let backdrop = document.getElementById(BACKDROP_ID);
    let sidebar = document.getElementById(SIDEBAR_ID);

    if (!backdrop) {
      backdrop = document.createElement('div');
      backdrop.id = BACKDROP_ID;
      backdrop.className = 'rebus-peer-sidebar-backdrop';
      document.body.appendChild(backdrop);
      backdrop.addEventListener('click', closeSidebar);
    }

    if (!sidebar) {
      sidebar = document.createElement('aside');
      sidebar.id = SIDEBAR_ID;
      sidebar.className = 'rebus-peer-sidebar';
      sidebar.setAttribute('aria-label', 'Профіль користувача');
      sidebar.innerHTML = `
        <div class="rebus-peer-sidebar-head">
          <div>
            <strong>Профіль користувача</strong>
            <span>Інформація про співрозмовника</span>
          </div>
          <button type="button" class="rebus-peer-sidebar-close" aria-label="Закрити">×</button>
        </div>
        <div class="rebus-peer-sidebar-body"></div>
      `;
      document.body.appendChild(sidebar);
      sidebar.querySelector('.rebus-peer-sidebar-close')?.addEventListener('click', closeSidebar);
    }

    return { backdrop, sidebar };
  }

  function renderSidebar(peer) {
    const { sidebar } = ensureSidebar();
    const body = sidebar.querySelector('.rebus-peer-sidebar-body');
    if (!body) return;

    const name = peer?.name || 'Користувач REBUS';
    const email = peer?.email || 'Email не вказано';
    const role = peer?.role || 'USER';
    const callSign = peer?.callsign || peer?.call_sign || peer?.nickname || 'Не вказано';
    const contour = peer?.contour || peer?.contour_name || 'Не призначено';
    const unit = peer?.unit || peer?.group || peer?.department || 'Не вказано';
    const position = peer?.position || peer?.job_title || 'Не вказано';
    const avatarUrl = getAvatarUrl(peer);
    const avatarStyle = avatarUrl ? ` style="background-image:url('${esc(avatarUrl)}')"` : '';

    body.innerHTML = `
      <section class="rebus-peer-card">
        <div class="rebus-peer-avatar-xl${avatarUrl ? ' has-avatar' : ''}"${avatarStyle}>${avatarUrl ? '' : esc(getInitialsSafe(name))}</div>
        <div class="rebus-peer-name">${esc(name)}</div>
        <div class="rebus-peer-email">${esc(email)}</div>
        <div class="rebus-peer-status"><i></i> Онлайн</div>
      </section>

      <section class="rebus-peer-section">
        <h4>Дані користувача</h4>
        <div class="rebus-peer-info-grid">
          <div class="rebus-peer-info-row"><span>Роль</span><strong>${esc(role)}</strong></div>
          <div class="rebus-peer-info-row"><span>Позивний</span><strong>${esc(callSign)}</strong></div>
          <div class="rebus-peer-info-row"><span>Контур</span><strong>${esc(contour)}</strong></div>
          <div class="rebus-peer-info-row"><span>Підрозділ</span><strong>${esc(unit)}</strong></div>
          <div class="rebus-peer-info-row"><span>Посада</span><strong>${esc(position)}</strong></div>
        </div>
      </section>

      <section class="rebus-peer-section">
        <h4>Матеріали чату</h4>
        <div class="rebus-peer-shortcuts">
          <div class="rebus-peer-shortcut"><em>📄</em>Файли</div>
          <div class="rebus-peer-shortcut"><em>🖼️</em>Фото</div>
          <div class="rebus-peer-shortcut"><em>🔗</em>Посилання</div>
        </div>
      </section>

      <section class="rebus-peer-section">
        <h4>Закладки</h4>
        <p class="rebus-peer-placeholder">Тут згодом будуть важливі повідомлення, закріплення та обрані матеріали з цього листування.</p>
      </section>
    `;
  }

  function openSidebar() {
    const peer = getPeer();
    if (!peer) return;
    const { backdrop, sidebar } = ensureSidebar();
    renderSidebar(peer);
    backdrop.classList.add('is-open');
    sidebar.classList.add('is-open');
  }

  function closeSidebar() {
    document.getElementById(BACKDROP_ID)?.classList.remove('is-open');
    document.getElementById(SIDEBAR_ID)?.classList.remove('is-open');
  }

  function bindHeader() {
    const head = document.getElementById('directChatHead');
    if (!head) return;
    const avatar = head.querySelector('.direct-chat-avatar');
    const title = head.querySelector('.direct-chat-title');
    [avatar, title].forEach(node => {
      if (!node || node.dataset.peerSidebarBound === '1') return;
      node.dataset.peerSidebarBound = '1';
      node.addEventListener('click', event => {
        if (!getPeer()) return;
        event.preventDefault();
        event.stopPropagation();
        openSidebar();
      });
    });
  }

  function init() {
    bindHeader();
    const head = document.getElementById('directChatHead');
    if (!head || head.dataset.peerSidebarObserver === '1') return;
    head.dataset.peerSidebarObserver = '1';
    new MutationObserver(bindHeader).observe(head, { childList: true, subtree: true });
  }

  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') closeSidebar();
  }, true);

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
  window.setTimeout(init, 300);
  window.setTimeout(init, 900);
})();
