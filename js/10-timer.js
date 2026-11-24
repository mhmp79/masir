'use strict';

/* ============================================================
   TIMER + TEST — ابزار مطالعه یکپارچه
   نسخه ۰.۹.۰ — ثبت با تاریخ انتخابی
   ============================================================ */

const TIMER_STATE_KEY = 'timer';

function defaultTimerState(){
  return {
    mode: 'stopwatch',
    isRunning: false,
    startedAt: null,
    accumulated: 0,
    pomWork: 25, pomBreak: 5, pomReps: 4,
    pomPhase: 'work', pomCurrentRep: 1,
    flowStudy: 60, flowBreak: 10,
    flowPhase: 'study',
    flowBreakDuration: 0,
    flowStudyMs: 0
  };
}
function loadTimerState(){
  try{
    const raw = localState.getSync(TIMER_STATE_KEY);
    if(!raw) return null;
    return Object.assign(defaultTimerState(), JSON.parse(raw));
  }catch(e){ return null; }
}
let timerState = loadTimerState() || defaultTimerState();
function saveTimerState(){
  try{ localState.setSync(TIMER_STATE_KEY, JSON.stringify(timerState)); }catch(e){}
  try{ if(typeof window._trackerSaveHook==='function') window._trackerSaveHook(); }catch(e){}
}
function applyImportedTimerState(value){
  if(!value || typeof value !== 'object') return;
  timerState = Object.assign(defaultTimerState(), value);
  saveTimerState();
  try{ updateTimerDisplay(); }catch(e){}
}
/* IndexedDB cache is ready before init(); load the persisted timer without
   overwriting anything the user changed in the meantime. */
function applyHydratedTimerState(){
  if(JSON.stringify(timerState) !== JSON.stringify(defaultTimerState())) return;
  const saved = loadTimerState();
  if(!saved) return;
  timerState = saved;
  try{ updateTimerDisplay(); }catch(e){}
  try{ updateFlowRatioInfo(); }catch(e){}
  ['pomWork','pomBreak','pomReps','flowStudy','flowBreak'].forEach(key=>{
    const el = document.getElementById(key);
    if(el) el.value = timerState[key];
  });
}
window._localStateHydratedHook = applyHydratedTimerState;

function getElapsedMs(){
  let ms = timerState.accumulated || 0;
  if(timerState.isRunning && timerState.startedAt) ms += Date.now() - timerState.startedAt;
  return ms;
}
function getTotalStudyMs(){
  if(timerState.mode === 'stopwatch') return getElapsedMs();
  if(timerState.mode === 'pomodoro'){
    const done = (timerState.pomCurrentRep - 1) * timerState.pomWork * 60000;
    if(timerState.pomPhase === 'work') return done + getElapsedMs();
    if(timerState.pomPhase === 'done') return timerState.pomReps * timerState.pomWork * 60000;
    return done + timerState.pomWork * 60000;
  }
  if(timerState.mode === 'flow'){
    return (timerState.flowStudyMs || 0) + (timerState.flowPhase === 'study' ? getElapsedMs() : 0);
  }
  return 0;
}
function fmtHMS(ms){
  const t = Math.floor(Math.max(0, ms) / 1000);
  return `${pad2(Math.floor(t/3600))}:${pad2(Math.floor((t%3600)/60))}:${pad2(t%60)}`;
}

function timerBeep(){
  try{
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if(!Ctx) return;
    const ctx = new Ctx();
    const play = (freq, delay, dur) => {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.connect(g); g.connect(ctx.destination);
      o.frequency.value = freq;
      g.gain.setValueAtTime(0.07, ctx.currentTime + delay);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay + dur);
      o.start(ctx.currentTime + delay);
      o.stop(ctx.currentTime + delay + dur);
    };
    play(880, 0, 0.14);
    play(1200, 0.18, 0.18);
    setTimeout(() => { try{ ctx.close(); }catch(e){} }, 700);
  }catch(e){}
}

function timerTick(){
  if(!timerState.isRunning){ updateTimerDisplay(); return; }
  const now = Date.now();
  let safety = 0;

  while(timerState.isRunning && safety++ < 40){
    if(timerState.mode === 'pomodoro'){
      const dur = (timerState.pomPhase === 'work' ? timerState.pomWork : timerState.pomBreak) * 60000;
      if(getElapsedMs() < dur) break;
      if(timerState.pomPhase === 'work'){
        if(timerState.pomCurrentRep >= timerState.pomReps){
          timerState.pomPhase = 'done';
          timerState.isRunning = false;
          timerState.accumulated = dur;
          timerState.startedAt = null;
          saveTimerState(); timerBeep();
          try{ toast('🎉 همه دوره‌ها تمام شد'); }catch(e){}
        }else{
          timerState.pomPhase = 'break';
          timerState.accumulated = 0;
          timerState.startedAt = now;
          saveTimerState(); timerBeep();
          try{ toast('☕ وقت استراحت'); }catch(e){}
        }
        break;
      }else{
        timerState.pomPhase = 'work';
        timerState.pomCurrentRep++;
        timerState.accumulated = 0;
        timerState.startedAt = now;
        saveTimerState(); timerBeep();
        try{ toast('📚 وقت مطالعه — دوره ' + fa(timerState.pomCurrentRep)); }catch(e){}
        break;
      }
    }else if(timerState.mode === 'flow' && timerState.flowPhase === 'break'){
      if(getElapsedMs() < timerState.flowBreakDuration) break;
      timerState.flowPhase = 'study';
      timerState.accumulated = 0;
      timerState.startedAt = now;
      saveTimerState(); timerBeep();
      try{ toast('📚 استراحت تمام شد'); }catch(e){}
      break;
    }else{ break; }
  }
  if(timerState.isRunning && safety >= 40){
    timerState.isRunning = false;
    timerState.startedAt = null;
    saveTimerState();
  }
  updateTimerDisplay();
}

function updateTimerDisplay(){
  const disp = document.getElementById('timerDisplay');
  if(!disp) return;
  const phaseEl = document.getElementById('timerPhaseLabel');
  const wrap = document.getElementById('timerProgressWrap');
  const fill = document.getElementById('timerProgressFill');
  const meta = document.getElementById('timerProgressMeta');
  const toggleBtn = document.getElementById('timerToggle');
  const phaseBtn = document.getElementById('timerPhaseAction');

  if(timerState.mode === 'stopwatch'){
    const el = getElapsedMs();
    disp.textContent = fmtHMS(el);
    disp.className = 'timer-display ' + (el > 0 ? 'work' : 'idle');
    phaseEl.textContent = timerState.isRunning ? '⏱ در حال مطالعه' : (el > 0 ? '⏸ متوقف' : 'آماده');
    wrap.classList.add('hidden');
    if(phaseBtn) phaseBtn.classList.add('hidden');
    if(toggleBtn) toggleBtn.textContent = timerState.isRunning ? '⏸ توقف' : (el > 0 ? '▶ ادامه' : '▶ شروع');
    updateUnifiedSaveState();
    return;
  }

  if(timerState.mode === 'pomodoro'){
    if(timerState.pomPhase === 'done'){
      disp.textContent = fmtHMS(0);
      disp.className = 'timer-display idle';
      phaseEl.textContent = '🎉 تمام شد';
      fill.style.width = '100%';
      fill.style.background = 'linear-gradient(90deg,#10b981,#22d3ee)';
      meta.textContent = `${fa(timerState.pomReps)} دوره کامل شد`;
      if(toggleBtn) toggleBtn.textContent = '🔄 شروع مجدد';
      if(phaseBtn) phaseBtn.classList.add('hidden');
      wrap.classList.remove('hidden');
      updateUnifiedSaveState();
      return;
    }
    const dur = (timerState.pomPhase === 'work' ? timerState.pomWork : timerState.pomBreak) * 60000;
    const el = getElapsedMs();
    disp.textContent = fmtHMS(Math.max(0, dur - el));
    disp.className = 'timer-display ' + (timerState.pomPhase === 'work' ? 'work' : 'break');
    const pName = timerState.pomPhase === 'work' ? '📚 مطالعه' : '☕ استراحت';
    phaseEl.textContent = `${pName} — دوره ${fa(timerState.pomCurrentRep)} از ${fa(timerState.pomReps)}`;
    const pct = Math.min(100, (el / dur) * 100);
    fill.style.width = pct + '%';
    fill.style.background = timerState.pomPhase === 'work'
      ? 'linear-gradient(90deg,#7c5cff,#22d3ee)'
      : 'linear-gradient(90deg,#10b981,#34d399)';
    meta.textContent = `${fmtHMS(el)} / ${fmtHMS(dur)}`;
    wrap.classList.remove('hidden');
    if(toggleBtn) toggleBtn.textContent = timerState.isRunning ? '⏸ توقف' : (el > 0 ? '▶ ادامه' : '▶ شروع');
    if(phaseBtn){
      if(timerState.isRunning){ phaseBtn.classList.remove('hidden'); phaseBtn.textContent = '⏭ رد کردن'; }
      else phaseBtn.classList.add('hidden');
    }
    updateUnifiedSaveState();
    return;
  }

  if(timerState.mode === 'flow'){
    const el = getElapsedMs();
    if(timerState.flowPhase === 'study'){
      disp.textContent = fmtHMS(el);
      disp.className = 'timer-display work';
      const earned = Math.floor((el / 60000) * (timerState.flowBreak / timerState.flowStudy));
      phaseEl.textContent = `📚 مطالعه — استراحت کسب‌شده: ${fa(earned)} دقیقه`;
      wrap.classList.add('hidden');
      if(phaseBtn){
        if(timerState.isRunning && earned >= 1){ phaseBtn.classList.remove('hidden'); phaseBtn.textContent = '☕ شروع استراحت'; }
        else phaseBtn.classList.add('hidden');
      }
    }else{
      const rem = Math.max(0, timerState.flowBreakDuration - el);
      disp.textContent = fmtHMS(rem);
      disp.className = 'timer-display break';
      phaseEl.textContent = '☕ استراحت';
      const pct = Math.min(100, (el / timerState.flowBreakDuration) * 100);
      fill.style.width = pct + '%';
      fill.style.background = 'linear-gradient(90deg,#10b981,#34d399)';
      meta.textContent = `${fmtHMS(el)} / ${fmtHMS(timerState.flowBreakDuration)}`;
      wrap.classList.remove('hidden');
      if(phaseBtn){ phaseBtn.classList.remove('hidden'); phaseBtn.textContent = '📚 بازگشت به مطالعه'; }
    }
    if(toggleBtn) toggleBtn.textContent = timerState.isRunning ? '⏸ توقف' : (el > 0 ? '▶ ادامه' : '▶ شروع');
    updateUnifiedSaveState();
  }
}

function updateUnifiedSaveState(){
  const btn = document.getElementById('unifiedSaveBtn');
  const summary = document.getElementById('unifiedSaveSummary');
  if(!btn || !summary) return;

  const studyMs = getTotalStudyMs();
  const minutes = Math.floor(studyMs / 60000);
  const testTotal = (typeof trkCounts !== 'undefined')
    ? (trkCounts.correct + trkCounts.wrong + trkCounts.blank)
    : 0;

  const hasTime = minutes > 0;
  const hasTests = testTotal > 0;

  const timePart = hasTime ? `⏱ ${hmString(minutes)}` : `⏱ بدون زمان`;
  const testPart = hasTests ? `📝 ${fa(testTotal)} تست` : `📝 تست نزدم`;

  summary.textContent = `${timePart}   •   ${testPart}`;

  btn.disabled = !(hasTime || hasTests);
}
window.updateUnifiedSaveState = updateUnifiedSaveState;

function timerToggle(){
  if(timerState.isRunning){
    timerState.accumulated = getElapsedMs();
    timerState.startedAt = null;
    timerState.isRunning = false;
  }else{
    if(timerState.mode === 'pomodoro' && timerState.pomPhase === 'done'){
      timerReset(true);
    }
    timerState.startedAt = Date.now();
    timerState.isRunning = true;
  }
  saveTimerState();
  updateTimerDisplay();
}

function timerReset(silent){
  const keep = {
    mode: timerState.mode,
    pomWork: timerState.pomWork, pomBreak: timerState.pomBreak, pomReps: timerState.pomReps,
    flowStudy: timerState.flowStudy, flowBreak: timerState.flowBreak
  };
  timerState = Object.assign(defaultTimerState(), keep);
  saveTimerState();
  updateTimerDisplay();
  if(!silent){ try{ toast('ریست شد'); }catch(e){} }
}

function timerSkipPhase(){
  if(timerState.mode !== 'pomodoro' || !timerState.isRunning) return;
  if(timerState.pomPhase === 'work'){
    timerState.accumulated = timerState.pomWork * 60000;
    timerState.startedAt = Date.now();
    timerTick();
  }else if(timerState.pomPhase === 'break'){
    timerState.accumulated = timerState.pomBreak * 60000;
    timerState.startedAt = Date.now();
    timerTick();
  }
}

function flowStartBreak(){
  const el = getElapsedMs();
  if(el < 60000){ try{ toast('حداقل یک دقیقه مطالعه لازم است'); }catch(e){} return; }
  timerState.flowStudyMs = (timerState.flowStudyMs || 0) + el;
  const earnedMs = el * (timerState.flowBreak / timerState.flowStudy);
  timerState.flowBreakDuration = Math.min(
    timerState.flowBreak * 60000,
    Math.max(60000, earnedMs)
  );
  timerState.flowPhase = 'break';
  timerState.accumulated = 0;
  timerState.startedAt = Date.now();
  timerState.isRunning = true;
  saveTimerState();
  timerBeep();
  updateTimerDisplay();
}

function flowBackToStudy(){
  timerState.flowPhase = 'study';
  timerState.accumulated = 0;
  timerState.startedAt = Date.now();
  timerState.isRunning = true;
  saveTimerState();
  updateTimerDisplay();
}

/* ⭐ openUnifiedSaveModal — با تاریخ انتخابی */
function openUnifiedSaveModal(){
  try{
    const studyMs = getTotalStudyMs();
    const minutes = Math.floor(studyMs / 60000);
    const testTotal = (typeof trkCounts !== 'undefined')
      ? (trkCounts.correct + trkCounts.wrong + trkCounts.blank)
      : 0;

    if(minutes === 0 && testTotal === 0){
      try{ toast('چیزی برای ثبت نیست'); }catch(e){}
      return;
    }

    let allSubjects;
    try{
      allSubjects = (typeof allSubjectsForSelect === 'function')
        ? allSubjectsForSelect()
        : (state && Array.isArray(state.subjects) ? state.subjects : []);
    }catch(e){
      allSubjects = (state && Array.isArray(state.subjects)) ? state.subjects : [];
    }

    let subjOpts = '';
    try{
      subjOpts = (typeof subjectSelectOptions === 'function')
        ? subjectSelectOptions(allSubjects)
        : allSubjects.map(s => `<option value="${esc(s.name)}">${esc(s.name)}</option>`).join('');
    }catch(e){
      subjOpts = allSubjects.map(s => `<option value="${esc(s.name)}">${esc(s.name)}</option>`).join('');
    }

    if(!subjOpts){ try{ toast('درسی تعریف نشده'); }catch(e){} return; }

    const now = new Date();
    const endMin = Math.min(1440, now.getHours() * 60 + now.getMinutes());
    const crossesMidnight = minutes > endMin;
    const startMinFromTimer = minutes > 0
      ? (crossesMidnight ? 1440 + endMin - minutes : endMin - minutes)
      : Math.max(0, endMin - 30);

    // Use the current local date, which may differ from the date when the app was opened.
    const gToday = {gy: now.getFullYear(), gm: now.getMonth() + 1, gd: now.getDate()};
    const todayDateVal = `${gToday.gy}-${pad2(gToday.gm)}-${pad2(gToday.gd)}`;

    openModal(`
      <div class="modal-head">
        <div class="card-title">💾 ثبت فعالیت</div>
        <button class="icon-btn" data-close>✕</button>
      </div>

      <label class="lbl mt-0">📅 تاریخ</label>
      <input class="input" type="date" id="umDate" value="${todayDateVal}">

      <label class="lbl">درس</label>
      <select class="input" id="umSubj">${subjOpts}</select>

      <label class="lbl">مبحث</label>
      <input class="input" id="umTopic" placeholder="مبحث (اختیاری)">

      <div class="unified-modal-section">
        <div class="unified-modal-section-title">⏱ زمان</div>
        <div class="grid2">
          <div><label class="lbl mt-0">شروع</label><div id="umStartWrap" class="time-pair"></div></div>
          <div><label class="lbl mt-0">پایان</label><div id="umEndWrap" class="time-pair"></div></div>
        </div>
        <div class="muted mt-8 fs-10h text-center" id="umTimeHint"></div>
      </div>

      <div class="unified-modal-section" id="umTestSection">
        <div class="unified-modal-section-title">📝 تست</div>
        <div class="toggle-card mb-8" id="umTestCard">
          <div>
            <div class="fw-700 fs-13">تست زدم</div>
            <div class="fs-10 text-muted mt-2">اگر تست زدی، فعالش کن</div>
          </div>
          <label class="switch"><input type="checkbox" id="umHasTest"><span></span></label>
        </div>
        <div id="umTestFields" class="hidden">
          <div class="grid3">
            <input dir="ltr" inputmode="numeric" class="input num-input" id="umCorrect" type="text" placeholder="درست" min="0">
            <input dir="ltr" inputmode="numeric" class="input num-input" id="umWrong" type="text" placeholder="غلط" min="0">
            <input dir="ltr" inputmode="numeric" class="input num-input" id="umBlank" type="text" placeholder="نزده" min="0">
          </div>
          <div id="umTestPct" class="text-center mt-10 fs-12">درصد: <b class="text-aqua fs-16">۰٪</b></div>
        </div>
      </div>

      <div class="row mt-16">
        <button class="btn ghost" data-close>انصراف</button>
        <button class="btn primary" id="umSave">✓ ثبت</button>
      </div>
    `);

    const startTp = mountTimePair('umStart', document.getElementById('umStartWrap'), {value: startMinFromTimer});
    const endTp = mountTimePair('umEnd', document.getElementById('umEndWrap'), {value: endMin});

    const hint = document.getElementById('umTimeHint');
    if(minutes > 0){
      hint.innerHTML = `⏱ پیش‌فرض از تایمر: <b class="text-cyan">${hmString(minutes)}</b> — قابل ویرایش • عبور از نیمه‌شب در دو روز جدا ثبت می‌شود`;
      hint.style.color = '';
    }else{
      hint.innerHTML = `⚠️ تایمری ثبت نشده — زمان را دستی وارد کن`;
      hint.style.color = '#fcd34d';
    }

    const subjEl = document.getElementById('umSubj');
    const hasTestToggle = document.getElementById('umHasTest');
    const testFields = document.getElementById('umTestFields');
    const testCard = document.getElementById('umTestCard');
    const testSection = document.getElementById('umTestSection');
    const correctEl = document.getElementById('umCorrect');
    const wrongEl = document.getElementById('umWrong');
    const blankEl = document.getElementById('umBlank');
    const dateEl = document.getElementById('umDate');

    const updateTestVisibility = () => {
      let canTest = true;
      try{
        canTest = (typeof subjectCanHaveTests === 'function')
          ? subjectCanHaveTests(subjEl.value)
          : true;
      }catch(e){ canTest = true; }
      testSection.style.display = canTest ? '' : 'none';
      if(!canTest){
        hasTestToggle.checked = false;
        testFields.classList.add('hidden');
        testCard.classList.remove('on');
      }
    };

    const initialHasTest = testTotal > 0;
    hasTestToggle.checked = initialHasTest;
    testCard.classList.toggle('on', initialHasTest);
    testFields.classList.toggle('hidden', !initialHasTest);

    if(initialHasTest){
      correctEl.value = trkCounts.correct || '';
      wrongEl.value = trkCounts.wrong || '';
      blankEl.value = trkCounts.blank || '';
    }

    const updatePct = () => {
      const c = +correctEl.value || 0;
      const w = +wrongEl.value || 0;
      const b = +blankEl.value || 0;
      const t = c + w + b;
      const pct = t ? Math.max(0, Math.round((3*c - w) / (3*t) * 100)) : 0;
      document.getElementById('umTestPct').innerHTML = `درصد: <b class="text-aqua fs-16">${fa(pct)}٪</b> <span class="text-muted fs-10h">(${fa(t)} تست)</span>`;
    };
    updatePct();
    [correctEl, wrongEl, blankEl].forEach(el => {
      el.addEventListener('input', updatePct);
    });

    hasTestToggle.addEventListener('change', () => {
      testFields.classList.toggle('hidden', !hasTestToggle.checked);
      testCard.classList.toggle('on', hasTestToggle.checked);
    });

    subjEl.addEventListener('change', updateTestVisibility);
    updateTestVisibility();

    document.getElementById('umSave').onclick = () => {
      const s = startTp.get();
      const e = endTp.get();
      if(s == null || e == null || e === s){
        try{ toast('زمان معتبر نیست'); }catch(ex){}
        return;
      }

      const saveNow = new Date();
      const currentDateKey = jKey(d2j(g2d(saveNow.getFullYear(), saveNow.getMonth() + 1, saveNow.getDate())));
      const dateKey = dateEl.value ? gDateInputToKey(dateEl.value) : currentDateKey;

      const subj = subjEl.value;
      const topic = document.getElementById('umTopic').value.trim();

      let canTest = true;
      try{
        canTest = (typeof subjectCanHaveTests === 'function')
          ? subjectCanHaveTests(subj)
          : true;
      }catch(ex){ canTest = true; }

      let tests = null;
      if(canTest && hasTestToggle.checked){
        const c = +correctEl.value || 0;
        const w = +wrongEl.value || 0;
        const b = +blankEl.value || 0;
        if(c + w + b > 0){
          tests = { correct: c, wrong: w, blank: b };
        }
      }

      const ts = Date.now();
      const activityParts = e > s
        ? [{date: dateKey, startMin: s, endMin: e}]
        : [
            {date: dateKeyOffset(dateKey, -1), startMin: s, endMin: 1440},
            ...(e > 0 ? [{date: dateKey, startMin: 0, endMin: e}] : [])
          ].filter(part => part.endMin > part.startMin);
      if(activityParts.length > 1) activityExpanded = true;
      activityParts.forEach((part, index) => {
        state.activities.push({
          id: uid(),
          date: part.date,
          subject: subj,
          topic,
          startMin: part.startMin,
          endMin: part.endMin,
          minutes: part.endMin - part.startMin,
          tests: index === activityParts.length - 1 ? tests : null,
          ts
        });
      });

      timerReset(true);

      if(tests !== null && typeof trkCounts !== 'undefined'){
        trkCounts = {correct: 0, wrong: 0, blank: 0};
        try{ saveTracker(); }catch(ex){}
        try{ renderTracker(); }catch(ex){}
      }

      save();
      closeModal();
      updateUnifiedSaveState();
      try{ renderDashboard(); renderActivityList(); renderPlanCalendar(); }catch(ex){}
      try{ toast('✓ ثبت شد'); }catch(ex){}
    };
  }catch(err){
    console.error('[timer] openUnifiedSaveModal error:', err);
    try{ toast('خطا: ' + (err.message || 'نامشخص')); }catch(e){}
  }
}

function updateFlowRatioInfo(){
  const el = document.getElementById('flowRatioInfo');
  if(!el) return;
  el.innerHTML = `با هر <b class="text-cyan">${fa(timerState.flowStudy)} دقیقه</b> مطالعه → <b class="text-ok">${fa(timerState.flowBreak)} دقیقه</b> استراحت`;
}

function setTimerMode(mode){
  if(timerState.isRunning && mode !== timerState.mode){
    if(!confirm('تایمر در حال اجراست. با تغییر حالت ریست می‌شود. ادامه؟')) return false;
  }
  timerState.mode = mode;
  timerReset(true);
  document.querySelectorAll('[data-tmode]').forEach(b => b.classList.toggle('active', b.dataset.tmode === mode));
  const pomSet = document.getElementById('timerPomodoroSettings');
  const flowSet = document.getElementById('timerFlowSettings');
  if(pomSet) pomSet.classList.toggle('hidden', mode !== 'pomodoro');
  if(flowSet) flowSet.classList.toggle('hidden', mode !== 'flow');
  updateFlowRatioInfo();
  updateTimerDisplay();
  saveTimerState();
  return true;
}

function bindTimerUI(){
  document.querySelectorAll('[data-tmode]').forEach(btn => {
    btn.onclick = () => setTimerMode(btn.dataset.tmode);
  });

  const toggleBtn = document.getElementById('timerToggle');
  if(toggleBtn) toggleBtn.onclick = timerToggle;

  const resetBtn = document.getElementById('timerReset');
  if(resetBtn) resetBtn.onclick = () => {
    if(timerState.isRunning && !confirm('تایمر در حال اجراست. ریست شود؟')) return;
    timerReset();
  };

  const phaseBtn = document.getElementById('timerPhaseAction');
  if(phaseBtn) phaseBtn.onclick = () => {
    if(timerState.mode === 'pomodoro') timerSkipPhase();
    else if(timerState.mode === 'flow'){
      if(timerState.flowPhase === 'study') flowStartBreak();
      else flowBackToStudy();
    }
  };

  const saveBtn = document.getElementById('unifiedSaveBtn');
  if(saveBtn) saveBtn.onclick = openUnifiedSaveModal;

  const pomWorkEl = document.getElementById('pomWork');
  const pomBreakEl = document.getElementById('pomBreak');
  const pomRepsEl = document.getElementById('pomReps');
  if(pomWorkEl) pomWorkEl.onchange = () => {
    const v = Math.max(1, Math.min(180, +pomWorkEl.value || 25));
    pomWorkEl.value = v;
    if(timerState.pomWork !== v){ timerState.pomWork = v; saveTimerState(); if(!timerState.isRunning) updateTimerDisplay(); }
  };
  if(pomBreakEl) pomBreakEl.onchange = () => {
    const v = Math.max(1, Math.min(60, +pomBreakEl.value || 5));
    pomBreakEl.value = v;
    if(timerState.pomBreak !== v){ timerState.pomBreak = v; saveTimerState(); if(!timerState.isRunning) updateTimerDisplay(); }
  };
  if(pomRepsEl) pomRepsEl.onchange = () => {
    const v = Math.max(1, Math.min(12, +pomRepsEl.value || 4));
    pomRepsEl.value = v;
    if(timerState.pomReps !== v){ timerState.pomReps = v; saveTimerState(); if(!timerState.isRunning) updateTimerDisplay(); }
  };

  const flowStudyEl = document.getElementById('flowStudy');
  const flowBreakEl = document.getElementById('flowBreak');
  if(flowStudyEl) flowStudyEl.onchange = () => {
    const v = Math.max(5, Math.min(180, +flowStudyEl.value || 60));
    flowStudyEl.value = v;
    if(timerState.flowStudy !== v){ timerState.flowStudy = v; saveTimerState(); updateFlowRatioInfo(); if(!timerState.isRunning) updateTimerDisplay(); }
  };
  if(flowBreakEl) flowBreakEl.onchange = () => {
    const v = Math.max(1, Math.min(60, +flowBreakEl.value || 10));
    flowBreakEl.value = v;
    if(timerState.flowBreak !== v){ timerState.flowBreak = v; saveTimerState(); updateFlowRatioInfo(); if(!timerState.isRunning) updateTimerDisplay(); }
  };

  document.querySelectorAll('[data-tmode]').forEach(b => b.classList.toggle('active', b.dataset.tmode === timerState.mode));
  if(pomWorkEl) pomWorkEl.value = timerState.pomWork;
  if(pomBreakEl) pomBreakEl.value = timerState.pomBreak;
  if(pomRepsEl) pomRepsEl.value = timerState.pomReps;
  if(flowStudyEl) flowStudyEl.value = timerState.flowStudy;
  if(flowBreakEl) flowBreakEl.value = timerState.flowBreak;
  const pomSet = document.getElementById('timerPomodoroSettings');
  const flowSet = document.getElementById('timerFlowSettings');
  if(pomSet) pomSet.classList.toggle('hidden', timerState.mode !== 'pomodoro');
  if(flowSet) flowSet.classList.toggle('hidden', timerState.mode !== 'flow');
  updateFlowRatioInfo();
  updateTimerDisplay();
  updateUnifiedSaveState();
}

let _timerInterval = null;
function startTimerLoop(){
  if(_timerInterval) return;
  _timerInterval = setInterval(() => {
    if(!document.getElementById('timerDisplay')) return;
    if(timerState.isRunning) timerTick();
  }, 300);
}

document.addEventListener('visibilitychange', () => {
  if(!document.hidden && timerState.isRunning) timerTick();
});
window.addEventListener('focus', () => {
  if(timerState.isRunning) timerTick();
});
window.addEventListener('pageshow', () => {
  if(timerState.isRunning) timerTick();
});

function initTimer(){
  bindTimerUI();
  startTimerLoop();
  timerTick();
  try{ if(typeof renderTracker === 'function') renderTracker(); }catch(e){}
}
if(document.readyState === 'loading'){
  document.addEventListener('DOMContentLoaded', initTimer);
} else {
  setTimeout(initTimer, 60);
}