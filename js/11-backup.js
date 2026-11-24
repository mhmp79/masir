'use strict';

/* ============================================================
   BACKUP — Schema 11 با پشتیبانی از state.sessions
   نسخه ۱.۰.۰
   ============================================================ */

const BACKUP_SCHEMA = 11;
const BACKUP_APP = 'konkur-unified';
const BUILTIN_SUBJECT_BACKUP_FIELDS = [
  'color','defaultQ','sessions','errors','specialTags',
  'lessonRecords','topicRecords','lessonSections'
];

function isBuiltinBackupSubject(subject){
  return !!subject&&DEFAULT_SUBJECTS.some(item=>
    item.name===subject.name&&item.type===subject.type
  );
}

function pickBuiltinSubjectState(subject){
  const result={};
  BUILTIN_SUBJECT_BACKUP_FIELDS.forEach(key=>{
    if(subject[key]!==undefined)result[key]=cloneStorageValue(subject[key]);
  });
  return result;
}

function buildBackupPayload(){
  const customSubjects=state.subjects.filter(subject=>!isBuiltinBackupSubject(subject));
  const builtinSubjectState={};
  state.subjects.filter(isBuiltinBackupSubject).forEach(subject=>{
    builtinSubjectState[subject.name]=pickBuiltinSubjectState(subject);
  });
  return {
    app: BACKUP_APP,
    schema: BACKUP_SCHEMA,
    version: APP_VERSION,
    exportedAt: new Date().toISOString(),
    summary: {
      subjects: customSubjects.length,
      activities: state.activities.length,
      exams: state.exams.length,
      sessions: (state.sessions || []).length,
      sleeps: state.sleeps.length,
      phones: state.phones.length,
      commonErrors: state.commonErrors.length
    },
    data: {
      ...state,
      profile: undefined,
      subjects: customSubjects.map(subject=>
        withoutStaticSubjectCurriculum(subject,state.profile.field)
      ),
      builtinSubjectState
    },
    tracker: {
      counts: { ...trkCounts },
      coef: trkCoef
    },
    timer: readLocalTimer()
  };
}

function readLocalTimer(){
  try{
    const raw=localState.getSync('timer');
    return raw?JSON.parse(raw):null;
  }catch(e){ return null; }
}

function validateBackup(parsed){
  if(!parsed || typeof parsed !== 'object' || Array.isArray(parsed)){
    throw new Error('فایل JSON معتبر نیست — فایل معتبر نیست');
  }
  if(parsed.app !== BACKUP_APP){
    throw new Error('این فایل مربوط به این برنامه نیست');
  }
  if(parsed.schema != null && +parsed.schema > BACKUP_SCHEMA){
    throw new Error('این فایل از نسخه جدیدتر برنامه است — برنامه را به‌روزرسانی کن');
  }
  const data = parsed.data;
  if(!data || typeof data !== 'object'){
    throw new Error('ساختار داده در فایل وجود ندارد');
  }
  if(!Array.isArray(data.subjects)){
    throw new Error('فیلد «subjects» در فایل وجود ندارد یا مقدار اشتباه دارد');
  }
  const schema=parsed.schema!=null?+parsed.schema:0;
  if(schema<10 && !data.subjects.length){
    throw new Error('لیست دروس در فایل خالی است — لطفاً فایل را از نسخه جدیدتر این برنامه ساخته‌شده ضمایم');
  }
  if(schema>=11 && data.sessions!=null && !Array.isArray(data.sessions)){
    throw new Error('فیلد «sessions» در فایل اشتباه است');
  }
  const checks = [];
  // Profile no longer required in manual/legacy backup.
  if(!Array.isArray(data.exams)){
    checks.push('فیلد «exams» باید آرایه باشد');
  }
  if(!Array.isArray(data.activities)){
    checks.push('فیلد «activities» باید آرایه باشد');
  }
  if(checks.length){
    throw new Error('ساختار داده ناقص: ' + checks.join(' و '));
  }
  return {
    data,
    tracker: parsed.tracker || null,
    timer: parsed.timer || null,
    summary: parsed.summary || null,
    schema
  };
}

function normalizeImportedData(data,schema=0){
  const def = defaultState();
  const profile = normalizeProfile(data.profile);
  let importedSubjects;
  if(schema>=10){
    const savedBuiltinState=data.builtinSubjectState&&typeof data.builtinSubjectState==='object'
      ?data.builtinSubjectState:{};
    importedSubjects=def.subjects.map(subject=>{
      const saved=savedBuiltinState[subject.name];
      if(!saved||typeof saved!=='object')return subject;
      const merged={...subject};
      BUILTIN_SUBJECT_BACKUP_FIELDS.forEach(key=>{
        if(Object.prototype.hasOwnProperty.call(saved,key))merged[key]=saved[key];
      });
      return normalizeSubject(merged);
    });
    importedSubjects.push(...data.subjects
      .filter(subject=>!isBuiltinBackupSubject(subject))
      .map(normalizeSubject));
  }else{
    importedSubjects=data.subjects.map(normalizeSubject);
  }
  const subjects = restoreFieldManagedCurriculum(
    importedSubjects,profile.field,profile.grade
  );

  const activities = Array.isArray(data.activities)
    ? data.activities.map(a => {
        const startMin = +a.startMin || 0;
        const endMin = +a.endMin || 0;
        let tests = null;
        if(a.tests && typeof a.tests === 'object'){
          tests = {
            correct: Math.max(0, +a.tests.correct || 0),
            wrong: Math.max(0, +a.tests.wrong || 0),
            blank: Math.max(0, +a.tests.blank || 0)
          };
        }
        return {
          id: String(a.id || uid()),
          date: String(a.date || TODAY_KEY),
          subject: String(a.subject || ''),
          topic: String(a.topic || ''),
          startMin, endMin,
          minutes: +a.minutes || Math.max(0, endMin - startMin),
          tests,
          ts: +a.ts || Date.now()
        };
      })
    : [];

  /* ===== SESSIONS ===== */
  let sessions;
  if (schema >= 11) {
    sessions = normalizeSessions(Array.isArray(data.sessions) ? data.sessions : []);
  } else {
    // migrate legacy plan/reserved (schema < 11)
    sessions = migrateLegacyStateToSessions(data.plan, data.reserved);
  }

  const classes = {};
  if(data.classes && typeof data.classes === 'object'){
    Object.keys(data.classes).forEach(name => {
      const c = data.classes[name];
      if(!c || typeof c !== 'object') return;
      classes[name] = {
        total: +c.total || 0,
        sessions: (c.sessions && typeof c.sessions === 'object') ? c.sessions : {}
      };
    });
  }

  const sleeps = Array.isArray(data.sleeps)
    ? data.sleeps.map(s => ({
        id: String(s.id || uid()),
        date: String(s.date || TODAY_KEY),
        endDate: String(s.endDate || s.date || TODAY_KEY),
        startMin: +s.startMin || 0,
        endMin: +s.endMin || 0,
        minutes: +s.minutes || 0,
        nap: !!s.nap,
        ts: +s.ts || Date.now()
      }))
    : [];

  const phones = Array.isArray(data.phones)
    ? data.phones.map(p => ({
        id: String(p.id || uid()),
        date: String(p.date || TODAY_KEY),
        minutes: +p.minutes || 0,
        ts: +p.ts || Date.now()
      }))
    : [];

  const exams = Array.isArray(data.exams)
    ? data.exams.map(normalizeExam).filter(Boolean)
    : [];

  const commonErrors = (Array.isArray(data.commonErrors) && data.commonErrors.length)
    ? data.commonErrors.map(e => ({
        id: String(e.id || uid()),
        label: String(e.label || ''),
        hasSub: !!e.hasSub,
        subType: e.subType || null,
        subOptions: Array.isArray(e.subOptions)
          ? e.subOptions.map(o => ({ id: String(o.id || uid()), label: String(o.label || '') }))
          : []
      }))
    : def.commonErrors;

  const settings = Object.assign({}, def.settings, data.settings || {});
  return { profile, subjects, commonErrors, activities, sessions, classes, sleeps, phones, exams, settings };
}

function exportBackup(){
  try{
    const payload = buildBackupPayload();
    const json = JSON.stringify(payload, null, 2);
    const blob = new Blob([json], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const d = new Date();
    const stamp = `${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}-${pad2(d.getHours())}${pad2(d.getMinutes())}`;
    const a = document.createElement('a');
    a.href = url;
    a.download = `konkur-backup-${stamp}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
    toast('✅ پشتیبان دانلود شد');
  }catch(err){
    console.error('[backup] export failed:', err);
    toast('❌ خطا در ساخت پشتیبان');
  }
}

function showImportPreview(summary, parsed, schema, mode){
  return new Promise((resolve) => {
    const s = summary || {};
    const exportedAt = parsed && parsed.exportedAt
      ? new Date(parsed.exportedAt).toLocaleString('fa-IR')
      : '—';
    const isOldSchema = schema > 0 && schema < BACKUP_SCHEMA;
    const oldSchemaNote = isOldSchema
      ? `<div class="backup-schema-warn">⚠️ این پشتیبان از نسخه قدیمی (Schema ${fa(schema)}) است — به‌طور خودکار به نسخه جدید مهاجرت می‌شود.</div>`
      : '';
    const isServer = mode === 'legacy-server';
    let sessionRow = '';
    if (s.sessions != null) {
      sessionRow = `<div class="setting-row"><div class="sr-label">📋 بازه‌های برنامه</div><div class="sr-control text-cyan fw-800">${fa(s.sessions || 0)}</div></div>`;
    } else if (s.planDays != null || s.reserved != null) {
      const legacyTotal = (s.planDays || 0) + (s.reserved || 0);
      sessionRow = `<div class="setting-row"><div class="sr-label">📋 بازه‌ها (legacy)</div><div class="sr-control text-amber fw-800">${fa(legacyTotal)}</div></div>`;
    }
    openModal(`
      <div class="modal-head">
        <div class="card-title text-ok">📦 پیش‌نمایش پشتیبان</div>
        <button class="icon-btn" data-close>✕</button>
      </div>
      <div class="muted mb-14 fs-11h lh-185">
        تاریخ ساخت فایل: <b class="text-soft">${esc(exportedAt)}</b><br>
        ${isServer
          ? 'با تأیید، داده‌های این بکاپ <b class="text-rose">به‌صورت کامل جایگزین اطلاعات حساب سرور و این دستگاه می‌شوند</b>. پروفایل حساب حفظ می‌شود.'
          : 'با تأیید، داده‌های این بکاپ <b class="text-rose">روی این دستگاه جایگزین می‌شوند</b>.'}
      </div>
      ${oldSchemaNote}
      <div class="setting-row"><div class="sr-label">📚 ${schema>=10?'دروس افزوده‌شده':'دروس'}</div><div class="sr-control text-cyan fw-800">${fa(s.subjects || 0)}</div></div>
      <div class="setting-row"><div class="sr-label">📝 فعالیت‌ها</div><div class="sr-control text-cyan fw-800">${fa(s.activities || 0)}</div></div>
      <div class="setting-row"><div class="sr-label">📊 آزمون‌ها</div><div class="sr-control text-cyan fw-800">${fa(s.exams || 0)}</div></div>
      ${sessionRow}
      <div class="setting-row"><div class="sr-label">🌙 خواب</div><div class="sr-control text-cyan fw-800">${fa(s.sleeps || 0)}</div></div>
      <div class="setting-row"><div class="sr-label">📱 گوشی</div><div class="sr-control text-cyan fw-800">${fa(s.phones || 0)}</div></div>
      <div class="setting-row"><div class="sr-label">🏷️ تگ‌های عمومی</div><div class="sr-control text-cyan fw-800">${fa(s.commonErrors || 0)}</div></div>
      <div class="row mt-16">
        <button class="btn ghost" id="ipCancel">انصراف</button>
        <button class="btn danger" id="ipConfirm">${isServer ? '🔄 جایگزینی سرور و دستگاه' : '📥 وارد کردن روی دستگاه'}</button>
      </div>
    `);
    document.getElementById('ipCancel').onclick = () => { closeModal(); resolve(false); };
    document.getElementById('ipConfirm').onclick = () => { closeModal(); resolve(true); };
  });
}

async function importBackup(file, options){
  const opts = options || {};
  const mode = opts.mode || 'legacy-server'; // 'legacy-server' | 'local'
  const client = window.sqlSync || window.masirSqlSync || null;
  const loggedIn = !!(client && typeof client.isLoggedIn === 'function' && client.isLoggedIn());
  const online = typeof navigator !== 'undefined' ? navigator.onLine !== false : true;
  if(mode === 'legacy-server'){
    if(!loggedIn){ toast('برای وارد کردن بکاپ قدیمی به سرور ابتدا وارد حساب شوید.'); return false; }
    if(!online){ toast('برای وارد کردن بکاپ قدیمی به سرور باید آنلاین باشید.'); return false; }
  }
  try{
    const text = await file.text();
    let parsed;
    try{ parsed = JSON.parse(text); }
    catch(e){ throw new Error('فایل JSON معتبر نیست'); }

    const { data, tracker, timer, summary, schema } = validateBackup(parsed);
    const confirmed = await showImportPreview(summary, parsed, schema, mode);
    if(!confirmed) return false;

    const normalized = normalizeImportedData(data,schema);
    normalized.subjects.forEach(s => {
      if(!normalized.classes[s.name]){
        normalized.classes[s.name] = { total: s.sessions || 0, sessions: {} };
      } else if(!normalized.classes[s.name].total){
        normalized.classes[s.name].total = s.sessions || 0;
      }
    });

    replaceTrackedState(normalized, true);
    if(tracker && tracker.counts && typeof tracker.counts === 'object'){
      trkCounts = {
        correct: Math.max(0, +tracker.counts.correct || 0),
        wrong: Math.max(0, +tracker.counts.wrong || 0),
        blank: Math.max(0, +tracker.counts.blank || 0)
      };
      trkCoef = (typeof TRK_COEF !== 'undefined' ? TRK_COEF : 1 / 3);
      try { saveTracker(); } catch(_) {}
    }
    if(timer && typeof applyImportedTimerState === 'function'){
      try { applyImportedTimerState(timer); } catch(e) { console.warn('[backup] timer import failed:', e); }
    }

    save();
    await flushStorage();

    if(mode === 'legacy-server' && loggedIn){
      await client.deleteAccountData();
      try{
        const uid = client.getLoggedInUserId ? client.getLoggedInUserId() : '';
        if(uid) localStorage.removeItem(`konkur-sql-sync-meta-v1::${uid}`);
      }catch(_){ }
      const up = await client.uploadAllData();
      if(!up || up.ok === false){
        throw new Error((up && up.error) || 'جایگزینی اطلاعات روی سرور ناموفق بود');
      }
      toast('✅ بکاپ وارد و روی سرور جایگزین شد');
    } else {
      toast('✅ بکاپ روی این دستگاه وارد شد');
    }
    setTimeout(() => location.reload(), 800);
    return true;
  }catch(err){
    console.error('[backup] import failed:', err);
    toast('❌ ' + (err.message || 'خطا در وارد کردن بکاپ'));
    return false;
  }
}

async function clearAllData(){
  const client = window.sqlSync || window.masirSqlSync || null;
  const loggedIn = !!(client && typeof client.isLoggedIn === 'function' && client.isLoggedIn());
  const online = typeof navigator !== 'undefined' ? navigator.onLine !== false : true;
  if(loggedIn && !online){
    toast('برای پاک کردن کامل سرور و دستگاه باید آنلاین باشید.');
    return;
  }
  const message = loggedIn
    ? 'دادههای حساب روی سرور و تمام اطلاعات این دستگاه پاک میشود. این عملیات قابل بازگشت نیست؛ ادامه میدهید؟'
    : 'تمام اطلاعات این دستگاه پاک میشود. ادامه میدهید؟';
  if(!confirm(message)) return;
  if(loggedIn){
    try{
      if(typeof client.deleteAccountData !== 'function') throw new Error('امکان حذف دادهها از سرور در دسترس نیست.');
      await client.deleteAccountData();
    }catch(error){
      console.error('[backup] server data delete failed:',error);
      toast('❌ حذف دادهها از سرور ناموفق بود؛ دادههای دستگاه پاک نشد.');
      return;
    }
  }
  replaceTrackedState(defaultState(), true);
  trkCounts = { correct: 0, wrong: 0, blank: 0 };
  trkCoef = (typeof TRK_COEF !== 'undefined' ? TRK_COEF : 1 / 3);
  if(typeof timerState !== 'undefined' && typeof defaultTimerState === 'function'){
    timerState = defaultTimerState();
    try{ updateTimerDisplay(); }catch(_){}
  }
  try{ localStorage.removeItem(LS_KEY); }catch(_){}
  try{
    localState.setSync('tracker',null);
    localState.setSync('timer',null);
  }catch(error){ console.warn('[backup] clearing local state failed:',error); }
  save();
  try{
    await flushStorage();
    /* clear legacy stores to prevent re-migration on reload */
    if (storageMode === 'indexeddb' && appStateRepository && appStateRepository.database) {
      try { await appStateRepository.clearLegacyStores(); } catch(e) { console.warn('[backup] clear legacy failed:', e); }
    }
  }
  catch(error){
    console.error('[backup] clearing data failed:',error);
    toast('پاک‌سازی در حافظه ذخیره نشد.');
    return;
  }
  toast(loggedIn ? 'دادهها از سرور و دستگاه پاک شد' : 'دادههای دستگاه پاک شد');
  setTimeout(() => location.reload(), 500);
}

function refreshBackupUiState(){
  const client = window.sqlSync || window.masirSqlSync || null;
  const loggedIn = !!(client && typeof client.isLoggedIn === 'function' && client.isLoggedIn());
  const online = typeof navigator !== 'undefined' ? navigator.onLine !== false : true;
  const imp = document.getElementById('importInput');
  const impLabel = document.getElementById('legacyImportLabel');
  const impStatus = document.getElementById('legacyImportStatus');
  const localImp = document.getElementById('localImportInput');
  const localImpLabel = document.getElementById('localImportLabel');
  const clr = document.getElementById('clearDataBtn');
  const backupLink = document.getElementById('backupSettingsLink');

  if(backupLink) backupLink.style.display = '';
  if(localImp) localImp.disabled = false;
  if(localImpLabel){ localImpLabel.classList.remove('is-disabled'); localImpLabel.setAttribute('aria-disabled','false'); }
  if(imp){ imp.disabled = !(loggedIn && online); }
  if(impLabel){
    impLabel.classList.toggle('is-disabled', !(loggedIn && online));
    impLabel.setAttribute('aria-disabled', (!(loggedIn && online)) ? 'true' : 'false');
  }
  if(impStatus){
    impStatus.textContent = !loggedIn
      ? 'جایگزینی سرور: ابتدا وارد حساب شوید.'
      : (!online ? 'جایگزینی سرور: برای این کار باید آنلاین باشید.' : 'وارد حساب هستید؛ می‌توانید بکاپ قدیمی را جایگزین سرور کنید.');
  }
  if(clr){
    const canClear = !loggedIn || online;
    clr.disabled = !canClear;
    clr.classList.toggle('is-disabled', !canClear);
    clr.title = (!loggedIn || online) ? '' : 'برای پاک کردن کامل سرور و دستگاه باید آنلاین باشید.';
  }
  try{
    if(window.legacyPbSync && typeof window.legacyPbSync.renderSyncUI === 'function') window.legacyPbSync.renderSyncUI();
  }catch(e){}
}

(function wireBackupEvents(){
  const exp = document.getElementById('exportBtn');
  if(exp) exp.onclick = exportBackup;
  const localImp = document.getElementById('localImportInput');
  if(localImp) localImp.onchange = async (e) => {
    const f = e.target.files && e.target.files[0];
    e.target.value = '';
    if(!f) return;
    await importBackup(f, { mode: 'local' });
  };
  const imp = document.getElementById('importInput');
  if(imp) imp.onchange = async (e) => {
    const f = e.target.files && e.target.files[0];
    e.target.value = '';
    if(!f) return;
    refreshBackupUiState();
    if(imp.disabled) return;
    await importBackup(f, { mode: 'legacy-server' });
  };
  const clr = document.getElementById('clearDataBtn');
  if(clr) clr.onclick = clearAllData;
  window.addEventListener('online', refreshBackupUiState);
  window.addEventListener('offline', refreshBackupUiState);
  document.addEventListener('visibilitychange', ()=>{ if(!document.hidden) refreshBackupUiState(); });
  setTimeout(refreshBackupUiState, 0);
})();
window.refreshBackupUiState = refreshBackupUiState;