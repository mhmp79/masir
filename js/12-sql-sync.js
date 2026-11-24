'use strict';

/* ============================================================
   MASIR SQL SYNC — automatic two-way sync through the SQL API.
   - Phone + password sessions; OTP is never used for normal login.
   - First sync downloads before uploading so a new device cannot wipe
     an existing account.
   - Local changes are uploaded incrementally; remote changes are read
     from /api/snapshot with a server cursor.
   - WebSocket hints trigger an immediate incremental cycle.
   - Sync is always automatic: status only, no button and no toggle.
   ============================================================ */

const SQL_API_URL_KEY = 'konkur-sql-api-url-v1';
const SQL_AUTH_TOKEN_KEY = 'konkur-sql-auth-v1';
const SQL_AUTH_USER_KEY = 'konkur-sql-user-v1';
const SQL_LAST_SYNC_KEY = 'konkur-sql-last-sync-v1';
const SQL_SYNC_META_KEY = 'konkur-sql-sync-meta-v1';
const SQL_SYNC_META_VERSION = 1;
const SQL_SYNC_META_LIMIT = 3;
const SQL_CHANGE_CHUNK = 400;

const SYNC_UPLOAD_STORES = Object.freeze([
  'app-meta', 'subjects', 'activities', 'classes', 'sessions',
  'sleeps', 'phones', 'exams', 'questions'
]);

let sqlClient = null;
let sqlClientUrl = '';
let authToken = '';
let authUser = null;
let syncBusy = null;            // 'upload' | 'download' | null
let syncError = null;
let syncNotice = null;
let syncProgress = { active: false, kind: 'upload', percent: 0, note: '' };
let lastProgressPaint = 0;
let accountSwitchPending = false;
let accountRenderState = '';
let pendingBadgeToken = 0;

const AUTO_UPLOAD_DEBOUNCE = 300;
const AUTO_LOCAL_CHANGE_GAP = 400;
const AUTO_MIN_CYCLE_GAP = 30000;
const AUTO_DOWNLOAD_MIN_GAP = 60000;
const AUTO_POLL_INTERVAL = 10 * 60 * 1000;
const AUTO_PROBE_GAP = 60000;
const AUTO_DEFER_RETRY = 20000;
const AUTO_BACKOFF_BASE = 60000;
const AUTO_MAX_BACKOFF = 15 * 60 * 1000;
const REALTIME_APPLY_DELAY = 150;

let autoSyncStarted = false;
let autoSyncRunning = false;
let autoSyncPending = false;
let autoSyncFailures = 0;
let autoSyncCooldownUntil = 0;
let autoSyncUploadTimer = null;
let autoSyncRetryTimer = null;
let autoSyncRetryReason = 'auto';
let autoSyncSuppressUpload = 0;
let lastCycleAt = 0;
let lastDownloadAt = 0;
let lastProbeAt = 0;
let probeInFlight = false;
let lastAutoStatus = 'idle';
let realtimeApplyTimer = null;
const realtimePush = {
  started: false,
  connected: false,
  identity: '',
  failedAt: 0,
  lastEventAt: 0
};

/* ============ server address ============ */
function normalizeSqlBaseUrl(url) {
  return String(url == null ? '' : url).trim().replace(/\/+$/, '');
}

function defaultSqlBaseUrl() {
  try {
    if (window.MASIR_SQL_API_URL) return normalizeSqlBaseUrl(window.MASIR_SQL_API_URL);
  } catch (e) {}
  try {
    if (window.location && /^https?:$/.test(window.location.protocol)) {
      return normalizeSqlBaseUrl(window.location.origin);
    }
  } catch (e) {}
  return 'http://localhost:4000';
}

function sqlBaseUrl() {
  try {
    const saved = localStorage.getItem(SQL_API_URL_KEY);
    if (saved) return normalizeSqlBaseUrl(saved);
  } catch (e) {}
  return defaultSqlBaseUrl();
}

function saveSqlBaseUrl(url) {
  const value = normalizeSqlBaseUrl(url);
  try { localStorage.setItem(SQL_API_URL_KEY, value); } catch (e) {}
  if (sqlClient && sqlClientUrl !== value) {
    sqlClient.disconnect();
    sqlClient = null;
  }
  return value;
}

/* ============ session ============ */
function readSession() {
  try {
    authToken = localStorage.getItem(SQL_AUTH_TOKEN_KEY) || '';
    const raw = localStorage.getItem(SQL_AUTH_USER_KEY);
    authUser = raw ? JSON.parse(raw) : null;
  } catch (e) {
    authToken = '';
    authUser = null;
  }
  if (authToken && tokenExpired(authToken)) clearSession();
}

function decodeTokenPayload(token) {
  try {
    const part = String(token || '').split('.')[1];
    if (!part) return null;
    const normalized = part.replace(/-/g, '+').replace(/_/g, '/');
    const json = typeof atob === 'function'
      ? atob(normalized + '='.repeat((4 - normalized.length % 4) % 4))
      : null;
    return json ? JSON.parse(json) : null;
  } catch (e) { return null; }
}

function tokenExpired(token) {
  const payload = decodeTokenPayload(token);
  return !!payload && typeof payload.exp === 'number' && payload.exp <= Math.floor(Date.now() / 1000);
}

function clearSession() {
  authToken = '';
  authUser = null;
  try { localStorage.removeItem(SQL_AUTH_TOKEN_KEY); } catch (e) {}
  try { localStorage.removeItem(SQL_AUTH_USER_KEY); } catch (e) {}
}

function saveSession(result) {
  const token = String((result && result.token) || '').trim();
  if (!token) throw new Error('پاسخ سرور فاقد نشانة ورود بود.');
  const previousId = authUser && authUser.id ? String(authUser.id) : '';
  const user = (result && result.user) || authUser || {};
  const nextId = user.id ? String(user.id) : '';
  if (previousId && nextId && previousId !== nextId) {
    accountSwitchPending = true;
    forgetSyncMeta();
  }
  authToken = token;
  authUser = user;
  try {
    localStorage.setItem(SQL_AUTH_TOKEN_KEY, token);
    localStorage.setItem(SQL_AUTH_USER_KEY, JSON.stringify(user));
  } catch (e) {}
  try {
    if (state && state.profile && nextId) {
      state.profile.id = nextId;
      save();
    }
  } catch (e) {}
  syncError = null;
  syncNotice = null;
  return user;
}

function isLoggedIn() {
  return !!authToken && !tokenExpired(authToken);
}

function getLoggedInPhone() {
  if (authUser && authUser.phone) return String(authUser.phone);
  const payload = decodeTokenPayload(authToken);
  return String((payload && (payload.phone || payload.sub)) || '');
}

function getLoggedInUserId() {
  if (authUser && authUser.id) return String(authUser.id);
  const payload = decodeTokenPayload(authToken);
  return String((payload && payload.sub) || '');
}

function getLoggedInRole() {
  return String((authUser && authUser.role) || 'student');
}

/* Kept as a compatibility alias for older callers; it returns the phone,
   because the app no longer has e-mail accounts. */
function getLoggedInEmail() { return getLoggedInPhone(); }

function sqlErrorMessage(error) {
  if (!error) return 'خطای ناشناخته';
  if (typeof error === 'string') return error;
  if (error.status === 400) return 'درخواست نامعتبر بود. لطفاً ورودیها را بررسی کنید.';
  if (error.status === 401) return 'نشست منقضی شده است؛ دوباره وارد شوید.';
  if (error.status === 403) return 'دسترسی به این حساب مجاز نیست.';
  if (error.status === 409) return 'این شماره یا رکورد از قبل وجود دارد.';
  if (error.status === 429) return 'سرور تعداد درخواستها را محدود کرده؛ چند لحظه صبر کنید.';
  return String(error.message || 'خطای ناشناخته');
}

/* ============ client ============ */
function getSqlClient() {
  const api = window.MasirSqlApi;
  if (!api || typeof api.MasirSqlClient !== 'function') {
    throw new Error('ماژول ارتباط با سرور بارگذاری نشد.');
  }
  const url = normalizeSqlBaseUrl(sqlBaseUrl());
  if (sqlClient && sqlClientUrl === url) return sqlClient;
  if (sqlClient) {
    try { sqlClient.disconnect(); } catch (e) {}
  }
  sqlClient = new api.MasirSqlClient({
    baseUrl: url,
    getToken: () => authToken,
    onEvent: handleSqlEvent,
    onConnectionChange: (connected) => {
      realtimePush.connected = !!connected;
      if (connected) realtimePush.failedAt = 0;
      renderSyncUI();
    }
  });
  sqlClientUrl = url;
  return sqlClient;
}

async function requireSqlAuth() {
  if (!isLoggedIn()) throw new Error('برای همگامسازی ابتدا وارد حساب کاربری شوید.');
  return getSqlClient();
}

async function loginWithPassword(phone, password, serverUrl) {
  if (serverUrl) saveSqlBaseUrl(serverUrl);
  const client = getSqlClient();
  const result = await client.login(phone, password);
  saveSession(result);
  try { await flushStorage(); } catch (e) {}
  return true;
}

async function completeSignup(phone, code, password, displayName) {
  const client = getSqlClient();
  const verified = await client.verifyOtp(phone, code, 'signup');
  const result = await client.completeSignup(verified && verified.token, password, displayName);
  saveSession(result);
  try { await flushStorage(); } catch (e) {}
  return true;
}

async function resetPasswordWithOtp(phone, code, password) {
  const client = getSqlClient();
  const verified = await client.verifyOtp(phone, code, 'reset');
  const result = await client.resetPassword(verified && verified.token, password);
  saveSession(result);
  try { await flushStorage(); } catch (e) {}
  return true;
}

async function changePassword(currentPassword, newPassword) {
  const client = await requireSqlAuth();
  await client.changePassword(currentPassword, newPassword);
  return true;
}

function logoutSql() {
  stopRealtimePush();
  stopAutoSyncTimers();
  clearSession();
  syncError = null;
  syncNotice = null;
  resetProgress();
  renderSyncUI();
  try { if (window.masirAuth) window.masirAuth.show('login'); } catch (e) {}
}

/* ============ sync metadata (auth/sync data only) ============ */
function readSyncMetaStore() {
  try {
    const raw = localStorage.getItem(SQL_SYNC_META_KEY);
    if (!raw) return {};
    const data = JSON.parse(raw);
    return data && typeof data === 'object' ? data : {};
  } catch (e) { return {}; }
}

function syncMetaKey(server, owner) {
  return `${normalizeSqlBaseUrl(server)}|${owner}`;
}

function loadSyncMeta(server, owner) {
  if (!owner) return null;
  try {
    const meta = readSyncMetaStore()[syncMetaKey(server, owner)];
    if (!meta || meta.version !== SQL_SYNC_META_VERSION) return null;
    return meta;
  } catch (e) { return null; }
}

function saveSyncMeta(server, owner, meta) {
  if (!owner) return;
  try {
    const all = readSyncMetaStore();
    const key = syncMetaKey(server, owner);
    all[key] = {
      ...meta,
      version: SQL_SYNC_META_VERSION,
      server: normalizeSqlBaseUrl(server),
      owner,
      savedAt: Date.now()
    };
    Object.keys(all)
      .filter(item => item !== key)
      .sort((a, b) => (all[b].savedAt || 0) - (all[a].savedAt || 0))
      .slice(SQL_SYNC_META_LIMIT - 1)
      .forEach(item => delete all[item]);
    localStorage.setItem(SQL_SYNC_META_KEY, JSON.stringify(all));
  } catch (e) {
    console.warn('[SQL] saving sync metadata failed:', e);
  }
}

function forgetSyncMeta() {
  try { localStorage.removeItem(SQL_SYNC_META_KEY); } catch (e) {}
  try { localStorage.removeItem(SQL_LAST_SYNC_KEY); } catch (e) {}
}

function currentSyncIdentity() {
  try {
    if (!isLoggedIn()) return null;
    const owner = getLoggedInUserId();
    const server = normalizeSqlBaseUrl(sqlBaseUrl());
    if (!owner) return null;
    return { owner, server, meta: loadSyncMeta(server, owner) };
  } catch (e) { return null; }
}

function getLastSyncTimestamp() {
  try {
    const identity = currentSyncIdentity();
    if (identity && identity.meta && identity.meta.lastSyncAt) return +identity.meta.lastSyncAt;
  } catch (e) {}
  try {
    const raw = localStorage.getItem(SQL_LAST_SYNC_KEY);
    return raw ? parseInt(raw, 10) : null;
  } catch (e) { return null; }
}

function setLastSyncTimestamp(ts) {
  try { localStorage.setItem(SQL_LAST_SYNC_KEY, String(ts)); } catch (e) {}
}

function formatLastSync() {
  const ts = getLastSyncTimestamp();
  if (!ts) return 'هنوز سینک نشده';
  try {
    const d = new Date(ts);
    const g = { gy: d.getFullYear(), gm: d.getMonth() + 1, gd: d.getDate() };
    const j = d2j(g2d(g.gy, g.gm, g.gd));
    return `${fa(j.jd)} ${MONTHS[j.jm - 1]} ${fa(j.jy)} — ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
  } catch (e) { return new Date(ts).toLocaleString('fa-IR'); }
}

/* ============ local pending changes ============ */
async function readPendingChanges(limit) {
  if (!window.storageSync || typeof window.storageSync.pendingChangesProvider !== 'function') return null;
  try {
    return (await window.storageSync.pendingChangesProvider(limit || 100000)) || [];
  } catch (error) {
    console.warn('[SQL] reading pending changes failed:', error);
    return null;
  }
}

async function acknowledgeChanges(changes) {
  if (!changes || !changes.length) return;
  if (!window.storageSync || typeof window.storageSync.acknowledger !== 'function') return;
  const acks = changes
    .filter(change => change && typeof change.id === 'string' && typeof change.revision === 'string')
    .map(change => ({ id: change.id, revision: change.revision }));
  if (acks.length) await window.storageSync.acknowledger(acks);
}

async function acknowledgeAllPending() {
  const pending = await readPendingChanges();
  if (pending && pending.length) await acknowledgeChanges(pending);
}

/* ============ tracker / timer ============ */
function currentTrackerPayload() {
  let source = null;
  try {
    const raw = localState.getSync('tracker');
    if (raw) source = JSON.parse(raw);
  } catch (e) {}
  const counts = source || (typeof trkCounts !== 'undefined' ? trkCounts : null);
  if (!counts) return null;
  return {
    counts: {
      correct: Math.max(0, +counts.correct || 0),
      wrong: Math.max(0, +counts.wrong || 0),
      blank: Math.max(0, +counts.blank || 0)
    },
    coef: (typeof TRK_COEF !== 'undefined' ? TRK_COEF : 1 / 3)
  };
}

function currentTimerPayload() {
  try {
    const raw = localState.getSync('timer');
    return raw ? JSON.parse(raw) : null;
  } catch (e) { return null; }
}

function trackerSignatureOf(payload) {
  return payload ? JSON.stringify(payload) : null;
}

function timerSignatureOf(payload) {
  return payload ? JSON.stringify(payload) : null;
}

function applyRemoteTracker(remoteTracker) {
  if (!remoteTracker || typeof trkCounts === 'undefined') return;
  const counts = remoteTracker.counts || {};
  trkCounts = {
    correct: Math.max(0, +counts.correct || 0),
    wrong: Math.max(0, +counts.wrong || 0),
    blank: Math.max(0, +counts.blank || 0)
  };
  trkCoef = (typeof TRK_COEF !== 'undefined' ? TRK_COEF : 1 / 3);
  try { saveTracker(); } catch (e) { console.warn('[SQL] saving tracker failed:', e); }
}

function applyRemoteTimer(remoteTimer) {
  if (!remoteTimer || typeof applyImportedTimerState !== 'function') return;
  try { applyImportedTimerState(remoteTimer); }
  catch (e) { console.warn('[SQL] saving timer failed:', e); }
}

function trackerToTyped(payload) {
  const counts = (payload && payload.counts) || {};
  return {
    correct: Math.max(0, +counts.correct || 0),
    wrong: Math.max(0, +counts.wrong || 0),
    blank: Math.max(0, +counts.blank || 0),
    coef: (typeof TRK_COEF !== 'undefined' ? TRK_COEF : 1 / 3)
  };
}

function timerToTyped(payload) {
  const value = payload || {};
  return {
    running: !!value.isRunning,
    startedAt: value.startedAt == null ? null : Number(value.startedAt),
    elapsedMs: Math.max(0, +value.accumulated || 0),
    mode: String(value.mode || 'stopwatch')
  };
}

function timerFromTyped(row) {
  const defaults = typeof defaultTimerState === 'function' ? defaultTimerState() : {};
  return {
    ...defaults,
    isRunning: !!row.running,
    startedAt: row.started_at == null ? null : Number(row.started_at),
    accumulated: Math.max(0, +row.elapsed_ms || 0),
    mode: String(row.mode || defaults.mode || 'stopwatch')
  };
}

/* ============ progress ============ */
function setProgress(kind, percent, note, force) {
  const value = Math.max(0, Math.min(100, Math.round(percent || 0)));
  syncProgress.active = true;
  syncProgress.kind = kind;
  syncProgress.percent = value;
  if (note !== undefined) syncProgress.note = note;

  const now = Date.now();
  if (!force && value < 100 && now - lastProgressPaint < 90) return;
  lastProgressPaint = now;

  const fill = document.getElementById('syncProgressFill');
  if (!fill) return;
  fill.style.width = value + '%';
  const track = document.getElementById('syncProgressTrack');
  if (track) track.setAttribute('aria-valuenow', String(value));
  const pct = document.getElementById('syncProgressPercent');
  if (pct) pct.textContent = fa(value) + '٪';
  const label = document.getElementById('syncProgressPercentLabel');
  if (label) label.textContent = kind === 'upload' ? 'درصد ارسال' : 'درصد دریافت';
  const noteEl = document.getElementById('syncProgressNote');
  if (noteEl) noteEl.textContent = syncProgress.note || '';
  const title = document.getElementById('syncProgressTitle');
  if (title) title.textContent = kind === 'upload' ? 'ارسال دادهها' : 'دریافت دادهها';
  const bar = document.getElementById('syncProgressBar');
  if (bar) bar.hidden = false;
}

function resetProgress() {
  syncProgress = { active: false, kind: 'upload', percent: 0, note: '' };
  lastProgressPaint = 0;
}

/* ============ upload ============ */
function pendingToChange(change) {
  if (!change || !change.store || change.recordId == null) return null;
  const payload = change.payload && typeof change.payload === 'object' ? change.payload : {};
  const data = { ...payload };
  if (payload.order !== undefined && payload.order !== null) data.localOrder = payload.order;
  return {
    original: change,
    store: change.store,
    id: String(change.recordId),
    op: change.operation === 'delete' ? 'delete' : 'upsert',
    updated: new Date(change.changedAt || Date.now()).toISOString(),
    data
  };
}

function buildFullUploadChanges() {
  const api = window.MasirSqlApi;
  const snapshot = normalizedStorageSnapshot(compactStateForStorage(state));
  const changes = [];
  SYNC_UPLOAD_STORES.forEach(store => {
    const records = snapshot.get(store);
    if (!records) return;
    records.forEach((json, localId) => {
      let record;
      try { record = JSON.parse(json); } catch (e) { return; }
      const data = { ...record };
      if (record.order !== undefined && record.order !== null) data.localOrder = record.order;
      changes.push({
        store,
        id: String(localId),
        op: 'upsert',
        updated: new Date().toISOString(),
        data
      });
    });
  });
  const tracker = currentTrackerPayload();
  if (tracker) {
    changes.push({
      table: 'tracker', store: 'tracker', id: 'tracker', op: 'upsert',
      updated: new Date().toISOString(), data: trackerToTyped(tracker)
    });
  }
  const timer = currentTimerPayload();
  if (timer) {
    changes.push({
      table: 'timer', store: 'timer', id: 'timer', op: 'upsert',
      updated: new Date().toISOString(), data: timerToTyped(timer)
    });
  }
  return changes.map(change => ({
    original: null,
    payload: api.normalizeChange(change),
    id: api.normalizeChange(change).id
  }));
}

function buildIncrementalUploadChanges(pending, meta) {
  const api = window.MasirSqlApi;
  const changes = [];
  (pending || []).forEach(change => {
    if (!SYNC_UPLOAD_STORES.includes(change.store)) return;
    const prepared = pendingToChange(change);
    if (!prepared) return;
    const payload = api.normalizeChange(prepared);
    changes.push({ original: change, payload, id: payload.id });
  });

  const tracker = currentTrackerPayload();
  const trackerSignature = trackerSignatureOf(tracker);
  if (tracker && (!meta || meta.tracker !== trackerSignature)) {
    const payload = api.normalizeChange({
      table: 'tracker', store: 'tracker', id: 'tracker', op: 'upsert',
      updated: new Date().toISOString(), data: trackerToTyped(tracker)
    });
    changes.push({ original: null, payload, id: payload.id });
  }
  const timer = currentTimerPayload();
  const timerSignature = timerSignatureOf(timer);
  if (timer && (!meta || meta.timer !== timerSignature)) {
    const payload = api.normalizeChange({
      table: 'timer', store: 'timer', id: 'timer', op: 'upsert',
      updated: new Date().toISOString(), data: timerToTyped(timer)
    });
    changes.push({ original: null, payload, id: payload.id });
  }
  return changes;
}

async function sendChangeBatch(client, changes) {
  const applied = [];
  const conflicts = [];
  for (let index = 0; index < changes.length; index += SQL_CHANGE_CHUNK) {
    const batch = changes.slice(index, index + SQL_CHANGE_CHUNK);
    const response = await client.sendChanges(batch.map(item => item.payload));
    if (response && Array.isArray(response.applied)) applied.push(...response.applied);
    if (response && Array.isArray(response.conflicts)) conflicts.push(...response.conflicts);
    const percent = 35 + (Math.min(index + batch.length, changes.length) / changes.length) * 63;
    setProgress('upload', percent, `${fa(Math.min(index + batch.length, changes.length))} از ${fa(changes.length)} رکورد`);
  }
  return { applied, conflicts };
}

async function performUpload(options) {
  const opts = options || {};
  const silent = !!opts.silent;
  if (syncBusy) return { ok: false, skipped: true, reason: 'busy' };
  if (!isLoggedIn()) {
    if (!silent) { syncError = 'برای همگامسازی ابتدا وارد حساب کاربری شوید.'; renderSyncUI(); }
    return { ok: false, error: 'auth' };
  }

  syncBusy = 'upload';
  syncError = null;
  if (!silent) syncNotice = null;
  setProgress('upload', 0, 'آمادهسازی…', true);
  renderSyncUI();

  try {
    await flushStorage().catch(() => {});
    const client = await requireSqlAuth();
    const identity = currentSyncIdentity();
    const owner = identity && identity.owner;
    const server = identity && identity.server;
    const meta = identity && identity.meta;
    const pending = opts.all ? [] : await readPendingChanges();
    const changes = opts.all ? buildFullUploadChanges() : buildIncrementalUploadChanges(pending, meta);

    if (!changes.length) {
      const now = Date.now();
      setLastSyncTimestamp(now);
      if (meta) saveSyncMeta(server, owner, { ...meta, lastSyncAt: now });
      syncNotice = '✓ تغییری برای ارسال نیست';
      return { ok: true, changed: 0, noChanges: true };
    }

    const tracker = currentTrackerPayload();
    const timer = currentTimerPayload();
    setProgress('upload', 35, `${fa(0)} از ${fa(changes.length)} رکورد`, true);
    const { applied, conflicts } = await sendChangeBatch(client, changes);
    const appliedSet = new Set(applied.map(String));
    const acked = changes
      .filter(item => item.original && appliedSet.has(String(item.id)))
      .map(item => item.original);
    await acknowledgeChanges(acked).catch(error => console.warn('[SQL] ack failed:', error));

    const now = Date.now();
    saveSyncMeta(server, owner, {
      ...(meta || {}),
      tracker: trackerSignatureOf(tracker),
      timer: timerSignatureOf(timer),
      lastSyncAt: now
    });
    setLastSyncTimestamp(now);

    if (conflicts.length) {
      syncError = `ارسال با ${fa(conflicts.length)} تداخل مواجه شد؛ تغییرات دوباره فرستاده میشوند.`;
      return { ok: false, changed: applied.length, error: syncError };
    }
    syncNotice = `✓ ${fa(applied.length)} تغییر روی حساب شما ذخیره شد`;
    return { ok: true, changed: applied.length };
  } catch (error) {
    console.error('[SQL] upload failed:', error);
    syncError = 'ارسال ناموفق بود — ' + sqlErrorMessage(error);
    return { ok: false, error: syncError, fatal: error.status === 401 };
  } finally {
    syncBusy = null;
    resetProgress();
    renderSyncUI();
    refreshPendingBadge();
    if (!silent) {
      if (syncError) toast('❌ ' + syncError);
      else if (syncNotice) toast(syncNotice);
    }
  }
}

/* ============ download ============ */
async function fetchRemoteChanges(client, since) {
  const changes = [];
  let cursor = '';
  let guard = 0;
  do {
    const response = await client.snapshot({ since: since || '', cursor, limit: 500 });
    const batch = (response && Array.isArray(response.changes)) ? response.changes : [];
    changes.push(...batch);
    cursor = response && response.nextCursor ? String(response.nextCursor) : '';
    guard++;
  } while (cursor && guard < 40);
  return changes;
}

function stripLocalEnvelope(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const out = { ...value };
  delete out.id;
  delete out.updated;
  delete out.localOrder;
  return out;
}

function rowLocalId(change) {
  const data = (change && change.data) || {};
  return String(data.local_id || data.localId || change.id || '');
}

function decodeRemoteChange(change, api, localSnapshot) {
  const table = String((change && change.table) || '');
  const store = api.localStoreForTable(table) || table;
  const data = (change && change.data) || {};
  const isDelete = change.op === 'delete' || data.deleted === true;
  const localId = rowLocalId(change);
  if (!localId) return null;

  if (table === 'tracker') {
    return { kind: 'tracker', value: { counts: data, coef: 1 / 3 }, updated: change.updated };
  }
  if (table === 'timer') {
    return { kind: 'timer', value: timerFromTyped(data), updated: change.updated };
  }

  if (store === 'app-meta' && localId === 'main' && isDelete) {
    throw new Error('دادههای اصلی حساب روی سرور حذف شده است؛ عملیات برای جلوگیری از حذف داده متوقف شد.');
  }
  const typed = api.fromTypedRow(table, data);
  const value = store === 'app-meta' ? (data.value || {}) : stripLocalEnvelope(typed);
  const order = data.local_order == null
    ? (localSnapshot && localSnapshot.get(store) && localSnapshot.get(store).get(localId)
        ? (() => { try { return JSON.parse(localSnapshot.get(store).get(localId)).order || 0; } catch (e) { return 0; } })()
        : 0)
    : Number(data.local_order) || 0;
  const record = { id: localId, value, order };
  if (data.exam_id) record.examId = String(data.exam_id);
  return { kind: isDelete ? 'delete' : 'put', store, record, updated: change.updated };
}

function safeSinceFromChanges(changes, fallback) {
  let max = '';
  (changes || []).forEach(change => {
    const value = String((change && change.updated) || '');
    if (value && value > max) max = value;
  });
  if (!max) return fallback || '';
  const time = Date.parse(max);
  return Number.isFinite(time) ? new Date(Math.max(0, time - 1000)).toISOString() : (fallback || '');
}

async function refreshAppAfterSync() {
  try {
    if (window.storageSync && typeof window.storageSync.reloadState === 'function') {
      await window.storageSync.reloadState();
    }
  } catch (error) {
    console.warn('[SQL] reloading local state failed:', error);
  }
  const renderers = [
    'refreshAll', 'renderSettingsPanel', 'renderProfileSection',
    'renderCommonErrors', 'renderSubjectErrorsSection', 'renderTracker'
  ];
  renderers.forEach(name => {
    try { if (typeof window[name] === 'function') window[name](); }
    catch (e) { console.warn('[SQL] ' + name + ' failed:', e); }
    try { if (typeof globalThis[name] === 'function') globalThis[name](); }
    catch (e) {}
  });
  try { renderSyncUI(); } catch (e) {}
}

async function performDownload(options) {
  const opts = options || {};
  const silent = !!opts.silent;
  if (opts.deferCheck && shouldDeferAutoDownload()) return { ok: false, deferred: true };
  if (syncBusy) return { ok: false, skipped: true, reason: 'busy' };
  if (!isLoggedIn()) {
    if (!silent) { syncError = 'برای همگامسازی ابتدا وارد حساب کاربری شوید.'; renderSyncUI(); }
    return { ok: false, error: 'auth' };
  }

  syncBusy = 'download';
  syncError = null;
  if (!silent) syncNotice = null;
  setProgress('download', 0, 'آمادهسازی…', true);
  renderSyncUI();

  try {
    await flushStorage().catch(() => {});
    const client = await requireSqlAuth();
    const identity = currentSyncIdentity();
    const owner = identity && identity.owner;
    const server = identity && identity.server;
    const meta = identity && identity.meta;
    const firstSync = !meta;
    setProgress('download', 8, 'دریافت تغییرات از سرور…', true);
    const changes = await fetchRemoteChanges(client, meta && meta.since);
    if (!changes.length && firstSync) {
      syncNotice = 'حساب شما هنوز دادهئی ندارد؛ از دستگاهی که اطلاعات دارد همگامسازی کنید.';
      return { ok: true, changed: 0, empty: true };
    }

    const api = window.MasirSqlApi;
    const localSnapshot = normalizedStorageSnapshot(compactStateForStorage(state));
    const decoded = [];
    changes.forEach(change => {
      try {
        const item = decodeRemoteChange(change, api, localSnapshot);
        if (item) decoded.push(item);
      } catch (error) {
        console.warn('[SQL] skipping remote change:', error.message);
      }
    });

    const mainMeta = decoded.find(item => item.store === 'app-meta' && item.kind === 'put' && item.record.id === 'main');
    if (firstSync && !mainMeta) {
      syncNotice = 'دادههای اصلی حساب پیدا نشد؛ از دستگاهی که اطلاعات دارد همگامسازی کنید.';
      return { ok: true, changed: 0, empty: true };
    }

    const pending = await readPendingChanges();
    const guarded = new Set((pending || []).map(change => `${change.store}::${change.recordId}`));
    const puts = [];
    const deletes = [];
    let remoteTracker = null;
    let remoteTimer = null;

    decoded.forEach(item => {
      if (item.kind === 'tracker') { remoteTracker = item.value; return; }
      if (item.kind === 'timer') { remoteTimer = item.value; return; }
      const key = `${item.store}::${item.record.id}`;
      if (guarded.has(key)) return;
      if (item.kind === 'delete') deletes.push({ store: item.store, id: item.record.id });
      else puts.push({ store: item.store, record: item.record });
    });

    setProgress('download', 85, 'ذخیرهسازی تغییرات روی این دستگاه…', true);
    autoSyncSuppressUpload++;
    try {
      if (firstSync) {
        const records = Object.fromEntries(NORMALIZED_STORES.map(store => [store, []]));
        decoded.forEach(item => {
          if (!item.store || item.kind !== 'put' || !records[item.store]) return;
          records[item.store].push(item.record);
        });
        const rawState = stateFromNormalizedRecords(records);
        if (!rawState) throw new Error('دادههای سرور کامل نیست (رکورد تنظیمات پیدا نشد).');
        const normalized = normalizeStateData(rawState);
        normalized.subjects.forEach(subject => {
          if (!normalized.classes[subject.name]) {
            normalized.classes[subject.name] = { total: subject.sessions || 0, sessions: {} };
          } else if (!normalized.classes[subject.name].total) {
            normalized.classes[subject.name].total = subject.sessions || 0;
          }
        });
        save();
        await flushStorage().catch(() => {});
        replaceTrackedState(normalized, true);
        if (remoteTracker) applyRemoteTracker(remoteTracker);
        if (remoteTimer) applyRemoteTimer(remoteTimer);
        save();
        await flushStorage();
        await acknowledgeAllPending().catch(() => {});
      } else {
        save();
        await flushStorage();
        if (puts.length || deletes.length) {
          await window.storageSync.applyRemoteChanges({
            puts,
            deletes,
            acknowledge: [...puts.map(item => ({ store: item.store, id: item.record.id })),
              ...deletes.map(item => ({ store: item.store, id: item.id }))]
          });
        }
        if (remoteTracker) applyRemoteTracker(remoteTracker);
        if (remoteTimer) applyRemoteTimer(remoteTimer);
      }
    } finally {
      autoSyncSuppressUpload--;
    }

    const now = Date.now();
    const tracker = currentTrackerPayload();
    const timer = currentTimerPayload();
    saveSyncMeta(server, owner, {
      ...(meta || {}),
      since: safeSinceFromChanges(changes, meta && meta.since),
      tracker: trackerSignatureOf(tracker),
      timer: timerSignatureOf(timer),
      lastSyncAt: now
    });
    setLastSyncTimestamp(now);
    const applied = puts.length + deletes.length + (remoteTracker ? 1 : 0) + (remoteTimer ? 1 : 0);
    syncNotice = applied
      ? `✓ ${fa(applied)} تغییر از حساب شما اعمال شد`
      : '✓ دادهها از قبل بهروز است';
    if (applied) await refreshAppAfterSync();
    return { ok: true, changed: applied, downloadAt: now, full: firstSync };
  } catch (error) {
    console.error('[SQL] download failed:', error);
    syncError = 'دریافت ناموفق بود — ' + sqlErrorMessage(error);
    return { ok: false, error: syncError, fatal: error.status === 401 };
  } finally {
    syncBusy = null;
    resetProgress();
    renderSyncUI();
    refreshPendingBadge();
    if (!silent) {
      if (syncError) toast('❌ ' + syncError);
      else if (syncNotice) toast(syncNotice);
    }
  }
}

/* ============ realtime ============ */
function realtimeIdentity() {
  try {
    if (!isLoggedIn()) return '';
    return normalizeSqlBaseUrl(sqlBaseUrl()) + '|' + getLoggedInUserId();
  } catch (e) { return ''; }
}

function handleSqlEvent(event) {
  try {
    if (!isLoggedIn() || !event) return;
    const actor = event.actorId ? String(event.actorId) : '';
    if (actor && actor === getLoggedInUserId()) return;
    realtimePush.lastEventAt = Date.now();
    if (realtimeApplyTimer) clearTimeout(realtimeApplyTimer);
    realtimeApplyTimer = setTimeout(() => {
      realtimeApplyTimer = null;
      scheduleAutoCycle(120, 'realtime');
    }, REALTIME_APPLY_DELAY);
  } catch (error) {
    console.warn('[SQL] realtime event failed:', error);
  }
}

function stopRealtimePush() {
  realtimePush.started = false;
  realtimePush.connected = false;
  realtimePush.identity = '';
  if (realtimeApplyTimer) { clearTimeout(realtimeApplyTimer); realtimeApplyTimer = null; }
  if (sqlClient) {
    try { sqlClient.disconnect(); } catch (e) {}
  }
  renderSyncUI();
}

async function startRealtimePush() {
  if (!autoSyncEnabled || !isLoggedIn()) return false;
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return false;
  try { if (document.hidden) return false; } catch (e) {}
  const identity = realtimeIdentity();
  if (!identity) return false;
  if (realtimePush.connected || (realtimePush.started && realtimePush.identity === identity)) {
    return realtimePush.connected;
  }
  const retryGap = 5 * 60 * 1000;
  if (Date.now() - realtimePush.failedAt < retryGap) return false;
  stopRealtimePush();
  realtimePush.started = true;
  realtimePush.identity = identity;
  try {
    const client = getSqlClient();
    await client.connect();
    renderSyncUI();
    return true;
  } catch (error) {
    console.warn('[SQL] realtime unavailable:', error && error.message ? error.message : error);
    realtimePush.failedAt = Date.now();
    stopRealtimePush();
    return false;
  }
}

/* ============ automatic sync engine ============ */
const autoSyncEnabled = true;

function shouldDeferAutoDownload() {
  try {
    const active = document.activeElement;
    if (active && active !== document.body) {
      const tag = String(active.tagName || '').toUpperCase();
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || active.isContentEditable) return true;
    }
    const backdrop = document.getElementById('modalBackdrop');
    if (backdrop && backdrop.classList.contains('show')) return true;
    const authOverlay = document.getElementById('authOverlay');
    if (authOverlay && authOverlay.classList.contains('show') && !authOverlay.hidden) return true;
  } catch (e) {}
  return false;
}

function registerAutoSuccess() {
  autoSyncFailures = 0;
  autoSyncCooldownUntil = 0;
}

function registerAutoFailure(message) {
  if (message) syncError = syncError || (typeof message === 'string' ? message : sqlErrorMessage(message));
  autoSyncFailures = Math.min(autoSyncFailures + 1, 6);
  const delay = Math.min(AUTO_MAX_BACKOFF, AUTO_BACKOFF_BASE * Math.pow(2, autoSyncFailures - 1));
  autoSyncCooldownUntil = Date.now() + delay;
  if (autoSyncEnabled) scheduleAutoCycle(delay, 'retry');
}

function scheduleAutoUpload(delay) {
  if (!autoSyncEnabled || !isLoggedIn()) return;
  if (autoSyncRunning) { autoSyncPending = true; return; }
  const wait = delay === undefined ? AUTO_UPLOAD_DEBOUNCE : delay;
  if (autoSyncUploadTimer) clearTimeout(autoSyncUploadTimer);
  autoSyncUploadTimer = setTimeout(() => {
    autoSyncUploadTimer = null;
    const gap = AUTO_LOCAL_CHANGE_GAP - (Date.now() - lastCycleAt);
    if (lastCycleAt && gap > 0) { scheduleAutoCycle(gap, 'local-change'); return; }
    syncCycle({ reason: 'local-change' });
  }, Math.max(0, wait));
}

function scheduleAutoCycle(delay, reason) {
  if (!autoSyncEnabled || !isLoggedIn()) return;
  autoSyncRetryReason = reason || autoSyncRetryReason || 'auto';
  if (autoSyncRetryTimer) clearTimeout(autoSyncRetryTimer);
  autoSyncRetryTimer = setTimeout(() => {
    autoSyncRetryTimer = null;
    syncCycle({ reason: autoSyncRetryReason });
  }, Math.max(0, delay || 0));
}

function stopAutoSyncTimers() {
  if (autoSyncUploadTimer) { clearTimeout(autoSyncUploadTimer); autoSyncUploadTimer = null; }
  if (autoSyncRetryTimer) { clearTimeout(autoSyncRetryTimer); autoSyncRetryTimer = null; }
  autoSyncPending = false;
}

async function syncCycle(options) {
  const opts = options || {};
  const reason = opts.reason || 'auto';
  if (!autoSyncEnabled) return { ok: false, disabled: true };
  if (!isLoggedIn()) { renderSyncUI(); return { ok: false, error: 'auth' }; }
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    lastAutoStatus = 'offline';
    renderSyncUI();
    return { ok: false, offline: true };
  }
  if (syncBusy || autoSyncRunning) {
    autoSyncPending = true;
    return { ok: false, busy: true };
  }
  const cooldown = autoSyncCooldownUntil - Date.now();
  if (cooldown > 0 && reason !== 'login') {
    scheduleAutoCycle(cooldown, reason);
    return { ok: false, cooldown: true };
  }
  const urgent = ['probe', 'visible', 'focus', 'online', 'realtime', 'login'].includes(reason);
  const minGap = reason === 'local-change' ? AUTO_LOCAL_CHANGE_GAP : AUTO_MIN_CYCLE_GAP;
  const gap = minGap - (Date.now() - lastCycleAt);
  if (lastCycleAt && gap > 0 && !urgent) {
    scheduleAutoCycle(gap, reason);
    return { ok: false, throttled: true };
  }

  autoSyncRunning = true;
  lastCycleAt = Date.now();
  lastAutoStatus = 'syncing';
  renderSyncUI();
  let outcome = { ok: false };
  let uploadFailure = null;

  try {
    await flushStorage().catch(() => {});
    const identity = currentSyncIdentity();
    const firstSync = !identity || !identity.meta;

    if (firstSync) {
      outcome = await performDownload({ silent: true, deferCheck: reason !== 'login' });
      if (outcome && outcome.ok) {
        lastDownloadAt = Date.now();
        registerAutoSuccess();
        lastAutoStatus = 'idle';
        if (outcome.empty) {
          /* A different account must start from clean defaults; never seed it
             with records that belonged to the previously signed-in account. */
          if (accountSwitchPending) {
            autoSyncSuppressUpload++;
            try {
              replaceTrackedState(defaultState(), true);
              save();
              await flushStorage().catch(() => {});
            } finally {
              autoSyncSuppressUpload--;
            }
          }
          const seed = await performUpload({ silent: true, all: true });
          if (seed && seed.ok) outcome = { ok: true, changed: seed.changed || 0, seeded: true };
        }
        accountSwitchPending = false;
      } else if (outcome && outcome.deferred) {
        scheduleAutoCycle(AUTO_DEFER_RETRY, reason);
        lastAutoStatus = 'idle';
      } else {
        registerAutoFailure(outcome && outcome.error);
        lastAutoStatus = 'error';
      }
      return outcome;
    }

    const up = await performUpload({ silent: true });
    if (!up || (!up.ok && up.fatal)) {
      outcome = up || { ok: false };
      registerAutoFailure(up && up.error);
      lastAutoStatus = 'error';
      return outcome;
    }
    const uploadFailed = !!up && !up.ok;
    if (uploadFailed) {
      uploadFailure = up.error || 'ارسال ناموفق بود';
      registerAutoFailure(uploadFailure);
    }

    const forceDownload = ['probe', 'realtime', 'login'].includes(reason);
    const downloadAllowed = forceDownload || (Date.now() - lastDownloadAt >= AUTO_DOWNLOAD_MIN_GAP);
    if (!downloadAllowed) {
      outcome = uploadFailed
        ? { ok: false, partial: true, error: uploadFailure }
        : { ok: true, changed: up.changed || 0, downloadSkipped: true };
      if (!uploadFailed) { registerAutoSuccess(); lastAutoStatus = 'idle'; }
      else lastAutoStatus = 'error';
      return outcome;
    }
    if (shouldDeferAutoDownload()) {
      outcome = uploadFailed ? { ok: false, partial: true, error: uploadFailure } : { ok: true, deferred: true };
      if (!uploadFailed) { registerAutoSuccess(); lastAutoStatus = 'idle'; }
      else lastAutoStatus = 'error';
      scheduleAutoCycle(AUTO_DEFER_RETRY, reason);
      return outcome;
    }

    const down = await performDownload({ silent: true, deferCheck: false });
    if (down && down.ok) {
      lastDownloadAt = Date.now();
      if (uploadFailed) {
        lastAutoStatus = 'error';
        outcome = { ok: false, partial: true, error: uploadFailure, changed: down.changed || 0 };
      } else {
        registerAutoSuccess();
        lastAutoStatus = 'idle';
        outcome = down;
      }
    } else if (down && down.deferred) {
      scheduleAutoCycle(AUTO_DEFER_RETRY, reason);
      lastAutoStatus = uploadFailed ? 'error' : 'idle';
      outcome = uploadFailed ? { ok: false, partial: true, error: uploadFailure } : down;
    } else {
      registerAutoFailure(down && down.error);
      lastAutoStatus = 'error';
      outcome = down || { ok: false };
    }
    return outcome;
  } catch (error) {
    console.error('[SQL] sync cycle failed:', error);
    syncError = 'همگامسازی ناموفق بود — ' + sqlErrorMessage(error);
    registerAutoFailure(syncError);
    lastAutoStatus = 'error';
    return { ok: false, error: syncError };
  } finally {
    autoSyncRunning = false;
    if (autoSyncPending) {
      autoSyncPending = false;
      scheduleAutoUpload(400);
    }
    if (uploadFailure) syncError = uploadFailure;
    renderSyncUI();
    refreshPendingBadge();
  }
}

function syncNow() {
  return syncCycle({ reason: 'login' });
}

function uploadAllData() {
  if (syncBusy || autoSyncRunning) return;
  return performUpload({ all: true });
}

function downloadAllData() {
  if (syncBusy || autoSyncRunning) return;
  return performDownload({ full: true });
}

async function probeRemoteChanges(force) {
  if (!autoSyncEnabled || !isLoggedIn()) return false;
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return false;
  if (syncBusy || autoSyncRunning || probeInFlight) return false;
  const now = Date.now();
  if (now - lastProbeAt < (force ? 5000 : AUTO_PROBE_GAP)) return false;
  lastProbeAt = now;
  probeInFlight = true;
  try {
    const client = getSqlClient();
    const identity = currentSyncIdentity();
    if (!identity || !identity.meta) return true;
    const response = await client.snapshot({ since: identity.meta.since || '', limit: 1 });
    return !!(response && Array.isArray(response.changes) && response.changes.length);
  } catch (error) {
    console.warn('[SQL] remote probe failed:', error);
    return false;
  } finally {
    probeInFlight = false;
  }
}

function maybeProbeRemoteChanges(force) {
  return probeRemoteChanges(force).then(changed => {
    if (changed) scheduleAutoCycle(0, 'probe');
    return changed;
  }).catch(() => false);
}

function flushPendingUploadOnHide() {
  if (!autoSyncEnabled || !isLoggedIn()) return;
  if (autoSyncUploadTimer) { clearTimeout(autoSyncUploadTimer); autoSyncUploadTimer = null; }
  if (syncBusy || autoSyncRunning) { autoSyncPending = true; return; }
  readPendingChanges(2000).then(pending => {
    if (!pending || !pending.length) return;
    return performUpload({ silent: true });
  }).catch(() => {});
}

function startAutoSync() {
  if (autoSyncStarted) return;
  autoSyncStarted = true;

  const previousHook = window._postSaveHook;
  window._postSaveHook = function () {
    try { if (typeof previousHook === 'function') previousHook(); } catch (e) {}
    if (autoSyncSuppressUpload > 0) return;
    scheduleAutoUpload();
  };
  window._trackerSaveHook = function () {
    if (autoSyncSuppressUpload > 0) return;
    scheduleAutoUpload();
  };

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { stopRealtimePush(); flushPendingUploadOnHide(); return; }
    if (!isLoggedIn()) return;
    startRealtimePush();
    if (Date.now() - lastDownloadAt >= AUTO_DOWNLOAD_MIN_GAP) scheduleAutoCycle(600, 'visible');
    else maybeProbeRemoteChanges(true);
  });
  window.addEventListener('pagehide', flushPendingUploadOnHide);
  window.addEventListener('online', () => {
    renderSyncUI();
    if (isLoggedIn()) {
      startRealtimePush();
      scheduleAutoCycle(1500, 'online');
    }
  });
  window.addEventListener('offline', () => { lastAutoStatus = 'offline'; stopRealtimePush(); renderSyncUI(); });
  window.addEventListener('focus', () => {
    if (!isLoggedIn() || document.hidden) return;
    startRealtimePush();
    if (Date.now() - lastDownloadAt >= AUTO_DOWNLOAD_MIN_GAP) scheduleAutoCycle(800, 'focus');
    else maybeProbeRemoteChanges(true);
  });
  setInterval(() => {
    if (document.hidden || !isLoggedIn()) return;
    if (Date.now() - lastDownloadAt >= AUTO_POLL_INTERVAL) { scheduleAutoCycle(0, 'poll'); return; }
    if (realtimePush.connected) return;
    startRealtimePush();
    maybeProbeRemoteChanges();
  }, 60000);

  startRealtimePush();
  scheduleAutoCycle(2000, 'startup');
}

function refreshPendingBadge() {
  const first = document.getElementById('syncPendingStatus');
  if (!first) return;
  const token = ++pendingBadgeToken;
  readPendingChanges(2000).then(pending => {
    if (token !== pendingBadgeToken) return;
    const el = document.getElementById('syncPendingStatus');
    if (!el) return;
    let count = Array.isArray(pending)
      ? pending.filter(change => change && SYNC_UPLOAD_STORES.includes(change.store)).length
      : 0;
    try {
      const identity = currentSyncIdentity();
      if (identity && identity.meta && identity.meta.tracker !== trackerSignatureOf(currentTrackerPayload())) count++;
    } catch (e) {}
    el.textContent = count ? `${fa(count)} تغییر در انتظار ارسال` : '✓ همه تغییرات ذخیره شدند';
    el.classList.toggle('pending', count > 0);
    el.classList.toggle('saved', count === 0);
  }).catch(() => {});
}

/* ============ status-only settings UI ============ */
function syncProgressMarkup() {
  const kindTitle = syncProgress.kind === 'upload' ? 'ارسال دادهها' : 'دریافت دادهها';
  return `
    <div class="sync-progress" id="syncProgressBar" role="group" aria-label="${kindTitle}" hidden>
      <div class="sync-progress-head">
        <span id="syncProgressTitle">${kindTitle}</span>
        <span class="sync-progress-value">
          <span id="syncProgressPercentLabel">${syncProgress.kind === 'upload' ? 'درصد ارسال' : 'درصد دریافت'}</span>
          <b id="syncProgressPercent">${fa(syncProgress.percent)}٪</b>
        </span>
      </div>
      <div class="sync-progress-track" id="syncProgressTrack" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${syncProgress.percent}">
        <div class="sync-progress-fill" id="syncProgressFill"></div>
      </div>
      <div class="sync-progress-note" id="syncProgressNote">${esc(syncProgress.note || '')}</div>
    </div>`;
}

function syncStateBadge(online, loggedIn, busy) {
  if (!loggedIn) return { text: 'نیاز به ورود', cls: 'warn' };
  if (busy) return { text: 'در حال سینک', cls: 'busy' };
  if (!online) return { text: 'آفلاین', cls: 'warn' };
  if (realtimePush.connected) return { text: 'زنده', cls: 'live' };
  return { text: 'آماده', cls: '' };
}

function accountActionButton(id, label, className) {
  return `<button type="button" class="btn ${className || 'ghost'} account-btn" id="${id}">${label}</button>`;
}

function renderAccountUI(loggedIn, phone, online, busy, lastSync) {
  const box = document.getElementById('accountUI');
  if (!box) return;
  const role = getLoggedInRole();
  const stateKey = `${loggedIn}|${phone}|${role}|${online}|${busy}|${lastSync}`;
  const active = document.activeElement;
  if (active && box.contains(active) &&
      /^(INPUT|TEXTAREA|SELECT)$/.test(String(active.tagName || '').toUpperCase()) &&
      accountRenderState === stateKey) return;
  accountRenderState = stateKey;

  if (!loggedIn) {
    box.innerHTML = `
      <div class="account-row">
        <span class="account-avatar muted-avatar">👤</span>
        <div class="account-identity">
          <div class="account-phone">حساب کاربری متصل نیست</div>
          <div class="account-sub">برای همگامسازی وارد شوید یا ثبتنام کنید</div>
        </div>
        <button type="button" class="btn primary account-btn" id="accountLoginBtn">ورود</button>
      </div>`;
    const loginBtn = document.getElementById('accountLoginBtn');
    if (loginBtn) loginBtn.onclick = () => {
      try { if (window.masirAuth) window.masirAuth.show('login'); } catch (e) {}
    };
    return;
  }

  const initial = String(phone || '?').trim().charAt(0).toUpperCase() || '?';
  const adminButtons = role === 'admin'
    ? accountActionButton('accountAdminBtn', 'مدیریت کاربران', 'ghost')
    : '';
  const advisorButtons = (role === 'advisor' || role === 'admin')
    ? accountActionButton('accountAdvisorCodeBtn', 'کد مشاور', 'ghost')
    : '';
  const studentButtons = role === 'student'
    ? accountActionButton('accountPairAdvisorBtn', 'اتصال مشاور', 'ghost')
    : '';
  box.innerHTML = `
    <div class="account-row">
      <span class="account-avatar">${esc(initial)}</span>
      <div class="account-identity">
        <div class="account-phone" dir="ltr">${esc(phone || 'حساب متصل')}</div>
        <div class="account-sub"><span class="sync-status-${online ? 'online' : 'offline'}">${online ? 'آنلاین' : 'آفلاین'}</span> • آخرین سینک: ${esc(lastSync)}</div>
      </div>
      ${accountActionButton('accountLogoutBtn', 'خروج', 'ghost')}
    </div>
    <div class="account-actions">
      ${accountActionButton('accountPasswordBtn', 'تغییر رمز', 'ghost')}
      ${adminButtons}${advisorButtons}${studentButtons}
    </div>`;

  const bind = (id, handler) => {
    const btn = document.getElementById(id);
    if (btn) btn.onclick = handler;
  };
  bind('accountLogoutBtn', () => {
    if (busy) return;
    if (!confirm('از حساب کاربری خارج میشوید؟')) return;
    logoutSql();
    toast('خارج شدید');
  });
  const openAuth = mode => () => {
    try { if (window.masirAuth) window.masirAuth.show(mode); } catch (e) {}
  };
  bind('accountPasswordBtn', openAuth('password'));
  bind('accountAdminBtn', openAuth('admin'));
  bind('accountAdvisorCodeBtn', openAuth('advisor-code'));
  bind('accountPairAdvisorBtn', openAuth('pair-advisor'));
}

function renderSyncUI() {
  const box = document.getElementById('syncUI');
  if (!box) return;
  const loggedIn = isLoggedIn();
  const phone = getLoggedInPhone();
  const lastSync = formatLastSync();
  const online = typeof navigator !== 'undefined' ? navigator.onLine !== false : true;
  const busy = !!syncBusy || autoSyncRunning;
  const badge = syncStateBadge(online, loggedIn, busy);

  renderAccountUI(loggedIn, phone, online, busy, lastSync);

  if (!loggedIn) {
    box.innerHTML = `
      <div class="sync-card-head">
        <div class="sync-card-title">همگامسازی ابری</div>
        <span class="sync-state-pill warn">${badge.text}</span>
      </div>
      <div class="sync-empty-note">پس از ورود، وضعیت همگامسازی خودکار اینجا نمایش داده میشود.</div>`;
    return;
  }

  box.innerHTML = `
    <div class="sync-card-head">
      <div class="sync-card-title">همگامسازی ابری</div>
      <span class="sync-state-pill ${badge.cls}">${badge.text}</span>
    </div>
    <div class="sync-pending-row">
      <span class="sync-pending" id="syncPendingStatus">در حال بررسی تغییرات…</span>
    </div>
    <div class="sync-auto-note">همگامسازی خودکار فعال است؛ تغییرات به محض اتصال ارسال و دریافت میشوند.</div>
    ${syncError ? `<div class="sync-login-error show">⚠️ ${esc(syncError)}</div>` : ''}
    ${syncProgressMarkup()}`;

  if (busy) setProgress(syncProgress.kind, syncProgress.percent, syncProgress.note, true);
  refreshPendingBadge();
}

function onSettingsOpen() {
  renderSyncUI();
  if (isLoggedIn()) startRealtimePush();
}

/* ============ public API ============ */
window.sqlSync = {
  isLoggedIn,
  getLoggedInPhone,
  getLoggedInEmail,
  getLoggedInUserId,
  getLoggedInRole,
  getLastSyncTimestamp,
  formatLastSync,
  getClient: getSqlClient,
  saveBaseUrl: saveSqlBaseUrl,
  baseUrl: sqlBaseUrl,
  login: loginWithPassword,
  completeSignup,
  requestOtp: (phone, purpose) => getSqlClient().requestOtp(phone, purpose || 'signup'),
  verifyOtp: (phone, code, purpose) => getSqlClient().verifyOtp(phone, code, purpose),
  resetPassword: resetPasswordWithOtp,
  changePassword,
  adminCreateUser: (phone, password, options) => getSqlClient().createUser(phone, password, options),
  adminResetPassword: (phone, password) => getSqlClient().resetUserPassword(phone, password),
  advisorLinks: () => getSqlClient().advisorLinks(),
  acceptAdvisor: code => getSqlClient().acceptAdvisor(code),
  inviteAdvisor: () => getSqlClient().inviteAdvisor(),
  assignStudent: (advisorPhone, studentPhone) => getSqlClient().assignStudent(advisorPhone, studentPhone),
  uploadAllData,
  downloadAllData,
  cycle: syncCycle,
  syncNow,
  startAutoSync,
  onSettingsOpen,
  logout: logoutSql,
  isAutoSyncEnabled: () => autoSyncEnabled,
  render: renderSyncUI,
  realtimeStatus: () => ({
    supported: typeof WebSocket !== 'undefined',
    connected: realtimePush.connected,
    lastEventAt: realtimePush.lastEventAt
  }),
  startRealtime: startRealtimePush
};
window.masirSqlSync = window.sqlSync;

readSession();
