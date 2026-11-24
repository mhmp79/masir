'use strict';

/* ============================================================
   PLAN v9.5.1 — Swipe preview + correct direction + ghost-free
   ============================================================ */

const PHASE_SIZE = 120;
const PHASE_COUNT = 12;
function phaseStartMin(n) { return (n - 1) * PHASE_SIZE; }

/* A block's real, half-open time range. Phase cells and pills share this helper
   so a block ending exactly at a boundary never spills into the next phase. */
function itemTimeRange(item) {
  if (!item || item.startMin == null) return null;
  const start = +item.startMin;
  const end = item.endMin != null ? +item.endMin : start + (+item.minutes || +item.durMin || 0);
  if (!Number.isFinite(start) || !Number.isFinite(end)) return null;
  return { start, end: Math.max(start, end) };
}

/* Persian calendar helpers for the month timeline. j2d returns an absolute day
   number, so subtracting two month starts gives the real month length. */
function shiftPersianMonth(jy, jm, delta) {
  const total = (+jy) * 12 + (+jm) - 1 + (+delta);
  return { jy: Math.floor(total / 12), jm: ((total % 12) + 12) % 12 + 1 };
}

function monthKeysOf(jy, jm) {
  const start = j2d(+jy, +jm, 1);
  const next = shiftPersianMonth(jy, jm, 1);
  const count = Math.max(1, j2d(next.jy, next.jm, 1) - start);
  return Array.from({ length: count }, (_, i) => jKey(d2j(start + i)));
}

function timelineStepDays() {
  return tlMode === 'day' ? 1 : tlMode === '3day' ? 3 : 7;
}

/* Month navigation changes the calendar month instead of jumping a fixed number
   of days, so the 29/30/31-day months always advance by exactly one screen. */
function shiftTimelineAnchor(dir) {
  tlSelectedKey = null;
  if (tlMode === 'month') {
    const m = shiftPersianMonth(calYear, calMonth, dir);
    calYear = m.jy;
    calMonth = m.jm;
    calSelected = jKey(d2j(j2d(m.jy, m.jm, 1)));
    return calSelected;
  }
  calSelected = jKey(d2j(jdnFromKey(calSelected) + dir * timelineStepDays()));
  const j = parseKey(calSelected);
  calYear = j.jy;
  calMonth = j.jm;
  return calSelected;
}

let planView = 'timeline';
let tlMode = 'day';
let calYear = TODAY_J.jy;
let calMonth = TODAY_J.jm;
let calSelected = TODAY_KEY;
/* The timeline anchor (calSelected) moves a whole day/week/3-day block at a time.
   Keep the highlighted day separate so navigation never paints a false selection. */
let tlSelectedKey = TODAY_KEY;
let examSelectedId = null;
let examTopicSetup = {};
let dragState = null;
let createDragState = null;
let resizeState = null;
let dropTargetEl = null;
let moveDragPreviewEl = null;
let tlSwipe = null;
const openPoolSubjects = new Set();

var planViewMode = 'timeline';

function syncCompat() {
  planViewMode = planView === 'timeline' ? 'timeline' : 'volume';
}

function timelineContainsToday() {
  if (tlMode === 'month') return calYear === TODAY_J.jy && calMonth === TODAY_J.jm;
  const jdn = jdnFromKey(calSelected);
  if (tlMode === 'day') return jdn === TODAY_JDN;
  if (tlMode === '3day') return jdn <= TODAY_JDN && TODAY_JDN <= jdn + 2;
  return weekStartJdn(jdn) === weekStartJdn(TODAY_JDN);
}
function subjectsContainsThisWeek() {
  return activeWeekStart() === weekStartJdn(TODAY_JDN);
}

function sessionById(id) { return state.sessions.find(s => s.id === id); }
function poolSessions() { return state.sessions.filter(s => !s.date).sort((a, b) => (a.ts || 0) - (b.ts || 0)); }
function sessionsOfDay(dayKey) { return state.sessions.filter(s => s.date === dayKey); }
function timedOfDay(dayKey) { return sessionsOfDay(dayKey).filter(s => s.startMin != null); }
function reservedOfDay(dayKey) { return sessionsOfDay(dayKey).filter(s => s.startMin == null); }
function upcomingExams() {
  return state.exams.filter(e => jdnFromKey(e.date) >= TODAY_JDN).sort((a, b) => jdnFromKey(a.date) - jdnFromKey(b.date));
}
function examProgress(examId) {
  const all = state.sessions.filter(s => s.examId === examId);
  return { total: all.length, done: all.filter(s => s.done).length };
}
function sessionsForTopic(examId, subject, topic) {
  return state.sessions.filter(s => s.examId === examId && s.subject === subject && s.topic === topic);
}
function activeWeekStart() { return weekStartJdn(jdnFromKey(calSelected)); }

function addSession(data) {
  const s = normalizeSession(data);
  if (!s) return null;
  state.sessions.push(s);
  save();
  return s;
}
function updateSession(id, updates) {
  const s = sessionById(id);
  if (!s) return null;
  Object.assign(s, updates);
  save();
  return s;
}
function deleteSession(id) {
  state.sessions = state.sessions.filter(s => s.id !== id);
  save();
}

function toggleDone(id) {
  const s = sessionById(id);
  if (!s) return;
  if (!s.done) {
    if (s.date && s.startMin != null) {
      const act = {
        id: uid(), date: s.date, subject: s.subject, topic: s.topic,
        startMin: s.startMin, endMin: Math.min(1440, s.startMin + s.durMin),
        minutes: s.durMin, tests: null, ts: Date.now()
      };
      state.activities.push(act);
      s.done = true;
      s.doneAt = Date.now();
      s.activityId = act.id;
      save();
      toast('به فعالیت تبدیل شد ✓');
    } else {
      registerAsActivity(s);
    }
  } else {
    if (s.activityId) state.activities = state.activities.filter(a => a.id !== s.activityId);
    s.done = false;
    s.doneAt = null;
    s.activityId = null;
    save();
  }
}

function registerAsActivity(s) {
  const dateKey = s.date || TODAY_KEY;
  const startMin = 16 * 60;
  const act = {
    id: uid(), date: dateKey, subject: s.subject, topic: s.topic,
    startMin, endMin: Math.min(1440, startMin + s.durMin),
    minutes: s.durMin, tests: null, ts: Date.now()
  };
  state.activities.push(act);
  s.done = true;
  s.doneAt = Date.now();
  s.activityId = act.id;
  if (!s.date) s.date = dateKey;
  if (s.startMin == null) s.startMin = startMin;
  save();
  if (typeof openEditActivityModal === 'function') {
    openEditActivityModal(act, () => {
      const still = state.activities.find(a => a.id === act.id);
      if (!still) { s.done = false; s.doneAt = null; s.activityId = null; }
      else { s.date = act.date; s.startMin = act.startMin; s.durMin = act.minutes; }
      save();
      renderPlan();
      renderDashboard();
    });
  } else {
    renderPlan();
    renderDashboard();
    toast('در فعالیت‌ها ثبت شد');
  }
}

function convertSessionToActivity(sid) {
  const s = sessionById(sid);
  if (!s) return null;
  const dateKey = s.date || TODAY_KEY;
  const startMin = s.startMin != null ? s.startMin : 16 * 60;
  const endMin = Math.min(1440, startMin + s.durMin);
  const act = {
    id: uid(), date: dateKey, subject: s.subject, topic: s.topic,
    startMin, endMin, minutes: s.durMin, tests: null, ts: Date.now()
  };
  state.activities.push(act);
  state.sessions = state.sessions.filter(x => x.id !== sid);
  save();
  return act;
}

function convertActivityToSession(aid) {
  const a = state.activities.find(x => x.id === aid);
  if (!a) return null;
  const durMin = a.minutes || (a.endMin - a.startMin) || 60;
  const s = normalizeSession({
    id: uid(), subject: a.subject, topic: a.topic || '', durMin,
    date: a.date || null, startMin: a.startMin != null ? a.startMin : null,
    done: false, examId: null, ts: Date.now()
  });
  if (!s) return null;
  state.sessions.push(s);
  state.activities = state.activities.filter(x => x.id !== aid);
  save();
  return s;
}

function renderPlan() {
  syncCompat();
  renderPool();
  renderExamPicker();
  renderTopicSetup();
  renderCalendar();
  renderViewContent();
}

/* ============ POOL ============ */
function renderPool() {
  const box = document.getElementById('planPool');
  if (!box) return;
  const pool = poolSessions();
  const count = document.getElementById('planPoolCount');
  if (count) count.textContent = pool.length ? `(${fa(pool.length)})` : '';

  if (!pool.length) {
    box.innerHTML = `<div class="pool-empty" data-drop-pool>استخر خالی — از «+ بازه» یا موضوعات آزمون بساز</div>`;
    bindCardsInContainer(box);
    return;
  }

  const grouped = {};
  pool.forEach(s => {
    const key = s.subject || '—';
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(s);
  });

  const subjectKeys = Object.keys(grouped).sort((a, b) => grouped[b].length - grouped[a].length);

  let chipsHtml = '<div class="pool-chip-bar">';
  subjectKeys.forEach(subject => {
    const color = subjColor(subject);
    const isOpen = openPoolSubjects.has(subject);
    chipsHtml += `<button type="button" class="pool-chip${isOpen ? ' active' : ''}" data-pool-chip="${esc(subject)}" style="--pcc:${color}">
      <span class="pc-dot" style="background:${color}"></span>
      <span class="pc-name">${esc(subject)}</span>
      <span class="pc-count">${fa(grouped[subject].length)}</span>
    </button>`;
  });
  chipsHtml += '</div>';

  let panelsHtml = '';
  subjectKeys.forEach(subject => {
    if (!openPoolSubjects.has(subject)) return;
    const color = subjColor(subject);
    panelsHtml += `<div class="pool-panel" data-pool-panel="${esc(subject)}" style="--ppc:${color}">
      <div class="pool-panel-head">
        <span class="pph-name" style="color:${color}">${esc(subject)}</span>
        <span class="pph-count">${fa(grouped[subject].length)} بازه</span>
      </div>
      <div class="pool-panel-grid">${grouped[subject].map(s => renderSessionCard(s, 'pool')).join('')}</div>
    </div>`;
  });

  box.innerHTML = `<div class="pool-drop-wrap" data-drop-pool>
    ${chipsHtml}
    ${panelsHtml ? `<div class="pool-sessions-area">${panelsHtml}</div>` : ''}
  </div>`;

  box.querySelectorAll('[data-pool-chip]').forEach(chip => {
    chip.onclick = () => {
      const subj = chip.dataset.poolChip;
      if (openPoolSubjects.has(subj)) {
        openPoolSubjects.clear();
      } else {
        openPoolSubjects.clear();
        openPoolSubjects.add(subj);
      }
      renderPool();
    };
  });
  bindCardsInContainer(box);
}

/* ============ EXAM PICKER ============ */
function renderExamPicker() {
  const box = document.getElementById('planExamPicker');
  if (!box) return;
  const exams = upcomingExams();
  if (!exams.length) {
    box.innerHTML = `<div class="plan-hint">آزمونی در پیش نیست.<br><button class="mini-btn" id="goExamBtn">تب آزمون →</button></div>`;
    const btn = document.getElementById('goExamBtn');
    if (btn) btn.onclick = () => switchView('exam');
    return;
  }
  if (examSelectedId && !exams.some(e => e.id === examSelectedId)) examSelectedId = null;
  box.innerHTML = exams.map(e => {
    const prog = examProgress(e.id);
    const days = Math.max(0, jdnFromKey(e.date) - TODAY_JDN);
    const active = examSelectedId === e.id;
    return `<div class="exam-item${active ? ' active' : ''}" data-exam-id="${e.id}">
      <div class="ei-head"><b>${esc(e.name)}</b><span>${fa(days)} روز</span></div>
      <div class="ei-meta">${prog.total > 0 ? `${fa(prog.done)}/${fa(prog.total)} بازه` : 'بدون بازه'}</div>
    </div>`;
  }).join('');
  box.querySelectorAll('.exam-item').forEach(el => {
    el.onclick = () => {
      examSelectedId = examSelectedId === el.dataset.examId ? null : el.dataset.examId;
      if (examSelectedId) {
        loadExamTopics();
        const card = document.getElementById('planTopicSetupCard');
        if (card) card.classList.add('open');
      } else { examTopicSetup = {}; }
      renderPlan();
    };
  });
}

/* ============ TOPIC SETUP ============ */
function loadExamTopics() {
  examTopicSetup = {};
  if (!examSelectedId) return;
  const exam = state.exams.find(e => e.id === examSelectedId);
  if (!exam || !exam.topics) return;
  Object.entries(exam.topics).forEach(([subject, val]) => {
    let arr = [];
    if (Array.isArray(val)) arr = val;
    else if (val && typeof val === 'object') {
      Object.values(val).forEach(v => { if (Array.isArray(v)) arr.push(...v); });
    }
    if (!arr.length) return;
    examTopicSetup[subject] = {};
    arr.forEach(topic => {
      const existing = sessionsForTopic(examSelectedId, subject, topic);
      examTopicSetup[subject][topic] = { count: existing.length, durMin: existing[0]?.durMin || 120 };
    });
  });
}

/* When exam topics are edited, exam-linked sessions keep their old topic label.
   Relabel only sessions whose topic is no longer valid, never removing or
   rescheduling them, so no study time or history is lost. */
function syncExamSessionsTopics(examId) {
  const exam = state.exams.find(e => e.id === examId);
  if (!exam || !exam.topics) return 0;
  let changed = 0;
  state.sessions.forEach(s => {
    if (s.examId !== examId) return;
    const val = exam.topics[s.subject];
    let topics = [];
    if (Array.isArray(val)) topics = val;
    else if (val && typeof val === 'object') Object.values(val).forEach(v => { if (Array.isArray(v)) topics.push(...v); });
    if (topics.includes(s.topic)) return;
    const next = topics.length === 1 ? topics[0] : '';
    if (s.topic !== next) { s.topic = next; changed++; }
  });
  if (examSelectedId === examId) loadExamTopics();
  return changed;
}

function renderTopicSetup() {
  const card = document.getElementById('planTopicSetupCard');
  const box = document.getElementById('planTopicSetup');
  const hint = document.getElementById('planTopicHint');
  if (!card || !box) return;

  if (!examSelectedId) {
    if (hint) hint.textContent = 'آزمون انتخاب کن';
    box.innerHTML = `<div class="plan-hint compact">از سایدبار یک آزمون انتخاب کن</div>`;
    return;
  }

  const subjects = Object.keys(examTopicSetup);
  const totalTopics = subjects.reduce((sum, s) => sum + Object.keys(examTopicSetup[s]).length, 0);
  if (hint) hint.textContent = `${fa(subjects.length)} درس • ${fa(totalTopics)} مبحث`;

  if (!subjects.length) {
    box.innerHTML = `<div class="plan-hint compact">این آزمون موضوعی ندارد.<br><button class="mini-btn mt-6" id="goExamSettingsBtn">تنظیمات →</button></div>`;
    const btn = document.getElementById('goExamSettingsBtn');
    if (btn) btn.onclick = () => switchView('exam');
    return;
  }
  let html = '';
  subjects.forEach(subject => {
    const color = subjColor(subject);
    html += `<div class="tsg-group"><div class="tsg-head" style="color:${color};border-color:${color}44">${esc(subject)}</div>`;
    Object.keys(examTopicSetup[subject]).forEach(topic => {
      const cfg = examTopicSetup[subject][topic];
      html += `<div class="tsg-row" data-subject="${esc(subject)}" data-topic="${esc(topic)}">
        <div class="tsg-topic" title="${esc(topic)}">${esc(topic)}</div>
        <div class="tsg-counter">
          <button type="button" class="tsg-btn" data-delta="-1">−</button>
          <span class="tsg-count">${fa(cfg.count)}</span>
          <button type="button" class="tsg-btn" data-delta="1">+</button>
          <span class="tsg-dur">${fa(cfg.durMin)}د</span>
        </div>
      </div>`;
    });
    html += '</div>';
  });
  box.innerHTML = html;
  box.querySelectorAll('.tsg-btn').forEach(btn => {
    btn.onclick = (e) => {
      e.stopPropagation();
      const row = btn.closest('.tsg-row');
      adjustTopicCount(row.dataset.subject, row.dataset.topic, +btn.dataset.delta);
    };
  });
}

function adjustTopicCount(subject, topic, delta) {
  const cfg = examTopicSetup[subject]?.[topic];
  if (!cfg) return;
  const existing = sessionsForTopic(examSelectedId, subject, topic);
  const unassigned = existing.filter(s => !s.date && !s.done);
  if (delta > 0) {
    cfg.count += delta;
    for (let i = 0; i < delta; i++) {
      addSession({ subject, topic, durMin: cfg.durMin, examId: examSelectedId, date: null, startMin: null, done: false });
    }
  } else if (delta < 0) {
    const toRemove = Math.min(unassigned.length, -delta);
    if (toRemove === 0) { toast('بازه‌های تخصیص‌یافته قابل حذف نیستند'); return; }
    cfg.count -= toRemove;
    for (let i = 0; i < toRemove; i++) deleteSession(unassigned[i].id);
    if (toRemove < -delta) toast(`${fa(-delta - toRemove)} بازه تخصیص‌یافته قابل حذف نبود`);
  }
  const row = document.querySelector(`.tsg-row[data-subject="${CSS.escape(subject)}"][data-topic="${CSS.escape(topic)}"]`);
  if (row) row.querySelector('.tsg-count').textContent = fa(cfg.count);
  renderPool();
  renderViewContent();
}

/* ============ CALENDAR ============ */
function renderCalendar() {
  const card = document.getElementById('planCalendarCard');
  if (!card) return;
  const title = document.getElementById('planCalTitle');
  if (title) title.textContent = `${MONTHS[calMonth - 1]} ${fa(calYear)}`;
  const grid = document.getElementById('planCalGrid');
  if (!grid) return;

  const firstJdn = j2d(calYear, calMonth, 1);
  const startCol = dowIndex(firstJdn);
  const len = jMonthLength(calYear, calMonth);
  let html = '';
  const cell = (k, d, adj) => {
    const hasData = sessionsOfDay(k).length > 0 || state.activities.some(a => a.date === k) || sleepForDay(k).length > 0;
    const hasExam = state.settings.examsEnabled && examForDay(k).length > 0;
    const cls = ['cal-cell'];
    if (adj) cls.push('adjacent');
    if (k === TODAY_KEY) cls.push('today');
    if (k === tlSelectedKey) cls.push('sel');
    if (hasExam) cls.push('exam-day');
    return `<div class="${cls.join(' ')}" data-key="${k}">${fa(d)}${hasData ? '<i class="dot"></i>' : ''}${hasExam ? '<i class="exam-dot"></i>' : ''}</div>`;
  };
  for (let i = 0; i < startCol; i++) {
    const jdn = firstJdn - startCol + i;
    const j = d2j(jdn);
    html += cell(jKey(j), j.jd, true);
  }
  for (let d = 1; d <= len; d++) html += cell(keyOf(calYear, calMonth, d), d, false);
  const trailing = (7 - ((startCol + len) % 7)) % 7;
  for (let i = 1; i <= trailing; i++) {
    const jdn = firstJdn + len - 1 + i;
    const j = d2j(jdn);
    html += cell(jKey(j), j.jd, true);
  }
  grid.innerHTML = html;
  grid.querySelectorAll('.cal-cell[data-key]').forEach(el => {
    el.onclick = () => {
      calSelected = el.dataset.key;
      tlSelectedKey = calSelected;
      const j = parseKey(calSelected);
      calYear = j.jy; calMonth = j.jm;
      syncCompat();
      renderCalendar();
      renderViewContent();
    };
  });
}

/* ============ NAV ============ */
(function wirePlanNav() {
  const seg = document.getElementById('planViewSeg');
  if (seg) {
    seg.addEventListener('click', (e) => {
      const b = e.target.closest('[data-view]');
      if (!b) return;
      document.querySelectorAll('#planViewSeg button').forEach(x =>
        x.classList.toggle('active', x.dataset.view === b.dataset.view));
      planView = b.dataset.view;
      syncCompat();
      renderViewContent();
    });
  }

  const topicToggle = document.getElementById('planTopicToggle');
  if (topicToggle) {
    topicToggle.onclick = () => {
      document.getElementById('planTopicSetupCard').classList.toggle('open');
    };
  }

  const addBtn = document.getElementById('planAddBtn');
  if (addBtn) addBtn.onclick = () => openSessionEditor(null, { examId: examSelectedId });

  const prevBtn = document.getElementById('planCalPrev');
  const nextBtn = document.getElementById('planCalNext');
  const todayBtn = document.getElementById('planCalToday');
  if (prevBtn) prevBtn.onclick = () => { calMonth--; if (calMonth < 1) { calMonth = 12; calYear--; } renderCalendar(); };
  if (nextBtn) nextBtn.onclick = () => { calMonth++; if (calMonth > 12) { calMonth = 1; calYear++; } renderCalendar(); };
  if (todayBtn) todayBtn.onclick = () => gotoToday();
})();

document.addEventListener('touchmove', (e) => {
  if (createDragState || (dragState && dragState.moved) || (tlSwipe && tlSwipe.active)) {
    e.preventDefault();
  }
}, { passive: false });

/* ============ VIEW ROUTER ============ */
function renderViewContent() {
  const box = document.getElementById('planMain');
  if (!box) return;
  try {
    if (planView === 'timeline') renderTimeline(box);
    else if (planView === 'subjects') renderSubjects(box);
    else if (planView === 'phases') renderPhases(box);
  } catch (e) {
    console.error('[plan] renderViewContent failed:', e);
    box.innerHTML = `<div class="plan-hint">خطا در نمایش. صفحه را رفرش کن.</div>`;
  }
}

/* ============ SESSION CARD ============ */
function renderSessionCard(s, context) {
  const color = subjColor(s.subject);
  const exam = s.examId ? state.exams.find(e => e.id === s.examId) : null;
  const time = s.startMin != null ? minToStr(s.startMin) : '';
  return `<div class="sess-card ${context}${s.done ? ' done' : ''}" data-sid="${s.id}" style="--sc:${color}">
    <div class="sc-head">
      <span class="sc-subject" style="color:${color}">${esc(s.subject || '—')}</span>
      ${exam ? '<span class="sc-exam" title="از آزمون">🎯</span>' : ''}
    </div>
    ${s.topic ? `<div class="sc-topic" title="${esc(s.topic)}">${esc(s.topic)}</div>` : ''}
    <div class="sc-meta">
      <span>⏱ ${fa(s.durMin)}د</span>
      ${time ? `<span>${time}</span>` : ''}
      ${s.done ? '<span class="sc-done">✓</span>' : ''}
    </div>
    <div class="sc-actions">
      <label class="sc-check"><input type="checkbox" data-done="${s.id}" ${s.done ? 'checked' : ''}></label>
      <button class="sc-more" data-edit="${s.id}">⋯</button>
    </div>
  </div>`;
}

function bindCardsInContainer(container) {
  container.querySelectorAll('[data-done]').forEach(cb => {
    cb.onchange = (e) => {
      e.stopPropagation();
      toggleDone(cb.dataset.done);
      renderPlan();
      renderDashboard();
    };
  });
  container.querySelectorAll('[data-edit]').forEach(btn => {
    btn.onclick = (e) => {
      e.stopPropagation();
      openSessionEditor(btn.dataset.edit);
    };
  });
  const selector = '.sess-card[data-sid], .sess-pill[data-sid], .tl-block[data-sid], .wv-block[data-sid], .wv-res-chip[data-sid]';
  container.querySelectorAll(selector).forEach(el => {
    el.addEventListener('pointerdown', onSessionPointerDown);
  });
  container.querySelectorAll('.tl-activity[data-act-id], .wv-act[data-act-id]').forEach(el => {
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      if (typeof window.openActivityInfo === 'function') {
        try { window.openActivityInfo(el.dataset.actId); return; } catch (err) {}
      }
      if (typeof openPlanActivityInfo === 'function') openPlanActivityInfo(el.dataset.actId);
    });
  });
  container.querySelectorAll('.tl-exam[data-exam-id], .wv-exam[data-exam-id]').forEach(el => {
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      if (typeof openExamDetail === 'function') openExamDetail(el.dataset.examId);
    });
  });
  container.querySelectorAll('.tl-sleep[data-sleep-id], .wv-sleep[data-sleep-id]').forEach(el => {
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      if (typeof openSleepInfo === 'function') openSleepInfo(el.dataset.sleepId);
    });
  });
}

/* ============ SESSION POINTER ============ */
function onSessionPointerDown(e) {
  if (e.button !== undefined && e.button !== 0) return;
  if (e.target.closest('input, button, label.sc-check, .sc-more, .resize-handle')) return;

  const el = e.currentTarget;
  const sid = el.dataset.sid;
  const s = sessionById(sid);
  if (!s) return;

  const sids = el.dataset.sids ? el.dataset.sids.split(',') : [sid];
  const sessions = sids.map(id => sessionById(id)).filter(Boolean);
  if (!sessions.length) return;

  const firstStart = Math.min(...sessions.map(x => x.startMin ?? 99999));
  const color = subjColor(s.subject);
  const isTouch = e.pointerType === 'touch';
  const startX = e.clientX, startY = e.clientY;
  const pointerId = e.pointerId;
  let dragActive = false;
  let timer = null;

  const enterDragMode = (cx, cy) => {
    if (dragActive) return;
    dragActive = true;
    if (timer) { clearTimeout(timer); timer = null; }
    try { el.setPointerCapture(pointerId); } catch (err) {}
    const ghost = document.createElement('div');
    ghost.className = 'drag-ghost';
    ghost.textContent = sessions.length > 1 ? `${s.subject} (${fa(sessions.length)})` : s.subject;
    ghost.style.background = `linear-gradient(135deg,${color},${color}bb)`;
    ghost.style.left = cx + 'px';
    ghost.style.top = cy + 'px';
    document.body.appendChild(ghost);
    dragState = { kind: 'move', sids, sessions, firstStart, ghost, color, startX: cx, startY: cy, moved: false, pointerId, sourceEl: el };
    document.body.classList.add('creating-block');
  };
  const cleanup = () => {
    document.removeEventListener('pointermove', onMove);
    document.removeEventListener('pointerup', onUp);
    document.removeEventListener('pointercancel', onCancel);
    if (timer) { clearTimeout(timer); timer = null; }
  };
  const onMove = (me) => {
    const dist = Math.hypot(me.clientX - startX, me.clientY - startY);
    if (!dragActive) {
      if (isTouch) { if (dist > 8) { cleanup(); return; } }
      else { if (dist > 6) enterDragMode(me.clientX, me.clientY); }
    }
    if (dragActive && dragState) {
      me.preventDefault();
      dragState.ghost.style.left = me.clientX + 'px';
      dragState.ghost.style.top = me.clientY + 'px';
      if (!dragState.moved && dist > 6) dragState.moved = true;
      if (dragState.moved) {
        if (dropTargetEl) dropTargetEl.classList.remove('drop-hover');
        dropTargetEl = null;
        const hit = document.elementFromPoint(me.clientX, me.clientY);
        if (hit) {
          const t = hit.closest('[data-drop-pool], [data-drop-reserved], [data-drop-timeline], [data-drop-col], [data-drop-day], [data-drop-subject], [data-drop-phase]');
          if (t) { t.classList.add('drop-hover'); dropTargetEl = t; }
        }
        updateTimelineDragPreview(findDropTarget(me.clientX, me.clientY));
      }
    }
  };
  const onUp = (ue) => {
    cleanup();
    if (!dragActive) { openSessionEditor(sid); return; }
    const st = dragState;
    dragState = null;
    document.body.classList.remove('creating-block');
    try { st.sourceEl.releasePointerCapture(st.pointerId); } catch (err) {}
    st.ghost.remove();
    hideTimelineDragPreview();
    if (dropTargetEl) { dropTargetEl.classList.remove('drop-hover'); dropTargetEl = null; }
    if (!st.moved) { openSessionEditor(st.sids[0]); return; }
    const target = findDropTarget(ue.clientX, ue.clientY);
    if (!target) {
      if (!confirm('بازه حذف شود؟ (خارج از محدوده رها شد)')) { renderViewContent(); return; }
      st.sessions.forEach(s => deleteSession(s.id));
      renderPlan();
      renderDashboard();
      toast('حذف شد');
      return;
    }
    applyDrop(st, target);
    renderPlan();
    renderDashboard();
  };
  const onCancel = () => {
    cleanup();
    if (dragActive && dragState) {
      try { dragState.sourceEl.releasePointerCapture(dragState.pointerId); } catch (err) {}
      dragState.ghost.remove();
      dragState = null;
      document.body.classList.remove('creating-block');
      hideTimelineDragPreview();
    }
    if (dropTargetEl) { dropTargetEl.classList.remove('drop-hover'); dropTargetEl = null; }
  };
  if (isTouch) timer = setTimeout(() => enterDragMode(startX, startY), 400);
  document.addEventListener('pointermove', onMove, { passive: false });
  document.addEventListener('pointerup', onUp, { once: true });
  document.addEventListener('pointercancel', onCancel, { once: true });
}

/* ============ CREATE DRAG ============ */
function onTimelinePointerDown(e) {
  const timeline = e.target.closest('[data-drop-timeline], [data-drop-col]');
  if (!timeline) return;
  if (e.target.closest('.tl-block, .tl-activity, .tl-exam, .tl-sleep, .reserved-bar, [data-sid]')) return;
  if (dragState) return;

  const isTouch = e.pointerType === 'touch';
  const startX = e.clientX, startY = e.clientY;
  let createActive = false;
  let timer = null;

  const enterCreateMode = () => {
    if (createActive) return;
    if (tlSwipe && tlSwipe.active) { cleanup(); return; }
    createActive = true;
    if (timer) { clearTimeout(timer); timer = null; }
    startCreateDrag({ clientX: startX, clientY: startY, pointerId: e.pointerId }, timeline);
  };

  const cleanup = () => {
    document.removeEventListener('pointermove', onMove);
    document.removeEventListener('pointerup', onUp);
    document.removeEventListener('pointercancel', onCancel);
    if (timer) { clearTimeout(timer); timer = null; }
  };

  const onMove = (me) => {
    if (createActive) return;
    if (tlSwipe && tlSwipe.active) { cleanup(); return; }
    const dist = Math.hypot(me.clientX - startX, me.clientY - startY);
    if (isTouch) { if (dist > 8) { cleanup(); } }
    else { if (dist > 8) { enterCreateMode(); } }
  };

  const onUp = () => { cleanup(); };
  const onCancel = () => cleanup();

  if (isTouch) timer = setTimeout(enterCreateMode, 400);
  document.addEventListener('pointermove', onMove, { passive: false });
  document.addEventListener('pointerup', onUp, { once: true });
  document.addEventListener('pointercancel', onCancel, { once: true });
}

function startCreateDrag(e, timeline) {
  if (tlSwipe && tlSwipe.active) return;
  const rect = timeline.getBoundingClientRect();
  const dayKey = timeline.dataset.dropTimeline || timeline.dataset.dropCol;
  let m = START_MIN + (e.clientY - rect.top) / PX_PER_MIN;
  m = snapMin(Math.max(START_MIN, Math.min(END_MIN - SNAP, m)));

  const preview = document.createElement('div');
  preview.className = 'create-preview';
  preview.style.top = ((m - START_MIN) * PX_PER_MIN) + 'px';
  preview.style.height = (SNAP * PX_PER_MIN) + 'px';
  preview.textContent = `${minToStr(m)} — ${minToStr(m + SNAP)}`;
  timeline.appendChild(preview);

  document.body.classList.add('creating-block');
  try { timeline.setPointerCapture(e.pointerId); } catch (err) {}

  createDragState = { timeline, dayKey, startMin: m, currentMin: m + SNAP, preview, pointerId: e.pointerId };
  document.addEventListener('pointermove', onCreateDragMove, { passive: false });
  document.addEventListener('pointerup', onCreateDragEnd, { once: true });
  document.addEventListener('pointercancel', onCreateDragCancel, { once: true });
}

function onCreateDragMove(e) {
  if (!createDragState) return;
  e.preventDefault();
  const rect = createDragState.timeline.getBoundingClientRect();
  let m = START_MIN + (e.clientY - rect.top) / PX_PER_MIN;
  m = snapMin(Math.max(START_MIN, Math.min(END_MIN, m)));
  const top = Math.min(createDragState.startMin, m);
  const bottom = Math.max(createDragState.startMin, m);
  const durMin = Math.max(SNAP, bottom - top);
  createDragState.currentMin = m;
  createDragState.preview.style.top = ((top - START_MIN) * PX_PER_MIN) + 'px';
  createDragState.preview.style.height = (durMin * PX_PER_MIN - 3) + 'px';
  createDragState.preview.textContent = `${minToStr(top)} — ${minToStr(top + durMin)}`;
}

function onCreateDragEnd() {
  document.removeEventListener('pointermove', onCreateDragMove);
  if (!createDragState) return;
  const st = createDragState;
  createDragState = null;
  document.body.classList.remove('creating-block');
  try { st.timeline.releasePointerCapture(st.pointerId); } catch (err) {}
  st.preview.remove();
  const top = Math.min(st.startMin, st.currentMin);
  const bottom = Math.max(st.startMin, st.currentMin);
  let durMin = bottom - top;
  if (durMin < 30) durMin = 60;
  openSessionEditor(null, { date: st.dayKey, startMin: top, durMin, examId: examSelectedId });
}

function onCreateDragCancel() {
  document.removeEventListener('pointermove', onCreateDragMove);
  if (createDragState) {
    document.body.classList.remove('creating-block');
    try { createDragState.timeline.releasePointerCapture(createDragState.pointerId); } catch (err) {}
    createDragState.preview.remove();
    createDragState = null;
  }
}

/* ============ MOVE DRAG PREVIEW ============ */
function updateTimelineDragPreview(target) {
  hideTimelineDragPreview();
  if (!target || !dragState || !dragState.moved) return;
  if (target.type !== 'timeline') return;
  const container = document.querySelector(`.timeline[data-drop-timeline="${target.date}"], .wv-col[data-drop-col="${target.date}"]`);
  if (!container) return;
  const totalDur = dragState.sessions.reduce((sum, s) => sum + (s.durMin || 60), 0);
  const color = dragState.color || '#7c5cff';
  const preview = document.createElement('div');
  preview.className = 'move-drag-preview';
  preview.style.borderColor = color;
  preview.style.background = `repeating-linear-gradient(45deg, ${color}55 0, ${color}55 6px, transparent 6px, transparent 12px), ${color}18`;
  const top = (target.startMin - START_MIN) * PX_PER_MIN;
  const height = Math.max(20, totalDur * PX_PER_MIN - 3);
  preview.style.top = top + 'px';
  preview.style.height = height + 'px';
  preview.innerHTML = `<span class="mdp-label">${minToStr(target.startMin)} — ${minToStr(target.startMin + totalDur)}</span>`;
  container.appendChild(preview);
  moveDragPreviewEl = preview;
}

function hideTimelineDragPreview() {
  if (moveDragPreviewEl) { moveDragPreviewEl.remove(); moveDragPreviewEl = null; }
}

function findDropTarget(x, y) {
  const el = document.elementFromPoint(x, y);
  if (!el) return null;
  if (el.closest('[data-drop-pool]')) return { type: 'pool' };
  const reserved = el.closest('[data-drop-reserved]');
  if (reserved) return { type: 'reserved', date: reserved.dataset.dropReserved };
  const tlDay = el.closest('[data-drop-timeline]');
  if (tlDay) {
    const rect = tlDay.getBoundingClientRect();
    let m = START_MIN + (y - rect.top) / PX_PER_MIN;
    m = snapMin(m);
    m = Math.max(START_MIN, Math.min(END_MIN - SNAP, m));
    return { type: 'timeline', date: tlDay.dataset.dropTimeline, startMin: m };
  }
  const tlCol = el.closest('[data-drop-col]');
  if (tlCol) {
    const rect = tlCol.getBoundingClientRect();
    let m = START_MIN + (y - rect.top) / PX_PER_MIN;
    m = snapMin(m);
    m = Math.max(START_MIN, Math.min(END_MIN - SNAP, m));
    return { type: 'timeline', date: tlCol.dataset.dropCol, startMin: m };
  }
  const phase = el.closest('[data-drop-phase]');
  if (phase) return { type: 'phase', date: phase.dataset.dropDay, phase: +phase.dataset.dropPhase };
  const subj = el.closest('[data-drop-subject]');
  if (subj) return { type: 'subject', date: subj.dataset.dropDay, subject: subj.dataset.dropSubject };
  const day = el.closest('[data-drop-day]');
  if (day) return { type: 'day', date: day.dataset.dropDay };
  return null;
}

function applyDrop(st, target) {
  const { sessions } = st;
  if (target.type === 'pool') {
    sessions.forEach(s => updateSession(s.id, { date: null, startMin: null }));
    toast('به استخر برگشت');
    return;
  }
  if (target.type === 'reserved') {
    sessions.forEach(s => updateSession(s.id, { date: target.date, startMin: null }));
    toast('به رزرو روز منتقل شد');
    return;
  }
  if (target.type === 'timeline') {
    const delta = target.startMin - st.firstStart;
    sessions.forEach(s => {
      if (s.startMin == null) updateSession(s.id, { date: target.date, startMin: target.startMin });
      else {
        const newStart = Math.max(START_MIN, Math.min(END_MIN - s.durMin, s.startMin + delta));
        updateSession(s.id, { date: target.date, startMin: newStart });
      }
    });
    toast('زمان‌بندی شد');
    return;
  }
  if (target.type === 'phase') {
    let t = phaseStartMin(target.phase);
    sessions.forEach(s => {
      updateSession(s.id, { date: target.date, startMin: Math.min(t, 1440 - s.durMin) });
      t += s.durMin;
    });
    toast('به فاز منتقل شد');
    return;
  }
  if (target.type === 'day' || target.type === 'subject') {
    sessions.forEach(s => updateSession(s.id, target.type === 'subject'
      ? { date: target.date, subject: target.subject }
      : { date: target.date }));
    toast('منتقل شد');
    return;
  }
}

/* ============ SWIPE NAVIGATION ============ */
function onTimelineSwipeStart(e) {
  if (e.pointerType !== 'touch') return;
  if (!e.target.closest('#tlBody')) return;
  if (e.target.closest('.tl-block, .tl-activity, .tl-exam, .tl-sleep, .reserved-bar, [data-sid], button, input, .tl-hour, .resize-handle, .grid-header, .tl-mode-row')) return;
  if (dragState || createDragState) return;
  if (document.getElementById('modalBackdrop')?.classList.contains('show')) return;
  if (tlSwipe) return;

  tlSwipe = {
    startX: e.clientX,
    startY: e.clientY,
    dx: 0,
    active: false,
    direction: 0,
    wrapper: null,
    currentEl: null,
    nextEl: null,
    width: 0,
    bodyEl: document.getElementById('tlBody')
  };

  document.addEventListener('pointermove', onTimelineSwipeMove, { passive: false });
  document.addEventListener('pointerup', onTimelineSwipeEnd, { once: true });
  document.addEventListener('pointercancel', onTimelineSwipeCancel, { once: true });
}

function onTimelineSwipeMove(e) {
  if (!tlSwipe) return;
  if (createDragState || dragState) { onTimelineSwipeCancel(); return; }

  const dx = e.clientX - tlSwipe.startX;
  const dy = e.clientY - tlSwipe.startY;
  const absX = Math.abs(dx);
  const absY = Math.abs(dy);

  if (!tlSwipe.active) {
    if (absX < 12 && absY < 12) return;
    if (absY > absX * 1.2) { onTimelineSwipeCancel(); return; }
    // ⭐ Swipe right (dx > 0) = NEXT day; Swipe left (dx < 0) = PREV day
    const dir = dx > 0 ? 1 : -1;
    activateSwipe(dir);
    tlSwipe.active = true;
  }

  if (tlSwipe.active) {
    e.preventDefault();
  }

  tlSwipe.dx = dx;
  updateSwipeProgress(dx);
}

function activateSwipe(direction) {
  const body = tlSwipe.bodyEl;
  if (!body) return;

  const wrapper = document.createElement('div');
  wrapper.className = 'tl-swipe-wrapper';

  const current = document.createElement('div');
  current.className = 'tl-swipe-panel tl-swipe-current';
  current.innerHTML = body.innerHTML;

  const next = document.createElement('div');
  next.className = 'tl-swipe-panel tl-swipe-next';
  next.innerHTML = renderAdjacentTimelineHTML(direction);

  body.innerHTML = '';
  body.appendChild(wrapper);
  wrapper.appendChild(current);

  const h = current.offsetHeight;
  if (h > 0) wrapper.style.height = h + 'px';

  current.style.position = 'absolute';
  current.style.top = '0';
  current.style.left = '0';
  current.style.width = '100%';
  current.style.willChange = 'transform';

  next.style.position = 'absolute';
  next.style.top = '0';
  next.style.left = '0';
  next.style.width = '100%';
  next.style.pointerEvents = 'none';
  next.style.willChange = 'transform';

  wrapper.appendChild(next);

  const width = wrapper.clientWidth || 300;
  // ⭐ FIX: direction=1 (next) → next starts at -width (right swipe reveals from left side)
  //         direction=-1 (prev) → next starts at +width (left swipe reveals from right side)
  next.style.transform = `translateX(${-direction * width}px)`;

  tlSwipe.wrapper = wrapper;
  tlSwipe.currentEl = current;
  tlSwipe.nextEl = next;
  tlSwipe.direction = direction;
  tlSwipe.width = width;
}

function updateSwipeProgress(dx) {
  if (!tlSwipe?.active || !tlSwipe.currentEl) return;
  const { currentEl, nextEl, direction, width } = tlSwipe;

  let clampedDx;
  if (direction === 1) {
    clampedDx = Math.max(-width * 0.15, Math.min(width, dx));
  } else {
    clampedDx = Math.min(width * 0.15, Math.max(-width, dx));
  }

  currentEl.style.transform = `translateX(${clampedDx}px)`;
  nextEl.style.transform = `translateX(${clampedDx - direction * width}px)`;
}

function onTimelineSwipeEnd(e) {
  if (!tlSwipe) return;
  document.removeEventListener('pointermove', onTimelineSwipeMove);

  if (!tlSwipe.active) {
    tlSwipe = null;
    return;
  }

  const st = tlSwipe;
  tlSwipe = null;

  const { currentEl, nextEl, direction, width } = st;
  if (!currentEl || !nextEl) return;

  const progress = (direction * st.dx) / width;

  if (progress > 0.5) {
    // Complete transition
    currentEl.style.transition = 'transform 0.24s cubic-bezier(.2,.9,.3,1)';
    nextEl.style.transition = 'transform 0.24s cubic-bezier(.2,.9,.3,1)';
    currentEl.style.transform = `translateX(${direction * width}px)`;
    nextEl.style.transform = 'translateX(0)';

    setTimeout(() => {
      shiftTimelineAnchor(direction);
      syncCompat();
      renderCalendar();
      renderViewContent();
    }, 250);
  } else {
    // ⭐ Snap back — FIX: nextEl returns to its ORIGINAL side (-direction * width)
    currentEl.style.transition = 'transform 0.22s cubic-bezier(.2,.9,.3,1)';
    nextEl.style.transition = 'transform 0.22s cubic-bezier(.2,.9,.3,1)';
    currentEl.style.transform = 'translateX(0)';
    nextEl.style.transform = `translateX(${-direction * width}px)`;

    setTimeout(() => {
      renderTimelineBody();
    }, 235);
  }
}

function onTimelineSwipeCancel() {
  document.removeEventListener('pointermove', onTimelineSwipeMove);
  if (!tlSwipe) return;
  if (tlSwipe.active) {
    renderTimelineBody();
  }
  tlSwipe = null;
}

function renderAdjacentTimelineHTML(targetDir) {
  const savedSelected = calSelected;
  const savedSelectedKey = tlSelectedKey;
  const savedYear = calYear;
  const savedMonth = calMonth;

  const savedMode = tlMode;
  tlSelectedKey = null;
  let html;
  try {
    if (savedMode === 'month') {
      shiftTimelineAnchor(targetDir);
      html = renderTimelineMonth();
    } else {
      const step = timelineStepDays();
      const targetJdn = jdnFromKey(calSelected) + targetDir * step;
      calSelected = jKey(d2j(targetJdn));
      const j = parseKey(calSelected);
      calYear = j.jy;
      calMonth = j.jm;
      if (savedMode === 'day') {
        html = renderTimelineDay(calSelected);
      } else if (savedMode === '3day') {
        const keys = Array.from({ length: 3 }, (_, i) => jKey(d2j(targetJdn + i)));
        html = renderTimelineMulti(keys);
      } else {
        html = renderTimelineMulti(weekKeysOf(targetJdn));
      }
    }
  } catch (err) {
    console.warn('[plan] adjacent render failed:', err);
    html = '';
  }

  calSelected = savedSelected;
  tlSelectedKey = savedSelectedKey;
  calYear = savedYear;
  calMonth = savedMonth;

  return html;
}

/* ============ TIMELINE VIEW ============ */
function renderTimeline(box) {
  computeRowHeight();
  const onToday = timelineContainsToday();
  box.innerHTML = `
    <div class="timeline-card">
      <div class="tl-mode-row">
        <div class="seg-mini" id="tlModeSeg">
          <button data-tlmode="day" class="${tlMode === 'day' ? 'active' : ''}">روز</button>
          <button data-tlmode="3day" class="${tlMode === '3day' ? 'active' : ''}">۳ روز</button>
          <button data-tlmode="week" class="${tlMode === 'week' ? 'active' : ''}">هفته</button>
          <button data-tlmode="month" class="${tlMode === 'month' ? 'active' : ''}">ماه</button>
        </div>
      </div>
      <div class="grid-header">
        <div class="gh-title">${timelineTitle()}</div>
        <div class="wh-nav">
          <button class="tl-nav-btn" data-nav="-1" aria-label="قبلی">‹</button>
          ${onToday ? '' : '<button class="tl-today-btn" id="tlTodayBtn">◉ امروز</button>'}
          <button class="tl-nav-btn" data-nav="1" aria-label="بعدی">›</button>
        </div>
      </div>
      <div id="tlBody" style="--row-h:${ROW_H}px"></div>
    </div>`;
  document.getElementById('tlModeSeg').onclick = (e) => {
    const b = e.target.closest('[data-tlmode]');
    if (!b) return;
    tlMode = b.dataset.tlmode;
    syncCompat();
    renderViewContent();
  };
  const todayBtn = document.getElementById('tlTodayBtn');
  if (todayBtn) todayBtn.onclick = () => gotoToday();
  box.querySelectorAll('[data-nav]').forEach(btn => {
    btn.onclick = () => {
      shiftTimelineAnchor(+btn.dataset.nav);
      syncCompat();
      renderCalendar();
      renderViewContent();
    };
  });
  renderTimelineBody();
}

function timelineTitle() {
  if (tlMode === 'month') return `${MONTHS[calMonth - 1]} ${fa(calYear)}`;
  if (tlMode === 'day') {
    const jdn = jdnFromKey(calSelected);
    const j = d2j(jdn);
    return `${DOW[dowIndex(jdn)]} ${fa(j.jd)} ${MONTHS[j.jm - 1]}`;
  }
  if (tlMode === '3day') {
    const jdn = jdnFromKey(calSelected);
    const j1 = d2j(jdn), j2 = d2j(jdn + 2);
    return `${fa(j1.jd)} ${MONTHS[j1.jm - 1]} تا ${fa(j2.jd)} ${MONTHS[j2.jm - 1]}`;
  }
  const st = activeWeekStart();
  const a = d2j(st), b = d2j(st + 6);
  return `${fa(a.jd)} ${MONTHS[a.jm - 1]} تا ${fa(b.jd)} ${MONTHS[b.jm - 1]}`;
}

function renderTimelineBody() {
  const body = document.getElementById('tlBody');
  if (!body) return;
  if (tlMode === 'day') {
    body.innerHTML = renderTimelineDay(calSelected);
  } else if (tlMode === 'month') {
    body.innerHTML = renderTimelineMonth();
  } else {
    const keys = tlMode === '3day'
      ? Array.from({ length: 3 }, (_, i) => jKey(d2j(jdnFromKey(calSelected) + i)))
      : weekKeysOf(jdnFromKey(calSelected));
    body.innerHTML = renderTimelineMulti(keys);
  }
  bindCardsInContainer(body);
  body.querySelectorAll('.mc-cell[data-key]').forEach(cell => {
    cell.onclick = () => {
      calSelected = cell.dataset.key;
      tlSelectedKey = calSelected;
      const j = parseKey(calSelected);
      calYear = j.jy;
      calMonth = j.jm;
      tlMode = 'day';
      syncCompat();
      renderCalendar();
      renderViewContent();
    };
  });
  body.querySelectorAll('.wv-day[data-key]').forEach(day => {
    day.onclick = () => {
      calSelected = day.dataset.key;
      tlSelectedKey = calSelected;
      const j = parseKey(calSelected);
      calYear = j.jy;
      calMonth = j.jm;
      tlMode = 'day';
      syncCompat();
      renderCalendar();
      renderViewContent();
    };
  });
  body.querySelectorAll('[data-drop-timeline]').forEach(tl => {
    tl.addEventListener('pointerdown', onTimelinePointerDown);
  });
  body.querySelectorAll('[data-drop-col]').forEach(col => {
    col.addEventListener('pointerdown', onTimelinePointerDown);
  });
}

function mergeSessions(sessions) {
  const sorted = [...sessions].sort((a, b) => a.startMin - b.startMin);
  const groups = [];
  sorted.forEach(s => {
    const last = groups[groups.length - 1];
    if (last && last.subject === s.subject && last.topic === s.topic && last.done === s.done && last.startMin + last.durMin === s.startMin) {
      last.durMin += s.durMin;
      last.endMin = last.startMin + last.durMin;
      last._end = last.endMin;
      last._ids.push(s.id);
    } else {
      const endMin = s.endMin != null ? +s.endMin : s.startMin + s.durMin;
      groups.push({ ...s, endMin, _end: endMin, _ids: [s.id] });
    }
  });
  return groups;
}

/* ---------- BUGFIX-1: horizontal block chain layout ----------
   Pure layout used by the timeline renderers. Blocks are sorted by start,
   touching blocks share an edge, gaps stay proportional, short blocks keep a
   readable minimum width, and an overflowing chain stays scrollable instead of
   drawing on top of itself. */
function timelineBlockRange(block) {
  const start = +block.startMin || 0;
  const end = block.endMin != null ? +block.endMin : start + (+block.durMin || 0);
  return { start, end: Math.max(start, end) };
}

function layoutTimelineBlocks(blocks, containerWidth, options) {
  const opts = options || {};
  const list = (blocks || []).filter(Boolean).map((block, index) => ({
    block, index, ...timelineBlockRange(block)
  }));
  const available = Math.max(1, +containerWidth || 1);
  if (!list.length) return { blocks: [], contentWidth: available, scrollable: false, pxPerMin: 0 };

  list.sort((a, b) => a.start - b.start || a.end - b.end || a.index - b.index);
  const minWidth = Math.max(1, opts.minWidth == null ? 32 : +opts.minWidth || 32);
  const minGap = Math.max(0, opts.minGap == null ? 4 : +opts.minGap || 0);
  const domainStart = opts.startMin != null ? +opts.startMin : Math.min(...list.map(item => item.start));
  const domainEnd = opts.endMin != null ? +opts.endMin : Math.max(...list.map(item => item.end));
  const span = Math.max(1, domainEnd - domainStart);
  const pxPerMin = available / span;

  let cursor = 0;
  let previous = null;
  const laidOut = [];
  list.forEach(item => {
    const start = Math.max(domainStart, item.start);
    const end = Math.min(domainEnd, item.end);
    if (end <= start) return;
    const width = Math.max(minWidth, (end - start) * pxPerMin);
    const touching = !!previous && start <= previous._layoutEnd;
    const gap = !previous ? 0 : (touching ? 0 : Math.max(minGap, (start - previous._layoutEnd) * pxPerMin));
    const left = previous ? Math.max(previous.left + previous.width + gap, cursor + gap) : 0;
    const placed = { ...item.block, _layoutStart: start, _layoutEnd: end, left, width };
    laidOut.push(placed);
    previous = placed;
    cursor = left + width;
  });
  const contentWidth = Math.max(available, cursor);
  return { blocks: laidOut, contentWidth, scrollable: contentWidth > available + 0.5, pxPerMin };
}

/* DOM helper used when a chain would overflow: the wrapper scrolls, blocks never overlap. */
function timelineChainHTML(blocks, containerWidth, options) {
  const layout = layoutTimelineBlocks(blocks, containerWidth, options);
  const inner = layout.blocks.map(block =>
    `<div class="tl-chain-block${block.done ? ' done' : ''}" style="left:${block.left.toFixed(2)}px;width:${block.width.toFixed(2)}px" title="${esc(block.subject || block.topic || '')}">${esc(block.subject || block.topic || '')}</div>`
  ).join('');
  return `<div class="tl-chain-scroll" style="overflow-x:${layout.scrollable ? 'auto' : 'hidden'}"><div class="tl-chain" style="width:${Math.ceil(layout.contentWidth)}px">${inner}</div></div>`;
}

/* A short block is painted taller than its real time range so its label stays
   readable. Lane packing must use that painted end, otherwise two tiny blocks
   that merely touch in time are drawn on top of each other. */
function visualLaneEnd(item) {
  const start = +item.startMin || 0;
  const end = item._end != null ? +item._end : start + (+item.durMin || 0);
  const minH = Math.max(0, +item._minH || 0);
  const inset = Math.max(0, +item._inset || 0);
  if (!minH) return Math.max(start, end);
  const realH = Math.max(0, (Math.max(start, end) - start) * PX_PER_MIN - inset);
  if (realH >= minH) return Math.max(start, end);
  return end + (minH - realH) / Math.max(PX_PER_MIN, 0.0001);
}

if (typeof globalThis !== 'undefined') {
  globalThis.__masirTimeline = { timelineBlockRange, layoutTimelineBlocks, timelineChainHTML, mergeSessions, visualLaneEnd, assignLanes, syncExamSessionsTopics, phaseCellItems };
}

function assignLanes(items) {
  if (!items.length) return { items: [], laneCount: 1 };
  const withEnd = items.map((it, i) => ({
    ...it, _idx: i,
    _laneStart: +it.startMin || 0,
    _laneEnd: visualLaneEnd(it)
  }));
  const sorted = [...withEnd].sort((a, b) => a._laneStart - b._laneStart);
  const laneEnds = [];
  const laneAssigned = sorted.map(it => {
    let lane = 0;
    while (lane < laneEnds.length && laneEnds[lane] > it._laneStart) lane++;
    laneEnds[lane] = it._laneEnd;
    return { ...it, _lane: lane };
  });
  const byIdx = {};
  laneAssigned.forEach(it => { byIdx[it._idx] = it; });
  return { items: items.map((_, i) => byIdx[i]), laneCount: Math.max(1, laneEnds.length) };
}

function laneStyleDay(lane, count) {
  if (count <= 1) return '';
  return `right:calc(52px + (100% - 62px) * ${lane} / ${count});left:auto;width:calc((100% - 62px) / ${count} - 3px);`;
}
function laneStyleMulti(lane, count) {
  if (count <= 1) return '';
  return `right:calc(2px + (100% - 4px) * ${lane} / ${count});left:auto;width:calc((100% - 4px) / ${count} - 2px);`;
}

function sleepVisibleRange(s, dayKey) {
  const startKey = s.date;
  const endKey = s.endDate || s.date;
  if (startKey === endKey) {
    if (startKey !== dayKey) return null;
    const top = Math.max(s.startMin, START_MIN);
    const bottom = Math.min(s.endMin, END_MIN);
    return bottom > top ? { top, bottom } : null;
  }
  const isStart = startKey === dayKey;
  const isEnd = endKey === dayKey;
  if (!isStart && !isEnd) return null;
  const vStart = isStart ? s.startMin : 0;
  const vEnd = isEnd ? s.endMin : 1440;
  const top = Math.max(vStart, START_MIN);
  const bottom = Math.min(vEnd, END_MIN);
  return bottom > top ? { top, bottom } : null;
}

function renderTimelineDay(dayKey) {
  const timed = timedOfDay(dayKey);
  const merged = mergeSessions(timed);
  const reserved = reservedOfDay(dayKey);
  const acts = state.activities
    .filter(a => a.date === dayKey && a.startMin != null && a.endMin != null)
    .filter(a => !timed.some(s => s.activityId === a.id))
    .map(a => ({ ...a, _type: 'act', _end: a.endMin }));
  const exams = state.settings.examsEnabled
    ? state.exams.filter(e => e.date === dayKey).map(e => ({ ...e, _type: 'exam', _end: e.endMin }))
    : [];
  const sleeps = [];
  state.sleeps
    .filter(s => s.date === dayKey || (s.endDate || s.date) === dayKey)
    .forEach(s => {
      const vis = sleepVisibleRange(s, dayKey);
      if (vis) sleeps.push({ ...s, _type: 'sleep', startMin: vis.top, _end: vis.bottom, _vis: vis });
    });

  const allItems = [
    ...merged.map(g => ({ ...g, _type: 'sess', _minH: 6, _inset: 3 })),
    ...acts.map(a => ({ ...a, _type: 'act', _minH: 8, _inset: 3 })),
    ...exams.map(e => ({ ...e, _type: 'exam', _minH: 10, _inset: 3 })),
    ...sleeps.map(s => ({ ...s, _type: 'sleep', _minH: 8, _inset: 3 }))
  ];
  const { items: laned, laneCount } = assignLanes(allItems);
  const idx = { sess: {}, act: {}, exam: {}, sleep: {} };
  laned.forEach(it => {
    if (it._type === 'sess') idx.sess[it._ids[0]] = it;
    else if (it._type === 'act') idx.act[it.id] = it;
    else if (it._type === 'exam') idx.exam[it.id] = it;
    else idx.sleep[it.id] = it;
  });

  let html = '';
  HOURS.forEach(h => { html += `<div class="tl-row"><span class="tl-hour">${fa(h)}:۰۰</span><i class="tl-quarter q1"></i><i class="tl-quarter q2"></i><i class="tl-quarter q3"></i></div>`; });

  merged.forEach(g => {
    const it = idx.sess[g._ids[0]];
    const c = subjColor(g.subject);
    const top = (g.startMin - START_MIN) * PX_PER_MIN;
    const h = Math.max(6, g.durMin * PX_PER_MIN - 3);
    const laneS = laneStyleDay(it ? it._lane : 0, laneCount);
    const multi = g._ids.length > 1;
    const resize = !g.done && !multi ? '<div class="resize-handle"></div>' : '';
    html += `<div class="tl-block tl-session${g.done ? ' done' : ''}" data-sid="${g._ids[0]}" data-sids="${g._ids.join(',')}"
      style="top:${top}px;height:${h}px;${laneS}background:linear-gradient(135deg,${c},${c}a8)">
      <div class="tb-title">${esc(g.subject)}${g.done ? ' ✓' : ''}</div>
      <div class="tb-sub${g.topic ? '' : ' empty'}">${esc(g.topic || 'بدون مبحث')}</div>
      <div class="tb-time">${minToStr(g.startMin)} — ${minToStr(g.startMin + g.durMin)}${multi ? ` • ${fa(g._ids.length)}` : ''}</div>
      ${resize}
    </div>`;
  });

  acts.forEach(a => {
    const it = idx.act[a.id];
    const c = subjColor(a.subject);
    const top = (a.startMin - START_MIN) * PX_PER_MIN;
    const h = Math.max(8, (a.endMin - a.startMin) * PX_PER_MIN - 3);
    const laneS = laneStyleDay(it ? it._lane : 0, laneCount);
    const disp = displaySubjectName(a.subject, a.topic);
    html += `<div class="tl-activity" data-act-id="${a.id}" style="top:${top}px;height:${h}px;${laneS}border-color:${c};background:repeating-linear-gradient(45deg,${c}22 0,${c}22 6px,transparent 6px,transparent 12px),${c}14">
      <div class="ta-title">${esc(disp)}</div>
      <div class="ta-time">${minToStr(a.startMin)} — ${minToStr(a.endMin)}</div>
    </div>`;
  });

  exams.forEach(e => {
    const it = idx.exam[e.id];
    const top = (e.startMin - START_MIN) * PX_PER_MIN;
    const h = Math.max(10, (e.endMin - e.startMin) * PX_PER_MIN - 3);
    const laneS = laneStyleDay(it ? it._lane : 0, laneCount);
    html += `<div class="tl-exam" data-exam-id="${e.id}" style="top:${top}px;height:${h}px;${laneS}">
      <div class="te-title">${esc(e.name)}</div>
      <div class="te-time">${minToStr(e.startMin)} — ${minToStr(e.endMin)}</div>
    </div>`;
  });

  sleeps.forEach(s => {
    const it = idx.sleep[s.id];
    const vis = s._vis;
    const topPx = (vis.top - START_MIN) * PX_PER_MIN;
    const hPx = Math.max(8, (vis.bottom - vis.top) * PX_PER_MIN - 3);
    const laneS = laneStyleDay(it ? it._lane : 0, laneCount);
    const isOvernight = (s.endDate || s.date) !== s.date;
    const label = s.nap ? '💤 چرت' : (isOvernight ? '🌙 خواب' : '😴 خواب');
    html += `<div class="tl-sleep" data-sleep-id="${s.id}" style="top:${topPx}px;height:${hPx}px;${laneS}">
      <div class="ts-title">${label}</div>
      <div class="ts-time">${minToStr(s.startMin)} — ${minToStr(s.endMin)}</div>
    </div>`;
  });

  if (dayKey === TODAY_KEY) {
    const now = new Date();
    const nowMin = now.getHours() * 60 + now.getMinutes();
    if (nowMin >= START_MIN && nowMin < END_MIN) {
      const top = (nowMin - START_MIN) * PX_PER_MIN;
      html += `<div class="now-line" style="top:${top}px"><span class="now-label">${minToStr(nowMin)}</span></div>`;
    }
  }

  const reservedBar = `
    <div class="reserved-bar" data-drop-reserved="${dayKey}">
      <div class="reserved-head">
        <span>📌 رزرو این روز (${fa(reserved.length)})</span>
        <span class="rh-hint">اینجا رها کن تا بدون ساعت شود</span>
      </div>
      <div class="reserved-list">
        ${reserved.length ? reserved.map(s => renderSessionCard(s, 'mini')).join('') : '<div class="reserved-empty">خالی — بازه‌ای بدون ساعت نیست</div>'}
      </div>
    </div>`;

  return reservedBar + `<div class="timeline" data-drop-timeline="${dayKey}">${html}</div>`;
}

function monthDayItems(dayKey) {
  const timed = timedOfDay(dayKey);
  const linkedIds = new Set(timed.map(s => s.activityId).filter(Boolean));
  const recorded = state.activities.filter(a =>
    a.date === dayKey && a.startMin != null && a.endMin != null && !linkedIds.has(a.id)
  );
  const exams = state.settings.examsEnabled
    ? state.exams.filter(e => e.date === dayKey && e.startMin != null)
    : [];
  return [
    ...timed.map(s => ({ ...s, _monthKind: 'session' })),
    ...recorded.map(a => ({ ...a, _monthKind: 'activity' })),
    ...exams.map(e => ({ ...e, _monthKind: 'exam' }))
  ].sort((a, b) => (+a.startMin || 0) - (+b.startMin || 0));
}

function renderTimelineMonth() {
  const firstJdn = j2d(calYear, calMonth, 1);
  const startCol = dowIndex(firstJdn);
  const len = jMonthLength(calYear, calMonth);
  const cellCount = Math.ceil((startCol + len) / 7) * 7;
  let html = `<div class="month-cal" role="grid" aria-label="${MONTHS[calMonth - 1]} ${fa(calYear)}">
    <div class="mc-weekdays">${DOW_SHORT.map(d => `<span>${d}</span>`).join('')}</div>
    <div class="mc-grid">`;

  for (let i = 0; i < cellCount; i++) {
    const jdn = firstJdn - startCol + i;
    const j = d2j(jdn);
    const k = jKey(j);
    const adjacent = i < startCol || j.jm !== calMonth || j.jy !== calYear;
    const items = adjacent ? [] : monthDayItems(k);
    const hasExam = !adjacent && state.settings.examsEnabled && state.exams.some(e => e.date === k);
    const cls = ['mc-cell'];
    if (adjacent) cls.push('adjacent');
    if (k === TODAY_KEY) cls.push('today');
    if (k === tlSelectedKey) cls.push('sel');

    const chips = items.slice(0, 2).map(item => {
      const label = item._monthKind === 'exam'
        ? `📝 ${item.name || 'امتحان'}`
        : item._monthKind === 'activity'
          ? (item.topic || item.subject || 'فعالیت')
          : (item.subject || 'مطالعه');
      const range = itemTimeRange(item);
      const time = range ? ` · ${minToStr(range.start)}–${minToStr(range.end)}` : '';
      const color = item._monthKind === 'exam' ? '#eab308' : subjColor(item.subject);
      return `<span class="mc-chip" style="--chip:${color}" title="${esc(label + time)}">${esc(label)}</span>`;
    }).join('');
    const more = items.length > 2 ? `<span class="mc-more">+${fa(items.length - 2)}</span>` : '';

    html += `<div class="${cls.join(' ')}" data-key="${k}" role="gridcell" aria-label="${fa(j.jd)} ${MONTHS[j.jm - 1]}">
      <div class="mc-day"><b>${fa(j.jd)}</b>${hasExam ? '<i class="mc-exam-dot"></i>' : ''}</div>
      <div class="mc-events">${chips}${more}</div>
    </div>`;
  }

  html += `</div><div class="mc-hint">برای دیدن تایم لاین روز، روی یک تاریخ کلیک کنید</div></div>`;
  return html;
}

function renderTimelineMulti(keys) {
  const cols = keys.length;
  const wrapper = cols >= 7 ? 'week-view narrow' : 'week-view';
  /* One shared band height for every column: a busier reserve list can never
     push a single day's ruler out of alignment with its neighbours. */
  const reserves = keys.map(k => reservedOfDay(k));
  const reserveH = Math.max(52, ...reserves.map(r => 21 * r.length + 21));
  const head = `<div class="wv-head" style="--cols:${cols}"><div></div>${keys.map(k => {
    const j = parseKey(k);
    const kd = j2d(j.jy, j.jm, j.jd);
    const cls = ['wv-day'];
    if (k === TODAY_KEY) cls.push('today');
    if (k === tlSelectedKey) cls.push('sel');
    return `<div class="${cls.join(' ')}" data-key="${k}"><span>${DOW_SHORT[dowIndex(kd)]}</span><b>${fa(j.jd)}</b></div>`;
  }).join('')}</div>`;
  const hours = HOURS.map(h => `<div class="wv-h">${fa(h)}</div>`).join('');

  const colsHTML = keys.map((k, dayIdx) => {
    const timed = timedOfDay(k);
    const merged = mergeSessions(timed);
    const reserved = reserves[dayIdx];
    const acts = state.activities
      .filter(a => a.date === k && a.startMin != null && a.endMin != null)
      .filter(a => !timed.some(s => s.activityId === a.id))
      .map(a => ({ ...a, _type: 'act', _end: a.endMin }));
    const exams = state.settings.examsEnabled
      ? state.exams.filter(e => e.date === k).map(e => ({ ...e, _type: 'exam', _end: e.endMin }))
      : [];
    const sleeps = [];
    state.sleeps
      .filter(s => s.date === k || (s.endDate || s.date) === k)
      .forEach(s => {
        const vis = sleepVisibleRange(s, k);
        if (vis) sleeps.push({ ...s, _type: 'sleep', startMin: vis.top, _end: vis.bottom, _vis: vis });
      });
    const allItems = [
      ...merged.map(g => ({ ...g, _type: 'sess', _minH: 4, _inset: 2 })),
      ...acts.map(a => ({ ...a, _type: 'act', _minH: 6, _inset: 2 })),
      ...exams.map(e => ({ ...e, _type: 'exam', _minH: 8, _inset: 2 })),
      ...sleeps.map(s => ({ ...s, _type: 'sleep', _minH: 6, _inset: 2 }))
    ];
    const { items: laned, laneCount } = assignLanes(allItems);
    const idx = { sess: {}, act: {}, exam: {}, sleep: {} };
    laned.forEach(it => {
      if (it._type === 'sess') idx.sess[it._ids[0]] = it;
      else if (it._type === 'act') idx.act[it.id] = it;
      else if (it._type === 'exam') idx.exam[it.id] = it;
      else idx.sleep[it.id] = it;
    });
    const cells = HOURS.map(h => `<div class="cell" data-h="${h}"></div>`).join('');
    const reservedHTML = `<div class="wv-reserve-row" data-drop-reserved="${k}">
      <div class="wv-reserve-label">📌 ${fa(reserved.length)}</div>
      <div class="wv-reserve-items">${reserved.length ? reserved.map(s => {
        const c = subjColor(s.subject);
        return `<div class="wv-res-chip" data-sid="${s.id}" style="background:linear-gradient(135deg,${c},${c}bb)" title="${esc(s.subject)} — ${esc(s.topic || '')}">${esc(s.subject)}</div>`;
      }).join('') : '<span class="wv-reserve-empty">—</span>'}</div>
    </div>`;
    const blocksHTML = merged.map(g => {
      const it = idx.sess[g._ids[0]];
      const c = subjColor(g.subject);
      const top = (g.startMin - START_MIN) * PX_PER_MIN;
      const h = Math.max(4, g.durMin * PX_PER_MIN - 2);
      const laneS = laneStyleMulti(it ? it._lane : 0, laneCount);
      return `<div class="wv-block${g.done ? ' done' : ''}" data-sid="${g._ids[0]}" data-sids="${g._ids.join(',')}" style="top:${top}px;height:${h}px;${laneS}background:linear-gradient(135deg,${c},${c}a8)"><span>${esc(g.subject)}${g.done ? ' ✓' : ''}</span></div>`;
    }).join('');
    const actsHTML = acts.map(a => {
      const it = idx.act[a.id];
      const c = subjColor(a.subject);
      const top = (a.startMin - START_MIN) * PX_PER_MIN;
      const h = Math.max(6, (a.endMin - a.startMin) * PX_PER_MIN - 2);
      const laneS = laneStyleMulti(it ? it._lane : 0, laneCount);
      const disp = displaySubjectName(a.subject, a.topic);
      return `<div class="wv-act" data-act-id="${a.id}" style="top:${top}px;height:${h}px;${laneS}border-color:${c};background:${c}25"><span>${esc(disp)}</span></div>`;
    }).join('');
    const examsHTML = exams.map(e => {
      const it = idx.exam[e.id];
      const top = (e.startMin - START_MIN) * PX_PER_MIN;
      const h = Math.max(8, (e.endMin - e.startMin) * PX_PER_MIN - 2);
      const laneS = laneStyleMulti(it ? it._lane : 0, laneCount);
      return `<div class="wv-exam" data-exam-id="${e.id}" style="top:${top}px;height:${h}px;${laneS}"><span>📝 ${esc(e.name)}</span></div>`;
    }).join('');
    const sleepsHTML = sleeps.map(s => {
      const it = idx.sleep[s.id];
      const vis = s._vis;
      const topPx = (vis.top - START_MIN) * PX_PER_MIN;
      const hPx = Math.max(6, (vis.bottom - vis.top) * PX_PER_MIN - 2);
      const laneS = laneStyleMulti(it ? it._lane : 0, laneCount);
      return `<div class="wv-sleep" data-sleep-id="${s.id}" style="top:${topPx}px;height:${hPx}px;${laneS}"><span>${s.nap ? '💤' : '🌙'}</span></div>`;
    }).join('');
    let nowLine = '';
    if (k === TODAY_KEY) {
      const now = new Date();
      const nowMin = now.getHours() * 60 + now.getMinutes();
      if (nowMin >= START_MIN && nowMin < END_MIN) {
        const top = (nowMin - START_MIN) * PX_PER_MIN;
        nowLine = `<div class="wv-now-line" style="top:${top}px"></div>`;
      }
    }
    return `<div class="wv-day-column">${reservedHTML}<div class="wv-col" data-drop-col="${k}">${cells}${blocksHTML}${actsHTML}${examsHTML}${sleepsHTML}${nowLine}</div></div>`;
  }).join('');

  return `<div class="${wrapper}"><div class="wv-scroll">${head}<div class="wv" style="--reserve-h:${reserveH}px"><div class="wv-hours"><div class="wv-reserve-spacer"></div>${hours}<div class="wv-h wv-h-end">۲۴:۰۰</div></div><div class="wv-cols" style="--cols:${cols}">${colsHTML}</div></div></div></div>`;
}

/* ============ SUBJECTS VIEW ============ */
function renderSubjects(box) {
  const st = activeWeekStart();
  const days = Array.from({ length: 7 }, (_, i) => jKey(d2j(st + i)));
  const allSubjects = allSubjectsForSelect();
  const subjects = allSubjects.filter(s => s.name !== OTHER_SUBJECT);
  if (!subjects.length) {
    box.innerHTML = `<div class="plan-hint">هنوز درسی نداری. از تنظیمات اضافه کن.</div>`;
    return;
  }
  /* «سایر» is a real column in the topic grid, always last. */
  subjects.push(...allSubjects.filter(s => s.name === OTHER_SUBJECT));
  const onThisWeek = subjectsContainsThisWeek();
  let html = `<div class="grid-card">
    <div class="grid-header">
      <div class="gh-title">${weekTitle(st)}</div>
      <div class="wh-nav">
        <button class="tl-nav-btn" data-week-nav="-1" aria-label="هفته قبل">‹</button>
        ${onThisWeek ? '' : '<button class="tl-today-btn" id="subjectsWeek">◉ این هفته</button>'}
        <button class="tl-nav-btn" data-week-nav="1" aria-label="هفته بعد">›</button>
      </div>
    </div>
    <div class="grid-scroll">
      <table class="grid-table">
        <thead><tr><th class="gt-corner">روز</th>`;
  subjects.forEach(s => { html += `<th style="color:${s.color}">${esc(s.name)}</th>`; });
  html += `</tr></thead><tbody>`;

  days.forEach(k => {
    const jd = parseKey(k);
    const jdn = jdnFromKey(k);
    const isToday = k === TODAY_KEY;
    html += `<tr><td class="gt-row-label${isToday ? ' today' : ''}">${DOW[dowIndex(jdn)]}<br><span class="text-muted fs-9">${fa(jd.jd)} ${MONTHS[jd.jm - 1].slice(0, 4)}</span></td>`;
    subjects.forEach(subj => {
      const cellSessions = sessionsOfDay(k).filter(s => s.subject === subj.name);
      html += `<td class="gt-cell" data-drop-day="${k}" data-drop-subject="${esc(subj.name)}">
        ${cellSessions.map(s => renderPill(s)).join('')}
      </td>`;
    });
    html += `</tr>`;
  });
  html += `</tbody></table></div></div>`;
  box.innerHTML = html;

  bindCardsInContainer(box);
  bindDayHover(box);
  bindEmptyCellClick(box);
  box.querySelectorAll('[data-week-nav]').forEach(btn => btn.onclick = () => navigateWeek(+btn.dataset.weekNav));
  const todayBtn = document.getElementById('subjectsWeek');
  if (todayBtn) todayBtn.onclick = () => gotoToday();
}

function renderPill(s) {
  const color = subjColor(s.subject);
  return `<div class="sess-pill${s.done ? ' done' : ''}" data-sid="${s.id}" style="--pill:${color}" title="${esc(s.subject)}${s.topic ? ' — ' + esc(s.topic) : ''}">
    <span class="sp-label">${esc(s.topic || s.subject)}</span>
    <span class="sp-dur">${fa(s.durMin)}د${s.startMin != null ? ' · ' + minToStr(s.startMin) : ''}</span>
  </div>`;
}

/* ============ PHASES VIEW ============ */
/* Volume planning shows planned sessions and already recorded activities in the
   same phase grid. A linked activity is skipped because its session pill is
   already rendered, so nothing appears twice. */
function phaseCellItems(dayKey,sessions,activities,phaseStart,phaseEnd){
  const linkedIds=new Set((sessions||[]).map(s=>s.activityId).filter(Boolean));
  const inPhase=item=>{
    const range=itemTimeRange(item);
    return !!range&&range.end>phaseStart&&range.start<phaseEnd;
  };
  const planned=(sessions||[]).filter(inPhase).map(s=>({...s,_kind:'session'}));
  const recorded=(activities||[]).filter(a=>a.date===dayKey&&!linkedIds.has(a.id)).filter(inPhase).map(a=>({...a,_kind:'activity'}));
  return [...planned,...recorded].sort((a,b)=>a.startMin-b.startMin||(a._kind==='session'?-1:1));
}

function renderPhases(box) {
  const st = activeWeekStart();
  const days = Array.from({ length: 7 }, (_, i) => jKey(d2j(st + i)));
  const onThisWeek = subjectsContainsThisWeek();
  let html = `<div class="grid-card">
    <div class="grid-header">
      <div class="gh-title">${weekTitle(st)}</div>
      <div class="wh-nav">
        <button class="tl-nav-btn" data-week-nav="-1" aria-label="هفته قبل">‹</button>
        ${onThisWeek ? '' : '<button class="tl-today-btn" id="phasesWeek">◉ این هفته</button>'}
        <button class="tl-nav-btn" data-week-nav="1" aria-label="هفته بعد">›</button>
      </div>
    </div>
    <div class="grid-scroll">
      <table class="grid-table phases-table">
        <thead><tr><th class="gt-corner">روز</th>`;
  for (let p = 1; p <= PHASE_COUNT; p++) {
    const startM = phaseStartMin(p);
    const endM = startM + PHASE_SIZE;
    const endLabel = endM >= 1440 ? '۲۴:۰۰' : minToStr(endM);
    html += `<th><div class="ph-num">${fa(p)}</div><div class="ph-time">${minToStr(startM)}–${endLabel}</div></th>`;
  }
  html += `</tr></thead><tbody>`;

  days.forEach(k => {
    const jd = parseKey(k);
    const jdn = jdnFromKey(k);
    const isToday = k === TODAY_KEY;
    html += `<tr><td class="gt-row-label${isToday ? ' today' : ''}">${DOW[dowIndex(jdn)]}<br><span class="text-muted fs-9">${fa(jd.jd)} ${MONTHS[jd.jm - 1].slice(0, 4)}</span></td>`;
    for (let p = 1; p <= PHASE_COUNT; p++) {
      const phaseStart = phaseStartMin(p);
      const phaseEnd = phaseStart + PHASE_SIZE;
      const cellItems = phaseCellItems(k, timedOfDay(k), state.activities, phaseStart, phaseEnd);
      html += `<td class="gt-cell phase-cell" data-drop-day="${k}" data-drop-phase="${p}">
        ${cellItems.map(s => renderPhasePill(s, phaseStart, phaseEnd)).join('')}
      </td>`;
    }
    html += `</tr>`;
  });
  html += `</tbody></table></div></div>`;
  box.innerHTML = html;

  bindCardsInContainer(box);
  bindDayHover(box);
  bindEmptyCellClick(box);
  box.querySelectorAll('[data-week-nav]').forEach(btn => btn.onclick = () => navigateWeek(+btn.dataset.weekNav));
  const todayBtn = document.getElementById('phasesWeek');
  if (todayBtn) todayBtn.onclick = () => gotoToday();
}

function phasePillTimeLabel(sStart, sEnd) {
  const start = +sStart;
  const end = +sEnd;
  if (!Number.isFinite(start) || !Number.isFinite(end)) return '';
  return `${minToStr(start)}–${minToStr(end)}`;
}

function renderPhasePill(s, phaseStart, phaseEnd) {
  const isActivity = s._kind === 'activity';
  const color = subjColor(s.subject);
  const range = itemTimeRange(s) || { start: +s.startMin || 0, end: +s.startMin || 0 };
  const sStart = range.start;
  const sEnd = range.end;
  const isContStart = sStart < phaseStart;
  const isContEnd = sEnd > phaseEnd;
  const classes = ['sess-pill', 'phase-pill'];
  if (isActivity) classes.push('activity-pill', 'tl-activity');
  if (s.done) classes.push('done');
  if (isContStart) classes.push('cont-start');
  if (isContEnd) classes.push('cont-end');
  if (isContStart && isContEnd) classes.push('cont-both');
  /* Each repeated pill owns only its slice of the block. Showing the full range
     in every cell made a 16:00–22:00 block look shifted into phases 10–12. */
  const segStart = Math.max(sStart, phaseStart);
  const segEnd = Math.min(sEnd, phaseEnd);
  const timeLabel = phasePillTimeLabel(sStart, sEnd);
  const segmentLabel = phasePillTimeLabel(segStart, segEnd) || timeLabel;
  const attrs = isActivity ? `data-act-id="${s.id}"` : `data-sid="${s.id}"`;
  const name = isActivity ? (s.topic || s.subject || 'فعالیت') : s.subject;
  const title = `${isActivity ? 'فعالیت ثبت‌شده' : 'جلسه'} — ${esc(name)}${s.topic && !isActivity ? ' — ' + esc(s.topic) : ''} (${timeLabel || segmentLabel} · ${fa(Math.max(0, sEnd - sStart))}د)`;
  return `<div class="${classes.join(' ')}" ${attrs} data-seg-start="${segStart}" data-seg-end="${segEnd}" style="--pill:${color}" title="${title}" aria-label="${title}">
    <span class="sp-label" style="color:${isActivity ? '#a7f3d0' : color}">${esc(name)}</span>
    <span class="sp-dur">${segmentLabel}</span>
  </div>`;
}

function bindEmptyCellClick(container) {
  container.querySelectorAll('.gt-cell').forEach(cell => {
    cell.addEventListener('click', (e) => {
      if (e.target.closest('.sess-pill, .sess-card')) return;
      const day = cell.dataset.dropDay;
      const subject = cell.dataset.dropSubject;
      const phase = cell.dataset.dropPhase;
      const defaults = { date: day, examId: examSelectedId };
      if (subject) defaults.subject = subject;
      if (phase) { defaults.startMin = phaseStartMin(+phase); defaults.durMin = PHASE_SIZE; }
      else { defaults.durMin = 120; }
      openSessionEditor(null, defaults);
    });
  });
}

function bindDayHover(container) {
  const selector = '[data-drop-day], [data-drop-subject], [data-drop-phase], [data-drop-col], [data-drop-timeline], [data-drop-reserved], [data-drop-pool]';
  container.querySelectorAll(selector).forEach(el => {
    el.addEventListener('pointerenter', () => {
      if (dragState && dragState.moved) el.classList.add('drop-hover');
    });
    el.addEventListener('pointerleave', () => el.classList.remove('drop-hover'));
  });
}

function weekTitle(ws) {
  const a = d2j(ws), b = d2j(ws + 6);
  return `${fa(a.jd)} ${MONTHS[a.jm - 1]} تا ${fa(b.jd)} ${MONTHS[b.jm - 1]}`;
}

function navigateWeek(dir) {
  tlSelectedKey = null;
  calSelected = jKey(d2j(jdnFromKey(calSelected) + dir * 7));
  const j = parseKey(calSelected);
  calYear = j.jy; calMonth = j.jm;
  syncCompat();
  renderCalendar();
  renderViewContent();
}

function gotoToday() {
  calSelected = TODAY_KEY;
  tlSelectedKey = TODAY_KEY;
  const j = parseKey(calSelected);
  calYear = j.jy; calMonth = j.jm;
  syncCompat();
  renderCalendar();
  renderViewContent();
}

/* ============ RESIZE ============ */
function startResize(e, blockEl) {
  const sid = blockEl.dataset.sid;
  const s = sessionById(sid);
  if (!s || s.done) return;
  e.preventDefault();
  e.stopPropagation();
  resizeState = { sid, blockEl, origDur: s.durMin, startY: e.clientY };
  document.addEventListener('pointermove', onResizeMove, { passive: false });
  document.addEventListener('pointerup', onResizeEnd, { once: true });
}
function onResizeMove(e) {
  if (!resizeState) return;
  e.preventDefault();
  const dy = e.clientY - resizeState.startY;
  const s = sessionById(resizeState.sid);
  if (!s) return;
  let newDur = snapMin(resizeState.origDur + dy / PX_PER_MIN);
  newDur = Math.max(SNAP, Math.min(720, newDur));
  s.durMin = newDur;
  resizeState.blockEl.style.height = Math.max(4, newDur * PX_PER_MIN - 3) + 'px';
  const timeEl = resizeState.blockEl.querySelector('.tb-time');
  if (timeEl) timeEl.textContent = `${minToStr(s.startMin)} — ${minToStr(s.startMin + s.durMin)}`;
}
function onResizeEnd() {
  document.removeEventListener('pointermove', onResizeMove);
  if (resizeState) {
    save();
    renderViewContent();
    toast('ذخیره شد ✓');
    resizeState = null;
  }
}
document.addEventListener('pointerdown', (e) => {
  const handle = e.target.closest('.resize-handle');
  if (!handle) return;
  const blockEl = handle.closest('.tl-session');
  if (blockEl) startResize(e, blockEl);
}, true);

/* ============ SESSION EDITOR ============ */
function openSessionEditor(sid, defaults) {
  defaults = defaults || {};
  const existing = sid ? sessionById(sid) : null;
  const isEdit = !!existing;
  const s = existing || {
    id: uid(),
    subject: defaults.subject || (planningSubjects()[0]?.name || ''),
    topic: defaults.topic || '',
    durMin: defaults.durMin || 120,
    date: defaults.date || null,
    startMin: defaults.startMin != null ? defaults.startMin : null,
    examId: defaults.examId || null,
    done: false
  };

  let dateLabel = 'بدون روز (در استخر)';
  if (s.date) {
    const jdn = jdnFromKey(s.date);
    const jd = parseKey(s.date);
    dateLabel = `${DOW[dowIndex(jdn)]} ${fa(jd.jd)} ${MONTHS[jd.jm - 1]}`;
  }
  const subjOpts = subjectSelectOptions(planningSubjects(), s.subject, true);

  openModal(`
    <div class="modal-head">
      <div class="card-title">${isEdit ? 'ویرایش بازه' : 'بازه جدید'}</div>
      <button class="icon-btn" data-close>✕</button>
    </div>
    <label class="lbl mt-0">درس</label>
    <select class="input" id="seSubject">${subjOpts}</select>
    <label class="lbl">مبحث</label>
    <input class="input" id="seTopic" value="${esc(s.topic)}" placeholder="مثلاً: فصل ۳">
    <label class="lbl">مدت (دقیقه)</label>
    <input dir="ltr" inputmode="numeric" class="input num-input" id="seDur" type="text" min="15" max="720" step="15" value="${s.durMin}">
    <label class="lbl">روز</label>
    <div class="date-row">
      <button class="input date-btn" id="seDateBtn" type="button">${dateLabel} 📅</button>
      ${s.date ? '<button class="mini-btn date-clear-btn" id="seDateClear" type="button">بدون تاریخ</button>' : ''}
    </div>
    ${s.date ? `
      <label class="lbl">ساعت شروع (اختیاری)</label>
      <div class="time-pair" id="seStartWrap"></div>
      ${s.startMin != null ? '<button class="mini-btn mt-6" id="seStartClear">× حذف ساعت</button>' : ''}
    ` : ''}
    <div class="row mt-18">
      ${isEdit ? '<button class="btn danger" id="seDelete">حذف</button>' : ''}
      <button class="btn primary" id="seSave">${isEdit ? 'ذخیره' : 'افزودن'}</button>
    </div>
    ${isEdit ? '<button class="btn plan-convert mt-8" id="seConvertToActivity">🔄 تبدیل به فعالیت</button>' : ''}
  `);

  if (s.date) {
    window._seStartTp = mountTimePair('seStart', document.getElementById('seStartWrap'), {
      value: s.startMin != null ? s.startMin : null
    });
    const sc = document.getElementById('seStartClear');
    if (sc) sc.onclick = () => {
      updateSession(s.id, { startMin: null });
      closeModal();
      openSessionEditor(sid, defaults);
    };
  } else { window._seStartTp = null; }

  document.getElementById('seDateBtn').onclick = () => {
    const draft = {
      id: s.id,
      subject: document.getElementById('seSubject').value,
      topic: document.getElementById('seTopic').value,
      durMin: parseInt(document.getElementById('seDur').value, 10) || 120,
      date: s.date,
      startMin: s.startMin,
      examId: s.examId
    };
    openJalaliDatePicker({
      title: 'تاریخ بازه',
      initialKey: s.date || TODAY_KEY,
      onPick: (key) => {
        draft.date = key;
        if (isEdit) {
          updateSession(s.id, { subject: draft.subject, topic: draft.topic, durMin: draft.durMin, date: draft.date });
          openSessionEditor(s.id);
        } else { openSessionEditor(null, draft); }
      }
    });
  };

  const dc = document.getElementById('seDateClear');
  if (dc) dc.onclick = () => {
    if (isEdit) updateSession(s.id, { date: null, startMin: null });
    closeModal();
    openSessionEditor(sid, { ...defaults, date: null, startMin: null });
  };

  document.getElementById('seSave').onclick = () => {
    const subject = document.getElementById('seSubject').value;
    const topic = document.getElementById('seTopic').value.trim();
    const durMin = Math.max(15, Math.min(720, parseInt(document.getElementById('seDur').value, 10) || 120));
    let startMin = s.startMin;
    if (window._seStartTp) startMin = window._seStartTp.get();
    if (isEdit) {
      updateSession(s.id, { subject, topic, durMin, startMin });
      toast('ذخیره شد ✓');
    } else {
      addSession({ id: s.id, subject, topic, durMin, date: s.date, startMin, examId: s.examId, done: false });
      toast('بازه اضافه شد ✓');
    }
    closeModal();
    window._seStartTp = null;
    renderPlan();
    renderDashboard();
  };

  if (isEdit) {
    document.getElementById('seDelete').onclick = () => {
      if (!confirm('این بازه حذف شود؟')) return;
      deleteSession(s.id);
      closeModal();
      window._seStartTp = null;
      renderPlan();
      renderDashboard();
      toast('حذف شد');
    };
    const convBtn = document.getElementById('seConvertToActivity');
    if (convBtn) convBtn.onclick = () => {
      if (!confirm('این بازه به فعالیت تبدیل شود؟')) return;
      convertSessionToActivity(s.id);
      closeModal();
      window._seStartTp = null;
      renderPlan();
      renderDashboard();
      toast('به فعالیت تبدیل شد ✓');
    };
  }
}

/* ============ PLAN IMAGE EXPORT ============ */
function openPlanImagePicker() {
  let anchor = jdnFromKey(calSelected);
  let previewToken = 0;
  const render = () => {
    const token = ++previewToken;
    const ws = weekStartJdn(anchor);
    const a = d2j(ws), b = d2j(ws + 6);
    const label = `${fa(a.jd)} ${MONTHS[a.jm - 1]} تا ${fa(b.jd)} ${MONTHS[b.jm - 1]} ${fa(b.jy)}`;
    const weeksLeft = Math.round((KONKUR_JDN - ws) / 7);
    const wl = weeksLeft > 0 ? `هفته ${fa(weeksLeft)} تا کنکور` : (weeksLeft === 0 ? 'هفته کنکور' : `هفته ${fa(Math.abs(weeksLeft))} بعد`);
    const canGoNext = ws < weekStartJdn(TODAY_JDN);
    const isCurrentWeek = ws === weekStartJdn(TODAY_JDN);
    openModal(`
      <div class="modal-head report-modal-head">
        <div class="wr-top-right">
          <div class="wr-logo report-modal-logo">🖼️</div>
          <div class="min-w-0">
            <div class="card-title mb-0">خروجی تصویری برنامه</div>
            <div class="wr-sub">پیشنمایش و دانلود برنامه هفتگی</div>
          </div>
        </div>
        <button class="icon-btn" data-close>✕</button>
      </div>
      <div class="report-nav">
        <button class="rn-btn" id="piPrev" type="button">›</button>
        <div class="rn-label">
          <div>${wl}</div>
          <div class="text-muted fs-11 mt-3">${label}</div>
          ${!isCurrentWeek ? '<button type="button" class="rn-today-btn" id="piToday">برو به هفته جاری</button>' : ''}
        </div>
        <button class="rn-btn" id="piNext" type="button" ${canGoNext ? '' : 'disabled'}>‹</button>
      </div>
      <div class="cwr-preview plan-preview" id="piPreview"><div class="muted report-empty">در حال ساخت پیشنمایش…</div></div>
      <button class="btn primary mt-6" id="piDownload">⬇ دانلود تصویر برنامه هفتگی</button>
      <div class="report-madeby">Made by MH.Mahdipanah</div>
    `);
    modalContent.classList.add('report-modal', 'plan-export-modal');
    document.getElementById('piPrev').onclick = () => { anchor -= 7; render(); };
    const nextBtn = document.getElementById('piNext');
    if (nextBtn) nextBtn.onclick = () => { if (canGoNext) { anchor += 7; render(); } };
    const todayBtn = document.getElementById('piToday');
    if (todayBtn) todayBtn.onclick = () => { anchor = TODAY_JDN; render(); };
    document.getElementById('piDownload').onclick = () => {
      const targetWs = weekStartJdn(anchor);
      closeModal();
      setTimeout(() => downloadPlanWeekImage(targetWs), 120);
    };
    if (typeof generatePlanWeekCanvas === 'function') {
      generatePlanWeekCanvas(ws).then((cv) => {
        if (token !== previewToken || !cv) return;
        const preview = document.getElementById('piPreview');
        if (preview) preview.innerHTML = `<img src="${cv.toDataURL('image/png')}" alt="پیشنمایش تصویر برنامه هفتگی">`;
      }).catch((err) => {
        console.error(err);
        if (token !== previewToken) return;
        const preview = document.getElementById('piPreview');
        if (preview) preview.innerHTML = '<div class="muted report-empty">خطا در ساخت پیشنمایش</div>';
      });
    }
  };
  render();
}

async function generatePlanWeekCanvas(weekStartJdnVal) {
  const ws = weekStartJdnVal;
  const we = ws + 6;
  const wsJ = d2j(ws), weJ = d2j(we);
  const rangeText = `${fa(wsJ.jd)} ${MONTHS[wsJ.jm - 1]} تا ${fa(weJ.jd)} ${MONTHS[weJ.jm - 1]} ${fa(weJ.jy)}`;
  const weeksLeft = Math.round((KONKUR_JDN - ws) / 7);
  const weekLabelTxt = weeksLeft > 0 ? `هفته ${fa(weeksLeft)} تا کنکور` : (weeksLeft === 0 ? 'هفته کنکور' : `هفته ${fa(Math.abs(weeksLeft))} بعد`);
  if (document.fonts && document.fonts.ready) { try { await document.fonts.ready; } catch (e) {} }

  const allSubs = planningSubjects();
  const specSubs = allSubs.filter(s => s.name !== OTHER_SUBJECT && s.type === 'specialized');
  const generalSubs = allSubs.filter(s => s.name !== OTHER_SUBJECT && s.type !== 'specialized');
  const otherSub = allSubs.find(s => s.name === OTHER_SUBJECT);
  const displaySubs = [...specSubs];
  if (generalSubs.length) displaySubs.push({ name: 'عمومی', color: '#a78bfa', isGeneralCombined: true, memberNames: generalSubs.map(s => s.name) });
  if (otherSub) displaySubs.push(otherSub);

  const pad = 44;
  const dayColW = 120;
  const minSubjW = 180;
  const keys = Array.from({ length: 7 }, (_, i) => jKey(d2j(ws + i)));
  const daysData = keys.map(k => displaySubs.map(s => {
    if (s.isGeneralCombined) {
      const all = [];
      s.memberNames.forEach(n => {
        const sess = sessionsOfDay(k).filter(x => x.subject === n);
        all.push(...sess.map(x => ({ subject: n, topic: x.topic, durMin: x.durMin, startMin: x.startMin })));
      });
      return all;
    }
    const sess = sessionsOfDay(k).filter(x => x.subject === s.name);
    return sess.map(x => ({ subject: s.name, topic: x.topic, durMin: x.durMin, startMin: x.startMin }));
  }));

  const nSubj = Math.max(1, displaySubs.length);
  let subjColW = minSubjW;
  let W = pad * 2 + dayColW + nSubj * subjColW;
  const minW = 1200;
  if (W < minW) { subjColW = Math.floor((minW - pad * 2 - dayColW) / nSubj); W = minW; }

  const cv = document.createElement('canvas');
  const cx = cv.getContext('2d');
  const itemFont = '700 14px Vazirmatn, Tahoma, sans-serif';
  const durFont = '800 12px Vazirmatn, Tahoma, sans-serif';
  const lineH = 19, durH = 20, itemPadY = 10, itemGap = 6, cellPadY = 12;
  const itemMaxW = subjColW - 20;
  const maxItems = 5;

  const cellLayouts = daysData.map(daySubj => daySubj.map((items, si) => {
    const disp = displaySubs[si];
    cx.font = itemFont;
    const laid = items.slice(0, maxItems).map(item => {
      let topic = item.topic || 'بدون مبحث';
      if (disp.isGeneralCombined && item.subject) topic = item.subject + ': ' + topic;
      const lines = wrapTextPlan(cx, topic, itemMaxW, 3);
      const h = lines.length * lineH + durH + itemPadY * 2;
      return { lines, durMin: item.durMin, height: h };
    });
    const overflow = Math.max(0, items.length - maxItems);
    const totalH = cellPadY + laid.reduce((s, it) => s + it.height + itemGap, 0) + (overflow > 0 ? 26 : 0) + cellPadY;
    return { items: laid, overflow, height: Math.max(110, totalH) };
  }));
  const rowHeights = cellLayouts.map(day => Math.max(110, ...day.map(l => l.height)));

  const headerH = 78;
  const titleH = 340;
  const footerH = 90;
  const tableH = headerH + rowHeights.reduce((s, h) => s + h, 0);
  const H = titleH + tableH + footerH + pad;

  cv.width = W; cv.height = H;
  const bg = cx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, '#0b1024'); bg.addColorStop(.5, '#101733'); bg.addColorStop(1, '#080d1c');
  cx.fillStyle = bg; cx.fillRect(0, 0, W, H);
  let rg = cx.createRadialGradient(W * .85, 30, 0, W * .85, 30, 900);
  rg.addColorStop(0, 'rgba(124,92,255,.48)'); rg.addColorStop(1, 'rgba(124,92,255,0)');
  cx.fillStyle = rg; cx.fillRect(0, 0, W, H);

  cx.direction = 'rtl';
  cx.textBaseline = 'middle';
  cx.textAlign = 'right';
  const R = W - pad;

  cx.fillStyle = 'rgba(255,255,255,.55)';
  cx.font = '600 26px Vazirmatn, Tahoma, sans-serif';
  cx.fillText('مسیر کنکور • برنامه‌ریزی هفتگی', R, pad + 26);
  cx.fillStyle = '#fff';
  cx.font = '800 54px Vazirmatn, Tahoma, sans-serif';
  cx.fillText(weekLabelTxt, R, pad + 100);
  cx.fillStyle = 'rgba(255,255,255,.62)';
  cx.font = '500 26px Vazirmatn, Tahoma, sans-serif';
  cx.fillText(rangeText, R, pad + 152);
  cx.fillStyle = 'rgba(34,211,238,.85)';
  cx.font = '700 22px Vazirmatn, Tahoma, sans-serif';
  cx.fillText(profileLabel(), R, pad + 198);

  const drawCell = (x, y, w, h, text, opts) => {
    opts = opts || {};
    if (opts.bg) { cx.fillStyle = opts.bg; cx.fillRect(x, y, w, h); }
    cx.strokeStyle = 'rgba(255,255,255,.08)';
    cx.lineWidth = 1;
    cx.strokeRect(x + .5, y + .5, w - 1, h - 1);
    if (text) {
      cx.fillStyle = opts.color || '#e8ecf7';
      cx.font = (opts.bold ? '800 ' : '500 ') + (opts.fontSize || 20) + 'px Vazirmatn, Tahoma, sans-serif';
      cx.textAlign = 'center';
      cx.textBaseline = 'middle';
      cx.fillText(text, x + w / 2, y + h / 2);
    }
  };

  let tblY = titleH;
  drawCell(R - dayColW, tblY, dayColW, headerH, 'روز', { bg: 'rgba(255,255,255,.07)', color: '#cfd6ea', bold: true, fontSize: 22 });
  displaySubs.forEach((s, i) => {
    const x = R - dayColW - (i + 1) * subjColW;
    drawCell(x, tblY, subjColW, headerH, s.name, { bg: s.color + '35', color: s.color, bold: true, fontSize: 20 });
  });
  tblY += headerH;

  keys.forEach((k, di) => {
    const rH = rowHeights[di];
    const kd = jdnFromKey(k);
    const j = parseKey(k);
    const isExam = state.settings.examsEnabled && examForDay(k).length > 0;
    const dayBg = isExam ? 'rgba(234,179,8,.18)' : (k === TODAY_KEY ? 'rgba(34,211,238,.10)' : 'rgba(255,255,255,.045)');
    drawCell(R - dayColW, tblY, dayColW, rH, '', { bg: dayBg });
    cx.textAlign = 'center';
    cx.fillStyle = isExam ? '#fcd34d' : (k === TODAY_KEY ? '#4de2f5' : '#fff');
    cx.font = '800 20px Vazirmatn, Tahoma, sans-serif';
    cx.fillText(DOW[dowIndex(kd)] + (isExam ? ' 📝' : ''), R - dayColW / 2, tblY + rH / 2 - 12);
    cx.fillStyle = 'rgba(255,255,255,.55)';
    cx.font = '500 16px Vazirmatn, Tahoma, sans-serif';
    cx.fillText(`${fa(j.jd)} ${MONTHS[j.jm - 1]}`, R - dayColW / 2, tblY + rH / 2 + 14);
    displaySubs.forEach((s, si) => {
      const x = R - dayColW - (si + 1) * subjColW;
      drawCell(x, tblY, subjColW, rH, '', { bg: isExam ? 'rgba(234,179,8,.05)' : 'rgba(255,255,255,.02)' });
      const cell = cellLayouts[di][si];
      let iy = tblY + cellPadY;
      cx.font = itemFont;
      cell.items.forEach(item => {
        const itemH = item.height;
        const px = x + 8;
        const pw = subjColW - 16;
        rrPlan(cx, px, iy, pw, itemH, 10);
        cx.fillStyle = s.color + '32'; cx.fill();
        cx.strokeStyle = s.color + '75'; cx.lineWidth = 1.5; cx.stroke();
        cx.textAlign = 'center';
        cx.fillStyle = '#fff';
        cx.font = itemFont;
        item.lines.forEach((line, li) => {
          cx.fillText(line, x + subjColW / 2, iy + itemPadY + li * lineH + lineH / 2);
        });
        cx.fillStyle = '#4de2f5';
        cx.font = durFont;
        cx.fillText('⏱ ' + hmString(item.durMin), x + subjColW / 2, iy + itemPadY + item.lines.length * lineH + durH / 2);
        iy += itemH + itemGap;
      });
      if (cell.overflow > 0) {
        cx.textAlign = 'center';
        cx.fillStyle = 'rgba(255,255,255,.5)';
        cx.font = '700 13px Vazirmatn, Tahoma, sans-serif';
        cx.fillText(`+${fa(cell.overflow)} مورد`, x + subjColW / 2, iy + 12);
      }
    });
    tblY += rH;
  });

  cx.textAlign = 'center';
  cx.fillStyle = 'rgba(255,255,255,.32)';
  cx.font = '600 20px Vazirmatn, Tahoma, sans-serif';
  cx.fillText('Made by MH.Mahdipanah', W / 2, H - 50);

  return cv;
}

async function downloadPlanWeekImage(weekStartJdnVal) {
  try {
    const cv = await generatePlanWeekCanvas(weekStartJdnVal);
    if (!cv) { toast('خطا در تولید تصویر'); return; }
    cv.toBlob((blob) => {
      if (!blob) { toast('خطا در تولید تصویر'); return; }
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const j = d2j(weekStartJdnVal);
      a.download = `plan-week-${j.jy}-${pad2(j.jm)}-${pad2(j.jd)}.png`;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
      toast('تصویر دانلود شد ✓');
    }, 'image/png');
  } catch (err) {
    console.error(err);
    toast('خطا در تولید تصویر');
  }
}

/* ============ TEXT WRAP ============ */
function wrapTextPlan(ctx, text, maxWidth, maxLines) {
  text = String(text || '').trim();
  if (!text) return [''];
  const words = text.split(/\s+/);
  const lines = [];
  let current = '';
  for (let w = 0; w < words.length; w++) {
    const word = words[w];
    const test = current ? current + ' ' + word : word;
    if (ctx.measureText(test).width <= maxWidth) { current = test; }
    else {
      if (current) {
        lines.push(current);
        if (lines.length >= maxLines) {
          if (w < words.length) {
            let last = lines[maxLines - 1];
            while (ctx.measureText(last + '…').width > maxWidth && last.length > 1) last = last.slice(0, -1);
            lines[maxLines - 1] = last + '…';
          }
          return lines;
        }
      }
      if (ctx.measureText(word).width > maxWidth) {
        let trunc = word;
        while (ctx.measureText(trunc + '…').width > maxWidth && trunc.length > 1) trunc = trunc.slice(0, -1);
        current = trunc + '…';
      } else { current = word; }
    }
  }
  if (current) lines.push(current);
  return lines.slice(0, maxLines);
}
function wrapText(ctx, text, maxWidth, maxLines) { return wrapTextPlan(ctx, text, maxWidth, maxLines); }

function rrPlan(ctx, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/* ============ LEGACY SHIMS ============ */
function renderPlanCalendar() { try { renderCalendar(); } catch (e) {} }
function renderTimeblock() { try { renderViewContent(); } catch (e) {} }
function renderBlocks() { try { renderViewContent(); } catch (e) {} }
function renderPlanTable() { try { renderViewContent(); } catch (e) {} }
function openPlanActivityInfo(actId) {
  if (typeof window.openActivityInfo === 'function') {
    try { window.openActivityInfo(actId); return; } catch (e) {}
  }
  const a = state.activities.find(x => x.id === actId);
  if (!a) return;
  openModal(`<div class="modal-head"><div class="card-title" style="color:${subjColor(a.subject)}">${esc(displaySubjectName(a.subject, a.topic))}</div><button class="icon-btn" data-close>✕</button></div>
    <div class="muted mb-12">${esc(a.topic || 'بدون مبحث')}</div>
    <div class="row mt-10"><button class="btn ghost" data-close>بستن</button></div>`);
}

/* ============ INIT ============ */
(function initPlanModule() {
  const exams = upcomingExams();
  if (exams.length && !examSelectedId) {
    examSelectedId = exams[0].id;
    loadExamTopics();
    const card = document.getElementById('planTopicSetupCard');
    if (card) card.classList.add('open');
  }
  const planMain = document.getElementById('planMain');
  if (planMain) {
    planMain.addEventListener('pointerdown', (e) => {
      if (!e.target.closest('#tlBody')) return;
      onTimelineSwipeStart(e);
    }, { passive: true });
  }
  syncCompat();
  renderPlan();
})();