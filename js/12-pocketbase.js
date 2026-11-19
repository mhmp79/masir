'use strict';

/* ============================================================
   POCKETBASE — همگام‌سازی خودکار دوطرفه (نسخه ۴.۲.۱۰)
   - هر کاربر با ایمیل/رمز خودش وارد می‌شود؛ داده‌ها با فیلد owner جدا می‌شوند
   - ارسال تدریجی: فقط رکوردهایی که تغییر کرده‌اند ارسال می‌شوند
   - دریافت تدریجی: فقط رکوردهایی که از آخرین سینک `updated` تازه‌تری دارند
     خوانده می‌شوند (فیلتر سمت سرور)، نه فهرست کامل مجموعه
   - حذف‌ها با «حساب تعداد» تشخیص داده می‌شوند: تعداد سرور با تعداد شناخته‌شده
     به‌علاوهٔ رکوردهای تازه مقایسه می‌شود؛ فقط در صورت اختلاف، فهرست کامل
     همان مجموعه خوانده می‌شود
   - اگر تغییری برای ارسال یا دریافت نباشد، عملاً هیچ داده‌ای جابه‌جا نمی‌شود
   - رویداد زندهٔ PocketBase دقیقاً همان رکورد را اعمال میکند؛ بدون
     بازبینی فهرست یا شمارش کل مجموعهها
   - اولین سینک دستگاه تازه اول دریافت می‌کند تا دادهٔ سرور بازنویسی نشود
   - هر ۶۰ ثانیه یک «کاوش ارزان» انجام می‌شود: فقط پرسیده می‌شود آیا رکوردی
     تازه‌تر از آخرین وضعیت شناخته‌شده روی سرور هست یا نه؛ سینک کامل فقط
     وقتی سرور واقعاً تغییر کرده باشد اجرا می‌شود
   ============================================================ */

const POCKETBASE_URL_DEFAULT = 'https://masir-69623a.dockhold.app';
const PB_URL_KEY = 'konkur-pb-url-v1';
const LAST_SYNC_KEY = 'konkur-last-sync-v1';
const AUTH_TOKEN_KEY = 'konkur-pb-auth-v1';
const PB_SYNC_META_KEY = 'konkur-pb-sync-meta-v1';
const PB_SYNC_META_VERSION = 3;
/* نسخهٔ بازبینی سلامت: یک‌بار پس از این ارتقا رکوردهای ناقص محلی ترمیم می‌شوند.
   نسخهٔ ۴ علاوه بر ترمیم رکوردهای ناقص، مقدار رکوردهایی را که نسخه‌های قبلی
   «دیده‌شده» ثبت کرده بودند ولی هرگز اعمال نکرده بودند دوباره مقایسه می‌کند. */
const PB_SYNC_INTEGRITY_VERSION = 5;
const PB_SYNC_META_LIMIT = 3;
const PB_MANIFEST_FIELDS = 'id,localId,updated';
const PB_DELETE_CHECK_GAP = 24 * 60 * 60 * 1000;
const PB_DEFAULT_PAGE_SIZE = 200;
/* در هر چرخه چند رکورد برای «ترمیم خودکار» با مقدار سرور مقایسه شود */
const PB_VERIFY_BATCH = 40;

let pocketBaseClient = null;
let pocketBaseClientUrl = '';
let syncBusy = null;            // 'upload' | 'download' | null
let syncError = null;
let syncNotice = null;
let syncProgress = { active: false, kind: 'upload', percent: 0, note: '' };
let lastProgressPaint = 0;

/* ============ server / client ============ */
function pocketBaseBaseUrl() {
  try {
    const saved = localStorage.getItem(PB_URL_KEY);
    if (saved) return saved;
  } catch (e) {}
  return POCKETBASE_URL_DEFAULT;
}
function normalizeBaseUrl(url) {
  return String(url || '').trim().replace(/\/+$/, '');
}
function savePocketBaseBaseUrl(url) {
  const value = normalizeBaseUrl(url);
  try { localStorage.setItem(PB_URL_KEY, value); } catch (e) {}
  return value;
}
function getPocketBaseClient() {
  if (typeof PocketBase === 'undefined') {
    throw new Error('کتابخانه PocketBase بارگذاری نشد؛ اتصال اینترنت را بررسی کنید.');
  }
  const url = normalizeBaseUrl(pocketBaseBaseUrl());
  if (pocketBaseClient && pocketBaseClientUrl === url) return pocketBaseClient;
  pocketBaseClient = new PocketBase(url);
  pocketBaseClientUrl = url;
  return pocketBaseClient;
}
function pocketBaseUser(pb) {
  const store = pb && pb.authStore;
  return (store && (store.record || store.model)) || null;
}
function pocketBaseUserId(pb) {
  const user = pocketBaseUser(pb);
  return user && user.id ? String(user.id) : '';
}

/* ============ legacy token (سازگاری با نسخه‌های قبلی) ============ */
function saveLegacyToken(token) {
  try { localStorage.setItem(AUTH_TOKEN_KEY, token || ''); } catch (e) {}
}
function loadLegacyToken() {
  try { return localStorage.getItem(AUTH_TOKEN_KEY) || ''; } catch (e) { return ''; }
}
function clearLegacyToken() {
  try { localStorage.removeItem(AUTH_TOKEN_KEY); } catch (e) {}
}

/* ============ login state ============ */
function isLoggedIn() {
  try {
    const pb = getPocketBaseClient();
    if (pb.authStore && pb.authStore.isValid) return true;
  } catch (e) {}
  return !!loadLegacyToken();
}
function getLoggedInEmail() {
  try {
    const pb = getPocketBaseClient();
    const user = pocketBaseUser(pb);
    if (user) return user.email || user.id || '';
  } catch (e) {}
  const token = loadLegacyToken();
  if (!token) return '';
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload.email || payload.id || '';
  } catch (e) { return ''; }
}

async function ensureAuthModel(pb) {
  const store = pb.authStore;
  if (store.isValid && pocketBaseUserId(pb)) return true;

  const legacyToken = loadLegacyToken();
  if (legacyToken) {
    try {
      store.save(legacyToken, null);
      const result = await pb.collection('users').authRefresh({ requestKey: null });
      const record = result && (result.record || result);
      if (record && record.id) {
        saveLegacyToken(store.token);
        return true;
      }
    } catch (e) {
      clearLegacyToken();
      try { store.clear(); } catch (_) {}
      return false;
    }
  }

  if (store.token) {
    try {
      const result = await pb.collection('users').authRefresh({ requestKey: null });
      const record = result && (result.record || result);
      if (record && record.id) return true;
    } catch (e) {
      try { store.clear(); } catch (_) {}
      return false;
    }
  }

  return false;
}

async function requirePocketBaseAuth() {
  let pb;
  try { pb = getPocketBaseClient(); }
  catch (e) { throw new Error(e.message || 'اتصال به PocketBase ممکن نشد'); }
  const ok = await ensureAuthModel(pb).catch(() => false);
  if (!ok || !pocketBaseUserId(pb)) {
    clearLegacyToken();
    try { pb.authStore.clear(); } catch (_) {}
    throw new Error('نشست منقضی شده است؛ دوباره وارد شوید.');
  }
  return pb;
}

/* ============ last-sync timestamp ============ */
function getLastSyncTimestamp() {
  try {
    if (typeof isLoggedIn === 'function' && isLoggedIn()) {
      const owner = pocketBaseUserId(getPocketBaseClient());
      const meta = owner ? loadSyncMeta(normalizeBaseUrl(pocketBaseBaseUrl()), owner) : null;
      if (meta && meta.lastSyncAt) return +meta.lastSyncAt;
    }
  } catch (e) {}
  try {
    const raw = localStorage.getItem(LAST_SYNC_KEY);
    return raw ? parseInt(raw, 10) : null;
  } catch (e) { return null; }
}
function setLastSyncTimestamp(ts) {
  try { localStorage.setItem(LAST_SYNC_KEY, String(ts)); } catch (e) {}
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

/* ============ metadata سینک تدریجی (برای هر سرور/کاربر) ============ */
function readSyncMetaStore() {
  try {
    const raw = localStorage.getItem(PB_SYNC_META_KEY);
    if (!raw) return {};
    const data = JSON.parse(raw);
    return data && typeof data === 'object' ? data : {};
  } catch (e) { return {}; }
}
function syncMetaKey(server, owner) {
  return `${normalizeBaseUrl(server)}|${owner}`;
}
/* ارتقای فرادادهٔ نسخهٔ قبل بدون وادار کردن دستگاه به دریافت کامل دوباره */
function migrateSyncMeta(meta) {
  if (!meta || meta.version === PB_SYNC_META_VERSION) return meta;
  if (meta.version === 2 && meta.remote && typeof meta.remote === 'object') {
    const floor = {};
    const counts = {};
    Object.keys(meta.remote).forEach(collection => {
      const map = meta.remote[collection] || {};
      let max = '';
      Object.keys(map).forEach(localId => {
        const value = map[localId];
        if (value && value > max) max = value;
      });
      if (max) floor[collection] = max;
      counts[collection] = Object.keys(map).length;
    });
    /* تعدادهای شناخته‌شده از فهرست قبلی ساخته می‌شوند؛ اگر سرور با آن‌ها
       اختلاف داشته باشد، «حساب تعداد» خودش همان مجموعه را بازبینی می‌کند. */
    return { ...meta, version: PB_SYNC_META_VERSION, floor, counts, countsAt: Date.now() };
  }
  return null;
}
function loadSyncMeta(server, owner) {
  if (!owner) return null;
  try {
    const meta = migrateSyncMeta(readSyncMetaStore()[syncMetaKey(server, owner)]);
    if (!meta || meta.version !== PB_SYNC_META_VERSION) return null;
    if (!meta.remote || typeof meta.remote !== 'object') return null;
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
      version: PB_SYNC_META_VERSION,
      server: normalizeBaseUrl(server),
      owner,
      savedAt: Date.now()
    };
    Object.keys(all)
      .filter(item => item !== key)
      .sort((a, b) => (all[b].savedAt || 0) - (all[a].savedAt || 0))
      .slice(PB_SYNC_META_LIMIT - 1)
      .forEach(item => delete all[item]);
    localStorage.setItem(PB_SYNC_META_KEY, JSON.stringify(all));
  } catch (e) {
    console.warn('[PB] saving sync metadata failed:', e);
  }
}

/* ============ collection mapping ============ */
const PB_COLLECTIONS = {
  'app-meta': 'settings',
  subjects: 'subjects',
  activities: 'activities',
  classes: 'classes',
  sessions: 'sessions',
  sleeps: 'sleeps',
  phones: 'phones',
  exams: 'exams',
  questions: 'questions',
  plan: 'plan',
  reserved: 'reserved'
};
const PB_UPLOAD_STORES = ['app-meta', 'subjects', 'activities', 'classes', 'sessions', 'sleeps', 'phones', 'exams', 'questions'];
const PB_DOWNLOAD_STORES = [...PB_UPLOAD_STORES, 'plan', 'reserved'];
const POCKETBASE_TRACKER_ID = 'tracker';

function pbCollectionName(store) {
  return PB_COLLECTIONS[store] || store;
}

/* ============ helpers ============ */
function pbFilterValue(value) {
  return String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}
function pocketBaseErrorMessage(error) {
  if (!error) return 'خطای ناشناخته';
  if (typeof error === 'string') return error;
  if (error.status === 404) return 'مجموعه موردنیاز روی سرور پیدا نشد — در پنل pocketbase/pb_collections_panel.json را ایمپورت کنید یا setup_pocketbase.py را اجرا کنید';
  if (error.status === 429) return 'سرور تعداد درخواست‌ها را محدود کرده (Too Many Requests) — چند لحظه صبر کنید و دوباره امتحان کنید، یا در پنل PocketBase محدودیت نرخ را بردارید';
  if (error.status === 401 || error.status === 403) return 'دسترسی به این حساب مجاز نیست؛ دوباره وارد شوید';
  if (error.status === 400 && error.message === 'Failed to authenticate.') {
    return 'ایمیل یا رمز عبور اشتباه است';
  }
  if (error.data && typeof error.data === 'object') {
    const details = Object.entries(error.data)
      .filter(([field, v]) => field !== 'message' && field !== 'status' && field !== 'data' && v && typeof v === 'object' && v.message)
      .map(([field, v]) => `${field}: ${v.message}`).join('، ');
    if (details) return `${error.message || 'PB error'} (${details})`;
  }
  if (error.message) return error.message;
  return 'خطای ناشناخته';
}
function isUniqueConflictError(err) {
  if (!err || err.status !== 400) return false;
  try {
    const text = JSON.stringify(err.data || err.response?.data || {}).toLowerCase();
    return text.includes('validation_not_unique') || text.includes('unique');
  } catch (_) { return false; }
}
/* رکورد سرور پیدا نشد (حذف یا بازسازی شده)؛ شناسه باید دوباره گرفته شود */
function isMissingRecordError(err) {
  return !!err && err.status === 404;
}
/* محدودیت نرخ PocketBase: تلاش دوباره با تأخیر فزاینده */
const PB_RATE_LIMIT_ATTEMPTS = 8;
let pbCooldownUntil = 0;
let pbWriteGapMs = 0;
let pbNextRequestAt = 0;
let pbLastRateLimitAt = 0;
function pbSleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
function isRateLimitError(error) {
  if (!error) return false;
  return error.status === 429 || /too many requests/i.test(String(error.message || ''));
}
function resetRateLimitPacing() {
  pbCooldownUntil = 0;
  pbWriteGapMs = 0;
  pbNextRequestAt = 0;
  pbLastRateLimitAt = 0;
}
async function pbPace() {
  /* وقتی سرور ۴۲۹ می‌دهد، بین درخواست‌ها فاصله می‌گذاریم تا زیر سقف نرخ بمانیم */
  const wait = Math.max(pbCooldownUntil, pbNextRequestAt) - Date.now();
  if (wait > 0) await pbSleep(wait);
  if (pbWriteGapMs) pbNextRequestAt = Math.max(Date.now(), pbNextRequestAt) + pbWriteGapMs;
}
async function withRateLimitRetry(fn) {
  for (let attempt = 0; ; attempt++) {
    await pbPace();
    try {
      return await fn();
    } catch (error) {
      if (!isRateLimitError(error) || attempt >= PB_RATE_LIMIT_ATTEMPTS) throw error;
      const now = Date.now();
      if (now - pbLastRateLimitAt > 1500) {
        pbWriteGapMs = Math.min(520, pbWriteGapMs ? pbWriteGapMs + 80 : 280);
      }
      pbLastRateLimitAt = now;
      const delay = Math.min(10000, 700 * Math.pow(2, attempt)) + Math.floor(Math.random() * 300);
      pbCooldownUntil = Math.max(pbCooldownUntil, Date.now() + delay);
      if (syncBusy && syncProgress.active) {
        setProgress(syncProgress.kind, syncProgress.percent, 'سرور محدودیت درخواست گذاشته؛ تلاش دوباره…', true);
      }
    }
  }
}
async function mapLimit(items, limit, worker) {
  let index = 0;
  const runners = Array.from({ length: Math.min(Math.max(1, limit), items.length) }, async () => {
    while (index < items.length) {
      const current = items[index++];
      await worker(current);
    }
  });
  await Promise.all(runners);
}

async function findExistingRecord(pb, collection, ownerId, localId) {
  try {
    const filter = `owner="${pbFilterValue(ownerId)}" && localId="${pbFilterValue(localId)}"`;
    const res = await withRateLimitRetry(() => pb.collection(collection).getList(1, 1, { filter, skipTotal: true, requestKey: null }));
    return (res.items && res.items[0]) || null;
  } catch (e) {
    return null;
  }
}

async function fetchOwnerRecords(pb, collection, ownerId) {
  const items = [];
  const perPage = 200;
  for (let page = 1; page < 500; page++) {
    const res = await withRateLimitRetry(() => pb.collection(collection).getList(page, perPage, {
      filter: `owner="${pbFilterValue(ownerId)}"`,
      skipTotal: true,
      requestKey: null
    }));
    const batch = (res && res.items) || [];
    batch.forEach(item => items.push(item));
    if (batch.length < perPage) break;
  }
  return items;
}

/* فهرست سبک سرور: فقط شناسه‌ها و زمان آخرین تغییر، بدون مقدار رکوردها */
async function fetchOwnerManifest(pb, collection, ownerId) {
  const items = [];
  const perPage = 200;
  for (let page = 1; page < 500; page++) {
    const res = await withRateLimitRetry(() => pb.collection(collection).getList(page, perPage, {
      filter: `owner="${pbFilterValue(ownerId)}"`,
      fields: PB_MANIFEST_FIELDS,
      skipTotal: true,
      requestKey: null
    }));
    const batch = (res && res.items) || [];
    batch.forEach(item => items.push(item));
    if (batch.length < perPage) break;
  }
  return items;
}

/* رکوردهای تغییرکرده را با شناسهٔ سرور می‌خوانیم، نه کل مجموعه */
async function fetchRemoteIdMap(pb, collection, ownerId, localIds) {
  const map = new Map();
  if (!localIds || !localIds.length) return map;
  const chunkSize = 20;
  for (let start = 0; start < localIds.length; start += chunkSize) {
    const chunk = localIds.slice(start, start + chunkSize);
    const localFilter = chunk.map(id => `localId="${pbFilterValue(id)}"`).join(' || ');
    const filter = `owner="${pbFilterValue(ownerId)}" && (${localFilter})`;
    const res = await withRateLimitRetry(() => pb.collection(collection).getList(1, chunk.length, {
      filter,
      fields: 'id,localId,updated,value,order',
      skipTotal: true,
      requestKey: null
    }));
    ((res && res.items) || []).forEach(item => map.set(String(item.localId), item));
  }
  return map;
}

/* فقط رکوردهایی که از یک زمان مشخص به بعد تغییر کرده‌اند (فیلتر سمت سرور) */
async function fetchChangedSince(pb, collection, ownerId, since) {  const items = [];
  const perPage = PB_DEFAULT_PAGE_SIZE;
  const filter = `owner="${pbFilterValue(ownerId)}" && updated >= "${pbFilterValue(since)}"`;
  for (let page = 1; page < 500; page++) {
    const res = await withRateLimitRetry(() => pb.collection(collection).getList(page, perPage, {
      filter,
      sort: 'updated,id',
      skipTotal: true,
      requestKey: null
    }));
    const batch = (res && res.items) || [];
    batch.forEach(item => items.push(item));
    if (batch.length < perPage) break;
  }
  return items;
}

/* فهرست سبک فقط شناسه و زمان تغییر دارد؛ برای رکوردهای تغییرکرده،
   مقدار کامل همان چند رکورد را جداگانه می‌خوانیم. */
async function fetchRemoteValuesByLocalIds(pb, collection, ownerId, localIds) {
  const items = [];
  const unique = [...new Set((localIds || []).map(id => String(id)))];
  const chunkSize = 20;
  for (let start = 0; start < unique.length; start += chunkSize) {
    const chunk = unique.slice(start, start + chunkSize);
    const localFilter = chunk.map(id => `localId="${pbFilterValue(id)}"`).join(' || ');
    const res = await withRateLimitRetry(() => pb.collection(collection).getList(1, chunk.length, {
      filter: `owner="${pbFilterValue(ownerId)}" && (${localFilter})`,
      skipTotal: true,
      requestKey: null
    }));
    ((res && res.items) || []).forEach(item => items.push(item));
  }
  return items;
}

/* تعداد رکوردهای سرور؛ برای تشخیص حذف (که در فیلتر updated دیده نمی‌شود) */
async function fetchOwnerCount(pb, collection, ownerId) {
  const res = await withRateLimitRetry(() => pb.collection(collection).getList(1, 1, {
    filter: `owner="${pbFilterValue(ownerId)}"`,
    skipTotal: false,
    requestKey: null
  }));
  if (res && typeof res.totalItems === 'number') return res.totalItems;
  return ((res && res.items) || []).length;
}

/* مقایسهٔ پایدار دو مقدار JSON بدون توجه به ترتیب کلیدها */
function pbSameJsonValue(a, b) {
  const stable = value => {
    if (value === null || typeof value !== 'object') return JSON.stringify(value);
    if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
    const keys = Object.keys(value).sort();
    return `{${keys.map(key => `${JSON.stringify(key)}:${stable(value[key])}`).join(',')}}`;
  };
  try { return stable(a) === stable(b); }
  catch (error) { return false; }
}

/* آیا سرور مقدار ارسالی را ذخیره نکرده است؟ فقط کلیدهای ارسالی بررسی
   می‌شوند تا فیلدهای اضافه‌ای که سرور برمی‌گرداند خطا ایجاد نکنند. */
function pbValueDrift(sent, saved) {
  if (sent === undefined || sent === null) return false;
  if (saved === undefined || saved === null) return true;
  if (typeof sent !== 'object' || sent === null || Array.isArray(sent)) {
    return !pbSameJsonValue(sent, saved);
  }
  if (typeof saved !== 'object' || Array.isArray(saved)) return true;
  return Object.keys(sent).some(key => !pbSameJsonValue(sent[key], saved[key]));
}

/* آیا مقدار ذخیره‌شده روی این دستگاه با مقدار رکورد سرور یکی است؟
   برای «ترمیم خودکار» استفاده می‌شود؛ فقط مقدار مقایسه می‌شود، نه ترتیب. */
function pbLocalValueMatches(storeSnapshot, canonical, item) {
  const json = storeSnapshot && storeSnapshot.get(canonical);
  if (!json) return false;
  try {
    const local = JSON.parse(json);
    return pbSameJsonValue(local && local.value, item && item.value);
  } catch (error) {
    return false;
  }
}

/* برخی مجموعه‌ها هرگز مقدار خالی ندارند؛ اگر خالی بود یعنی رکورد ناقص ذخیره شده است.
   (برای classes مقدار خالی یعنی کلاس بدون جلسه و طبیعی است.) */
const PB_NON_EMPTY_VALUE_STORES = new Set([
  'subjects', 'activities', 'sessions', 'sleeps', 'phones', 'exams', 'questions'
]);
function pbLocalSnapshotDamaged(store, json) {
  let parsed;
  try { parsed = JSON.parse(json); }
  catch (error) { return true; }
  if (!parsed || !Object.prototype.hasOwnProperty.call(parsed, 'value')) return true;
  const value = parsed.value;
  if (value == null) return true;
  if (typeof value === 'string') return !value.trim();
  if (typeof value !== 'object' || Array.isArray(value)) return false;
  if (!Object.keys(value).length) return PB_NON_EMPTY_VALUE_STORES.has(store);
  return false;
}

/* بزرگ‌ترین زمان تغییرِ شناخته‌شده برای یک مجموعه (از floor و فهرست رکوردها) */
function syncKnownMax(meta, collection) {
  let max = (meta && meta.floor && meta.floor[collection]) || '';
  const remoteMap = (meta && meta.remote && meta.remote[collection]) || {};
  Object.keys(remoteMap).forEach(key => {
    const value = remoteMap[key];
    if (typeof value === 'string' && value > max) max = value;
  });
  return max;
}

function maxUpdatedTimestamp(records) {  let max = '';
  (records || []).forEach(record => {
    const value = pbManifestTimestamp(record);
    if (value && value > max) max = value;
  });
  return max;
}

function pbStoreForCollection(collection) {
  return collection === pbCollectionName('app-meta') ? 'app-meta' : collection;
}

/* در مجموعهٔ settings همه‌چیز به‌جز شمارنده به شناسهٔ اصلی نگاشت می‌شود */
function pbCanonicalLocalId(store, localId) {
  const id = String(localId == null ? '' : localId);
  if (store !== 'app-meta') return id;
  if (id === POCKETBASE_TRACKER_ID) return id;
  return DB_STATE_ID;
}

/* اگر مجموعه ستون updated نداشته باشد، «null» یعنی زمان تغییر نامعلوم است */
function pbManifestTimestamp(record) {
  if (!record || !Object.prototype.hasOwnProperty.call(record, 'updated')) return null;
  return String(record.updated || '');
}

function pbManifestUpdatedMap(store, records) {
  const map = {};
  (records || []).forEach(record => {
    const localId = pbCanonicalLocalId(store, record.localId);
    if (!localId) return;
    map[localId] = pbManifestTimestamp(record);
  });
  return map;
}

/* شمارندهٔ تست بیرون از state است و جداگانه ارسال می‌شود */
function currentTrackerPayload() {
  if (typeof trkCounts === 'undefined') return null;
  return {
    counts: {
      correct: Math.max(0, +trkCounts.correct || 0),
      wrong: Math.max(0, +trkCounts.wrong || 0),
      blank: Math.max(0, +trkCounts.blank || 0)
    },
    coef: (typeof trkCoef !== 'undefined' && isFinite(+trkCoef)) ? +trkCoef : 0
  };
}
function trackerSignatureOf(payload) {
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
  if (typeof trkCoef !== 'undefined' && isFinite(+remoteTracker.coef)) trkCoef = +remoteTracker.coef;
  try { saveTracker(); } catch (e) { console.warn('[PB] saving tracker failed:', e); }
}

async function readPendingChanges(limit = 100000) {
  if (!window.storageSync || typeof window.storageSync.pendingChangesProvider !== 'function') return null;
  try {
    return (await window.storageSync.pendingChangesProvider(limit)) || [];
  } catch (error) {
    console.warn('[PB] reading pending changes failed:', error);
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

/* ============ progress ============ */
function setProgress(kind, percent, note, force = false) {
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
  const percentLabel = document.getElementById('syncProgressPercentLabel');
  if (percentLabel) percentLabel.textContent = kind === 'upload' ? 'درصد ارسال' : 'درصد دریافت';
  const noteEl = document.getElementById('syncProgressNote');
  if (noteEl) noteEl.textContent = syncProgress.note || '';
  const title = document.getElementById('syncProgressTitle');
  if (title) title.textContent = kind === 'upload' ? 'ارسال داده‌ها' : 'دریافت داده‌ها';
  const bar = document.getElementById('syncProgressBar');
  if (bar) bar.hidden = false;
}

function resetProgress() {
  syncProgress = { active: false, kind: 'upload', percent: 0, note: '' };
  lastProgressPaint = 0;
}

/* ============ upload (snapshot mirror) ============ */
function buildUploadRecords() {
  const snapshot = normalizedStorageSnapshot(compactStateForStorage(state));
  const items = [];
  PB_UPLOAD_STORES.forEach(store => {
    const records = snapshot.get(store);
    if (!records) return;
    records.forEach((json, localId) => {
      let record;
      try { record = JSON.parse(json); } catch (e) { return; }
      items.push({
        store,
        collection: pbCollectionName(store),
        localId: String(localId),
        record
      });
    });
  });
  /* شمارنده تست (خارج از state، در localStorage) */
  if (typeof trkCounts !== 'undefined') {
    items.push({
      store: 'app-meta',
      collection: pbCollectionName('app-meta'),
      localId: POCKETBASE_TRACKER_ID,
      record: {
        value: {
          counts: {
            correct: Math.max(0, +trkCounts.correct || 0),
            wrong: Math.max(0, +trkCounts.wrong || 0),
            blank: Math.max(0, +trkCounts.blank || 0)
          },
          coef: (typeof trkCoef !== 'undefined' && isFinite(+trkCoef)) ? +trkCoef : 0
        }
      }
    });
  }
  return items;
}

function uploadRecordPayload(item, ownerId, orderOnly) {
  const record = item.record || {};
  const data = { owner: ownerId, localId: item.localId };
  if (!orderOnly) {
    if (record.value !== undefined) {
      data.value = record.value;
    } else {
      const value = { ...record };
      delete value.id;
      delete value.order;
      delete value.examId;
      data.value = value;
    }
  }
  if (record.order !== undefined && record.order !== null) data.order = record.order;
  if (record.examId) data.examId = record.examId;
  return data;
}

/* فقط فیلدهایی که کاربر روی همین دستگاه عوض کرده است برداشته می‌شود */
function pbPickValueFields(value, fields) {
  const picked = {};
  if (!value || typeof value !== 'object' || Array.isArray(value) || !Array.isArray(fields)) return picked;
  fields.forEach(field => {
    if (Object.prototype.hasOwnProperty.call(value, field)) picked[field] = value[field];
  });
  return picked;
}

/*
 * ادغام مقدار سرور با فیلدهای تغییرکردهٔ محلی.
 * پایهٔ ادغام نسخهٔ سرور است تا ویرایش‌های دستگاه‌های دیگر پاک نشود؛
 * فقط فیلدهایی که کاربر همین‌جا عوض کرده روی آن نوشته می‌شود.
 */
function pbMergeValueWithFields(remoteValue, localValue, fields) {
  const base = remoteValue && typeof remoteValue === 'object' && !Array.isArray(remoteValue)
    ? { ...remoteValue }
    : {};
  return { ...base, ...pbPickValueFields(localValue, fields) };
}

/*
 * نوشتن یک رکورد: اگر شناسهٔ سرور شناخته شده باشد PATCH، وگرنه POST.
 * - اگر PATCH خطای ۴۰۴ بدهد (رکورد سرور حذف/بازسازی شده)، شناسه دوباره
 *   خوانده می‌شود و در نهایت رکورد تازه ساخته می‌شود؛ ویرایش گم نمی‌شود.
 * - پس از نوشتن، مقدارِ برگشتی سرور با مقدار ارسالی مقایسه می‌شود؛ اگر
 *   سرور مقدار را ذخیره نکرده باشد خطا برگردانده می‌شود تا تغییر «تأیید»
 *   نشود و در صف ارسال بماند.
 */
async function upsertRemoteRecord(pb, item, ownerId, remoteByLocalId, change) {
  const existing = remoteByLocalId && remoteByLocalId.get(item.localId);
  const fields = change && Array.isArray(change.fields) ? change.fields : null;
  /* تغییر «فقط ترتیب» نباید مقدار رکورد را بازنویسی کند؛ فقط order می‌رود */
  const orderOnly = !!(fields && !fields.length && existing && existing.id);
  /* نوشتن جزئی (فقط order یا مقدارِ ادغام‌شده) یعنی نسخهٔ محلی هنوز کاملاً
     با سرور یکی نیست؛ زمان سرور نباید به‌عنوان «دیده‌شده» ثبت شود. */
  const partial = !!(fields && existing && existing.id);
  const data = uploadRecordPayload(item, ownerId, orderOnly);
  if (!orderOnly && fields && fields.length && existing && existing.value !== undefined) {
    data.value = pbMergeValueWithFields(existing.value, item.record && item.record.value, fields);
  }
  const fullData = () => uploadRecordPayload(item, ownerId, false);

  const ensureStored = saved => {
    if (!saved) return saved;
    if (data.value === undefined) return saved;
    if (!pbValueDrift(data.value, saved.value)) return saved;
    const error = new Error(`سرور مقدار «${item.collection}» را ذخیره نکرد`);
    error.status = 409;
    error.valueDrift = true;
    throw error;
  };
  const updateById = (id, payload = data) => pb.collection(item.collection).update(id, payload, { requestKey: null });
  const createOrAdopt = async () => {
    const payload = orderOnly ? fullData() : data;
    try {
      return await pb.collection(item.collection).create(payload, { requestKey: null });
    } catch (error) {
      if (!isUniqueConflictError(error) && !isMissingRecordError(error)) throw error;
      const found = await findExistingRecord(pb, item.collection, ownerId, item.localId);
      if (!found || !found.id) throw error;
      return await updateById(found.id, payload);
    }
  };

  const record = await withRateLimitRetry(async () => {
    if (existing && existing.id) {
      try {
        return ensureStored(await updateById(existing.id));
      } catch (error) {
        if (!isMissingRecordError(error)) throw error;
        const found = await findExistingRecord(pb, item.collection, ownerId, item.localId);
        if (found && found.id && found.id !== existing.id) {
          return ensureStored(await updateById(found.id));
        }
        return ensureStored(await createOrAdopt());
      }
    }
    return ensureStored(await createOrAdopt());
  });
  return { record, partial };
}

/*
 * در ارسال تدریجی به فهرست کامل مجموعه نیاز نیست؛ فقط شناسهٔ سرور
 * همان رکوردهایی را می‌گیریم که تغییر محلی دارند. مجموعهٔ settings
 * (که فقط چند رکورد دارد) مثل قبل کامل خوانده می‌شود تا نگاشت شناسه‌ها درست بماند.
 */
async function resolveUploadRemoteMaps(pb, ops, ownerId, meta) {
  const touched = new Map();
  ops.forEach(op => {
    const collection = op.collection || (op.item && op.item.collection);
    const store = op.store || (op.item && op.item.store);
    if (!collection || !store) return;
    if (!touched.has(collection)) touched.set(collection, { store, localIds: new Set(), full: false });
    const entry = touched.get(collection);
    const localId = op.localId != null ? op.localId : (op.item && op.item.localId);
    if (localId != null) entry.localIds.add(String(localId));
    if (store === 'app-meta') entry.full = true;
    if (!meta || !meta.remote || !meta.remote[collection]) entry.full = true;
  });

  const maps = new Map();
  for (const [collection, entry] of touched) {
    const records = entry.full
      ? await fetchOwnerManifest(pb, collection, ownerId)
      : [...(await fetchRemoteIdMap(pb, collection, ownerId, [...entry.localIds])).values()];
    maps.set(collection, new Map(records.map(record => [
      pbCanonicalLocalId(entry.store, record.localId),
      record
    ])));
  }
  return maps;
}

/*
 * ارسال تدریجی: اول تغییرات محلی خوانده می‌شود؛ اگر چیزی برای ارسال نباشد
 * هیچ درخواستی به سرور فرستاده نمی‌شود. در غیر این صورت فقط فهرست سبک
 * سرور بررسی و رکوردهای تغییرکرده نوشته می‌شوند.
 */
async function performUpload(options = {}) {
  const silent = !!options.silent;
  if (syncBusy) return { ok: false, skipped: true, reason: 'busy' };
  if (!isLoggedIn()) {
    if (!silent) {
      syncError = 'برای همگام‌سازی ابتدا وارد حساب کاربری شوید.';
      renderSyncUI();
    }
    return { ok: false, error: 'auth' };
  }

  syncBusy = 'upload';
  syncError = null;
  if (!silent) syncNotice = null;
  resetRateLimitPacing();
  setProgress('upload', 0, 'آماده‌سازی…', true);
  renderSyncUI();

  try {
    await flushStorage().catch(() => {});
    const pb = await requirePocketBaseAuth();
    const ownerId = pocketBaseUserId(pb);
    const server = normalizeBaseUrl(pocketBaseBaseUrl());
    const meta = loadSyncMeta(server, ownerId);
    const pending = await readPendingChanges();
    const fullSync = !meta || pending === null;

    const trackerPayload = currentTrackerPayload();
    const trackerSignature = trackerSignatureOf(trackerPayload);
    const trackerChanged = !meta || meta.tracker !== trackerSignature;

    /* مسیر کم‌هزینه: نه تغییر محلی هست، نه شمارندهٔ تست عوض شده */
    if (!fullSync && !(pending && pending.length) && !trackerChanged) {
      const now = Date.now();
      saveSyncMeta(server, ownerId, { ...meta, lastSyncAt: now });
      setLastSyncTimestamp(now);
      syncNotice = '✓ تغییری برای ارسال نیست';
      return { ok: true, changed: 0, noChanges: true };
    }

    const items = buildUploadRecords();
    const itemsByKey = new Map(items.map(item => [`${item.store}::${item.localId}`, item]));
    const collections = [...new Set(PB_UPLOAD_STORES.map(pbCollectionName))];
    const trackerItem = items.find(item => item.localId === POCKETBASE_TRACKER_ID);

    const ops = [];
    const skipped = [];
    if (fullSync) {
      items.forEach(item => ops.push({ kind: 'put', item }));
    } else {
      (pending || []).forEach(change => {
        if (!change || !PB_UPLOAD_STORES.includes(change.store)) return;
        if (change.operation === 'delete') {
          ops.push({
            kind: 'delete',
            store: change.store,
            collection: pbCollectionName(change.store),
            localId: String(change.recordId),
            change
          });
          return;
        }
        const item = itemsByKey.get(`${change.store}::${change.recordId}`);
        if (item) ops.push({ kind: 'put', item, change });
        else skipped.push(change);
      });
      if (trackerChanged && trackerItem) ops.push({ kind: 'put', item: trackerItem });
    }

    if (!ops.length) {
      const now = Date.now();
      setLastSyncTimestamp(now);
      if (meta) saveSyncMeta(server, ownerId, { ...meta, lastSyncAt: now });
      syncNotice = '✓ تغییری برای ارسال نیست';
      return { ok: true, changed: 0, noChanges: true };
    }

    /* فاز ۱: شناسهٔ رکوردهای سرور
       در حالت تدریجی فقط رکوردهای تغییرکرده پرسیده می‌شوند، نه فهرست کل مجموعه */
    let remote = null;
    let remoteMaps;
    if (fullSync) {
      remote = new Map();
      for (let i = 0; i < collections.length; i++) {
        const collection = collections[i];
        setProgress('upload', 5 + (i / collections.length) * 30, `بررسی سرور — ${collection}`);
        remote.set(collection, await fetchOwnerManifest(pb, collection, ownerId));
      }
      remoteMaps = new Map();
      collections.forEach(collection => {
        const store = pbStoreForCollection(collection);
        remoteMaps.set(collection, new Map((remote.get(collection) || []).map(record => [
          pbCanonicalLocalId(store, record.localId),
          record
        ])));
      });
    } else {
      setProgress('upload', 8, 'خواندن شناسهٔ رکوردهای تغییرکرده…', true);
      remoteMaps = await resolveUploadRemoteMaps(pb, ops, ownerId, meta);
    }

    /* در حالت تدریجی، حذف محلی فقط وقتی روی سرور اعمال می‌شود که رکورد وجود داشته باشد */
    ops.forEach(op => {
      if (op.kind !== 'delete') return;
      const store = op.store;
      if (store === 'app-meta') return;
      const record = remoteMaps.get(op.collection) && remoteMaps.get(op.collection).get(op.localId);
      if (record && record.id) op.remoteId = record.id;
    });

    const total = ops.length;
    let done = 0;
    const tick = () => {
      done++;
      setProgress('upload', total ? 35 + (done / total) * 63 : 100, `${fa(done)} از ${fa(total)} رکورد`);
    };
    setProgress('upload', 35, `${fa(0)} از ${fa(total)} رکورد`, true);

    /* فاز ۲: نوشتن فقط تغییرات */
    const errors = [];
    const results = new Map(); // collection -> Map(localId -> saved record)
    const partialWrites = new Set();
    const deleted = [];

    await mapLimit(ops, 4, async op => {
      try {
        if (op.kind === 'delete') {
          if (op.remoteId) {
            await withRateLimitRetry(() => pb.collection(op.collection).delete(op.remoteId, { requestKey: null }));
            deleted.push({ collection: op.collection, localId: op.localId });
          }
          op.ok = true;
        } else {
          const outcome = await upsertRemoteRecord(pb, op.item, ownerId, remoteMaps.get(op.item.collection), op.change);
          const saved = outcome && outcome.record;
          if (saved) {
            if (!results.has(op.item.collection)) results.set(op.item.collection, new Map());
            results.get(op.item.collection).set(op.item.localId, saved);
          }
          if (outcome && outcome.partial) partialWrites.add(`${op.item.collection}::${op.item.localId}`);
          op.ok = true;
        }
      } catch (error) {
        errors.push({
          collection: op.collection || (op.item && op.item.collection),
          localId: op.localId || (op.item && op.item.localId),
          status: error && error.status ? error.status : 0,
          drift: !!(error && error.valueDrift),
          message: pocketBaseErrorMessage(error)
        });
      }
      tick();
    });

    const changedCount = ops.filter(op => op.ok).length;
    const now = Date.now();

    if (errors.length) {
      /* فقط تغییرات موفق تأیید می‌شوند تا تغییرات ناموفق دوباره فرستاده شوند */
      const acked = fullSync ? [] : ops.filter(op => op.ok && op.change).map(op => op.change).concat(skipped);
      try { await acknowledgeChanges(acked); } catch (e) { console.warn('[PB] acknowledging changes failed:', e); }
      const drifted = errors.find(entry => entry.drift);
      /* فقط خطای احراز هویت باید کل چرخه را متوقف کند؛ بقیهٔ خطاها
         نباید مانع دریافت تغییرات دستگاه‌های دیگر شوند. */
      const authOnly = errors.every(entry => entry.status === 401);
      syncError = drifted
        ? `تغییر «${drifted.collection}» روی سرور ذخیره نشد؛ دوباره تلاش می‌شود.`
        : `ارسال با ${fa(errors.length)} خطا انجام شد — ${errors[0].message}`;
      return { ok: false, partial: changedCount > 0, fatal: authOnly, changed: changedCount, error: syncError };
    }

    /* فرادادهٔ سینک: در حالت تدریجی فقط رکوردهای همین ارسال روی نسخهٔ قبلی اعمال می‌شوند.
       رکوردهای فقط-سرور با مقایسهٔ updated در «دریافت» بعدی پیدا می‌شوند. */
    const nextRemote = {};
    if (fullSync) {
      const localIdsByCollection = new Map();
      items.forEach(item => {
        const localId = pbCanonicalLocalId(item.store, item.localId);
        if (!localId) return;
        if (!localIdsByCollection.has(item.collection)) localIdsByCollection.set(item.collection, new Set());
        localIdsByCollection.get(item.collection).add(localId);
      });
      collections.forEach(collection => {
        const store = pbStoreForCollection(collection);
        const localIds = localIdsByCollection.get(collection) || new Set();
        const map = {};
        (remote.get(collection) || []).forEach(record => {
          const localId = pbCanonicalLocalId(store, record.localId);
          if (!localId || !localIds.has(localId)) return;
          map[localId] = pbManifestTimestamp(record);
        });
        nextRemote[collection] = map;
      });
    } else {
      Object.keys(meta.remote || {}).forEach(collection => {
        nextRemote[collection] = { ...(meta.remote[collection] || {}) };
      });
    }
    results.forEach((map, collection) => {
      const store = pbStoreForCollection(collection);
      if (!nextRemote[collection]) nextRemote[collection] = {};
      map.forEach((record, localId) => {
        nextRemote[collection][pbCanonicalLocalId(store, localId)] = pbManifestTimestamp(record);
      });
    });
    /* نوشتن جزئی (فقط order یا مقدار ادغام‌شده) نسخهٔ محلی را کامل با سرور
       هم‌تراز نمی‌کند؛ پس زمان سرور به‌عنوان «دیده‌شده» ثبت نمی‌شود تا دریافت
       همان چرخه کل مقدار تازهٔ سرور را بیاورد و تغییری گم نشود. */
    partialWrites.forEach(key => {
      const separator = key.indexOf('::');
      if (separator < 0) return;
      const collection = key.slice(0, separator);
      const localId = key.slice(separator + 2);
      const store = pbStoreForCollection(collection);
      if (nextRemote[collection]) delete nextRemote[collection][pbCanonicalLocalId(store, localId)];
    });
    deleted.forEach(({ collection, localId }) => {
      const store = pbStoreForCollection(collection);
      if (nextRemote[collection]) delete nextRemote[collection][pbCanonicalLocalId(store, localId)];
    });

    /* در اولین ارسال، خط زمانی سرور هم ثبت می‌شود تا دریافت بعدی فقط تغییرات را بخواند.
       در ارسال‌های تدریجی خط زمانی جلو نمی‌رود تا تغییر دستگاه‌های دیگر از دست نرود. */
    const floor = { ...((meta && meta.floor) || {}) };
    const counts = { ...((meta && meta.counts) || {}) };
    if (fullSync) {
      collections.forEach(collection => {
        const records = remote.get(collection) || [];
        counts[collection] = records.length;
        const max = maxUpdatedTimestamp(records);
        if (max) floor[collection] = max;
      });
    }
    /* تعداد رکوردهای سرور با نوشتن‌های همین ارسال هم‌تراز می‌شود
       تا دریافت بعدی به بازبینی کامل نیاز پیدا نکند. */
    ops.forEach(op => {
      if (!op.ok) return;
      const collection = op.collection || (op.item && op.item.collection);
      if (!collection || typeof counts[collection] !== 'number') return;
      if (op.kind === 'delete') {
        if (op.remoteId) counts[collection] = Math.max(0, counts[collection] - 1);
        return;
      }
      const item = op.item;
      if (!item) return;
      const existing = remoteMaps.get(collection);
      const localId = pbCanonicalLocalId(item.store, item.localId);
      if (existing && existing.get(localId)) return;
      counts[collection] += 1;
    });

    saveSyncMeta(server, ownerId, {
      remote: nextRemote,
      floor,
      counts,
      countsAt: fullSync ? now : (meta.countsAt || 0),
      integrity: (meta && meta.integrity) || 0,
      tracker: trackerSignature,
      lastSyncAt: now
    });
    setLastSyncTimestamp(now);
    try {
      await acknowledgeChanges(fullSync ? (pending || []) : ops.filter(op => op.ok && op.change).map(op => op.change).concat(skipped));
    } catch (e) {
      console.warn('[PB] acknowledging changes failed:', e);
    }
    syncNotice = changedCount
      ? `✓ ${fa(changedCount)} تغییر روی حساب شما ذخیره شد`
      : '✓ سرور از قبل با این دستگاه همگام بود';
    return { ok: true, changed: changedCount };
  } catch (error) {
    console.error('[PB] upload failed:', error);
    syncError = 'ارسال ناموفق بود — ' + pocketBaseErrorMessage(error);
    return { ok: false, error: syncError };
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

/* ============ download (apply server changes, without page reload) ============ */
function remoteToLocalRecords(store, remoteRecords) {
  const records = remoteRecords.map(item => {
    const record = {
      id: String(item.localId || ''),
      value: item.value,
      order: item.order
    };
    if (item.examId) record.examId = item.examId;
    return record;
  });
  if (store === 'app-meta') {
    if (!records.some(record => record.id === DB_STATE_ID) && records.length) {
      records[0].id = DB_STATE_ID;
    }
    return records.filter(record => record.id === DB_STATE_ID).slice(0, 1);
  }
  records.forEach((record, index) => {
    record.order = (record.order === undefined || record.order === null) ? index : record.order;
  });
  return records;
}

function pbRemoteRecordToLocal(store, item, localSnapshot) {
  if (store === 'app-meta') {
    if (pbCanonicalLocalId(store, item.localId) === POCKETBASE_TRACKER_ID) return null;
    return { id: DB_STATE_ID, value: item.value };
  }
  const id = String(item.localId == null ? '' : item.localId);
  if (!id) return null;
  const record = { id, value: item.value };
  if (item.order !== undefined && item.order !== null) {
    record.order = item.order;
  } else {
    let fallback = 0;
    const existing = localSnapshot && localSnapshot.get(store) && localSnapshot.get(store).get(id);
    if (existing) {
      try {
        const parsed = JSON.parse(existing);
        if (parsed.order !== undefined && parsed.order !== null) fallback = parsed.order;
      } catch (e) {}
    }
    record.order = fallback;
  }
  if (item.examId) record.examId = item.examId;
  return record;
}

/* پس از اعمال تغییرات سرور، state از حافظه دوباره خوانده و نماها تازه می‌شوند */
async function refreshAppAfterSync() {
  try {
    if (window.storageSync && typeof window.storageSync.reloadState === 'function') {
      await window.storageSync.reloadState();
    }
  } catch (error) {
    console.warn('[PB] reloading local state failed:', error);
  }
  try { if (typeof refreshAll === 'function') refreshAll(); } catch (e) { console.warn('[PB] refreshAll failed:', e); }
  try { if (typeof renderSettingsPanel === 'function') renderSettingsPanel(); } catch (e) { console.warn('[PB] renderSettingsPanel failed:', e); }
  try { if (typeof renderProfileSection === 'function') renderProfileSection(); } catch (e) {}
  try { if (typeof renderCommonErrors === 'function') renderCommonErrors(); } catch (e) {}
  try { if (typeof renderSubjectErrorsSection === 'function') renderSubjectErrorsSection(); } catch (e) {}
  try { if (typeof renderTracker === 'function') renderTracker(); } catch (e) {}
  try { renderSyncUI(); } catch (e) {}
}

async function performDownload(options = {}) {
  const silent = !!options.silent;
  const fullRefresh = !!options.full;
  if (options.deferCheck && shouldDeferAutoDownload()) return { ok: false, deferred: true };
  if (syncBusy) return { ok: false, skipped: true, reason: 'busy' };
  if (!isLoggedIn()) {
    if (!silent) {
      syncError = 'برای همگام‌سازی ابتدا وارد حساب کاربری شوید.';
      renderSyncUI();
    }
    return { ok: false, error: 'auth' };
  }

  syncBusy = 'download';
  syncError = null;
  if (!silent) syncNotice = null;
  resetRateLimitPacing();
  setProgress('download', 0, 'آماده‌سازی…', true);
  renderSyncUI();

  try {
    await flushStorage().catch(() => {});
    const pb = await requirePocketBaseAuth();
    const ownerId = pocketBaseUserId(pb);
    const server = normalizeBaseUrl(pocketBaseBaseUrl());
    const meta = loadSyncMeta(server, ownerId);
    const canApplyIncremental = !!meta &&
      !!window.storageSync &&
      typeof window.storageSync.applyRemoteChanges === 'function';
    const stores = PB_DOWNLOAD_STORES.map(store => ({ store, collection: pbCollectionName(store) }));

    if (canApplyIncremental) {
      const syncStores = stores.filter(entry => NORMALIZED_STORES.includes(entry.store));
      const previousRemote = meta.remote || {};
      const previousCounts = meta.counts || {};
      const previousFloor = meta.floor || {};
      /* "هر سینک = ترمیم کامل": نسخههای قبلی میتوانستند زمان تغییر رکوردی را
         «دیدهشده» ثبت کنند بدون آنکه مقدارش روی دستگاه اعمال شود؛ نتیجه
         اینکه هر دو دستگاه خود را بهروز میدانستند ولی مقدارها فرق داشت.
         از این پس زمانی که مقدار هر رکورد آخرین بار واقعاً با سرور مقایسه
         شده (`checked`) نگهداری میشود. در هر چرخه، رکوردهایی که زمانشان با
         زمان بررسیشده فرق دارد دوباره خوانده و مقایسه میشوند — همان اطمینان
         دکمه ترمیم، بدون انتقال مجدد رکوردهای تغیینکرده. */
      const explicitVerify = !!options.verify || !!options.full;
      const integrityOutdated = meta.integrity !== PB_SYNC_INTEGRITY_VERSION;
      const previousChecked = (meta && meta.checked && typeof meta.checked === 'object')
        ? meta.checked : {};
      const nextChecked = {};
      Object.keys(previousChecked).forEach(collection => {
        nextChecked[collection] = { ...(previousChecked[collection] || {}) };
      });
      const verifyState = { version: PB_SYNC_INTEGRITY_VERSION, mode: 'all', done: true };
      const now = Date.now();
      /* حذف رکورد در فیلتر `updated` دیده نمی‌شود. به‌جای بازخوانی دوره‌ای کل
         فهرست‌ها، «حساب تعداد» انجام می‌شود: تعداد رکوردهای سرور باید برابر
         تعداد شناخته‌شده به‌علاوهٔ رکوردهای تازه باشد. فقط اگر این معادله
         برقرار نباشد (حذف یا حذف+افزودن) فهرست همان مجموعه خوانده می‌شود.
         بازبینی کامل فقط یک بار در شبانه‌روز یا با «دریافت کامل» انجام می‌شود. */
      const deepCheck = fullRefresh ||
        meta.integrity !== PB_SYNC_INTEGRITY_VERSION ||
        !meta.countsAt ||
        (now - meta.countsAt > PB_DELETE_CHECK_GAP);

      /* حذف‌ها و ویرایش‌های محلی در انتظار ارسال نباید با نسخهٔ سرور بازنویسی شوند.
         این فهرست در همهٔ مسیرها خوانده می‌شود (نه فقط بازبینی کامل) تا دریافت
         تدریجی هم ویرایش تازهٔ کاربر را از بین نبرد. */
      let pendingDeletes = null;
      let pendingPuts = null;
      try {
        const pending = await readPendingChanges();
        if (pending) {
          pendingDeletes = new Set();
          pendingPuts = new Set();
          pending.forEach(change => {
            if (!change || !change.store) return;
            const key = `${change.store}::${change.recordId}`;
            if (change.operation === 'delete') pendingDeletes.add(key);
            else pendingPuts.add(key);
          });
        }
      } catch (error) {
        console.warn('[PB] reading pending changes failed:', error);
      }
      const hasPendingChange = (store, canonical, rawLocalId) => {
        const key = `${store}::${canonical}`;
        const keyRaw = `${store}::${String(rawLocalId == null ? '' : rawLocalId)}`;
        const put = !!pendingPuts && (pendingPuts.has(key) || pendingPuts.has(keyRaw));
        const del = !!pendingDeletes && (pendingDeletes.has(key) || pendingDeletes.has(keyRaw));
        return { put, del, any: put || del };
      };
      /* تغییرهای محلی که به‌خاطر در انتظار بودن اعمال نشدند؛ پس از دریافت ارسال می‌شوند */
      let pendingSkipped = 0;

      /* فاز ۱: خواندن فقط داده‌های تازه، نه کل مجموعه */
      const fetchedByStore = new Map();
      for (let i = 0; i < syncStores.length; i++) {
        const entry = syncStores[i];
        const knownMap = previousRemote[entry.collection] || {};
        const knownCount = typeof previousCounts[entry.collection] === 'number'
          ? previousCounts[entry.collection]
          : Object.keys(knownMap).length;
        let needManifest = deepCheck || entry.store === 'app-meta';
        let serverCount = null;
        let records = [];

        if (!needManifest) {
          setProgress('download', 5 + (i / syncStores.length) * 40, `بررسی سرور — ${entry.collection}`, true);
          serverCount = await fetchOwnerCount(pb, entry.collection, ownerId);
          /* نخستین بار (بدون مبنای زمانی) باید یک‌بار فهرست خوانده شود */
          if (serverCount > 0 && !previousFloor[entry.collection]) needManifest = true;
        }

        if (needManifest) {
          setProgress('download', 5 + (i / syncStores.length) * 40, `بازبینی فهرست — ${entry.collection}`);
          records = await fetchOwnerManifest(pb, entry.collection, ownerId);
          serverCount = records.length;
        } else if (serverCount > 0) {
          setProgress('download', 5 + (i / syncStores.length) * 40, `دریافت تغییرات — ${entry.collection}`);
          records = await fetchChangedSince(pb, entry.collection, ownerId, previousFloor[entry.collection]);
          /* رکوردهایی که پیش‌تر روی سرور نبوده‌اند؛ بقیه فقط ویرایش‌اند */
          const seen = new Set();
          let added = 0;
          records.forEach(item => {
            const canonical = pbCanonicalLocalId(entry.store, item.localId);
            if (!canonical || seen.has(canonical)) return;
            seen.add(canonical);
            if (knownMap[canonical] === undefined) added++;
          });
          if (knownCount + added !== serverCount) {
            /* شاید شمارش و دریافت هم‌زمان با تغییر دیگری بوده باشند */
            const recheck = await fetchOwnerCount(pb, entry.collection, ownerId);
            if (recheck !== serverCount) serverCount = recheck;
            if (knownCount + added !== serverCount) {
              setProgress('download', 5 + (i / syncStores.length) * 40, `بازبینی فهرست — ${entry.collection}`);
              records = await fetchOwnerManifest(pb, entry.collection, ownerId);
              serverCount = records.length;
              needManifest = true;
            }
          }
        } else if (knownCount > 0) {
          /* مجموعه روی سرور خالی شده است؛ فهرست خالی، حذف‌ها را اعمال می‌کند */
          setProgress('download', 5 + (i / syncStores.length) * 40, `بازبینی فهرست — ${entry.collection}`);
          records = await fetchOwnerManifest(pb, entry.collection, ownerId);
          serverCount = records.length;
          needManifest = true;
        }
        fetchedByStore.set(entry.store, { records, full: needManifest, count: serverCount });
      }

      const serverTotal = syncStores.reduce((sum, entry) =>
        sum + ((fetchedByStore.get(entry.store) || {}).count || 0), 0);
      if (!serverTotal) {
        throw new Error('داده‌های حساب روی سرور پیدا نشد؛ عملیات برای جلوگیری از حذف داده متوقف شد.');
      }
      const appMetaFetched = fetchedByStore.get('app-meta') || { records: [] };
      const hasMainRecord = (appMetaFetched.records || []).some(record =>
        pbCanonicalLocalId('app-meta', record.localId) === DB_STATE_ID
      );
      if (!hasMainRecord) {
        throw new Error('داده‌های سرور کامل نیست (رکورد تنظیمات پیدا نشد)؛ عملیات برای جلوگیری از حذف داده متوقف شد.');
      }

      /* فاز ۲: تعیین رکوردهای تازه و حذف‌شده‌ها.
         فهرست سبک (`full`) مقدار رکورد را ندارد؛ بنابراین مقدار همان چند
         رکورد تغییرکرده با یک درخواست هدفمند خوانده می‌شود. */
      const localSnapshot = normalizedStorageSnapshot(compactStateForStorage(state));
      const puts = [];
      const deletes = [];
      const acknowledge = [];
      const nextRemote = { ...previousRemote };
      const floor = { ...previousFloor };
      const counts = { ...previousCounts };
      let remoteTracker = null;
      let trackerChangedRemotely = false;
      let applied = 0;

      for (const entry of syncStores) {
        const info = fetchedByStore.get(entry.store) || { records: [], full: false, count: 0 };
        const prevMap = previousRemote[entry.collection] || {};
        const nextMap = info.full ? {} : { ...prevMap };
        const checkedMap = nextChecked[entry.collection] || (nextChecked[entry.collection] = {});
        const seen = new Set();
        const missingValues = [];
        const missingCanonical = new Set();
        /* رکوردهایی که به‌خاطر تغییر محلی در انتظار ارسال اعمال نشدند.
           زمان آن‌ها در فراداده ثبت نمی‌شود تا ویرایش دستگاه دیگر برای همیشه
           پنهان نماند و کاوش بعدی دوباره آن را پیدا کند. */
        const skippedCanonical = new Set();
        /* رکوردهایی که در همین چرخه مقدارشان نوشته شد (یا در حال نوشتن است) */
        const handledCanonical = new Set();

        (info.records || []).forEach(item => {
          const canonical = pbCanonicalLocalId(entry.store, item.localId);
          if (!canonical) return;
          const updated = pbManifestTimestamp(item);
          seen.add(canonical);

          if (info.full) {
            /* تغییر محلی در انتظار ارسال برنده است؛ مقدار سرور اعمال نمی‌شود */
            const pending = hasPendingChange(entry.store, canonical, item.localId);
            if (pending.any) { pendingSkipped++; skippedCanonical.add(canonical); return; }
            nextMap[canonical] = updated;
            const unchanged = prevMap[canonical] === updated;
            let needsValue = !unchanged;
            if (!needsValue && deepCheck) {
              if (entry.store === 'app-meta') {
                /* تنظیمات و شمارنده همیشه با مقدار کامل هم‌تراز می‌شوند */
                needsValue = true;
              } else {
                const storeSnapshot = localSnapshot.get(entry.store);
                const rawLocal = storeSnapshot && storeSnapshot.get(canonical);
                /* رکورد روی این دستگاه هست ولی بدون مقدار ذخیره شده (خرابی نسخهٔ قدیمی)،
                   یا اصلاً روی این دستگاه نیست؛ هر دو باید از سرور بازخوانی شوند. */
                const damaged = rawLocal != null && pbLocalSnapshotDamaged(entry.store, rawLocal);
                needsValue = !!pendingDeletes && (!rawLocal || damaged);
              }
            }
            if (needsValue && !missingCanonical.has(canonical)) {
              missingCanonical.add(canonical);
              missingValues.push(String(item.localId));
            }
            return;
          }

          if (prevMap[canonical] === updated) return; /* بازتاب تغییر همین دستگاه */
          if (hasPendingChange(entry.store, canonical, item.localId).any) {
            /* ویرایش/حذف تازهٔ همین دستگاه هنوز ارسال نشده است */
            pendingSkipped++;
            skippedCanonical.add(canonical);
            return;
          }
          nextMap[canonical] = updated;
          checkedMap[canonical] = updated;

          if (entry.store === 'app-meta' && canonical === POCKETBASE_TRACKER_ID) {
            remoteTracker = item.value;
            trackerChangedRemotely = true;
            return;
          }
          const record = pbRemoteRecordToLocal(entry.store, item, localSnapshot);
          if (!record) return;
          puts.push({ store: entry.store, record });
          acknowledge.push({ store: entry.store, id: record.id });
          handledCanonical.add(canonical);
          applied++;
        });

        if (info.full) {
          Object.keys(prevMap).forEach(localId => {
            if (seen.has(localId)) return;
            if (entry.store === 'app-meta') return;
            /* اگر برای این رکورد تغییری در انتظار ارسال است، حذف سرور اعمال
               نمی‌شود تا ویرایش تازهٔ دستگاه دیگر یا حذف در انتظار از بین نرود. */
            if (hasPendingChange(entry.store, localId, localId).any) { pendingSkipped++; return; }
            deletes.push({ store: entry.store, id: localId });
            acknowledge.push({ store: entry.store, id: localId });
            applied++;
          });
        }

        if (missingValues.length) {
          setProgress('download', 55, `دریافت ${fa(missingValues.length)} رکورد تغییرکرده — ${entry.collection}`, true);
          const detailed = await fetchRemoteValuesByLocalIds(pb, entry.collection, ownerId, missingValues);
          detailed.forEach(item => {
            const canonical = pbCanonicalLocalId(entry.store, item.localId);
            if (!canonical) return;
            const itemUpdated = pbManifestTimestamp(item);
            if (hasPendingChange(entry.store, canonical, item.localId).any) {
              pendingSkipped++;
              delete nextMap[canonical];
              skippedCanonical.add(canonical);
              return;
            }
            if (entry.store === 'app-meta') {
              if (canonical === POCKETBASE_TRACKER_ID) {
                checkedMap[canonical] = itemUpdated;
                if (pbSameJsonValue(item.value, currentTrackerPayload())) return;
                remoteTracker = item.value;
                trackerChangedRemotely = true;
                return;
              }
              const localJson = localSnapshot.get('app-meta') &&
                localSnapshot.get('app-meta').get(DB_STATE_ID);
              if (localJson) {
                try {
                  const local = JSON.parse(localJson);
                  if (pbSameJsonValue(local.value, item.value)) {
                    checkedMap[canonical] = itemUpdated;
                    return;
                  }
                } catch (error) {}
              }
            }
            const record = pbRemoteRecordToLocal(entry.store, item, localSnapshot);
            if (!record) return;
            puts.push({ store: entry.store, record });
            acknowledge.push({ store: entry.store, id: record.id });
            handledCanonical.add(canonical);
            checkedMap[canonical] = itemUpdated;
            applied++;
          });
        }
        /* فراداده فقط زمانی «دیده‌شده» را جلو می‌برد که مقدار واقعاً اعمال شده
           باشد؛ وگرنه همان رکورد برای همیشه پنهان می‌ماند. */
        if (missingCanonical.size) {
          missingCanonical.forEach(canonical => {
            if (!handledCanonical.has(canonical)) delete nextMap[canonical];
          });
        }
        /* هر سینک = ترمیم: رکوردهای شناختهشدهای که زمانشان با آخرین بررسی
           واقعی فرق دارد دوباره خوانده و با مقدار محلی مقایسه میشوند. */
        if (entry.store !== 'app-meta') {
          const storeSnapshot = localSnapshot.get(entry.store);
          const knownIds = Object.keys(prevMap).sort();
          const targetIds = knownIds.filter(canonical => {
            if (handledCanonical.has(canonical) || skippedCanonical.has(canonical)) return false;
            if (explicitVerify || integrityOutdated) return true;
            const stamp = prevMap[canonical];
            return !stamp || checkedMap[canonical] !== stamp;
          });
          if (targetIds.length) {
            setProgress('download', 62, `بررسی ${fa(targetIds.length)} رکورد — ${entry.collection}`, true);
            const detailed = await fetchRemoteValuesByLocalIds(pb, entry.collection, ownerId, targetIds);
            const byCanonical = new Map();
            detailed.forEach(item => {
              const canonical = pbCanonicalLocalId(entry.store, item.localId);
              if (canonical) byCanonical.set(canonical, item);
            });
            targetIds.forEach(canonical => {
              const item = byCanonical.get(canonical);
              /* نبود رکورد روی سرور را بازبینی فهرست تشخیص میدهد */
              if (!item) return;
              if (hasPendingChange(entry.store, canonical, item.localId).any) {
                pendingSkipped++;
                skippedCanonical.add(canonical);
                return;
              }
              const updated = pbManifestTimestamp(item);
              if (pbLocalValueMatches(storeSnapshot, canonical, item)) {
                checkedMap[canonical] = updated;
                if (updated && updated > (nextMap[canonical] || '')) nextMap[canonical] = updated;
                return;
              }
              const record = pbRemoteRecordToLocal(entry.store, item, localSnapshot);
              if (!record) return;
              puts.push({ store: entry.store, record });
              acknowledge.push({ store: entry.store, id: record.id });
              handledCanonical.add(canonical);
              checkedMap[canonical] = updated;
              applied++;
              if (updated && updated > (nextMap[canonical] || '')) nextMap[canonical] = updated;
              if (updated && updated > (floor[entry.collection] || '')) floor[entry.collection] = updated;
            });
          }
        }

        /* رکوردهای کنارگذاشته‌شده «تازه‌ترین زمان شناخته‌شده» را بالا نمی‌برند؛
           وگرنه کاوش بعدی فکر می‌کند همه‌چیز دیده شده و آن تغییر گم می‌شود. */
        const observedRecords = skippedCanonical.size
          ? (info.records || []).filter(item => {
              const canonical = pbCanonicalLocalId(entry.store, item.localId);
              return !canonical || !skippedCanonical.has(canonical);
            })
          : (info.records || []);
        const observedMax = maxUpdatedTimestamp(observedRecords);
        if (observedMax && observedMax > (floor[entry.collection] || '')) floor[entry.collection] = observedMax;
        if (typeof info.count === 'number') counts[entry.collection] = info.count;
        nextRemote[entry.collection] = nextMap;
      }

      /* تغییرهای محلی‌ای که کنار گذاشته شدند باید هرچه زودتر ارسال شوند */
      if (pendingSkipped) scheduleAutoUpload(600);
      /* پیمایش چرخهای قدیمی جای خود را به بررسی کامل هر چرخه داد */

      if (!applied && !trackerChangedRemotely) {
        saveSyncMeta(server, ownerId, {
          ...meta,
          remote: nextRemote,
          floor,
          counts,
          countsAt: now,
          integrity: PB_SYNC_INTEGRITY_VERSION,
          verify: verifyState || meta.verify || null,
          checked: nextChecked,
          lastSyncAt: now
        });
        setLastSyncTimestamp(now);
        syncNotice = '✓ داده‌ها از قبل به‌روز است';
        return { ok: true, changed: 0, noChanges: true };
      }

      /* فاز ۳: نوشتن تغییرات روی دستگاه */
      setProgress('download', 85, 'ذخیره‌سازی تغییرات روی این دستگاه…', true);
      /* نوشتن‌های همین دریافت نباید چرخهٔ ارسال تازه بسازند */
      autoSyncSuppressUpload++;
      try {
        save();
        await flushStorage();
        await window.storageSync.applyRemoteChanges({ puts, deletes, acknowledge });
        if (trackerChangedRemotely && remoteTracker) applyRemoteTracker(remoteTracker);
      } finally {
        autoSyncSuppressUpload--;
      }
      if (trackerChangedRemotely && remoteTracker) {
        try { if (typeof renderTracker === 'function') renderTracker(); }
        catch (e) { console.warn('[PB] renderTracker failed:', e); }
      }

      saveSyncMeta(server, ownerId, {
        ...meta,
        remote: nextRemote,
        floor,
        counts,
        countsAt: now,
        integrity: PB_SYNC_INTEGRITY_VERSION,
        verify: verifyState || meta.verify || null,
        checked: nextChecked,
        tracker: trackerChangedRemotely && remoteTracker ? JSON.stringify(remoteTracker) : (meta.tracker || null),
        lastSyncAt: now
      });
      setLastSyncTimestamp(now);

      syncNotice = applied
        ? `✓ ${fa(applied)} تغییر از حساب شما اعمال شد`
        : '✓ شمارنده‌های تست به‌روز شد';
      if (applied) await refreshAppAfterSync();
      return { ok: true, changed: applied, downloadAt: now };
    }

    /* اولین سینک یا نبود امکان سینک تدریجی: دریافت کامل */
    const totals = new Map();
    let counted = 0;
    for (const entry of stores) {
      let count = 0;
      try {
        const res = await withRateLimitRetry(() => pb.collection(entry.collection).getList(1, 1, {
          filter: `owner="${pbFilterValue(ownerId)}"`,
          skipTotal: false,
          requestKey: null
        }));
        count = res.totalItems || 0;
      } catch (error) {
        if (entry.store !== 'plan' && entry.store !== 'reserved') throw error;
      }
      totals.set(entry.store, count);
      counted++;
      setProgress('download', (counted / stores.length) * 5, 'شمارش رکوردهای سرور…');
    }

    const total = [...totals.values()].reduce((sum, value) => sum + value, 0);
    if (!total) {
      syncNotice = 'حساب شما هنوز داده‌ای ندارد؛ از دستگاهی که اطلاعات دارد همگام‌سازی کنید.';
      return { ok: true, changed: 0, empty: true };
    }

    const records = Object.fromEntries([...NORMALIZED_STORES, ...LEGACY_STORES].map(store => [store, []]));
    const rawRecords = new Map();
    let done = 0;
    let remoteTracker = null;
    const tick = amount => {
      done += amount;
      const percent = 5 + (Math.min(done, total) / total) * 95;
      setProgress('download', percent, `${fa(Math.min(done, total))} از ${fa(total)} رکورد`);
    };

    for (const entry of stores) {
      if (!totals.get(entry.store)) continue;
      const remoteRecords = await fetchOwnerRecords(pb, entry.collection, ownerId).catch(error => {
        if (entry.store === 'plan' || entry.store === 'reserved') return [];
        throw error;
      });
      rawRecords.set(entry.store, remoteRecords);
      if (entry.store === 'app-meta') {
        const trackerRecord = remoteRecords.find(record => String(record.localId || '') === POCKETBASE_TRACKER_ID);
        if (trackerRecord && trackerRecord.value) remoteTracker = trackerRecord.value;
      }
      if (records[entry.store]) {
        records[entry.store] = remoteToLocalRecords(entry.store, remoteRecords);
      }
      tick(remoteRecords.length);
    }

    const rawState = stateFromNormalizedRecords(records);
    if (!rawState) throw new Error('داده‌های سرور کامل نیست (رکورد تنظیمات پیدا نشد).');

    const normalized = normalizeStateData(rawState);
    normalized.subjects.forEach(subject => {
      if (!normalized.classes[subject.name]) {
        normalized.classes[subject.name] = { total: subject.sessions || 0, sessions: {} };
      } else if (!normalized.classes[subject.name].total) {
        normalized.classes[subject.name].total = subject.sessions || 0;
      }
    });

    setProgress('download', 100, 'ذخیره‌سازی روی این دستگاه…', true);
    autoSyncSuppressUpload++;
    try {
      /* ابتدا تغییرات معلق قبلی ذخیره می‌شوند تا با دادهٔ تازه قاطی نشوند */
      save();
      await flushStorage();
      replaceTrackedState(normalized, true);
      if (remoteTracker) applyRemoteTracker(remoteTracker);
      save();
      await flushStorage();
      await acknowledgeAllPending();
    } finally {
      autoSyncSuppressUpload--;
    }

    const now = Date.now();
    const nextRemote = {};
    const floor = {};
    const counts = {};
    stores.forEach(entry => {
      if (!NORMALIZED_STORES.includes(entry.store)) return;
      const records = rawRecords.get(entry.store) || [];
      nextRemote[entry.collection] = pbManifestUpdatedMap(entry.store, records);
      counts[entry.collection] = records.length;
      const max = maxUpdatedTimestamp(records);
      if (max) floor[entry.collection] = max;
    });
    saveSyncMeta(server, ownerId, {
      remote: nextRemote,
      floor,
      counts,
      countsAt: now,
      integrity: PB_SYNC_INTEGRITY_VERSION,
      verify: { version: PB_SYNC_INTEGRITY_VERSION, mode: 'all', done: true },
      checked: nextRemote,
      tracker: remoteTracker ? JSON.stringify(remoteTracker) : null,
      lastSyncAt: now
    });

    setLastSyncTimestamp(now);
    syncNotice = `✓ ${fa(total)} رکورد از حساب شما دریافت شد`;
    await refreshAppAfterSync();
    return { ok: true, changed: total, downloadAt: now, full: true };
  } catch (error) {
    console.error('[PB] download failed:', error);
    syncError = 'دریافت ناموفق بود — ' + pocketBaseErrorMessage(error);
    return { ok: false, error: syncError };
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

/* ============ login / logout ============ */
async function loginWithPassword(email, password, serverUrl) {
  if (serverUrl) {
    savePocketBaseBaseUrl(serverUrl);
    pocketBaseClient = null;
  }
  const pb = getPocketBaseClient();
  const auth = await withRateLimitRetry(() => pb.collection('users').authWithPassword(email, password));
  saveLegacyToken(pb.authStore.token);
  const record = auth && (auth.record || auth);
  if (record && record.id) {
    state.profile.email = String(record.email || email || '');
    state.profile.id = String(record.id);
    save();
    await flushStorage().catch(() => {});
  }
  startRealtimePush();
  return true;
}

function logoutPocketBase() {
  stopRealtimePush();
  clearLegacyToken();
  try {
    if (pocketBaseClient && pocketBaseClient.authStore) pocketBaseClient.authStore.clear();
  } catch (_) {}
  syncError = null;
  syncNotice = null;
  resetProgress();
  stopAutoSyncTimers();
  stopRealtimePush();
}

/* ============ realtime push (PocketBase SSE) ============ */
/* دریافت زنده: سرور هر تغییر را همان لحظه اعلام می‌کند، بنابراین لازم نیست
   برنامه مدام برای «چیزی تازه هست؟» سرور را بپرسد. اگر اتصال ممکن نباشد
   (پراکسی، مرورگر قدیمی، آفلاین) بی‌صدا به همان کاوش دوره‌ای برمی‌گردیم. */
const REALTIME_RETRY_MS = 5 * 60 * 1000;
const realtimePush = {
  supported: typeof EventSource !== 'undefined',
  started: false,
  connected: false,
  identity: '',
  unsubs: [],
  lastEventAt: 0,
  failedAt: 0
};

function realtimeIdentity() {
  try {
    if (!isLoggedIn()) return '';
    const pb = getPocketBaseClient();
    const owner = pocketBaseUserId(pb);
    if (!owner) return '';
    return normalizeBaseUrl(pocketBaseBaseUrl()) + '|' + owner;
  } catch (e) { return ''; }
}
function stopRealtimePush() {
  const unsubs = realtimePush.unsubs;
  realtimePush.started = false;
  realtimePush.connected = false;
  realtimePush.identity = '';
  realtimePush.unsubs = [];
  /* رویدادهای صفبندی شده نباید پس از خروج یا تغییر هویت باقی بمانند */
  realtimeHints = [];
  if (realtimeApplyTimer) { clearTimeout(realtimeApplyTimer); realtimeApplyTimer = null; }
  unsubs.forEach(unsub => {
    try {
      const out = unsub();
      if (out && typeof out.catch === 'function') out.catch(() => {});
    } catch (e) {}
  });
  renderSyncUI();
  return Promise.resolve();
}
async function startRealtimePush() {
  if (!realtimePush.supported) return false;
  if (!autoSyncEnabled || !isLoggedIn()) return false;
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return false;
  try { if (document.hidden) return false; } catch (e) {}
  const identity = realtimeIdentity();
  if (!identity) return false;
  if (realtimePush.connected || (realtimePush.started && realtimePush.identity === identity)) return realtimePush.connected;
  if (Date.now() - realtimePush.failedAt < REALTIME_RETRY_MS) return false;
  await stopRealtimePush();
  realtimePush.started = true;
  realtimePush.identity = identity;
  try {
    const pb = getPocketBaseClient();
    const ownerId = pocketBaseUserId(pb);
    const collections = [...new Set(PB_DOWNLOAD_STORES.map(pbCollectionName))];
    for (const collection of collections) {
      const store = pbStoreForCollection(collection);
      const unsub = await pb.collection(collection).subscribe('*', event => {
        handleRealtimeEvent(store, collection, event, ownerId);
      });
      if (!realtimePush.started || realtimePush.identity !== identity) {
        try { const out = unsub(); if (out && typeof out.catch === 'function') out.catch(() => {}); } catch (e) {}
        return false;
      }
      realtimePush.unsubs.push(unsub);
    }
    realtimePush.connected = true;
    renderSyncUI();
    return true;
  } catch (error) {
    console.warn('[PB] realtime unavailable:', error && error.message ? error.message : error);
    realtimePush.failedAt = Date.now();
    await stopRealtimePush();
    return false;
  }
}
/* رویداد سرور فقط «یک تغییر هست» را اعلام می‌کند؛ اعمال آن با همان مسیر
   تدریجیِ آزموده‌شده انجام می‌شود تا ادغام فیلدها و ویرایش‌های معلق حفظ شوند. */
/* رویداد سرور دقیقاً همان رکوردی را که تغییر کرده اعلام میکند. بهجای
   بازبینی تمام مجموعهها، فقط همان نشانهها را نگه میداریم و اعمال میکنیم. */
const REALTIME_APPLY_DELAY = 120;
let realtimeHints = [];
let realtimeApplyTimer = null;
let realtimeApplyRunning = false;

function queueRealtimeHint(hint) {
  const key = hint.collection + '::' + hint.canonical + '::' + hint.action;
  const index = realtimeHints.findIndex(item =>
    item.collection + '::' + item.canonical + '::' + item.action === key);
  if (index >= 0) {
    const current = realtimeHints[index];
    if (!hint.stamp || !current.stamp || hint.stamp >= current.stamp) realtimeHints[index] = hint;
  } else {
    realtimeHints.push(hint);
    if (realtimeHints.length > 200) realtimeHints.shift();
  }
  scheduleRealtimeApply();
}

function scheduleRealtimeApply(delay) {
  if (realtimeApplyTimer) clearTimeout(realtimeApplyTimer);
  realtimeApplyTimer = setTimeout(() => {
    realtimeApplyTimer = null;
    applyRealtimeHints().catch(error => {
      console.warn('[PB] realtime apply failed:', error);
      realtimePending = true;
      scheduleAutoCycle(500, 'realtime');
    });
  }, delay === undefined ? REALTIME_APPLY_DELAY : delay);
}

function handleRealtimeEvent(store, collection, event, ownerId) {
  try {
    if (!event || !event.record) return;
    if (event.record.owner && ownerId && event.record.owner !== ownerId) return;
    if (!isLoggedIn()) return;
    realtimePush.lastEventAt = Date.now();
    const canonical = pbCanonicalLocalId(store, event.record.localId);
    if (!canonical) return;
    const server = normalizeBaseUrl(pocketBaseBaseUrl());
    const meta = loadSyncMeta(server, ownerId);
    const stamp = pbManifestTimestamp(event.record);
    if (event.action !== 'delete' && meta && meta.remote && meta.remote[collection]) {
      const known = meta.remote[collection][canonical];
      /* پژواک نوشتن خودمان یا رکوردی که همین حالا اعمال شده */
      if (stamp && known && stamp <= known) return;
    }
    queueRealtimeHint({
      store, collection, canonical,
      localId: String(event.record.localId == null ? '' : event.record.localId),
      action: event.action || 'update',
      stamp,
      record: event.record
    });
  } catch (error) {
    console.warn('[PB] realtime event failed:', error);
  }
}

/* اعمال هدفمند رویدادهای زنده: نه فهرست کامل، نه شمارش، نه بازبینی رکوردهای بیربط.
   تنها رکوردهایی که سرور اعلام کرده با همان قواعد ایمن سینک تدریجی نوشته میشوند. */
async function applyRealtimeHints() {
  if (!realtimeHints.length) return;
  if (!autoSyncEnabled || !isLoggedIn()) { realtimeHints = []; return; }
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    realtimeHints = [];
    realtimePending = true;
    return;
  }
  if (syncBusy || autoSyncRunning || realtimeApplyRunning) {
    scheduleRealtimeApply(300);
    return;
  }
  const hints = realtimeHints.splice(0);
  const identity = currentSyncIdentity();
  if (!identity || !identity.meta ||
      !window.storageSync || typeof window.storageSync.applyRemoteChanges !== 'function') {
    realtimePending = true;
    scheduleAutoCycle(150, 'realtime');
    return;
  }

  realtimeApplyRunning = true;
  lastAutoStatus = 'syncing';
  renderSyncUI();
  let fallbackFull = false;
  try {
    await flushStorage().catch(() => {});
    const pending = await readPendingChanges().catch(() => null);
    const pendingPut = new Set();
    const pendingDel = new Set();
    (pending || []).forEach(change => {
      if (!change || !change.store) return;
      const key = `${change.store}::${change.recordId}`;
      if (change.operation === 'delete') pendingDel.add(key);
      else pendingPut.add(key);
    });
    const pendingFor = (store, canonical, rawLocalId) => {
      const keys = [`${store}::${canonical}`, `${store}::${String(rawLocalId == null ? '' : rawLocalId)}`];
      const put = keys.some(key => pendingPut.has(key));
      const del = keys.some(key => pendingDel.has(key));
      return { put, del, any: put || del };
    };

    const pb = await requirePocketBaseAuth();
    const ownerId = pocketBaseUserId(pb);
    const server = normalizeBaseUrl(pocketBaseBaseUrl());
    const meta = loadSyncMeta(server, ownerId) || identity.meta;
    const nextMeta = {
      ...meta,
      remote: { ...(meta.remote || {}) },
      checked: { ...(meta.checked || {}) },
      floor: { ...(meta.floor || {}) },
      counts: { ...(meta.counts || {}) }
    };
    Object.keys(nextMeta.remote).forEach(collection => {
      nextMeta.remote[collection] = { ...(nextMeta.remote[collection] || {}) };
    });
    Object.keys(nextMeta.checked).forEach(collection => {
      nextMeta.checked[collection] = { ...(nextMeta.checked[collection] || {}) };
    });

    /* چند رویداد پشتسرهم برای یک رکورد: تازهترینشان برنده است. */
    const groups = new Map();
    hints.forEach(hint => {
      const known = (nextMeta.remote[hint.collection] || {})[hint.canonical];
      if (hint.action !== 'delete' && hint.stamp && known && hint.stamp <= known) return;
      const key = hint.collection + '::' + hint.canonical;
      const previous = groups.get(key);
      const newer = !previous || !hint.stamp || !previous.stamp || hint.stamp >= previous.stamp;
      if (newer || (hint.action === 'delete' && previous && previous.action !== 'delete')) {
        groups.set(key, hint);
      }
    });
    if (!groups.size) {
      lastAutoStatus = 'idle';
      return { ok: true, changed: 0, noChanges: true };
    }

    /* رویداد معمولی مقدار رکورد را هم دارد؛ فقط اگر ناقص بود همان رکورد را میخوانیم. */
    const missingByCollection = new Map();
    groups.forEach(hint => {
      if (hint.action === 'delete') return;
      const record = hint.record;
      if (record && Object.prototype.hasOwnProperty.call(record, 'value')) return;
      const set = missingByCollection.get(hint.collection) || new Set();
      set.add(hint.localId);
      missingByCollection.set(hint.collection, set);
    });
    for (const [collection, ids] of missingByCollection) {
      const fetched = await fetchRemoteValuesByLocalIds(pb, collection, ownerId, [...ids]);
      fetched.forEach(item => {
        const store = pbStoreForCollection(collection);
        const canonical = pbCanonicalLocalId(store, item.localId);
        const hint = groups.get(collection + '::' + canonical);
        if (hint) hint.record = item;
      });
    }

    const localSnapshot = normalizedStorageSnapshot(compactStateForStorage(state));
    const puts = [];
    const deletes = [];
    const acknowledge = [];
    const touchedCollections = new Set();
    let applied = 0;
    let remoteTracker = null;

    groups.forEach(hint => {
      const { store, collection, canonical, action, localId } = hint;
      const remoteMap = nextMeta.remote[collection] || (nextMeta.remote[collection] = {});
      const checkedMap = nextMeta.checked[collection] || (nextMeta.checked[collection] = {});
      if (action === 'delete') {
        if (!canonical || (store === 'app-meta' && canonical === DB_STATE_ID)) return;
        if (pendingFor(store, canonical, localId).any) return;
        deletes.push({ store, id: canonical });
        acknowledge.push({ store, id: canonical });
        delete remoteMap[canonical];
        delete checkedMap[canonical];
        touchedCollections.add(collection);
        applied++;
        return;
      }
      const item = hint.record;
      if (!item || !Object.prototype.hasOwnProperty.call(item, 'value')) {
        fallbackFull = true; /* رکورد روی سرور نیست؛ بازبینی فهرست لازم است */
        return;
      }
      if (pendingFor(store, canonical, localId).any) return;
      const updated = hint.stamp || pbManifestTimestamp(item) || '';
      if (store === 'app-meta' && canonical === POCKETBASE_TRACKER_ID) {
        if (!pbSameJsonValue(item.value, currentTrackerPayload())) remoteTracker = item.value;
        if (updated) {
          remoteMap[canonical] = updated;
          checkedMap[canonical] = updated;
          if (updated > (nextMeta.floor[collection] || '')) nextMeta.floor[collection] = updated;
        }
        touchedCollections.add(collection);
        return;
      }
      const record = pbRemoteRecordToLocal(store, item, localSnapshot);
      if (!record) { fallbackFull = true; return; }
      puts.push({ store, record });
      acknowledge.push({ store, id: record.id });
      if (updated) {
        remoteMap[canonical] = updated;
        checkedMap[canonical] = updated;
        if (updated > (nextMeta.floor[collection] || '')) nextMeta.floor[collection] = updated;
      }
      touchedCollections.add(collection);
      applied++;
    });

    touchedCollections.forEach(collection => {
      nextMeta.counts[collection] = Object.keys(nextMeta.remote[collection] || {}).length;
    });

    if (applied || remoteTracker) {
      autoSyncSuppressUpload++;
      try {
        save();
        await flushStorage();
        await window.storageSync.applyRemoteChanges({ puts, deletes, acknowledge });
        if (remoteTracker) applyRemoteTracker(remoteTracker);
      } finally {
        autoSyncSuppressUpload--;
      }
      const now = Date.now();
      nextMeta.lastSyncAt = now;
      saveSyncMeta(server, ownerId, {
        ...nextMeta,
        tracker: remoteTracker ? JSON.stringify(remoteTracker) : (meta.tracker || null)
      });
      setLastSyncTimestamp(now);
      syncNotice = `✓ ${fa(applied)} تغییر زنده اعمال شد`;
      await refreshAppAfterSync();
    } else {
      saveSyncMeta(server, ownerId, nextMeta);
    }

    if (fallbackFull) {
      realtimePending = true;
      scheduleAutoCycle(200, 'realtime');
    }
    lastAutoStatus = 'idle';
    return { ok: true, changed: applied };
  } catch (error) {
    console.warn('[PB] targeted realtime failed:', error);
    realtimePending = true;
    scheduleAutoCycle(300, 'realtime');
    lastAutoStatus = 'error';
    return { ok: false, error };
  } finally {
    realtimeApplyRunning = false;
    renderSyncUI();
  }
}

/* ============ automatic sync engine ============ */
const AUTO_SYNC_ENABLED_KEY = 'konkur-pb-auto-sync-v1';
const AUTO_UPLOAD_DEBOUNCE = 300;
const AUTO_MIN_CYCLE_GAP = 30000;
/* تغییر محلی نباید ۳۰ ثانیه معطل بماند؛ فقط یک فاصلهٔ کوتاه برای ادغام
   چند ویرایش پشت‌سرهم لازم است. */
const AUTO_LOCAL_CHANGE_GAP = 400;
const AUTO_DOWNLOAD_MIN_GAP = 60000;
const AUTO_POLL_INTERVAL = 10 * 60 * 1000;
const AUTO_PROBE_GAP = 60000;
const AUTO_DEFER_RETRY = 20000;
const AUTO_BACKOFF_BASE = 60000;
const AUTO_MAX_BACKOFF = 15 * 60 * 1000;

let autoSyncEnabled = readAutoSyncEnabled();
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
let realtimePending = false;
let lastAutoStatus = 'idle';
let pendingBadgeToken = 0;

function readAutoSyncEnabled() {
  try {
    const raw = localStorage.getItem(AUTO_SYNC_ENABLED_KEY);
    return raw === null ? true : raw === '1';
  } catch (e) { return true; }
}
function setAutoSyncEnabled(enabled) {
  autoSyncEnabled = !!enabled;
  try { localStorage.setItem(AUTO_SYNC_ENABLED_KEY, autoSyncEnabled ? '1' : '0'); } catch (e) {}
  if (!autoSyncEnabled) { stopAutoSyncTimers(); stopRealtimePush(); }
  else { scheduleAutoUpload(700); startRealtimePush(); }
  renderSyncUI();
  refreshPendingBadge();
}
function stopAutoSyncTimers() {
  if (autoSyncUploadTimer) { clearTimeout(autoSyncUploadTimer); autoSyncUploadTimer = null; }
  if (autoSyncRetryTimer) { clearTimeout(autoSyncRetryTimer); autoSyncRetryTimer = null; }
  autoSyncPending = false;
}
function currentSyncIdentity() {
  try {
    if (!isLoggedIn()) return null;
    const pb = getPocketBaseClient();
    const owner = pocketBaseUserId(pb);
    if (!owner) return null;
    const server = normalizeBaseUrl(pocketBaseBaseUrl());
    return { owner, server, meta: loadSyncMeta(server, owner) };
  } catch (e) { return null; }
}
function hasLocalStudyData() {
  try {
    if (!state) return false;
    if ((state.activities || []).length) return true;
    if ((state.exams || []).length) return true;
    if ((state.sleeps || []).length) return true;
    if ((state.phones || []).length) return true;
    if ((state.sessions || []).length) return true;
    if (state.profile && (state.profile.firstName || state.profile.lastName)) return true;
    if (state.classes && Object.keys(state.classes).some(name => {
      const cls = state.classes[name];
      return cls && cls.sessions && Object.keys(cls.sessions).length;
    })) return true;
    if (typeof defaultState === 'function' && Array.isArray(state.subjects)) {
      const defaultNames = new Set((defaultState().subjects || []).map(subject => subject && subject.name));
      if (state.subjects.some(subject => subject && !defaultNames.has(subject.name))) return true;
    }
    if (typeof trkCounts !== 'undefined') {
      const total = (+trkCounts.correct || 0) + (+trkCounts.wrong || 0) + (+trkCounts.blank || 0);
      if (total > 0) return true;
    }
    return false;
  } catch (e) { return false; }
}
function shouldDeferAutoDownload() {
  try {
    const active = document.activeElement;
    if (active && active !== document.body) {
      const tag = String(active.tagName || '').toUpperCase();
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || active.isContentEditable) return true;
    }
    const backdrop = document.getElementById('modalBackdrop');
    if (backdrop && backdrop.classList.contains('show')) return true;
  } catch (e) {}
  return false;
}
function registerAutoSuccess() {
  autoSyncFailures = 0;
  autoSyncCooldownUntil = 0;
}
function registerAutoFailure(message) {
  if (message) syncError = syncError || (typeof message === 'string' ? message : pocketBaseErrorMessage(message));
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

async function syncCycle(options = {}) {
  const reason = options.reason || 'auto';
  const manual = reason === 'manual';
  if (!manual && !autoSyncEnabled) return { ok: false, disabled: true };
  if (!isLoggedIn()) { renderSyncUI(); return { ok: false, error: 'auth' }; }
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    lastAutoStatus = 'offline';
    if (manual) toast('❌ اتصال اینترنت برقرار نیست');
    renderSyncUI();
    return { ok: false, offline: true };
  }
  if (syncBusy || autoSyncRunning) {
    if (!manual) autoSyncPending = true;
    /* رویداد زنده نباید در میان یک چرخهٔ دیگر گم شود */
    if (reason === 'realtime' || reason === 'probe') realtimePending = true;
    return { ok: false, busy: true };
  }
  if (!manual) {
    const cooldown = autoSyncCooldownUntil - Date.now();
    if (cooldown > 0) { scheduleAutoCycle(cooldown, reason); return { ok: false, cooldown: true }; }
    /* وقتی سرور واقعاً تغییر کرده یا کاربر تازه به برنامه برگشته،
       فاصلهٔ ۳۰ ثانیه‌ای چرخه نباید اعمال تغییر را عقب بیندازد. */
    const urgent = reason === 'probe' || reason === 'visible' || reason === 'focus' ||
      reason === 'online' || reason === 'realtime';
    const minGap = reason === 'local-change' ? AUTO_LOCAL_CHANGE_GAP : AUTO_MIN_CYCLE_GAP;
    const gap = minGap - (Date.now() - lastCycleAt);
    if (lastCycleAt && gap > 0 && !urgent) {
      scheduleAutoCycle(gap, reason);
      return { ok: false, throttled: true };
    }
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

    /* اولین همگام‌سازی: دستگاه تازه اول دریافت می‌کند؛ اگر دادهٔ محلی وجود دارد اول ارسال */
    if (firstSync && !hasLocalStudyData()) {
      outcome = await performDownload({ silent: true, deferCheck: !manual });
      if (outcome && outcome.ok) {
        lastDownloadAt = Date.now();
        registerAutoSuccess();
        lastAutoStatus = 'idle';
        /* حساب خالی است: همین دستگاه پایهٔ اولیه را می‌سازد تا سینک بعدی معنا داشته باشد */
        if (outcome.empty) {
          const seed = await performUpload({ silent: true });
          if (seed && seed.ok) outcome = { ok: true, changed: seed.changed || 0, seeded: true };
        }
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
    /* فقط خطای احراز هویت باید چرخه را متوقف کند. یک رکورد مشکل‌دار نباید
       مانع دریافت تغییرات دستگاه‌های دیگر شود. */
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

    /* کاوش سرور یا رویداد زنده یعنی تغییر واقعی پیدا شده؛ دریافت نباید به
       فاصلهٔ ۶۰ ثانیه‌ای محدود شود */
    const forceDownload = manual || reason === 'probe' || reason === 'realtime';
    const downloadAllowed = forceDownload || firstSync || (Date.now() - lastDownloadAt >= AUTO_DOWNLOAD_MIN_GAP);
    if (!downloadAllowed) {
      outcome = uploadFailed
        ? { ok: false, partial: true, error: uploadFailure }
        : { ok: true, changed: up.changed || 0, downloadSkipped: true };
      if (!uploadFailed) { registerAutoSuccess(); lastAutoStatus = 'idle'; }
      else lastAutoStatus = 'error';
      return outcome;
    }
    if (!manual && shouldDeferAutoDownload()) {
      outcome = uploadFailed ? { ok: false, partial: true, error: uploadFailure } : { ok: true, deferred: true };
      if (!uploadFailed) { registerAutoSuccess(); lastAutoStatus = 'idle'; }
      else lastAutoStatus = 'error';
      scheduleAutoCycle(AUTO_DEFER_RETRY, reason);
      return outcome;
    }

    /* تغییرهایی که همین حالا اعلام شده‌اند با همین دریافت خوانده می‌شوند */
    realtimePending = false;
    const downloadOptions = { silent: true, deferCheck: false };
    if (options.verify) downloadOptions.verify = true;
    if (options.full) downloadOptions.full = true;
    const down = await performDownload(downloadOptions);
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
    console.error('[PB] sync cycle failed:', error);
    syncError = 'همگام‌سازی ناموفق بود — ' + pocketBaseErrorMessage(error);
    registerAutoFailure(syncError);
    lastAutoStatus = 'error';
    return { ok: false, error: syncError };
  } finally {
    autoSyncRunning = false;
    if (realtimePending) {
      /* رویدادی که هنگام این چرخه رسید، در چرخهٔ بعدی (فوری) خوانده می‌شود */
      realtimePending = false;
      scheduleAutoCycle(200, 'realtime');
    }
    if (autoSyncPending) {
      autoSyncPending = false;
      scheduleAutoUpload(400);
    }
    /* دریافت، پیام خطا را پاک می‌کند؛ خطای ارسال باید تا موفقیت بعدی دیده شود */
    if (uploadFailure) syncError = uploadFailure;
    renderSyncUI();
    refreshPendingBadge();
    if (manual) {
      if (outcome && outcome.ok) toast(syncError ? '❌ ' + syncError : (syncNotice || '✓ همگام‌سازی انجام شد'));
      else if (outcome && outcome.offline) toast('❌ اتصال اینترنت برقرار نیست');
      else if (syncError) toast('❌ ' + syncError);
    }
  }
}

function syncNow() {
  /* دکمهٔ سینک همان کاری را میکند که ترمیم میکرد: ارسال محلی، بازبینی
     کامل فهرستها و مقایسهٔ مقدار تمام رکوردهای شناختهشده با سرور. */
  return syncCycle({ reason: 'manual', verify: true, full: true });
}
/* نام قدیمی برای سازگاری؛ اکنون همان «همگامسازی» است و دکمهٔ جداگانه حذف شد. */
function syncRepair() {
  return syncNow();
}
function uploadAllData() {
  if (syncBusy || autoSyncRunning) return;
  return performUpload({});
}
function downloadAllData() {
  if (syncBusy || autoSyncRunning) return;
  return performDownload({ full: true, verify: true });
}
function onSettingsOpen() {
  renderSyncUI();
  refreshPendingBadge();
  if (!autoSyncEnabled || !isLoggedIn()) return;
  startRealtimePush();
  if (Date.now() - lastDownloadAt >= AUTO_DOWNLOAD_MIN_GAP) scheduleAutoCycle(600, 'settings');
}
/* کاوش ارزان: آیا روی سرور رکوردی تازه‌تر از آخرین وضعیت شناخته‌شده هست؟
   به‌جای سینک کامل دوره‌ای، فقط این پرسش کوچک انجام می‌شود. */
async function probeRemoteChanges(force) {
  if (!autoSyncEnabled || !isLoggedIn()) return false;
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return false;
  if (syncBusy || autoSyncRunning || probeInFlight) return false;
  const now = Date.now();
  /* کاوش اجباری (بازگشت به برنامه) فقط چند ثانیه فاصله لازم دارد */
  if (now - lastProbeAt < (force ? 5000 : AUTO_PROBE_GAP)) return false;
  lastProbeAt = now;
  probeInFlight = true;
  try {
    const pb = await requirePocketBaseAuth();
    const ownerId = pocketBaseUserId(pb);
    if (!ownerId) return false;
    const server = normalizeBaseUrl(pocketBaseBaseUrl());
    const meta = loadSyncMeta(server, ownerId);
    if (!meta || !meta.remote) return true; /* فراداده نداریم؛ سینک کامل لازم است */
    for (const store of PB_DOWNLOAD_STORES) {
      const collection = pbCollectionName(store);
      const knownMax = syncKnownMax(meta, collection);
      try {
        /* تازه‌ترین رکورد سرور خوانده می‌شود، نه فیلتر «updated > …»؛
           این روش به قالب زمان یا درست‌بودن فرادادهٔ محلی وابسته نیست. */
        const res = await withRateLimitRetry(() => pb.collection(collection).getList(1, 1, {
          filter: `owner="${pbFilterValue(ownerId)}"`,
          sort: '-updated',
          fields: 'id,updated',
          skipTotal: true,
          requestKey: null
        }));
        const newest = res && Array.isArray(res.items) ? res.items[0] : null;
        const serverMax = newest ? pbManifestTimestamp(newest) : null;
        if (!serverMax) continue;
        if (!knownMax || serverMax > knownMax) return true;
        if (serverMax < knownMax) {
          /* فراداده از سرور جلوتر است (بازگردانی پشتیبان، حذف رکوردِ آخر
             یا ساعت نادرست). پاک‌سازی همان مجموعه تا سینک بعدی فهرست
             کامل را بخواند و مسیر تدریجی خودش را ترمیم کند. */
          const healed = {
            ...meta,
            floor: { ...(meta.floor || {}) },
            remote: { ...(meta.remote || {}) }
          };
          delete healed.floor[collection];
          delete healed.remote[collection];
          saveSyncMeta(server, ownerId, healed);
          console.warn('[PB] stale sync metadata for', collection, 'reset');
          return true;
        }
      } catch (error) {
        /* مجموعه‌ای روی سرور نیست (مثل plan/reserved)؛ کاوش ادامه می‌یابد */
      }
    }
    return false;
  } catch (error) {
    console.warn('[PB] remote probe failed:', error);
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

/* اگر برنامه به پس‌زمینه برود، تغییرهای ذخیره‌شده بلافاصله ارسال می‌شوند
   تا جابه‌جایی یک بلوک پیش از بستن/ترک برنامه روی سرور بنشیند. */
function flushPendingUploadOnHide() {
  if (!autoSyncEnabled || !isLoggedIn()) return;
  if (autoSyncUploadTimer) { clearTimeout(autoSyncUploadTimer); autoSyncUploadTimer = null; }
  if (syncBusy || autoSyncRunning) { autoSyncPending = true; return; }
  readPendingChanges().then(pending => {
    if (!pending || !pending.length) return;
    return performUpload({ silent: true });
  }).catch(() => {});
}

function startAutoSync() {
  if (autoSyncStarted) return;
  autoSyncStarted = true;
  autoSyncEnabled = readAutoSyncEnabled();

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
    if (!autoSyncEnabled || !isLoggedIn()) return;
    startRealtimePush();
    if (Date.now() - lastDownloadAt >= AUTO_DOWNLOAD_MIN_GAP) scheduleAutoCycle(600, 'visible');
    else maybeProbeRemoteChanges(true);
  });
  window.addEventListener('pagehide', flushPendingUploadOnHide);
  window.addEventListener('online', () => {
    renderSyncUI();
    if (autoSyncEnabled && isLoggedIn()) {
      startRealtimePush();
      scheduleAutoCycle(1500, 'online');
    }
  });
  window.addEventListener('offline', () => { lastAutoStatus = 'offline'; stopRealtimePush(); renderSyncUI(); });
  window.addEventListener('focus', () => {
    if (!autoSyncEnabled || !isLoggedIn() || document.hidden) return;
    startRealtimePush();
    if (Date.now() - lastDownloadAt >= AUTO_DOWNLOAD_MIN_GAP) scheduleAutoCycle(800, 'focus');
    else maybeProbeRemoteChanges(true);
  });
  setInterval(() => {
    if (document.hidden || !autoSyncEnabled || !isLoggedIn()) return;
    if (Date.now() - lastDownloadAt >= AUTO_POLL_INTERVAL) { scheduleAutoCycle(0, 'poll'); return; }
    /* با اتصال زنده، پرس‌وجوی دقیقه‌ای لازم نیست؛ همان پایش ده‌دقیقه‌ای می‌ماند */
    if (realtimePush.connected) return;
    startRealtimePush();
    maybeProbeRemoteChanges();
  }, 60000);

  startRealtimePush();
  scheduleAutoCycle(4000, 'startup');
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
      ? pending.filter(change => change && PB_UPLOAD_STORES.includes(change.store)).length
      : 0;
    try {
      const identity = currentSyncIdentity();
      if (identity && identity.meta && identity.meta.tracker !== trackerSignatureOf(currentTrackerPayload())) count++;
    } catch (e) {}
    el.textContent = count ? `${fa(count)} تغییر در انتظار ارسال` : 'همه تغییرات ذخیره شده‌اند';
    el.classList.toggle('pending', count > 0);
  }).catch(() => {});
}

/* ============ sync UI ============ */
function syncProgressMarkup() {
  const kindTitle = syncProgress.kind === 'upload' ? 'ارسال داده‌ها' : 'دریافت داده‌ها';
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

let accountRenderState = '';

function syncStateBadge(online, loggedIn, busy) {
  if (!loggedIn) return { text: 'نیاز به ورود', cls: 'warn' };
  if (busy) return { text: 'در حال سینک', cls: 'busy' };
  if (!online) return { text: 'آفلاین', cls: 'warn' };
  if (!autoSyncEnabled) return { text: 'خاموش', cls: 'warn' };
  if (realtimePush.connected) return { text: 'زنده', cls: 'live' };
  return { text: 'آماده', cls: '' };
}

/* هویت حساب و پروفایل در یک نقطه دیده میشود: نام و رشته در بالا، ایمیل و
   ورود/خروج بلافاصله زیر همان کارت. */
function renderAccountUI(loggedIn, email, online, busy, lastSync) {
  const box = document.getElementById('accountUI');
  if (!box) return;
  const stateKey = loggedIn
    ? `in|${email}|${online}|${busy}|${lastSync}`
    : 'out';
  const active = document.activeElement;
  if (active && box.contains(active) &&
      /^(INPUT|TEXTAREA|SELECT)$/.test(String(active.tagName || '').toUpperCase()) &&
      accountRenderState === stateKey) return;
  accountRenderState = stateKey;

  if (loggedIn) {
    const initial = String(email || '?').trim().charAt(0).toUpperCase() || '?';
    box.innerHTML = `
      <div class="account-row">
        <span class="account-avatar">${esc(initial)}</span>
        <div class="account-identity">
          <div class="account-email" dir="ltr">${esc(email || 'حساب متصل')}</div>
          <div class="account-sub"><span class="sync-status-${online ? 'online' : 'offline'}">${online ? 'آنلاین' : 'آفلاین'}</span> • آخرین سینک: ${esc(lastSync)}</div>
        </div>
        <button class="btn ghost account-btn" id="syncLogoutBtn" ${busy ? 'disabled' : ''}>خروج</button>
      </div>`;
    const logoutBtn = document.getElementById('syncLogoutBtn');
    if (logoutBtn) logoutBtn.onclick = () => {
      if (busy) return;
      if (!confirm('از حساب کاربری خارج میشوید؟')) return;
      logoutPocketBase();
      toast('خارج شدید');
      renderSyncUI();
    };
    return;
  }

  box.innerHTML = `
    <div class="account-row">
      <span class="account-avatar muted-avatar">👤</span>
      <div class="account-identity">
        <div class="account-email">حساب کاربری متصل نیست</div>
        <div class="account-sub">برای همگامسازی وارد شوید</div>
      </div>
    </div>
    <div class="account-login-form">
      <input class="input" id="syncEmail" type="email" placeholder="ایمیل" dir="ltr" autocomplete="username" inputmode="email" aria-label="ایمیل">
      <input class="input" id="syncPassword" type="password" placeholder="رمز عبور" autocomplete="current-password" aria-label="رمز عبور">
      <button class="btn primary" id="syncLoginBtn">ورود</button>
      <div id="syncLoginError" class="sync-login-error"></div>
    </div>`;
  const loginBtn = document.getElementById('syncLoginBtn');
  const passwordEl = document.getElementById('syncPassword');
  if (passwordEl) passwordEl.onkeydown = event => {
    if (event.key === 'Enter') { event.preventDefault(); if (loginBtn) loginBtn.click(); }
  };
  if (!loginBtn) return;
  loginBtn.onclick = async () => {
    const emailEl = document.getElementById('syncEmail');
    const errEl = document.getElementById('syncLoginError');
    const emailValue = (emailEl ? emailEl.value : '').trim();
    const password = passwordEl ? passwordEl.value : '';
    if (errEl) { errEl.textContent = ''; errEl.classList.remove('show'); }
    if (!emailValue || !password) {
      if (errEl) { errEl.textContent = 'ایمیل و رمز عبور را وارد کنید.'; errEl.classList.add('show'); }
      return;
    }
    loginBtn.disabled = true;
    loginBtn.textContent = '⏳…';
    try {
      await loginWithPassword(emailValue, password);
      syncError = null;
      syncNotice = autoSyncEnabled ? '✓ وارد شدید؛ همگامسازی خودکار آغاز شد.' : '✓ وارد شدید.';
      toast('✓ وارد شدید');
      renderSyncUI();
      startAutoSync();
      if (autoSyncEnabled) scheduleAutoCycle(300, 'login');
    } catch (error) {
      console.error('[PB] login failed:', error);
      if (errEl) {
        errEl.textContent = 'خطا در ورود: ' + pocketBaseErrorMessage(error);
        errEl.classList.add('show');
      }
      loginBtn.disabled = false;
      loginBtn.textContent = 'ورود';
    }
  };
}

function renderSyncUI() {
  const box = document.getElementById('syncUI');
  if (!box) return;

  const loggedIn = isLoggedIn();
  const email = getLoggedInEmail();
  const lastSync = formatLastSync();
  const online = typeof navigator !== 'undefined' ? navigator.onLine !== false : true;
  const busy = !!syncBusy || autoSyncRunning || realtimeApplyRunning;
  const badge = syncStateBadge(online, loggedIn, busy);

  /* حساب کاربری بخشی از همان کارت پروفایل است، نه بخش جداگانه تنظیمات. */
  renderAccountUI(loggedIn, email, online, busy, lastSync);

  if (!loggedIn) {
    box.innerHTML = `
      <div class="sync-card-head">
        <div class="sync-card-title">همگامسازی ابری</div>
        <span class="sync-state-pill warn">${badge.text}</span>
      </div>
      <div class="sync-empty-note">پس از ورود، تنظیمات همگامسازی اینجا نمایش داده میشود.</div>`;
    return;
  }

  box.innerHTML = `
    <div class="sync-card-head">
      <div class="sync-card-title">همگامسازی ابری</div>
      <span class="sync-state-pill ${badge.cls}">${badge.text}</span>
    </div>
    <label class="toggle-card sync-auto-toggle ${autoSyncEnabled ? 'on' : ''}" for="syncAutoToggle">
      <div class="sync-auto-info">
        <div class="sync-auto-title">همگامسازی خودکار</div>
        <div class="sync-auto-desc">تغییرات بلافاصله ارسال و بهصورت زنده دریافت میشوند.</div>
      </div>
      <span class="switch"><input type="checkbox" id="syncAutoToggle" ${autoSyncEnabled ? 'checked' : ''} ${busy ? 'disabled' : ''}><span></span></span>
    </label>
    <div class="sync-pending-row">
      <span class="sync-pending" id="syncPendingStatus">در حال بررسی تغییرات…</span>
    </div>
    <button class="btn primary sync-now-btn" id="syncNowBtn" ${busy ? 'disabled' : ''}>
      ${busy ? '⏳ در حال همگامسازی…' : '🔄 همگامسازی و بررسی'}
    </button>
    ${syncProgressMarkup()}
    ${syncError ? `<div class="sync-login-error show">⚠️ ${esc(syncError)}</div>` : ''}
    ${syncNotice ? `<div class="sync-notice">${esc(syncNotice)}</div>` : ''}
  `;

  if (busy) setProgress(syncProgress.kind, syncProgress.percent, syncProgress.note, true);
  const nowBtn = document.getElementById('syncNowBtn');
  const toggle = document.getElementById('syncAutoToggle');
  if (nowBtn) nowBtn.onclick = () => { syncNow(); };
  if (toggle) toggle.onchange = () => setAutoSyncEnabled(!!toggle.checked);
  refreshPendingBadge();
}

/* Expose for external calls */
window.pocketBaseSync = {
  isLoggedIn,
  getLoggedInEmail,
  getLastSyncTimestamp,
  formatLastSync,
  ensureAuthModel,
  uploadAllData,
  downloadAllData,
  syncNow,
  syncRepair,
  cycle: syncCycle,
  startAutoSync,
  onSettingsOpen,
  isAutoSyncEnabled: () => autoSyncEnabled,
  setAutoSyncEnabled,
  realtimeStatus: () => ({
    supported: realtimePush.supported,
    connected: realtimePush.connected,
    lastEventAt: realtimePush.lastEventAt
  }),
  startRealtime: startRealtimePush,
  login: loginWithPassword,
  logout: logoutPocketBase,
  render: renderSyncUI
};