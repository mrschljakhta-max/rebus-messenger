(() => {
  const MONTHS_UK = ['Січень', 'Лютий', 'Березень', 'Квітень', 'Травень', 'Червень', 'Липень', 'Серпень', 'Вересень', 'Жовтень', 'Листопад', 'Грудень'];
  const MONTH_MAP = new Map(MONTHS_UK.map((name, index) => [name.toLowerCase(), index]));
  const indexByPeer = new Map();
  let currentPeerId = null;
  let loadingPeerId = null;

  function client() {
    return window.rebusSupabaseClient || window.supabaseClient || (typeof supabaseClient !== 'undefined' ? supabaseClient : null);
  }

  async function getCurrentUserId() {
    const supa = client();
    if (!supa?.auth?.getUser) return null;
    const { data } = await supa.auth.getUser();
    return data?.user?.id || null;
  }

  function activePeerId() {
    return document.querySelector('#page-chat .direct-user.is-selected[data-user-id], #page-chat .direct-user.is-active[data-user-id]')?.dataset.userId || null;
  }

  function dateKey(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  async function fetchAllDates(peerId) {
    const supa = client();
    const me = await getCurrentUserId();
    if (!supa || !me || !peerId) return new Map();

    const pairFilter = `and(user_id.eq.${me},recipient_id.eq.${peerId}),and(user_id.eq.${peerId},recipient_id.eq.${me})`;
    const counts = new Map();
    const pageSize = 1000;
    let from = 0;

    while (true) {
      const { data, error } = await supa
        .from('messenger_messages')
        .select('id, created_at')
        .eq('channel', 'direct')
        .or(pairFilter)
        .order('created_at', { ascending: true })
        .range(from, from + pageSize - 1);

      if (error) {
        console.warn('[REBUS] calendar date index skipped:', error.message);
        break;
      }

      (data || []).forEach(message => {
        const key = dateKey(message.created_at);
        if (!key) return;
        counts.set(key, (counts.get(key) || 0) + 1);
      });

      if (!data || data.length < pageSize) break;
      from += pageSize;
    }

    return counts;
  }

  async function refreshDates(force = false) {
    const peerId = activePeerId();
    if (!peerId) return;
    currentPeerId = peerId;
    if (!force && indexByPeer.has(peerId)) {
      patchCalendars();
      return;
    }
    if (loadingPeerId === peerId) return;
    loadingPeerId = peerId;
    const counts = await fetchAllDates(peerId);
    indexByPeer.set(peerId, counts);
    loadingPeerId = null;
    patchCalendars();
  }

  function getActiveCounts() {
    const peerId = activePeerId() || currentPeerId;
    return peerId ? (indexByPeer.get(peerId) || new Map()) : new Map();
  }

  function parseCalendarTitle(text = '') {
    const clean = text.trim().replace(/\s+/g, ' ');
    const match = clean.match(/^([А-ЯІЇЄҐа-яіїєґ]+)\s+(\d{4})$/);
    if (!match) return null;
    const month = MONTH_MAP.get(match[1].toLowerCase());
    const year = Number(match[2]);
    if (month == null || !year) return null;
    return { month, year };
  }

  function findCalendarRoots() {
    const roots = [];
    document.querySelectorAll('body *').forEach(node => {
      if (!(node instanceof HTMLElement)) return;
      const parsed = parseCalendarTitle(node.textContent || '');
      if (!parsed) return;
      const root = node.closest('[role="dialog"], .calendar, .datepicker, .date-picker, .chat-calendar, .rebus-calendar')
        || node.parentElement?.parentElement?.parentElement
        || node.parentElement;
      if (root && !roots.includes(root)) roots.push(root);
      root && (root.dataset.calendarMonth = String(parsed.month), root.dataset.calendarYear = String(parsed.year));
    });
    return roots;
  }

  function keyForDay(year, month, day) {
    return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }

  function patchCalendars() {
    const counts = getActiveCounts();
    if (!counts.size) return;

    findCalendarRoots().forEach(root => {
      const year = Number(root.dataset.calendarYear);
      const month = Number(root.dataset.calendarMonth);
      if (!Number.isFinite(year) || !Number.isFinite(month)) return;

      root.querySelectorAll('button, [role="button"], .day, .calendar-day, .datepicker-day').forEach(cell => {
        if (!(cell instanceof HTMLElement)) return;
        const dayText = (cell.textContent || '').trim();
        if (!/^\d{1,2}$/.test(dayText)) return;
        const day = Number(dayText);
        if (day < 1 || day > 31) return;
        const key = keyForDay(year, month, day);
        const count = counts.get(key) || 0;
        cell.classList.toggle('has-chat-messages', count > 0);
        if (count > 0) {
          cell.dataset.messageDate = key;
          cell.dataset.messageCount = String(count);
          cell.title = `${count} повідомл. за ${key}`;
        }
      });
    });
  }

  function scrollToDate(key) {
    if (!key) return false;
    const target = Array.from(document.querySelectorAll('#messagesList .message[data-message-id]')).find(message => {
      const meta = message.querySelector('.message-meta span')?.textContent || '';
      // Fallback works for currently rendered messages through day divider lookup below.
      return message.dataset.messageDate === key || meta.includes(key);
    });
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return true;
    }
    const dividers = Array.from(document.querySelectorAll('#messagesList .message-day-divider'));
    const label = new Date(`${key}T12:00:00`).toLocaleDateString('uk-UA', { day: 'numeric', month: 'long', year: 'numeric' });
    const divider = dividers.find(item => (item.textContent || '').toLowerCase().includes(label.toLowerCase()));
    divider?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    return Boolean(divider);
  }

  document.addEventListener('click', event => {
    const routeOrPeer = event.target.closest?.('[data-route="chat"], .direct-user[data-user-id]');
    if (routeOrPeer) setTimeout(() => refreshDates(true), 250);

    const dateCell = event.target.closest?.('[data-message-date]');
    if (dateCell?.dataset?.messageDate) {
      setTimeout(() => scrollToDate(dateCell.dataset.messageDate), 80);
    }
  }, true);

  document.addEventListener('rebus:route-change', event => {
    if (!event.detail?.route || event.detail.route === 'chat') setTimeout(() => refreshDates(false), 250);
  });

  new MutationObserver(() => {
    clearTimeout(window.__rebusCalendarPatchTimer);
    window.__rebusCalendarPatchTimer = setTimeout(() => {
      refreshDates(false);
      patchCalendars();
    }, 120);
  }).observe(document.body, { childList: true, subtree: true });

  window.RebusChatCalendarDates = { refresh: () => refreshDates(true), patch: patchCalendars, index: indexByPeer };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => setTimeout(refreshDates, 700), { once: true });
  else setTimeout(refreshDates, 700);
})();
