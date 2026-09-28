const WATCHLIST_BTN_LABEL = 'Add to Watchlist';
const MARKAS_BTN_LABEL = 'Mark As';
const AUTH_PROMPT_MESSAGE = 'Sign in or Sign up to continue';

const MARKAS_OPTIONS = [
  { id: 'dnf', label: 'Did Not Finish' },
  { id: 'watched', label: 'Watched' },
];

const STAR_COUNT = 5;
const TOAST_VISIBLE_MS = 2200;

const WEEKDAY_LABELS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const MONTH_LABELS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTH_LABELS_LONG = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

document.addEventListener('DOMContentLoaded', () => {
  const actionsBox = document.querySelector('.show-actions');
  if (!actionsBox) return;

  const watchlistBtn      = document.getElementById('watchlist-btn');
  const markasBtnLabel    = document.getElementById('markas-btn-label');
  const markasToggle      = document.getElementById('markas-toggle');
  const markasOptionsWrap = document.getElementById('markas-options');
  const starsTrack        = document.getElementById('markas-stars-track');
  const starsFg           = document.getElementById('markas-stars-fg');

  if (watchlistBtn)   watchlistBtn.textContent  = WATCHLIST_BTN_LABEL;
  if (markasBtnLabel) markasBtnLabel.textContent = MARKAS_BTN_LABEL;

  if (markasOptionsWrap) {
    markasOptionsWrap.innerHTML = MARKAS_OPTIONS.map((opt) =>
      `<button type="button" class="markas-option" data-action="${opt.id}">${opt.label}</button>`
    ).join('');
  }

  const watchedMarkasBtn = markasOptionsWrap
    ? markasOptionsWrap.querySelector('[data-action="watched"]')
    : null;

  let toastEl    = null;
  let toastTimer = null;

  function showAuthPrompt() {
    if (!toastEl) {
      toastEl = document.createElement('div');
      toastEl.className = 'watchlist-toast';
      toastEl.textContent = AUTH_PROMPT_MESSAGE;
      document.body.appendChild(toastEl);
    }
    toastEl.classList.remove('-visible');
    void toastEl.offsetWidth;
    toastEl.classList.add('-visible');

    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      toastEl.classList.remove('-visible');
    }, TOAST_VISIBLE_MS);
  }

  function closeMarkAs() {
    if (markasToggle) markasToggle.checked = false;
  }

  if (markasToggle && starsFg) {
    markasToggle.addEventListener('change', () => {
      if (markasToggle.checked) {
        starsFg.style.width = '0%';
      }
    });
  }

  if (watchlistBtn) {
    watchlistBtn.addEventListener('click', () => {
      showAuthPrompt();
    });
  }

  if (markasOptionsWrap) {
    markasOptionsWrap.addEventListener('click', (e) => {
      const btn = e.target.closest('.markas-option');
      if (!btn) return;
      closeMarkAs();
      if (btn.dataset.action === 'watched') {
        openWatchedPopover();
      } else {
        showAuthPrompt();
      }
    });
  }

  if (starsTrack && starsFg) {
    let dragging = false;

    function percentFromEvent(e) {
      const rect = starsTrack.getBoundingClientRect();
      const x    = e.clientX - rect.left;
      const pct  = (x / rect.width) * 100;
      return Math.max(0, Math.min(100, pct));
    }

    function buildSnapPoints() {
      const rect         = starsTrack.getBoundingClientRect();
      const totalWidth   = rect.width;
      if (totalWidth === 0) return [];

      const computed      = window.getComputedStyle(starsTrack);
      const letterSpacing = parseFloat(computed.letterSpacing) || 0;
      const slotWidth     = totalWidth / STAR_COUNT;
      const glyphWidth    = slotWidth - letterSpacing;

      const pts = [];
      for (let i = 0; i < STAR_COUNT; i++) {
        const starStart = i * slotWidth;
        pts.push((starStart + glyphWidth * 0.5) / totalWidth * 100);
        pts.push((i + 1) * slotWidth / totalWidth * 100);
      }
      return pts;
    }

    function snapToHalfStar(pct) {
      const pts = buildSnapPoints();
      if (!pts.length) return Math.round(pct / 10) * 10;

      if (pct < pts[0] / 2) return 0;

      let nearest = pts[0];
      let minDist = Math.abs(pct - pts[0]);
      for (let i = 1; i < pts.length; i++) {
        const dist = Math.abs(pct - pts[i]);
        if (dist < minDist) { minDist = dist; nearest = pts[i]; }
      }
      return nearest;
    }

    function setFill(pct) {
      starsFg.style.width = snapToHalfStar(pct) + '%';
    }

    starsTrack.addEventListener('pointerdown', (e) => {
      dragging = true;
      starsTrack.setPointerCapture(e.pointerId);
      setFill(percentFromEvent(e));
    });

    starsTrack.addEventListener('pointermove', (e) => {
      if (!dragging) return;
      setFill(percentFromEvent(e));
    });

    function finishDrag(e) {
      if (!dragging) return;
      dragging = false;
      closeMarkAs();
      showAuthPrompt();
    }

    starsTrack.addEventListener('pointerup',     finishDrag);
    starsTrack.addEventListener('pointercancel', finishDrag);
  }

  const watchdateToggle = document.getElementById('watchdate-toggle');
  const wdPopover       = document.getElementById('watchdate-popover');
  const wdShowNameEl    = document.getElementById('wd-show-name');
  const wdCalendarEl    = document.getElementById('wd-calendar');
  const wdHintEl        = document.getElementById('wd-hint');
  const wdDurationEl    = document.getElementById('wd-duration');
  const wdFieldStart    = document.getElementById('wd-field-start');
  const wdFieldEnd      = document.getElementById('wd-field-end');
  const wdValues = {
    start: document.getElementById('wd-value-start'),
    end:   document.getElementById('wd-value-end'),
  };
  const wdQuickBtn  = document.getElementById('wd-quick-btn');
  const wdCancelBtn = document.getElementById('wd-cancel-btn');
  const wdSaveBtn   = document.getElementById('wd-save-btn');

  const wdJumpToggle   = document.getElementById('wd-jump-toggle');
  const wdJumpMonthsEl = document.getElementById('wd-jump-months');
  const wdJumpYearsEl  = document.getElementById('wd-jump-years');

  if (!watchdateToggle || !wdPopover || !wdCalendarEl) {
    return;
  }

  function todayMidnight() {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }

  const WD_TODAY = todayMidnight();

  let wdView        = new Date(WD_TODAY);
  let wdActiveField = 'start';
  let wdJumpYear    = WD_TODAY.getFullYear();
  const wdRange = { start: null, end: null };

  function wdFloorDate() {
    const meta = window.tvboxShowMeta;
    if (meta && meta.firstAirDate) {
      const parsed = new Date(meta.firstAirDate + 'T00:00:00');
      if (!isNaN(parsed.getTime())) return parsed;
    }
    return new Date(1900, 0, 1);
  }

  function wdMinDate() { return wdFloorDate(); }
  function wdMaxDate() { return WD_TODAY; }

  function sameDay(a, b) {
    return !!a && !!b &&
      a.getFullYear() === b.getFullYear() &&
      a.getMonth() === b.getMonth() &&
      a.getDate() === b.getDate();
  }

  function formatDate(d) {
    return MONTH_LABELS_SHORT[d.getMonth()] + ' ' + d.getDate() + ', ' + d.getFullYear();
  }

  function wdNavIcon(dir) {
    const path = dir === 'prev' ? 'M15 6l-6 6 6 6' : 'M9 6l6 6-6 6';
    return '<svg viewBox="0 0 24 24"><path d="' + path +
      '" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  }

  function wdNavBtn(dir, disabled) {
    return '<button type="button" class="wd-cal-nav" data-nav="' + dir + '"' +
      (disabled ? ' disabled' : '') + '>' + wdNavIcon(dir) + '</button>';
  }

  function renderWdCalendar() {
    const min = wdMinDate();
    const max = wdMaxDate();
    const viewYM = new Date(wdView.getFullYear(), wdView.getMonth(), 1);
    const prevMonthLastDay = new Date(viewYM.getFullYear(), viewYM.getMonth(), 0);
    const nextMonthFirstDay = new Date(viewYM.getFullYear(), viewYM.getMonth() + 1, 1);
    const prevDisabled = prevMonthLastDay < min;
    const nextDisabled = nextMonthFirstDay > max;

    let html = '<div class="wd-cal-head">';
    html += wdNavBtn('prev', prevDisabled);
    html += '<button type="button" class="wd-cal-label" data-jump>' +
      MONTH_LABELS_LONG[viewYM.getMonth()] + ' ' + viewYM.getFullYear() + '</button>';
    html += wdNavBtn('next', nextDisabled);
    html += '</div>';

    html += '<div class="wd-weekdays">' +
      WEEKDAY_LABELS.map((w) => '<span>' + w + '</span>').join('') + '</div>';

    html += '<div class="wd-days">';
    const firstWeekday = viewYM.getDay();
    for (let i = 0; i < firstWeekday; i++) {
      html += '<span class="wd-day -empty"></span>';
    }
    const daysInMonth = new Date(viewYM.getFullYear(), viewYM.getMonth() + 1, 0).getDate();
    for (let day = 1; day <= daysInMonth; day++) {
      const d = new Date(viewYM.getFullYear(), viewYM.getMonth(), day);
      const disabled = d < min || d > max;
      const isToday = sameDay(d, WD_TODAY);
      const isStart = sameDay(d, wdRange.start);
      const isEnd   = sameDay(d, wdRange.end);
      const sameStartEnd = wdRange.start && wdRange.end && sameDay(wdRange.start, wdRange.end);
      let inRange = false;
      if (wdRange.start && wdRange.end) {
        inRange = d > wdRange.start && d < wdRange.end;
      }
      const cls = ['wd-day'];
      if (disabled) cls.push('-disabled');
      if (isToday) cls.push('-today');
      if (isStart || isEnd) cls.push('-selected');
      if (isStart && wdRange.end && !sameStartEnd) cls.push('-range-start');
      if (isEnd && wdRange.start && !sameStartEnd) cls.push('-range-end');
      if (inRange) cls.push('-inrange');
      html += '<button type="button" class="' + cls.join(' ') + '"' +
        (disabled ? ' disabled' : '') + ' data-day="' + d.getTime() + '">' + day + '</button>';
    }
    html += '</div>';

    wdCalendarEl.innerHTML = html;
  }

  function wdNavigate(dir) {
    wdView = new Date(wdView.getFullYear(), wdView.getMonth() + dir, 1);
    renderWdCalendar();
  }

  function updateWdStubs() {
    wdValues.start.textContent = wdRange.start ? formatDate(wdRange.start) : '—';
    wdValues.end.textContent   = wdRange.end   ? formatDate(wdRange.end)   : '—';

    if (wdFieldStart) wdFieldStart.classList.toggle('-active', wdActiveField === 'start');
    if (wdFieldEnd)   wdFieldEnd.classList.toggle('-active', wdActiveField === 'end');

    if (wdRange.start && wdRange.end) {
      const days = Math.round((wdRange.end - wdRange.start) / 86400000) + 1;
      wdDurationEl.textContent = days === 1 ? '1 day' : days + ' days';
      wdDurationEl.hidden = false;
    } else {
      wdDurationEl.hidden = true;
    }

    if (wdActiveField === 'start') {
      wdHintEl.textContent = wdRange.start ? 'Tap a day to change when you started' : 'Tap the day you started watching';
    } else {
      wdHintEl.textContent = wdRange.end ? 'Tap a day to change when you finished' : 'Now tap the day you finished';
    }
  }

  function wdSelectDate(date) {
    if (wdActiveField === 'start') {
      wdRange.start = date;
      if (wdRange.end && date > wdRange.end) wdRange.end = null;
      if (!wdRange.end) wdActiveField = 'end';
    } else {
      if (wdRange.start && date < wdRange.start) {
        wdRange.start = date;
        wdRange.end = null;
      } else {
        wdRange.end = date;
      }
    }
    wdView = new Date(date.getFullYear(), date.getMonth(), 1);
    updateWdStubs();
    renderWdCalendar();
  }

  wdCalendarEl.addEventListener('click', (e) => {
    const dayBtn  = e.target.closest('[data-day]');
    const navBtn  = e.target.closest('[data-nav]');
    const jumpBtn = e.target.closest('[data-jump]');

    if (dayBtn) {
      wdSelectDate(new Date(parseInt(dayBtn.getAttribute('data-day'), 10)));
    } else if (navBtn && !navBtn.disabled) {
      wdNavigate(navBtn.getAttribute('data-nav') === 'next' ? 1 : -1);
    } else if (jumpBtn) {
      openWdJump();
    }
  });

  if (wdFieldStart) {
    wdFieldStart.addEventListener('click', () => {
      wdRange.start = null;
      wdActiveField = 'start';
      updateWdStubs();
      renderWdCalendar();
    });
  }

  if (wdFieldEnd) {
    wdFieldEnd.addEventListener('click', () => {
      wdRange.end = null;
      wdActiveField = 'end';
      updateWdStubs();
      renderWdCalendar();
    });
  }

  function renderWdJumpMonths() {
    const min = wdMinDate();
    const max = wdMaxDate();
    let html = '';
    for (let m = 0; m < 12; m++) {
      const monthStart = new Date(wdJumpYear, m, 1);
      const monthEnd   = new Date(wdJumpYear, m + 1, 0);
      const disabled   = monthEnd < min || monthStart > max;
      const active     = wdJumpYear === wdView.getFullYear() && m === wdView.getMonth();
      html += '<button type="button" class="wd-jump-row' +
        (disabled ? ' -disabled' : '') + (active ? ' -active' : '') + '"' +
        (disabled ? ' disabled' : '') + ' data-month="' + m + '">' + MONTH_LABELS_LONG[m] + '</button>';
    }
    wdJumpMonthsEl.innerHTML = html;
  }

  function renderWdJumpYears() {
    const min = wdMinDate().getFullYear();
    const max = wdMaxDate().getFullYear();
    let html = '';
    for (let y = max; y >= min; y--) {
      html += '<button type="button" class="wd-jump-row' +
        (y === wdJumpYear ? ' -active' : '') + '" data-year="' + y + '">' + y + '</button>';
    }
    wdJumpYearsEl.innerHTML = html;
  }

  function openWdJump() {
    wdJumpYear = wdView.getFullYear();
    renderWdJumpMonths();
    renderWdJumpYears();
    wdJumpToggle.checked = true;
    const activeMonthBtn = wdJumpMonthsEl.querySelector('.-active');
    if (activeMonthBtn) activeMonthBtn.scrollIntoView({ block: 'center' });
    const activeYearBtn = wdJumpYearsEl.querySelector('.-active');
    if (activeYearBtn) activeYearBtn.scrollIntoView({ block: 'center' });
  }

  function closeWdJump() {
    wdJumpToggle.checked = false;
  }

  if (wdJumpYearsEl) {
    wdJumpYearsEl.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-year]');
      if (!btn) return;
      wdJumpYear = parseInt(btn.getAttribute('data-year'), 10);
      renderWdJumpMonths();
      renderWdJumpYears();
    });
  }

  if (wdJumpMonthsEl) {
    wdJumpMonthsEl.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-month]');
      if (!btn || btn.disabled) return;
      const m = parseInt(btn.getAttribute('data-month'), 10);
      wdView = new Date(wdJumpYear, m, 1);
      closeWdJump();
      renderWdCalendar();
    });
  }

  function openWatchedPopover() {
    const titleEl = document.getElementById('show-title');
    if (wdShowNameEl) {
      wdShowNameEl.textContent =
        (titleEl && titleEl.textContent) ||
        (window.tvboxShowMeta && window.tvboxShowMeta.name) ||
        'this show';
    }
    wdView = wdRange.start
      ? new Date(wdRange.start.getFullYear(), wdRange.start.getMonth(), 1)
      : new Date(WD_TODAY);
    updateWdStubs();
    renderWdCalendar();
    watchdateToggle.checked = true;
  }

  function closeWatchedPopover() {
    watchdateToggle.checked = false;
  }

  if (wdCancelBtn) {
    wdCancelBtn.addEventListener('click', () => {
      closeWatchedPopover();
    });
  }

  if (wdQuickBtn) {
    wdQuickBtn.addEventListener('click', () => {
      wdRange.start = null;
      wdRange.end = null;
      updateWdStubs();
      closeWatchedPopover();
      showAuthPrompt();
    });
  }

  if (wdSaveBtn) {
    wdSaveBtn.addEventListener('click', () => {
      closeWatchedPopover();
      showAuthPrompt();
    });
  }

  renderWdCalendar();

  window.addEventListener('scroll', () => {
    if (markasToggle && markasToggle.checked) markasToggle.checked = false;
    if (watchdateToggle && watchdateToggle.checked) watchdateToggle.checked = false;
    if (wdJumpToggle && wdJumpToggle.checked) wdJumpToggle.checked = false;
  }, { passive: true });
});
