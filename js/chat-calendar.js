(() => {
  const POPOVER_ID = 'rebusChatCalendarPopover';
  const DAY_SELECTOR = '#messagesList .message-day-divider';
  const UK_MONTHS = [
    'січня', 'лютого', 'березня', 'квітня', 'травня', 'червня',
    'липня', 'серпня', 'вересня', 'жовтня', 'листопада', 'грудня'
  ];
  const UK_MONTH_TITLES = [
    'Січень', 'Лютий', 'Березень', 'Квітень', 'Травень', 'Червень',
    'Липень', 'Серпень', 'Вересень', 'Жовтень', 'Листопад', 'Грудень'
  ];
  const WEEK = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Нд'];

  let viewedMonth = null;
  let selectedDateKey = null;
  let activeAnchor = null;
  let activePeerId = null;
  let dateIndex = new Map();
  let indexLoadingFor = null;

  function pad(value) {
    return String(value).padStart(2, '0');
  }

  function toKey(date) {
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  }

  function keyFromIso(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    return toKey(date);
  }

  function startOfDay(date) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
  }

  function monthStart(date) {
    return new Date(date.getFullYear(), date.getMonth(), 1);
  }

  function addMonths(date, offset) {
    return new Date(date.getFullYear(), date.getMonth() + offset, 1);
  }

  function sameMonth(a, b) {
    return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();
  }

  function supa() {
    try { if (typeof supabaseClient !== 'undefined') return supabaseClient; } catch {}
    return window.supabaseClient || window.rebusSupabaseClient || null;
  }

  async function getCurrentUserId() {
    try {
      if (typeof currentUser !== 'undefined' && currentUser?.id) return currentUser.id;
    } catch {}
    const client = supa();
    if (!client?.auth?.getUser) return null;
    const { data } = await client.auth.getUser();
    return data?.user?.id || null;
  }

  function getSelectedPeerId() {
    try {
      if (typeof selectedPeer !== 'undefined' && selectedPeer?.id) return selectedPeer.id;
    } catch {}
    return document.querySelector('#page-chat .direct-user.is-selected[data-user-id], #page-chat .direct-user.is-active[data-user-id]')?.dataset.userId || null;
  }

  function parseDividerDate(label) {
    const text = String(label || '').trim().toLowerCase();
    const today = startOfDay(new Date());
    if (!text) return null;
    if (text === 'сьогодні') return today;
    if (text === 'вчора') {
      const date = new Date(today);
      date.setDate(date.getDate() - 1);
      return date;
    }

    const match = text.replace(/\s*р\.$/, '').match(/^(\d{1,2})\s+([а-яіїєґ]+)\s+(\d{4})$/i);
    if (!match) return null;
    const day = Number(match[1]);
    const month = UK_MONTHS.indexOf(match[2]);
    const year = Number(match[3]);
    if (!day || month < 0 || !year) return null;
    return new Date(year, month, day);
  }

  function hydrateDividers() {
    document.querySelectorAll(DAY_SELECTOR).forEach(divider => {
      const span = divider.querySelector('span');
      const date = parseDividerDate(span?.textContent || divider.textContent);
      if (!date) return;
      divider.dataset.dateKey = toKey(date);
      divider.dataset.dateLabel = span?.textContent?.trim() || divider.textContent.trim();
      divider.setAttribute('role', 'button');
      divider.setAttribute('tabindex', '0');
      divider.setAttribute('title', 'Відкрити календар листування');
    });
  }

  function getRenderedDividers() {
    hydrateDividers();
    const map = new Map();
    document.querySelectorAll(DAY_SELECTOR).forEach(divider => {
      if (divider.dataset.dateKey) map.set(divider.dataset.dateKey, divider);
    });
    return map;
  }

  function getAvailableDates() {
    const rendered = getRenderedDividers();
    const map = new Map(dateIndex);
    rendered.forEach((divider, key) => {
      const item = map.get(key) || { count: 0, divider: null };
      item.divider = divider;
      map.set(key, item);
    });
    return map;
  }

  async function refreshDateIndex(force = false) {
    const peerId = getSelectedPeerId();
    const client = supa();
    const me = await getCurrentUserId();
    if (!client || !me || !peerId) return dateIndex;
    if (!force && activePeerId === peerId && dateIndex.size) return dateIndex;
    if (indexLoadingFor === peerId) return dateIndex;

    activePeerId = peerId;
    indexLoadingFor = peerId;
    const next = new Map();
    const pairFilter = `and(user_id.eq.${me},recipient_id.eq.${peerId}),and(user_id.eq.${peerId},recipient_id.eq.${me})`;
    const pageSize = 1000;
    let from = 0;

    try {
      while (true) {
        const { data, error } = await client
          .from('messenger_messages')
          .select('created_at')
          .eq('channel', 'direct')
          .or(pairFilter)
          .order('created_at', { ascending: true })
          .range(from, from + pageSize - 1);

        if (error) throw error;
        (data || []).forEach(message => {
          const key = keyFromIso(message.created_at);
          if (!key) return;
          const item = next.get(key) || { count: 0, divider: null };
          item.count += 1;
          next.set(key, item);
        });
        if (!data || data.length < pageSize) break;
        from += pageSize;
      }
      dateIndex = next;
    } catch (error) {
      console.warn('[REBUS] Chat calendar full date index failed:', error?.message || error);
      const fallback = new Map();
      getRenderedDividers().forEach((divider, key) => fallback.set(key, { count: 1, divider }));
      dateIndex = fallback;
    } finally {
      indexLoadingFor = null;
    }

    return dateIndex;
  }

  function getRange(dateMap) {
    const today = startOfDay(new Date());
    const keys = [...dateMap.keys()].sort();
    const min = keys.length ? new Date(`${keys[0]}T00:00:00`) : today;
    const maxDate = keys.length ? new Date(`${keys[keys.length - 1]}T00:00:00`) : today;
    return { min, max: maxDate > today ? maxDate : today };
  }

  function ensurePopover() {
    let popover = document.getElementById(POPOVER_ID);
    if (popover) return popover;
    popover = document.createElement('div');
    popover.id = POPOVER_ID;
    popover.className = 'rebus-chat-calendar-popover';
    popover.hidden = true;
    document.body.appendChild(popover);
    return popover;
  }

  function closeCalendar() {
    const popover = document.getElementById(POPOVER_ID);
    if (popover) popover.hidden = true;
    document.querySelectorAll('.message-day-divider.is-calendar-open').forEach(node => node.classList.remove('is-calendar-open'));
  }

  function positionPopover(popover, anchor) {
    const rect = anchor.getBoundingClientRect();
    popover.hidden = false;
    popover.style.left = '0px';
    popover.style.top = '0px';
    const popRect = popover.getBoundingClientRect();
    const gap = 10;
    const left = Math.min(Math.max(gap, rect.left + rect.width / 2 - popRect.width / 2), window.innerWidth - popRect.width - gap);
    const below = rect.bottom + gap;
    const top = below + popRect.height < window.innerHeight - gap ? below : Math.max(gap, rect.top - popRect.height - gap);
    popover.style.left = `${left}px`;
    popover.style.top = `${top}px`;
  }

  function renderLoading(anchor) {
    const popover = ensurePopover();
    popover.innerHTML = '<div class="rebus-chat-calendar-loading">Завантаження дат листування…</div>';
    positionPopover(popover, anchor);
  }

  async function renderCalendar(anchor, forceRefresh = false) {
    activeAnchor = anchor;
    if (!dateIndex.size || forceRefresh || activePeerId !== getSelectedPeerId()) {
      renderLoading(anchor);
      await refreshDateIndex(forceRefresh);
    }

    const dateMap = getAvailableDates();
    const { min, max } = getRange(dateMap);
    if (!viewedMonth) viewedMonth = monthStart(selectedDateKey ? new Date(`${selectedDateKey}T00:00:00`) : max);

    const firstAvailableMonth = monthStart(min);
    const lastAvailableMonth = monthStart(max);
    if (viewedMonth < firstAvailableMonth) viewedMonth = firstAvailableMonth;
    if (viewedMonth > lastAvailableMonth) viewedMonth = lastAvailableMonth;

    const popover = ensurePopover();
    const year = viewedMonth.getFullYear();
    const month = viewedMonth.getMonth();
    const first = new Date(year, month, 1);
    const startOffset = (first.getDay() + 6) % 7;
    const gridStart = new Date(year, month, 1 - startOffset);
    const todayKey = toKey(startOfDay(new Date()));

    const days = Array.from({ length: 42 }, (_, index) => {
      const date = new Date(gridStart);
      date.setDate(gridStart.getDate() + index);
      const key = toKey(date);
      const info = dateMap.get(key);
      const hasMessages = Boolean(info?.count);
      const isVisibleMonth = date.getMonth() === month;
      const disabled = !hasMessages;
      return `
        <button type="button"
          class="rebus-chat-calendar-day${isVisibleMonth ? ' is-visible-month' : ''}${hasMessages ? ' has-messages' : ''}${key === selectedDateKey ? ' is-selected' : ''}${key === todayKey ? ' is-today' : ''}"
          data-date-key="${key}"
          ${disabled ? 'disabled' : ''}
          title="${hasMessages ? 'Перейти до листування за цю дату' : ''}">
          ${date.getDate()}
        </button>
      `;
    }).join('');

    popover.innerHTML = `
      <div class="rebus-chat-calendar-head">
        <button type="button" class="rebus-chat-calendar-nav" data-calendar-nav="prev" ${sameMonth(viewedMonth, firstAvailableMonth) ? 'disabled' : ''}>‹</button>
        <strong>${UK_MONTH_TITLES[month]} ${year}</strong>
        <button type="button" class="rebus-chat-calendar-nav" data-calendar-nav="next" ${sameMonth(viewedMonth, lastAvailableMonth) ? 'disabled' : ''}>›</button>
      </div>
      <div class="rebus-chat-calendar-week">${WEEK.map(day => `<span>${day}</span>`).join('')}</div>
      <div class="rebus-chat-calendar-grid">${days}</div>
      <div class="rebus-chat-calendar-foot">Підсвічені дні — дні, у які є листування. Натисни день, щоб перейти до нього в чаті.</div>
    `;

    popover.querySelectorAll('[data-calendar-nav]').forEach(button => {
      button.addEventListener('click', event => {
        event.stopPropagation();
        viewedMonth = addMonths(viewedMonth, button.dataset.calendarNav === 'prev' ? -1 : 1);
        renderCalendar(anchor, false);
      });
    });

    popover.querySelectorAll('.rebus-chat-calendar-day.has-messages').forEach(button => {
      button.addEventListener('click', async event => {
        event.stopPropagation();
        await scrollToDate(button.dataset.dateKey);
        closeCalendar();
      });
    });

    positionPopover(popover, anchor);
  }

  function openCalendar(anchor) {
    const key = anchor.dataset.dateKey;
    selectedDateKey = key || selectedDateKey || toKey(startOfDay(new Date()));
    viewedMonth = monthStart(new Date(`${selectedDateKey}T00:00:00`));
    document.querySelectorAll('.message-day-divider.is-calendar-open').forEach(node => node.classList.remove('is-calendar-open'));
    anchor.classList.add('is-calendar-open');
    renderCalendar(anchor, false);
  }

  function waitForRender() {
    return new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  }

  function findRenderedDateTarget(key) {
    const firstMessage = document.querySelector(`#messagesList .message[data-message-date="${CSS.escape(key)}"]`);
    if (firstMessage) return firstMessage;
    return getAvailableDates().get(key)?.divider || getRenderedDividers().get(key) || null;
  }

  async function scrollToDate(key) {
    selectedDateKey = key;

    let target = findRenderedDateTarget(key);

    if (!target && window.RebusDirectChatApi?.loadMessagesForDate) {
      const popover = ensurePopover();
      popover.innerHTML = '<div class="rebus-chat-calendar-loading">Підвантаження повідомлень за обрану дату…</div>';
      if (activeAnchor) positionPopover(popover, activeAnchor);

      const loaded = await window.RebusDirectChatApi.loadMessagesForDate(key);
      if (loaded) {
        await waitForRender();
        bindDividers(document);
        hydrateDividers();
        target = findRenderedDateTarget(key);
      }
    }

    if (!target) {
      const popover = ensurePopover();
      popover.innerHTML = '<div class="rebus-chat-calendar-loading">Не вдалося знайти повідомлення за цю дату в стрічці.</div>';
      if (activeAnchor) positionPopover(popover, activeAnchor);
      return false;
    }

    target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    const divider = getRenderedDividers().get(key) || target.closest?.('.message-day-divider');
    const pulse = divider || target;
    pulse.classList.remove('is-scroll-target');
    void pulse.offsetWidth;
    pulse.classList.add('is-scroll-target');
    window.setTimeout(() => pulse.classList.remove('is-scroll-target'), 1400);
    return true;
  }

  function bindDividers(scope = document) {
    hydrateDividers();
    scope.querySelectorAll?.(DAY_SELECTOR)?.forEach(divider => {
      if (divider.dataset.calendarBound === '1') return;
      divider.dataset.calendarBound = '1';
      divider.addEventListener('click', event => {
        event.preventDefault();
        event.stopPropagation();
        openCalendar(divider);
      });
      divider.addEventListener('keydown', event => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        openCalendar(divider);
      });
    });
  }

  function init() {
    bindDividers(document);
    const list = document.getElementById('messagesList');
    if (!list || list.dataset.calendarObserverReady === '1') return;
    list.dataset.calendarObserverReady = '1';
    new MutationObserver(mutations => {
      mutations.forEach(mutation => mutation.addedNodes.forEach(node => {
        if (node instanceof HTMLElement) bindDividers(node);
      }));
      bindDividers(document);
    }).observe(list, { childList: true, subtree: true });
  }

  document.addEventListener('click', event => {
    if (event.target.closest?.('.direct-user[data-user-id]')) {
      dateIndex = new Map();
      activePeerId = null;
      viewedMonth = null;
      setTimeout(() => refreshDateIndex(true), 500);
    }
    if (!event.target.closest?.(`#${POPOVER_ID}, .message-day-divider`)) closeCalendar();
  }, true);

  document.addEventListener('rebus:route-change', event => {
    if (!event.detail?.route || event.detail.route === 'chat') setTimeout(() => refreshDateIndex(false), 600);
  });

  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') closeCalendar();
  }, true);

  window.addEventListener('resize', closeCalendar);
  document.addEventListener('scroll', event => {
    if (event.target?.id === 'messagesList') return;
    closeCalendar();
  }, true);

  window.RebusChatCalendar = { refresh: () => refreshDateIndex(true), open: () => activeAnchor && renderCalendar(activeAnchor, true), index: () => dateIndex };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
  window.setTimeout(init, 300);
  window.setTimeout(init, 900);
})();
