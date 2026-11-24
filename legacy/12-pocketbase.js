'use strict';

/* ============================================================
   POCKETBASE ΓÇö ┘ç┘à┌»╪º┘àΓÇî╪│╪º╪▓█î ╪«┘ê╪»┌⌐╪º╪▒ ╪»┘ê╪╖╪▒┘ü┘ç (┘å╪│╪«┘ç █┤.█▓.█▒█░)
   - ┘ç╪▒ ┌⌐╪º╪▒╪¿╪▒ ╪¿╪º ╪º█î┘à█î┘ä/╪▒┘à╪▓ ╪«┘ê╪»╪┤ ┘ê╪º╪▒╪» ┘à█îΓÇî╪┤┘ê╪»╪¢ ╪»╪º╪»┘çΓÇî┘ç╪º ╪¿╪º ┘ü█î┘ä╪» owner ╪¼╪»╪º ┘à█îΓÇî╪┤┘ê┘å╪»
   - ╪º╪▒╪│╪º┘ä ╪¬╪»╪▒█î╪¼█î: ┘ü┘é╪╖ ╪▒┌⌐┘ê╪▒╪»┘ç╪º█î█î ┌⌐┘ç ╪¬╪║█î█î╪▒ ┌⌐╪▒╪»┘çΓÇî╪º┘å╪» ╪º╪▒╪│╪º┘ä ┘à█îΓÇî╪┤┘ê┘å╪»
   - ╪»╪▒█î╪º┘ü╪¬ ╪¬╪»╪▒█î╪¼█î: ┘ü┘é╪╖ ╪▒┌⌐┘ê╪▒╪»┘ç╪º█î█î ┌⌐┘ç ╪º╪▓ ╪ó╪«╪▒█î┘å ╪│█î┘å┌⌐ `updated` ╪¬╪º╪▓┘çΓÇî╪¬╪▒█î ╪»╪º╪▒┘å╪»
     ╪«┘ê╪º┘å╪»┘ç ┘à█îΓÇî╪┤┘ê┘å╪» (┘ü█î┘ä╪¬╪▒ ╪│┘à╪¬ ╪│╪▒┘ê╪▒)╪î ┘å┘ç ┘ü┘ç╪▒╪│╪¬ ┌⌐╪º┘à┘ä ┘à╪¼┘à┘ê╪╣┘ç
   - ╪¡╪░┘üΓÇî┘ç╪º ╪¿╪º ┬½╪¡╪│╪º╪¿ ╪¬╪╣╪»╪º╪»┬╗ ╪¬╪┤╪«█î╪╡ ╪»╪º╪»┘ç ┘à█îΓÇî╪┤┘ê┘å╪»: ╪¬╪╣╪»╪º╪» ╪│╪▒┘ê╪▒ ╪¿╪º ╪¬╪╣╪»╪º╪» ╪┤┘å╪º╪«╪¬┘çΓÇî╪┤╪»┘ç
     ╪¿┘çΓÇî╪╣┘ä╪º┘ê┘ç┘ö ╪▒┌⌐┘ê╪▒╪»┘ç╪º█î ╪¬╪º╪▓┘ç ┘à┘é╪º█î╪│┘ç ┘à█îΓÇî╪┤┘ê╪»╪¢ ┘ü┘é╪╖ ╪»╪▒ ╪╡┘ê╪▒╪¬ ╪º╪«╪¬┘ä╪º┘ü╪î ┘ü┘ç╪▒╪│╪¬ ┌⌐╪º┘à┘ä
     ┘ç┘à╪º┘å ┘à╪¼┘à┘ê╪╣┘ç ╪«┘ê╪º┘å╪»┘ç ┘à█îΓÇî╪┤┘ê╪»
   - ╪º┌»╪▒ ╪¬╪║█î█î╪▒█î ╪¿╪▒╪º█î ╪º╪▒╪│╪º┘ä █î╪º ╪»╪▒█î╪º┘ü╪¬ ┘å╪¿╪º╪┤╪»╪î ╪╣┘à┘ä╪º┘ï ┘ç█î┌å ╪»╪º╪»┘çΓÇî╪º█î ╪¼╪º╪¿┘çΓÇî╪¼╪º ┘å┘à█îΓÇî╪┤┘ê╪»
   - ╪▒┘ê█î╪»╪º╪» ╪▓┘å╪»┘ç┘ö PocketBase ╪»┘é█î┘é╪º┘ï ┘ç┘à╪º┘å ╪▒┌⌐┘ê╪▒╪» ╪▒╪º ╪º╪╣┘à╪º┘ä ┘à█î┌⌐┘å╪»╪¢ ╪¿╪»┘ê┘å
     ╪¿╪º╪▓╪¿█î┘å█î ┘ü┘ç╪▒╪│╪¬ █î╪º ╪┤┘à╪º╪▒╪┤ ┌⌐┘ä ┘à╪¼┘à┘ê╪╣┘ç┘ç╪º
   - ╪º┘ê┘ä█î┘å ╪│█î┘å┌⌐ ╪»╪│╪¬┌»╪º┘ç ╪¬╪º╪▓┘ç ╪º┘ê┘ä ╪»╪▒█î╪º┘ü╪¬ ┘à█îΓÇî┌⌐┘å╪» ╪¬╪º ╪»╪º╪»┘ç┘ö ╪│╪▒┘ê╪▒ ╪¿╪º╪▓┘å┘ê█î╪│█î ┘å╪┤┘ê╪»
   - ┘ç╪▒ █╢█░ ╪½╪º┘å█î┘ç █î┌⌐ ┬½┌⌐╪º┘ê╪┤ ╪º╪▒╪▓╪º┘å┬╗ ╪º┘å╪¼╪º┘à ┘à█îΓÇî╪┤┘ê╪»: ┘ü┘é╪╖ ┘╛╪▒╪│█î╪»┘ç ┘à█îΓÇî╪┤┘ê╪» ╪ó█î╪º ╪▒┌⌐┘ê╪▒╪»█î
     ╪¬╪º╪▓┘çΓÇî╪¬╪▒ ╪º╪▓ ╪ó╪«╪▒█î┘å ┘ê╪╢╪╣█î╪¬ ╪┤┘å╪º╪«╪¬┘çΓÇî╪┤╪»┘ç ╪▒┘ê█î ╪│╪▒┘ê╪▒ ┘ç╪│╪¬ █î╪º ┘å┘ç╪¢ ╪│█î┘å┌⌐ ┌⌐╪º┘à┘ä ┘ü┘é╪╖
     ┘ê┘é╪¬█î ╪│╪▒┘ê╪▒ ┘ê╪º┘é╪╣╪º┘ï ╪¬╪║█î█î╪▒ ┌⌐╪▒╪»┘ç ╪¿╪º╪┤╪» ╪º╪¼╪▒╪º ┘à█îΓÇî╪┤┘ê╪»
   ============================================================ */

const POCKETBASE_URL_DEFAULT = 'https://masir-69623a.dockhold.app';
const PB_URL_KEY = 'konkur-pb-url-v1';
const LAST_SYNC_KEY = 'konkur-last-sync-v1';
const AUTH_TOKEN_KEY = 'konkur-pb-auth-v1';
const PB_SYNC_META_KEY = 'konkur-pb-sync-meta-v1';
const PB_SYNC_META_VERSION = 3;
/* ┘å╪│╪«┘ç┘ö ╪¿╪º╪▓╪¿█î┘å█î ╪│┘ä╪º┘à╪¬: █î┌⌐ΓÇî╪¿╪º╪▒ ┘╛╪│ ╪º╪▓ ╪º█î┘å ╪º╪▒╪¬┘é╪º ╪▒┌⌐┘ê╪▒╪»┘ç╪º█î ┘å╪º┘é╪╡ ┘à╪¡┘ä█î ╪¬╪▒┘à█î┘à ┘à█îΓÇî╪┤┘ê┘å╪».
   ┘å╪│╪«┘ç┘ö █┤ ╪╣┘ä╪º┘ê┘ç ╪¿╪▒ ╪¬╪▒┘à█î┘à ╪▒┌⌐┘ê╪▒╪»┘ç╪º█î ┘å╪º┘é╪╡╪î ┘à┘é╪»╪º╪▒ ╪▒┌⌐┘ê╪▒╪»┘ç╪º█î█î ╪▒╪º ┌⌐┘ç ┘å╪│╪«┘çΓÇî┘ç╪º█î ┘é╪¿┘ä█î
   ┬½╪»█î╪»┘çΓÇî╪┤╪»┘ç┬╗ ╪½╪¿╪¬ ┌⌐╪▒╪»┘ç ╪¿┘ê╪»┘å╪» ┘ê┘ä█î ┘ç╪▒┌»╪▓ ╪º╪╣┘à╪º┘ä ┘å┌⌐╪▒╪»┘ç ╪¿┘ê╪»┘å╪» ╪»┘ê╪¿╪º╪▒┘ç ┘à┘é╪º█î╪│┘ç ┘à█îΓÇî┌⌐┘å╪». */
const PB_SYNC_INTEGRITY_VERSION = 5;
const PB_SYNC_META_LIMIT = 3;
const PB_MANIFEST_FIELDS = 'id,localId,updated';
const PB_DELETE_CHECK_GAP = 24 * 60 * 60 * 1000;
const PB_DEFAULT_PAGE_SIZE = 200;
/* ╪»╪▒ ┘ç╪▒ ┌å╪▒╪«┘ç ┌å┘å╪» ╪▒┌⌐┘ê╪▒╪» ╪¿╪▒╪º█î ┬½╪¬╪▒┘à█î┘à ╪«┘ê╪»┌⌐╪º╪▒┬╗ ╪¿╪º ┘à┘é╪»╪º╪▒ ╪│╪▒┘ê╪▒ ┘à┘é╪º█î╪│┘ç ╪┤┘ê╪» */
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
    throw new Error('┌⌐╪¬╪º╪¿╪«╪º┘å┘ç PocketBase ╪¿╪º╪▒┌»╪░╪º╪▒█î ┘å╪┤╪»╪¢ ╪º╪¬╪╡╪º┘ä ╪º█î┘å╪¬╪▒┘å╪¬ ╪▒╪º ╪¿╪▒╪▒╪│█î ┌⌐┘å█î╪».');
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

/* ============ legacy token (╪│╪º╪▓┌»╪º╪▒█î ╪¿╪º ┘å╪│╪«┘çΓÇî┘ç╪º█î ┘é╪¿┘ä█î) ============ */
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
  catch (e) { throw new Error(e.message || '╪º╪¬╪╡╪º┘ä ╪¿┘ç PocketBase ┘à┘à┌⌐┘å ┘å╪┤╪»'); }
  const ok = await ensureAuthModel(pb).catch(() => false);
  if (!ok || !pocketBaseUserId(pb)) {
    clearLegacyToken();
    try { pb.authStore.clear(); } catch (_) {}
    throw new Error('┘å╪┤╪│╪¬ ┘à┘å┘é╪╢█î ╪┤╪»┘ç ╪º╪│╪¬╪¢ ╪»┘ê╪¿╪º╪▒┘ç ┘ê╪º╪▒╪» ╪┤┘ê█î╪».');
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
  if (!ts) return '┘ç┘å┘ê╪▓ ╪│█î┘å┌⌐ ┘å╪┤╪»┘ç';
  try {
    const d = new Date(ts);
    const g = { gy: d.getFullYear(), gm: d.getMonth() + 1, gd: d.getDate() };
    const j = d2j(g2d(g.gy, g.gm, g.gd));
    return `${fa(j.jd)} ${MONTHS[j.jm - 1]} ${fa(j.jy)} ΓÇö ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
  } catch (e) { return new Date(ts).toLocaleString('fa-IR'); }
}

/* ============ metadata ╪│█î┘å┌⌐ ╪¬╪»╪▒█î╪¼█î (╪¿╪▒╪º█î ┘ç╪▒ ╪│╪▒┘ê╪▒/┌⌐╪º╪▒╪¿╪▒) ============ */
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
/* ╪º╪▒╪¬┘é╪º█î ┘ü╪▒╪º╪»╪º╪»┘ç┘ö ┘å╪│╪«┘ç┘ö ┘é╪¿┘ä ╪¿╪»┘ê┘å ┘ê╪º╪»╪º╪▒ ┌⌐╪▒╪»┘å ╪»╪│╪¬┌»╪º┘ç ╪¿┘ç ╪»╪▒█î╪º┘ü╪¬ ┌⌐╪º┘à┘ä ╪»┘ê╪¿╪º╪▒┘ç */
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
    /* ╪¬╪╣╪»╪º╪»┘ç╪º█î ╪┤┘å╪º╪«╪¬┘çΓÇî╪┤╪»┘ç ╪º╪▓ ┘ü┘ç╪▒╪│╪¬ ┘é╪¿┘ä█î ╪│╪º╪«╪¬┘ç ┘à█îΓÇî╪┤┘ê┘å╪»╪¢ ╪º┌»╪▒ ╪│╪▒┘ê╪▒ ╪¿╪º ╪ó┘åΓÇî┘ç╪º
       ╪º╪«╪¬┘ä╪º┘ü ╪»╪º╪┤╪¬┘ç ╪¿╪º╪┤╪»╪î ┬½╪¡╪│╪º╪¿ ╪¬╪╣╪»╪º╪»┬╗ ╪«┘ê╪»╪┤ ┘ç┘à╪º┘å ┘à╪¼┘à┘ê╪╣┘ç ╪▒╪º ╪¿╪º╪▓╪¿█î┘å█î ┘à█îΓÇî┌⌐┘å╪». */
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
const POCKETBASE_TIMER_ID = 'timer';

function pbCollectionName(store) {
  return PB_COLLECTIONS[store] || store;
}

/* ============ helpers ============ */
function pbFilterValue(value) {
  return String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}
function pocketBaseErrorMessage(error) {
  if (!error) return '╪«╪╖╪º█î ┘å╪º╪┤┘å╪º╪«╪¬┘ç';
  if (typeof error === 'string') return error;
  if (error.status === 404) return '┘à╪¼┘à┘ê╪╣┘ç ┘à┘ê╪▒╪»┘å█î╪º╪▓ ╪▒┘ê█î ╪│╪▒┘ê╪▒ ┘╛█î╪»╪º ┘å╪┤╪» ΓÇö ╪»╪▒ ┘╛┘å┘ä pocketbase/pb_collections_panel.json ╪▒╪º ╪º█î┘à┘╛┘ê╪▒╪¬ ┌⌐┘å█î╪» █î╪º setup_pocketbase.py ╪▒╪º ╪º╪¼╪▒╪º ┌⌐┘å█î╪»';
  if (error.status === 429) return '╪│╪▒┘ê╪▒ ╪¬╪╣╪»╪º╪» ╪»╪▒╪«┘ê╪º╪│╪¬ΓÇî┘ç╪º ╪▒╪º ┘à╪¡╪»┘ê╪» ┌⌐╪▒╪»┘ç (Too Many Requests) ΓÇö ┌å┘å╪» ┘ä╪¡╪╕┘ç ╪╡╪¿╪▒ ┌⌐┘å█î╪» ┘ê ╪»┘ê╪¿╪º╪▒┘ç ╪º┘à╪¬╪¡╪º┘å ┌⌐┘å█î╪»╪î █î╪º ╪»╪▒ ┘╛┘å┘ä PocketBase ┘à╪¡╪»┘ê╪»█î╪¬ ┘å╪▒╪« ╪▒╪º ╪¿╪▒╪»╪º╪▒█î╪»';
  if (error.status === 401 || error.status === 403) return '╪»╪│╪¬╪▒╪│█î ╪¿┘ç ╪º█î┘å ╪¡╪│╪º╪¿ ┘à╪¼╪º╪▓ ┘å█î╪│╪¬╪¢ ╪»┘ê╪¿╪º╪▒┘ç ┘ê╪º╪▒╪» ╪┤┘ê█î╪»';
  if (error.status === 400 && error.message === 'Failed to authenticate.') {
    return '╪º█î┘à█î┘ä █î╪º ╪▒┘à╪▓ ╪╣╪¿┘ê╪▒ ╪º╪┤╪¬╪¿╪º┘ç ╪º╪│╪¬';
  }
  if (error.data && typeof error.data === 'object') {
    const details = Object.entries(error.data)
      .filter(([field, v]) => field !== 'message' && field !== 'status' && field !== 'data' && v && typeof v === 'object' && v.message)
      .map(([field, v]) => `${field}: ${v.message}`).join('╪î ');
    if (details) return `${error.message || 'PB error'} (${details})`;
  }
  if (error.message) return error.message;
  return '╪«╪╖╪º█î ┘å╪º╪┤┘å╪º╪«╪¬┘ç';
}
function isUniqueConflictError(err) {
  if (!err || err.status !== 400) return false;
  try {
    const text = JSON.stringify(err.data || err.response?.data || {}).toLowerCase();
    return text.includes('validation_not_unique') || text.includes('unique');
  } catch (_) { return false; }
}
/* ╪▒┌⌐┘ê╪▒╪» ╪│╪▒┘ê╪▒ ┘╛█î╪»╪º ┘å╪┤╪» (╪¡╪░┘ü █î╪º ╪¿╪º╪▓╪│╪º╪▓█î ╪┤╪»┘ç)╪¢ ╪┤┘å╪º╪│┘ç ╪¿╪º█î╪» ╪»┘ê╪¿╪º╪▒┘ç ┌»╪▒┘ü╪¬┘ç ╪┤┘ê╪» */
function isMissingRecordError(err) {
  return !!err && err.status === 404;
}
/* ┘à╪¡╪»┘ê╪»█î╪¬ ┘å╪▒╪« PocketBase: ╪¬┘ä╪º╪┤ ╪»┘ê╪¿╪º╪▒┘ç ╪¿╪º ╪¬╪ú╪«█î╪▒ ┘ü╪▓╪º█î┘å╪»┘ç */
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
  /* ┘ê┘é╪¬█î ╪│╪▒┘ê╪▒ █┤█▓█╣ ┘à█îΓÇî╪»┘ç╪»╪î ╪¿█î┘å ╪»╪▒╪«┘ê╪º╪│╪¬ΓÇî┘ç╪º ┘ü╪º╪╡┘ä┘ç ┘à█îΓÇî┌»╪░╪º╪▒█î┘à ╪¬╪º ╪▓█î╪▒ ╪│┘é┘ü ┘å╪▒╪« ╪¿┘à╪º┘å█î┘à */
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
        setProgress(syncProgress.kind, syncProgress.percent, '╪│╪▒┘ê╪▒ ┘à╪¡╪»┘ê╪»█î╪¬ ╪»╪▒╪«┘ê╪º╪│╪¬ ┌»╪░╪º╪┤╪¬┘ç╪¢ ╪¬┘ä╪º╪┤ ╪»┘ê╪¿╪º╪▒┘çΓÇª', true);
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

/* ┘ü┘ç╪▒╪│╪¬ ╪│╪¿┌⌐ ╪│╪▒┘ê╪▒: ┘ü┘é╪╖ ╪┤┘å╪º╪│┘çΓÇî┘ç╪º ┘ê ╪▓┘à╪º┘å ╪ó╪«╪▒█î┘å ╪¬╪║█î█î╪▒╪î ╪¿╪»┘ê┘å ┘à┘é╪»╪º╪▒ ╪▒┌⌐┘ê╪▒╪»┘ç╪º */
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

/* ╪▒┌⌐┘ê╪▒╪»┘ç╪º█î ╪¬╪║█î█î╪▒┌⌐╪▒╪»┘ç ╪▒╪º ╪¿╪º ╪┤┘å╪º╪│┘ç┘ö ╪│╪▒┘ê╪▒ ┘à█îΓÇî╪«┘ê╪º┘å█î┘à╪î ┘å┘ç ┌⌐┘ä ┘à╪¼┘à┘ê╪╣┘ç */
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

/* ┘ü┘é╪╖ ╪▒┌⌐┘ê╪▒╪»┘ç╪º█î█î ┌⌐┘ç ╪º╪▓ █î┌⌐ ╪▓┘à╪º┘å ┘à╪┤╪«╪╡ ╪¿┘ç ╪¿╪╣╪» ╪¬╪║█î█î╪▒ ┌⌐╪▒╪»┘çΓÇî╪º┘å╪» (┘ü█î┘ä╪¬╪▒ ╪│┘à╪¬ ╪│╪▒┘ê╪▒) */
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

/* ┘ü┘ç╪▒╪│╪¬ ╪│╪¿┌⌐ ┘ü┘é╪╖ ╪┤┘å╪º╪│┘ç ┘ê ╪▓┘à╪º┘å ╪¬╪║█î█î╪▒ ╪»╪º╪▒╪»╪¢ ╪¿╪▒╪º█î ╪▒┌⌐┘ê╪▒╪»┘ç╪º█î ╪¬╪║█î█î╪▒┌⌐╪▒╪»┘ç╪î
   ┘à┘é╪»╪º╪▒ ┌⌐╪º┘à┘ä ┘ç┘à╪º┘å ┌å┘å╪» ╪▒┌⌐┘ê╪▒╪» ╪▒╪º ╪¼╪»╪º┌»╪º┘å┘ç ┘à█îΓÇî╪«┘ê╪º┘å█î┘à. */
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

/* ╪¬╪╣╪»╪º╪» ╪▒┌⌐┘ê╪▒╪»┘ç╪º█î ╪│╪▒┘ê╪▒╪¢ ╪¿╪▒╪º█î ╪¬╪┤╪«█î╪╡ ╪¡╪░┘ü (┌⌐┘ç ╪»╪▒ ┘ü█î┘ä╪¬╪▒ updated ╪»█î╪»┘ç ┘å┘à█îΓÇî╪┤┘ê╪») */
async function fetchOwnerCount(pb, collection, ownerId) {
  const res = await withRateLimitRetry(() => pb.collection(collection).getList(1, 1, {
    filter: `owner="${pbFilterValue(ownerId)}"`,
    skipTotal: false,
    requestKey: null
  }));
  if (res && typeof res.totalItems === 'number') return res.totalItems;
  return ((res && res.items) || []).length;
}

/* ┘à┘é╪º█î╪│┘ç┘ö ┘╛╪º█î╪»╪º╪▒ ╪»┘ê ┘à┘é╪»╪º╪▒ JSON ╪¿╪»┘ê┘å ╪¬┘ê╪¼┘ç ╪¿┘ç ╪¬╪▒╪¬█î╪¿ ┌⌐┘ä█î╪»┘ç╪º */
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

/* ╪ó█î╪º ╪│╪▒┘ê╪▒ ┘à┘é╪»╪º╪▒ ╪º╪▒╪│╪º┘ä█î ╪▒╪º ╪░╪«█î╪▒┘ç ┘å┌⌐╪▒╪»┘ç ╪º╪│╪¬╪ƒ ┘ü┘é╪╖ ┌⌐┘ä█î╪»┘ç╪º█î ╪º╪▒╪│╪º┘ä█î ╪¿╪▒╪▒╪│█î
   ┘à█îΓÇî╪┤┘ê┘å╪» ╪¬╪º ┘ü█î┘ä╪»┘ç╪º█î ╪º╪╢╪º┘ü┘çΓÇî╪º█î ┌⌐┘ç ╪│╪▒┘ê╪▒ ╪¿╪▒┘à█îΓÇî┌»╪▒╪»╪º┘å╪» ╪«╪╖╪º ╪º█î╪¼╪º╪» ┘å┌⌐┘å┘å╪». */
function pbValueDrift(sent, saved) {
  if (sent === undefined || sent === null) return false;
  if (saved === undefined || saved === null) return true;
  if (typeof sent !== 'object' || sent === null || Array.isArray(sent)) {
    return !pbSameJsonValue(sent, saved);
  }
  if (typeof saved !== 'object' || Array.isArray(saved)) return true;
  return Object.keys(sent).some(key => !pbSameJsonValue(sent[key], saved[key]));
}

/* ╪ó█î╪º ┘à┘é╪»╪º╪▒ ╪░╪«█î╪▒┘çΓÇî╪┤╪»┘ç ╪▒┘ê█î ╪º█î┘å ╪»╪│╪¬┌»╪º┘ç ╪¿╪º ┘à┘é╪»╪º╪▒ ╪▒┌⌐┘ê╪▒╪» ╪│╪▒┘ê╪▒ █î┌⌐█î ╪º╪│╪¬╪ƒ
   ╪¿╪▒╪º█î ┬½╪¬╪▒┘à█î┘à ╪«┘ê╪»┌⌐╪º╪▒┬╗ ╪º╪│╪¬┘ü╪º╪»┘ç ┘à█îΓÇî╪┤┘ê╪»╪¢ ┘ü┘é╪╖ ┘à┘é╪»╪º╪▒ ┘à┘é╪º█î╪│┘ç ┘à█îΓÇî╪┤┘ê╪»╪î ┘å┘ç ╪¬╪▒╪¬█î╪¿. */
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

/* ╪¿╪▒╪«█î ┘à╪¼┘à┘ê╪╣┘çΓÇî┘ç╪º ┘ç╪▒┌»╪▓ ┘à┘é╪»╪º╪▒ ╪«╪º┘ä█î ┘å╪»╪º╪▒┘å╪»╪¢ ╪º┌»╪▒ ╪«╪º┘ä█î ╪¿┘ê╪» █î╪╣┘å█î ╪▒┌⌐┘ê╪▒╪» ┘å╪º┘é╪╡ ╪░╪«█î╪▒┘ç ╪┤╪»┘ç ╪º╪│╪¬.
   (╪¿╪▒╪º█î classes ┘à┘é╪»╪º╪▒ ╪«╪º┘ä█î █î╪╣┘å█î ┌⌐┘ä╪º╪│ ╪¿╪»┘ê┘å ╪¼┘ä╪│┘ç ┘ê ╪╖╪¿█î╪╣█î ╪º╪│╪¬.) */
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

/* ╪¿╪▓╪▒┌»ΓÇî╪¬╪▒█î┘å ╪▓┘à╪º┘å ╪¬╪║█î█î╪▒┘É ╪┤┘å╪º╪«╪¬┘çΓÇî╪┤╪»┘ç ╪¿╪▒╪º█î █î┌⌐ ┘à╪¼┘à┘ê╪╣┘ç (╪º╪▓ floor ┘ê ┘ü┘ç╪▒╪│╪¬ ╪▒┌⌐┘ê╪▒╪»┘ç╪º) */
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

/* ╪»╪▒ ┘à╪¼┘à┘ê╪╣┘ç┘ö settings ┘ç┘à┘çΓÇî┌å█î╪▓ ╪¿┘çΓÇî╪¼╪▓ ╪┤┘à╪º╪▒┘å╪»┘ç ╪¿┘ç ╪┤┘å╪º╪│┘ç┘ö ╪º╪╡┘ä█î ┘å┌»╪º╪┤╪¬ ┘à█îΓÇî╪┤┘ê╪» */
function pbCanonicalLocalId(store, localId) {
  const id = String(localId == null ? '' : localId);
  if (store !== 'app-meta') return id;
  if (id === POCKETBASE_TRACKER_ID || id === POCKETBASE_TIMER_ID) return id;
  return DB_STATE_ID;
}

/* ╪º┌»╪▒ ┘à╪¼┘à┘ê╪╣┘ç ╪│╪¬┘ê┘å updated ┘å╪»╪º╪┤╪¬┘ç ╪¿╪º╪┤╪»╪î ┬½null┬╗ █î╪╣┘å█î ╪▓┘à╪º┘å ╪¬╪║█î█î╪▒ ┘å╪º┘à╪╣┘ä┘ê┘à ╪º╪│╪¬ */
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

/* ╪┤┘à╪º╪▒┘å╪»┘ç ┘ê ╪¬╪º█î┘à╪▒ ╪¿█î╪▒┘ê┘å ╪º╪▓ state ┘ç╪│╪¬┘å╪» ┘ê ╪º╪▓ localState ╪«┘ê╪º┘å╪»┘ç ┘à█î╪┤┘ê┘å╪» */
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
function applyRemoteTracker(remoteTracker) {
  if (!remoteTracker || typeof trkCounts === 'undefined') return;
  const counts = remoteTracker.counts || {};
  trkCounts = {
    correct: Math.max(0, +counts.correct || 0),
    wrong: Math.max(0, +counts.wrong || 0),
    blank: Math.max(0, +counts.blank || 0)
  };
  trkCoef = (typeof TRK_COEF !== 'undefined' ? TRK_COEF : 1 / 3);
  try { saveTracker(); } catch (e) { console.warn('[PB] saving tracker failed:', e); }
}
function applyRemoteTimer(remoteTimer) {
  if (!remoteTimer || typeof applyImportedTimerState !== 'function') return;
  try { applyImportedTimerState(remoteTimer); }
  catch (e) { console.warn('[PB] saving timer failed:', e); }
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
  if (pct) pct.textContent = fa(value) + '┘¬';
  const percentLabel = document.getElementById('syncProgressPercentLabel');
  if (percentLabel) percentLabel.textContent = kind === 'upload' ? '╪»╪▒╪╡╪» ╪º╪▒╪│╪º┘ä' : '╪»╪▒╪╡╪» ╪»╪▒█î╪º┘ü╪¬';
  const noteEl = document.getElementById('syncProgressNote');
  if (noteEl) noteEl.textContent = syncProgress.note || '';
  const title = document.getElementById('syncProgressTitle');
  if (title) title.textContent = kind === 'upload' ? '╪º╪▒╪│╪º┘ä ╪»╪º╪»┘çΓÇî┘ç╪º' : '╪»╪▒█î╪º┘ü╪¬ ╪»╪º╪»┘çΓÇî┘ç╪º';
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
  /* ╪┤┘à╪º╪▒┘å╪»┘ç ╪¬╪│╪¬ ┘ê ╪¬╪º█î┘à╪▒ (╪«╪º╪▒╪¼ ╪º╪▓ state╪î ╪»╪▒ localState) */
  const trackerPayload = currentTrackerPayload();
  if (trackerPayload) {
    items.push({
      store: 'app-meta',
      collection: pbCollectionName('app-meta'),
      localId: POCKETBASE_TRACKER_ID,
      record: { value: trackerPayload }
    });
  }
  const timerPayload = currentTimerPayload();
  if (timerPayload) {
    items.push({
      store: 'app-meta',
      collection: pbCollectionName('app-meta'),
      localId: POCKETBASE_TIMER_ID,
      record: { value: timerPayload }
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

/* ┘ü┘é╪╖ ┘ü█î┘ä╪»┘ç╪º█î█î ┌⌐┘ç ┌⌐╪º╪▒╪¿╪▒ ╪▒┘ê█î ┘ç┘à█î┘å ╪»╪│╪¬┌»╪º┘ç ╪╣┘ê╪╢ ┌⌐╪▒╪»┘ç ╪º╪│╪¬ ╪¿╪▒╪»╪º╪┤╪¬┘ç ┘à█îΓÇî╪┤┘ê╪» */
function pbPickValueFields(value, fields) {
  const picked = {};
  if (!value || typeof value !== 'object' || Array.isArray(value) || !Array.isArray(fields)) return picked;
  fields.forEach(field => {
    if (Object.prototype.hasOwnProperty.call(value, field)) picked[field] = value[field];
  });
  return picked;
}

/*
 * ╪º╪»╪║╪º┘à ┘à┘é╪»╪º╪▒ ╪│╪▒┘ê╪▒ ╪¿╪º ┘ü█î┘ä╪»┘ç╪º█î ╪¬╪║█î█î╪▒┌⌐╪▒╪»┘ç┘ö ┘à╪¡┘ä█î.
 * ┘╛╪º█î┘ç┘ö ╪º╪»╪║╪º┘à ┘å╪│╪«┘ç┘ö ╪│╪▒┘ê╪▒ ╪º╪│╪¬ ╪¬╪º ┘ê█î╪▒╪º█î╪┤ΓÇî┘ç╪º█î ╪»╪│╪¬┌»╪º┘çΓÇî┘ç╪º█î ╪»█î┌»╪▒ ┘╛╪º┌⌐ ┘å╪┤┘ê╪»╪¢
 * ┘ü┘é╪╖ ┘ü█î┘ä╪»┘ç╪º█î█î ┌⌐┘ç ┌⌐╪º╪▒╪¿╪▒ ┘ç┘à█î┘åΓÇî╪¼╪º ╪╣┘ê╪╢ ┌⌐╪▒╪»┘ç ╪▒┘ê█î ╪ó┘å ┘å┘ê╪┤╪¬┘ç ┘à█îΓÇî╪┤┘ê╪».
 */
function pbMergeValueWithFields(remoteValue, localValue, fields) {
  const base = remoteValue && typeof remoteValue === 'object' && !Array.isArray(remoteValue)
    ? { ...remoteValue }
    : {};
  return { ...base, ...pbPickValueFields(localValue, fields) };
}

/*
 * ┘å┘ê╪┤╪¬┘å █î┌⌐ ╪▒┌⌐┘ê╪▒╪»: ╪º┌»╪▒ ╪┤┘å╪º╪│┘ç┘ö ╪│╪▒┘ê╪▒ ╪┤┘å╪º╪«╪¬┘ç ╪┤╪»┘ç ╪¿╪º╪┤╪» PATCH╪î ┘ê┌»╪▒┘å┘ç POST.
 * - ╪º┌»╪▒ PATCH ╪«╪╖╪º█î █┤█░█┤ ╪¿╪»┘ç╪» (╪▒┌⌐┘ê╪▒╪» ╪│╪▒┘ê╪▒ ╪¡╪░┘ü/╪¿╪º╪▓╪│╪º╪▓█î ╪┤╪»┘ç)╪î ╪┤┘å╪º╪│┘ç ╪»┘ê╪¿╪º╪▒┘ç
 *   ╪«┘ê╪º┘å╪»┘ç ┘à█îΓÇî╪┤┘ê╪» ┘ê ╪»╪▒ ┘å┘ç╪º█î╪¬ ╪▒┌⌐┘ê╪▒╪» ╪¬╪º╪▓┘ç ╪│╪º╪«╪¬┘ç ┘à█îΓÇî╪┤┘ê╪»╪¢ ┘ê█î╪▒╪º█î╪┤ ┌»┘à ┘å┘à█îΓÇî╪┤┘ê╪».
 * - ┘╛╪│ ╪º╪▓ ┘å┘ê╪┤╪¬┘å╪î ┘à┘é╪»╪º╪▒┘É ╪¿╪▒┌»╪┤╪¬█î ╪│╪▒┘ê╪▒ ╪¿╪º ┘à┘é╪»╪º╪▒ ╪º╪▒╪│╪º┘ä█î ┘à┘é╪º█î╪│┘ç ┘à█îΓÇî╪┤┘ê╪»╪¢ ╪º┌»╪▒
 *   ╪│╪▒┘ê╪▒ ┘à┘é╪»╪º╪▒ ╪▒╪º ╪░╪«█î╪▒┘ç ┘å┌⌐╪▒╪»┘ç ╪¿╪º╪┤╪» ╪«╪╖╪º ╪¿╪▒┌»╪▒╪»╪º┘å╪»┘ç ┘à█îΓÇî╪┤┘ê╪» ╪¬╪º ╪¬╪║█î█î╪▒ ┬½╪¬╪ú█î█î╪»┬╗
 *   ┘å╪┤┘ê╪» ┘ê ╪»╪▒ ╪╡┘ü ╪º╪▒╪│╪º┘ä ╪¿┘à╪º┘å╪».
 */
async function upsertRemoteRecord(pb, item, ownerId, remoteByLocalId, change) {
  const existing = remoteByLocalId && remoteByLocalId.get(item.localId);
  const fields = change && Array.isArray(change.fields) ? change.fields : null;
  /* ╪¬╪║█î█î╪▒ ┬½┘ü┘é╪╖ ╪¬╪▒╪¬█î╪¿┬╗ ┘å╪¿╪º█î╪» ┘à┘é╪»╪º╪▒ ╪▒┌⌐┘ê╪▒╪» ╪▒╪º ╪¿╪º╪▓┘å┘ê█î╪│█î ┌⌐┘å╪»╪¢ ┘ü┘é╪╖ order ┘à█îΓÇî╪▒┘ê╪» */
  const orderOnly = !!(fields && !fields.length && existing && existing.id);
  /* ┘å┘ê╪┤╪¬┘å ╪¼╪▓╪ª█î (┘ü┘é╪╖ order █î╪º ┘à┘é╪»╪º╪▒┘É ╪º╪»╪║╪º┘àΓÇî╪┤╪»┘ç) █î╪╣┘å█î ┘å╪│╪«┘ç┘ö ┘à╪¡┘ä█î ┘ç┘å┘ê╪▓ ┌⌐╪º┘à┘ä╪º┘ï
     ╪¿╪º ╪│╪▒┘ê╪▒ █î┌⌐█î ┘å█î╪│╪¬╪¢ ╪▓┘à╪º┘å ╪│╪▒┘ê╪▒ ┘å╪¿╪º█î╪» ╪¿┘çΓÇî╪╣┘å┘ê╪º┘å ┬½╪»█î╪»┘çΓÇî╪┤╪»┘ç┬╗ ╪½╪¿╪¬ ╪┤┘ê╪». */
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
    const error = new Error(`╪│╪▒┘ê╪▒ ┘à┘é╪»╪º╪▒ ┬½${item.collection}┬╗ ╪▒╪º ╪░╪«█î╪▒┘ç ┘å┌⌐╪▒╪»`);
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
 * ╪»╪▒ ╪º╪▒╪│╪º┘ä ╪¬╪»╪▒█î╪¼█î ╪¿┘ç ┘ü┘ç╪▒╪│╪¬ ┌⌐╪º┘à┘ä ┘à╪¼┘à┘ê╪╣┘ç ┘å█î╪º╪▓ ┘å█î╪│╪¬╪¢ ┘ü┘é╪╖ ╪┤┘å╪º╪│┘ç┘ö ╪│╪▒┘ê╪▒
 * ┘ç┘à╪º┘å ╪▒┌⌐┘ê╪▒╪»┘ç╪º█î█î ╪▒╪º ┘à█îΓÇî┌»█î╪▒█î┘à ┌⌐┘ç ╪¬╪║█î█î╪▒ ┘à╪¡┘ä█î ╪»╪º╪▒┘å╪». ┘à╪¼┘à┘ê╪╣┘ç┘ö settings
 * (┌⌐┘ç ┘ü┘é╪╖ ┌å┘å╪» ╪▒┌⌐┘ê╪▒╪» ╪»╪º╪▒╪») ┘à╪½┘ä ┘é╪¿┘ä ┌⌐╪º┘à┘ä ╪«┘ê╪º┘å╪»┘ç ┘à█îΓÇî╪┤┘ê╪» ╪¬╪º ┘å┌»╪º╪┤╪¬ ╪┤┘å╪º╪│┘çΓÇî┘ç╪º ╪»╪▒╪│╪¬ ╪¿┘à╪º┘å╪».
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
 * ╪º╪▒╪│╪º┘ä ╪¬╪»╪▒█î╪¼█î: ╪º┘ê┘ä ╪¬╪║█î█î╪▒╪º╪¬ ┘à╪¡┘ä█î ╪«┘ê╪º┘å╪»┘ç ┘à█îΓÇî╪┤┘ê╪»╪¢ ╪º┌»╪▒ ┌å█î╪▓█î ╪¿╪▒╪º█î ╪º╪▒╪│╪º┘ä ┘å╪¿╪º╪┤╪»
 * ┘ç█î┌å ╪»╪▒╪«┘ê╪º╪│╪¬█î ╪¿┘ç ╪│╪▒┘ê╪▒ ┘ü╪▒╪│╪¬╪º╪»┘ç ┘å┘à█îΓÇî╪┤┘ê╪». ╪»╪▒ ╪║█î╪▒ ╪º█î┘å ╪╡┘ê╪▒╪¬ ┘ü┘é╪╖ ┘ü┘ç╪▒╪│╪¬ ╪│╪¿┌⌐
 * ╪│╪▒┘ê╪▒ ╪¿╪▒╪▒╪│█î ┘ê ╪▒┌⌐┘ê╪▒╪»┘ç╪º█î ╪¬╪║█î█î╪▒┌⌐╪▒╪»┘ç ┘å┘ê╪┤╪¬┘ç ┘à█îΓÇî╪┤┘ê┘å╪».
 */
async function performUpload(options = {}) {
  const silent = !!options.silent;
  if (syncBusy) return { ok: false, skipped: true, reason: 'busy' };
  if (!isLoggedIn()) {
    if (!silent) {
      syncError = '╪¿╪▒╪º█î ┘ç┘à┌»╪º┘àΓÇî╪│╪º╪▓█î ╪º╪¿╪¬╪»╪º ┘ê╪º╪▒╪» ╪¡╪│╪º╪¿ ┌⌐╪º╪▒╪¿╪▒█î ╪┤┘ê█î╪».';
      renderSyncUI();
    }
    return { ok: false, error: 'auth' };
  }

  syncBusy = 'upload';
  syncError = null;
  if (!silent) syncNotice = null;
  resetRateLimitPacing();
  setProgress('upload', 0, '╪ó┘à╪º╪»┘çΓÇî╪│╪º╪▓█îΓÇª', true);
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
    const timerPayload = currentTimerPayload();
    const timerSignature = timerPayload ? JSON.stringify(timerPayload) : null;
    const timerChanged = !!timerPayload && (!meta || meta.timer !== timerSignature);

    /* ┘à╪│█î╪▒ ┌⌐┘àΓÇî┘ç╪▓█î┘å┘ç: ┘å┘ç ╪¬╪║█î█î╪▒ ┘à╪¡┘ä█î ┘ç╪│╪¬╪î ┘å┘ç ╪┤┘à╪º╪▒┘å╪»┘ç┘ö ╪¬╪│╪¬/╪¬╪º█î┘à╪▒ ╪╣┘ê╪╢ ╪┤╪»┘ç */
    if (!fullSync && !(pending && pending.length) && !trackerChanged && !timerChanged) {
      const now = Date.now();
      saveSyncMeta(server, ownerId, { ...meta, lastSyncAt: now });
      setLastSyncTimestamp(now);
      syncNotice = 'Γ£ô ╪¬╪║█î█î╪▒█î ╪¿╪▒╪º█î ╪º╪▒╪│╪º┘ä ┘å█î╪│╪¬';
      return { ok: true, changed: 0, noChanges: true };
    }

    const items = buildUploadRecords();
    const itemsByKey = new Map(items.map(item => [`${item.store}::${item.localId}`, item]));
    const collections = [...new Set(PB_UPLOAD_STORES.map(pbCollectionName))];
    const trackerItem = items.find(item => item.localId === POCKETBASE_TRACKER_ID);
    const timerItem = items.find(item => item.localId === POCKETBASE_TIMER_ID);

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
      if (timerChanged && timerItem) ops.push({ kind: 'put', item: timerItem });
    }

    if (!ops.length) {
      const now = Date.now();
      setLastSyncTimestamp(now);
      if (meta) saveSyncMeta(server, ownerId, { ...meta, lastSyncAt: now });
      syncNotice = 'Γ£ô ╪¬╪║█î█î╪▒█î ╪¿╪▒╪º█î ╪º╪▒╪│╪º┘ä ┘å█î╪│╪¬';
      return { ok: true, changed: 0, noChanges: true };
    }

    /* ┘ü╪º╪▓ █▒: ╪┤┘å╪º╪│┘ç┘ö ╪▒┌⌐┘ê╪▒╪»┘ç╪º█î ╪│╪▒┘ê╪▒
       ╪»╪▒ ╪¡╪º┘ä╪¬ ╪¬╪»╪▒█î╪¼█î ┘ü┘é╪╖ ╪▒┌⌐┘ê╪▒╪»┘ç╪º█î ╪¬╪║█î█î╪▒┌⌐╪▒╪»┘ç ┘╛╪▒╪│█î╪»┘ç ┘à█îΓÇî╪┤┘ê┘å╪»╪î ┘å┘ç ┘ü┘ç╪▒╪│╪¬ ┌⌐┘ä ┘à╪¼┘à┘ê╪╣┘ç */
    let remote = null;
    let remoteMaps;
    if (fullSync) {
      remote = new Map();
      for (let i = 0; i < collections.length; i++) {
        const collection = collections[i];
        setProgress('upload', 5 + (i / collections.length) * 30, `╪¿╪▒╪▒╪│█î ╪│╪▒┘ê╪▒ ΓÇö ${collection}`);
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
      setProgress('upload', 8, '╪«┘ê╪º┘å╪»┘å ╪┤┘å╪º╪│┘ç┘ö ╪▒┌⌐┘ê╪▒╪»┘ç╪º█î ╪¬╪║█î█î╪▒┌⌐╪▒╪»┘çΓÇª', true);
      remoteMaps = await resolveUploadRemoteMaps(pb, ops, ownerId, meta);
    }

    /* ╪»╪▒ ╪¡╪º┘ä╪¬ ╪¬╪»╪▒█î╪¼█î╪î ╪¡╪░┘ü ┘à╪¡┘ä█î ┘ü┘é╪╖ ┘ê┘é╪¬█î ╪▒┘ê█î ╪│╪▒┘ê╪▒ ╪º╪╣┘à╪º┘ä ┘à█îΓÇî╪┤┘ê╪» ┌⌐┘ç ╪▒┌⌐┘ê╪▒╪» ┘ê╪¼┘ê╪» ╪»╪º╪┤╪¬┘ç ╪¿╪º╪┤╪» */
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
      setProgress('upload', total ? 35 + (done / total) * 63 : 100, `${fa(done)} ╪º╪▓ ${fa(total)} ╪▒┌⌐┘ê╪▒╪»`);
    };
    setProgress('upload', 35, `${fa(0)} ╪º╪▓ ${fa(total)} ╪▒┌⌐┘ê╪▒╪»`, true);

    /* ┘ü╪º╪▓ █▓: ┘å┘ê╪┤╪¬┘å ┘ü┘é╪╖ ╪¬╪║█î█î╪▒╪º╪¬ */
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
      /* ┘ü┘é╪╖ ╪¬╪║█î█î╪▒╪º╪¬ ┘à┘ê┘ü┘é ╪¬╪ú█î█î╪» ┘à█îΓÇî╪┤┘ê┘å╪» ╪¬╪º ╪¬╪║█î█î╪▒╪º╪¬ ┘å╪º┘à┘ê┘ü┘é ╪»┘ê╪¿╪º╪▒┘ç ┘ü╪▒╪│╪¬╪º╪»┘ç ╪┤┘ê┘å╪» */
      const acked = fullSync ? [] : ops.filter(op => op.ok && op.change).map(op => op.change).concat(skipped);
      try { await acknowledgeChanges(acked); } catch (e) { console.warn('[PB] acknowledging changes failed:', e); }
      const drifted = errors.find(entry => entry.drift);
      /* ┘ü┘é╪╖ ╪«╪╖╪º█î ╪º╪¡╪▒╪º╪▓ ┘ç┘ê█î╪¬ ╪¿╪º█î╪» ┌⌐┘ä ┌å╪▒╪«┘ç ╪▒╪º ┘à╪¬┘ê┘é┘ü ┌⌐┘å╪»╪¢ ╪¿┘é█î┘ç┘ö ╪«╪╖╪º┘ç╪º
         ┘å╪¿╪º█î╪» ┘à╪º┘å╪╣ ╪»╪▒█î╪º┘ü╪¬ ╪¬╪║█î█î╪▒╪º╪¬ ╪»╪│╪¬┌»╪º┘çΓÇî┘ç╪º█î ╪»█î┌»╪▒ ╪┤┘ê┘å╪». */
      const authOnly = errors.every(entry => entry.status === 401);
      syncError = drifted
        ? `╪¬╪║█î█î╪▒ ┬½${drifted.collection}┬╗ ╪▒┘ê█î ╪│╪▒┘ê╪▒ ╪░╪«█î╪▒┘ç ┘å╪┤╪»╪¢ ╪»┘ê╪¿╪º╪▒┘ç ╪¬┘ä╪º╪┤ ┘à█îΓÇî╪┤┘ê╪».`
        : `╪º╪▒╪│╪º┘ä ╪¿╪º ${fa(errors.length)} ╪«╪╖╪º ╪º┘å╪¼╪º┘à ╪┤╪» ΓÇö ${errors[0].message}`;
      return { ok: false, partial: changedCount > 0, fatal: authOnly, changed: changedCount, error: syncError };
    }

    /* ┘ü╪▒╪º╪»╪º╪»┘ç┘ö ╪│█î┘å┌⌐: ╪»╪▒ ╪¡╪º┘ä╪¬ ╪¬╪»╪▒█î╪¼█î ┘ü┘é╪╖ ╪▒┌⌐┘ê╪▒╪»┘ç╪º█î ┘ç┘à█î┘å ╪º╪▒╪│╪º┘ä ╪▒┘ê█î ┘å╪│╪«┘ç┘ö ┘é╪¿┘ä█î ╪º╪╣┘à╪º┘ä ┘à█îΓÇî╪┤┘ê┘å╪».
       ╪▒┌⌐┘ê╪▒╪»┘ç╪º█î ┘ü┘é╪╖-╪│╪▒┘ê╪▒ ╪¿╪º ┘à┘é╪º█î╪│┘ç┘ö updated ╪»╪▒ ┬½╪»╪▒█î╪º┘ü╪¬┬╗ ╪¿╪╣╪»█î ┘╛█î╪»╪º ┘à█îΓÇî╪┤┘ê┘å╪». */
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
    /* ┘å┘ê╪┤╪¬┘å ╪¼╪▓╪ª█î (┘ü┘é╪╖ order █î╪º ┘à┘é╪»╪º╪▒ ╪º╪»╪║╪º┘àΓÇî╪┤╪»┘ç) ┘å╪│╪«┘ç┘ö ┘à╪¡┘ä█î ╪▒╪º ┌⌐╪º┘à┘ä ╪¿╪º ╪│╪▒┘ê╪▒
       ┘ç┘àΓÇî╪¬╪▒╪º╪▓ ┘å┘à█îΓÇî┌⌐┘å╪»╪¢ ┘╛╪│ ╪▓┘à╪º┘å ╪│╪▒┘ê╪▒ ╪¿┘çΓÇî╪╣┘å┘ê╪º┘å ┬½╪»█î╪»┘çΓÇî╪┤╪»┘ç┬╗ ╪½╪¿╪¬ ┘å┘à█îΓÇî╪┤┘ê╪» ╪¬╪º ╪»╪▒█î╪º┘ü╪¬
       ┘ç┘à╪º┘å ┌å╪▒╪«┘ç ┌⌐┘ä ┘à┘é╪»╪º╪▒ ╪¬╪º╪▓┘ç┘ö ╪│╪▒┘ê╪▒ ╪▒╪º ╪¿█î╪º┘ê╪▒╪» ┘ê ╪¬╪║█î█î╪▒█î ┌»┘à ┘å╪┤┘ê╪». */
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

    /* ╪»╪▒ ╪º┘ê┘ä█î┘å ╪º╪▒╪│╪º┘ä╪î ╪«╪╖ ╪▓┘à╪º┘å█î ╪│╪▒┘ê╪▒ ┘ç┘à ╪½╪¿╪¬ ┘à█îΓÇî╪┤┘ê╪» ╪¬╪º ╪»╪▒█î╪º┘ü╪¬ ╪¿╪╣╪»█î ┘ü┘é╪╖ ╪¬╪║█î█î╪▒╪º╪¬ ╪▒╪º ╪¿╪«┘ê╪º┘å╪».
       ╪»╪▒ ╪º╪▒╪│╪º┘äΓÇî┘ç╪º█î ╪¬╪»╪▒█î╪¼█î ╪«╪╖ ╪▓┘à╪º┘å█î ╪¼┘ä┘ê ┘å┘à█îΓÇî╪▒┘ê╪» ╪¬╪º ╪¬╪║█î█î╪▒ ╪»╪│╪¬┌»╪º┘çΓÇî┘ç╪º█î ╪»█î┌»╪▒ ╪º╪▓ ╪»╪│╪¬ ┘å╪▒┘ê╪». */
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
    /* ╪¬╪╣╪»╪º╪» ╪▒┌⌐┘ê╪▒╪»┘ç╪º█î ╪│╪▒┘ê╪▒ ╪¿╪º ┘å┘ê╪┤╪¬┘åΓÇî┘ç╪º█î ┘ç┘à█î┘å ╪º╪▒╪│╪º┘ä ┘ç┘àΓÇî╪¬╪▒╪º╪▓ ┘à█îΓÇî╪┤┘ê╪»
       ╪¬╪º ╪»╪▒█î╪º┘ü╪¬ ╪¿╪╣╪»█î ╪¿┘ç ╪¿╪º╪▓╪¿█î┘å█î ┌⌐╪º┘à┘ä ┘å█î╪º╪▓ ┘╛█î╪»╪º ┘å┌⌐┘å╪». */
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
      timer: timerSignature,
      lastSyncAt: now
    });
    setLastSyncTimestamp(now);
    try {
      await acknowledgeChanges(fullSync ? (pending || []) : ops.filter(op => op.ok && op.change).map(op => op.change).concat(skipped));
    } catch (e) {
      console.warn('[PB] acknowledging changes failed:', e);
    }
    syncNotice = changedCount
      ? `Γ£ô ${fa(changedCount)} ╪¬╪║█î█î╪▒ ╪▒┘ê█î ╪¡╪│╪º╪¿ ╪┤┘à╪º ╪░╪«█î╪▒┘ç ╪┤╪»`
      : 'Γ£ô ╪│╪▒┘ê╪▒ ╪º╪▓ ┘é╪¿┘ä ╪¿╪º ╪º█î┘å ╪»╪│╪¬┌»╪º┘ç ┘ç┘à┌»╪º┘à ╪¿┘ê╪»';
    return { ok: true, changed: changedCount };
  } catch (error) {
    console.error('[PB] upload failed:', error);
    syncError = '╪º╪▒╪│╪º┘ä ┘å╪º┘à┘ê┘ü┘é ╪¿┘ê╪» ΓÇö ' + pocketBaseErrorMessage(error);
    return { ok: false, error: syncError };
  } finally {
    syncBusy = null;
    resetProgress();
    renderSyncUI();
    refreshPendingBadge();
    if (!silent) {
      if (syncError) toast('Γ¥î ' + syncError);
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
    const canonical = pbCanonicalLocalId(store, item.localId);
    if (canonical === POCKETBASE_TRACKER_ID || canonical === POCKETBASE_TIMER_ID) return null;
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

/* ┘╛╪│ ╪º╪▓ ╪º╪╣┘à╪º┘ä ╪¬╪║█î█î╪▒╪º╪¬ ╪│╪▒┘ê╪▒╪î state ╪º╪▓ ╪¡╪º┘ü╪╕┘ç ╪»┘ê╪¿╪º╪▒┘ç ╪«┘ê╪º┘å╪»┘ç ┘ê ┘å┘à╪º┘ç╪º ╪¬╪º╪▓┘ç ┘à█îΓÇî╪┤┘ê┘å╪» */
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
      syncError = '╪¿╪▒╪º█î ┘ç┘à┌»╪º┘àΓÇî╪│╪º╪▓█î ╪º╪¿╪¬╪»╪º ┘ê╪º╪▒╪» ╪¡╪│╪º╪¿ ┌⌐╪º╪▒╪¿╪▒█î ╪┤┘ê█î╪».';
      renderSyncUI();
    }
    return { ok: false, error: 'auth' };
  }

  syncBusy = 'download';
  syncError = null;
  if (!silent) syncNotice = null;
  resetRateLimitPacing();
  setProgress('download', 0, '╪ó┘à╪º╪»┘çΓÇî╪│╪º╪▓█îΓÇª', true);
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
      /* ╪ó█î╪º ╪│╪▒┘ê╪▒ ╪¿╪▒╪º█î ┘ç╪▒ ┘à╪¼┘à┘ê╪╣┘ç ╪│╪¬┘ê┘å `updated` ╪»╪º╪▒╪»╪ƒ ╪º┌»╪▒ ┘å╪»╪º╪┤╪¬┘ç ╪¿╪º╪┤╪»╪î
         ┬½╪¬╪║█î█î╪▒ ╪º╪▓ ┘ü┘ä╪º┘å ╪▓┘à╪º┘å┬╗ ┘ê ┘à┘é╪º█î╪│┘ç┘ö ╪▓┘à╪º┘å ╪▒┌⌐┘ê╪▒╪»┘ç╪º ╪¿█îΓÇî┘à╪╣┘å╪º╪│╪¬ ┘ê ┘å╪¿╪º█î╪»
         ╪¿╪│╪¬┘ç┘ö ┌⌐╪º┘à┘ä ╪▒┌⌐┘ê╪▒╪»┘ç╪º ╪»┘ê╪¿╪º╪▒┘ç ╪«┘ê╪º┘å╪»┘ç ╪┤┘ê╪». ┘å╪¬█î╪¼┘ç ╪¿╪▒╪º█î ┌å╪▒╪«┘çΓÇî┘ç╪º█î ╪¿╪╣╪»
         ┘å┌»┘ç ╪»╪º╪┤╪¬┘ç ┘à█îΓÇî╪┤┘ê╪». */
      const previousStamps = (meta.stamps && typeof meta.stamps === 'object') ? meta.stamps : {};
      /* "┘ç╪▒ ╪│█î┘å┌⌐ = ╪¬╪▒┘à█î┘à ┌⌐╪º┘à┘ä": ┘å╪│╪«┘ç┘ç╪º█î ┘é╪¿┘ä█î ┘à█î╪¬┘ê╪º┘å╪│╪¬┘å╪» ╪▓┘à╪º┘å ╪¬╪║█î█î╪▒ ╪▒┌⌐┘ê╪▒╪»█î ╪▒╪º
         ┬½╪»█î╪»┘ç╪┤╪»┘ç┬╗ ╪½╪¿╪¬ ┌⌐┘å┘å╪» ╪¿╪»┘ê┘å ╪ó┘å┌⌐┘ç ┘à┘é╪»╪º╪▒╪┤ ╪▒┘ê█î ╪»╪│╪¬┌»╪º┘ç ╪º╪╣┘à╪º┘ä ╪┤┘ê╪»╪¢ ┘å╪¬█î╪¼┘ç
         ╪º█î┘å┌⌐┘ç ┘ç╪▒ ╪»┘ê ╪»╪│╪¬┌»╪º┘ç ╪«┘ê╪» ╪▒╪º ╪¿┘ç╪▒┘ê╪▓ ┘à█î╪»╪º┘å╪│╪¬┘å╪» ┘ê┘ä█î ┘à┘é╪»╪º╪▒┘ç╪º ┘ü╪▒┘é ╪»╪º╪┤╪¬.
         ╪º╪▓ ╪º█î┘å ┘╛╪│ ╪▓┘à╪º┘å█î ┌⌐┘ç ┘à┘é╪»╪º╪▒ ┘ç╪▒ ╪▒┌⌐┘ê╪▒╪» ╪ó╪«╪▒█î┘å ╪¿╪º╪▒ ┘ê╪º┘é╪╣╪º┘ï ╪¿╪º ╪│╪▒┘ê╪▒ ┘à┘é╪º█î╪│┘ç
         ╪┤╪»┘ç (`checked`) ┘å┌»┘ç╪»╪º╪▒█î ┘à█î╪┤┘ê╪». ╪»╪▒ ┘ç╪▒ ┌å╪▒╪«┘ç╪î ╪▒┌⌐┘ê╪▒╪»┘ç╪º█î█î ┌⌐┘ç ╪▓┘à╪º┘å╪┤╪º┘å ╪¿╪º
         ╪▓┘à╪º┘å ╪¿╪▒╪▒╪│█î╪┤╪»┘ç ┘ü╪▒┘é ╪»╪º╪▒╪» ╪»┘ê╪¿╪º╪▒┘ç ╪«┘ê╪º┘å╪»┘ç ┘ê ┘à┘é╪º█î╪│┘ç ┘à█î╪┤┘ê┘å╪» ΓÇö ┘ç┘à╪º┘å ╪º╪╖┘à█î┘å╪º┘å
         ╪»┌⌐┘à┘ç ╪¬╪▒┘à█î┘à╪î ╪¿╪»┘ê┘å ╪º┘å╪¬┘é╪º┘ä ┘à╪¼╪»╪» ╪▒┌⌐┘ê╪▒╪»┘ç╪º█î ╪¬╪║█î█î┘å┌⌐╪▒╪»┘ç. */
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
      /* ╪¡╪░┘ü ╪▒┌⌐┘ê╪▒╪» ╪»╪▒ ┘ü█î┘ä╪¬╪▒ `updated` ╪»█î╪»┘ç ┘å┘à█îΓÇî╪┤┘ê╪». ╪¿┘çΓÇî╪¼╪º█î ╪¿╪º╪▓╪«┘ê╪º┘å█î ╪»┘ê╪▒┘çΓÇî╪º█î ┌⌐┘ä
         ┘ü┘ç╪▒╪│╪¬ΓÇî┘ç╪º╪î ┬½╪¡╪│╪º╪¿ ╪¬╪╣╪»╪º╪»┬╗ ╪º┘å╪¼╪º┘à ┘à█îΓÇî╪┤┘ê╪»: ╪¬╪╣╪»╪º╪» ╪▒┌⌐┘ê╪▒╪»┘ç╪º█î ╪│╪▒┘ê╪▒ ╪¿╪º█î╪» ╪¿╪▒╪º╪¿╪▒
         ╪¬╪╣╪»╪º╪» ╪┤┘å╪º╪«╪¬┘çΓÇî╪┤╪»┘ç ╪¿┘çΓÇî╪╣┘ä╪º┘ê┘ç┘ö ╪▒┌⌐┘ê╪▒╪»┘ç╪º█î ╪¬╪º╪▓┘ç ╪¿╪º╪┤╪». ┘ü┘é╪╖ ╪º┌»╪▒ ╪º█î┘å ┘à╪╣╪º╪»┘ä┘ç
         ╪¿╪▒┘é╪▒╪º╪▒ ┘å╪¿╪º╪┤╪» (╪¡╪░┘ü █î╪º ╪¡╪░┘ü+╪º┘ü╪▓┘ê╪»┘å) ┘ü┘ç╪▒╪│╪¬ ┘ç┘à╪º┘å ┘à╪¼┘à┘ê╪╣┘ç ╪«┘ê╪º┘å╪»┘ç ┘à█îΓÇî╪┤┘ê╪».
         ╪¿╪º╪▓╪¿█î┘å█î ┌⌐╪º┘à┘ä ┘ü┘é╪╖ █î┌⌐ ╪¿╪º╪▒ ╪»╪▒ ╪┤╪¿╪º┘å┘çΓÇî╪▒┘ê╪▓ █î╪º ╪¿╪º ┬½╪»╪▒█î╪º┘ü╪¬ ┌⌐╪º┘à┘ä┬╗ ╪º┘å╪¼╪º┘à ┘à█îΓÇî╪┤┘ê╪». */
      const deepCheck = fullRefresh ||
        meta.integrity !== PB_SYNC_INTEGRITY_VERSION ||
        !meta.countsAt ||
        (now - meta.countsAt > PB_DELETE_CHECK_GAP);

      /* ╪¡╪░┘üΓÇî┘ç╪º ┘ê ┘ê█î╪▒╪º█î╪┤ΓÇî┘ç╪º█î ┘à╪¡┘ä█î ╪»╪▒ ╪º┘å╪¬╪╕╪º╪▒ ╪º╪▒╪│╪º┘ä ┘å╪¿╪º█î╪» ╪¿╪º ┘å╪│╪«┘ç┘ö ╪│╪▒┘ê╪▒ ╪¿╪º╪▓┘å┘ê█î╪│█î ╪┤┘ê┘å╪».
         ╪º█î┘å ┘ü┘ç╪▒╪│╪¬ ╪»╪▒ ┘ç┘à┘ç┘ö ┘à╪│█î╪▒┘ç╪º ╪«┘ê╪º┘å╪»┘ç ┘à█îΓÇî╪┤┘ê╪» (┘å┘ç ┘ü┘é╪╖ ╪¿╪º╪▓╪¿█î┘å█î ┌⌐╪º┘à┘ä) ╪¬╪º ╪»╪▒█î╪º┘ü╪¬
         ╪¬╪»╪▒█î╪¼█î ┘ç┘à ┘ê█î╪▒╪º█î╪┤ ╪¬╪º╪▓┘ç┘ö ┌⌐╪º╪▒╪¿╪▒ ╪▒╪º ╪º╪▓ ╪¿█î┘å ┘å╪¿╪▒╪». */
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
      /* ╪¬╪║█î█î╪▒┘ç╪º█î ┘à╪¡┘ä█î ┌⌐┘ç ╪¿┘çΓÇî╪«╪º╪╖╪▒ ╪»╪▒ ╪º┘å╪¬╪╕╪º╪▒ ╪¿┘ê╪»┘å ╪º╪╣┘à╪º┘ä ┘å╪┤╪»┘å╪»╪¢ ┘╛╪│ ╪º╪▓ ╪»╪▒█î╪º┘ü╪¬ ╪º╪▒╪│╪º┘ä ┘à█îΓÇî╪┤┘ê┘å╪» */
      let pendingSkipped = 0;

      /* ┘ü╪º╪▓ █▒: ╪«┘ê╪º┘å╪»┘å ┘ü┘é╪╖ ╪»╪º╪»┘çΓÇî┘ç╪º█î ╪¬╪º╪▓┘ç╪î ┘å┘ç ┌⌐┘ä ┘à╪¼┘à┘ê╪╣┘ç */
      const fetchedByStore = new Map();
      for (let i = 0; i < syncStores.length; i++) {
        const entry = syncStores[i];
        const knownMap = previousRemote[entry.collection] || {};
        const knownCount = typeof previousCounts[entry.collection] === 'number'
          ? previousCounts[entry.collection]
          : Object.keys(knownMap).length;
        /* app-meta ┌⌐┘ê┌å┌⌐ ╪º╪│╪¬ (╪¬┘å╪╕█î┘à╪º╪¬ ┘ê ╪┤┘à╪º╪▒┘å╪»┘ç) ┘ê ┘ç┘à█î╪┤┘ç ┌⌐╪º┘à┘ä ╪«┘ê╪º┘å╪»┘ç ┘à█îΓÇî╪┤┘ê╪».
           ┘à╪¼┘à┘ê╪╣┘çΓÇî┘ç╪º█î ╪»█î┌»╪▒ ┘ü┘é╪╖ ╪¿╪º ┬½╪¡╪│╪º╪¿ ╪¬╪╣╪»╪º╪»┬╗ ┘ê ┬½╪¬╪║█î█î╪▒┘ç╪º█î ╪▓┘à╪º┘å█î┬╗ ╪¿╪▒╪▒╪│█î
           ┘à█îΓÇî╪┤┘ê┘å╪»╪¢ ╪¿╪º╪▓╪¿█î┘å█î ┌⌐╪º┘à┘ä ┘ü┘ç╪▒╪│╪¬ ┘ü┘é╪╖ ╪»╪▒ ╪¬╪▒┘à█î┘à ╪»╪│╪¬█î/╪¿╪▒╪▒╪│█î ╪▒┘ê╪▓╪º┘å┘ç. */
        let needManifest = deepCheck || entry.store === 'app-meta';
        let serverCount = null;
        let records = [];
        let stampsSupported = previousStamps[entry.collection];
        /* ┘ü╪▒╪º╪»╪º╪»┘ç┘ö ┘å╪│╪«┘çΓÇî┘ç╪º█î ┘é╪¿┘ä█î ╪│╪¬┘ê┘å stamps ┘å╪»╪º╪▒╪»╪¢ ╪º┌»╪▒ ┘ç█î┌å ╪▓┘à╪º┘å█î ╪¿╪▒╪º█î ╪º█î┘å
           ┘à╪¼┘à┘ê╪╣┘ç ╪½╪¿╪¬ ┘å╪┤╪»┘ç ╪¿╪º╪┤╪»╪î █î╪╣┘å█î ╪│╪▒┘ê╪▒ ╪│╪¬┘ê┘å updated ┘å╪»╪º╪▒╪». */
        if (stampsSupported === undefined && !previousFloor[entry.collection] && knownCount > 0) {
          stampsSupported = false;
        }

        if (needManifest) {
          setProgress('download', 5 + (i / syncStores.length) * 40, `╪¿╪º╪▓╪¿█î┘å█î ┘ü┘ç╪▒╪│╪¬ ΓÇö ${entry.collection}`);
          records = await fetchOwnerManifest(pb, entry.collection, ownerId);
          serverCount = records.length;
        } else {
          setProgress('download', 5 + (i / syncStores.length) * 40, `╪¿╪▒╪▒╪│█î ╪│╪▒┘ê╪▒ ΓÇö ${entry.collection}`, true);
          serverCount = await fetchOwnerCount(pb, entry.collection, ownerId);

          if (serverCount > 0) {
            if (stampsSupported === false) {
              /* ╪│╪▒┘ê╪▒ ╪│╪¬┘ê┘å updated ┘å╪»╪º╪▒╪»: ┌å█î╪▓█î ╪¿╪▒╪º█î ┬½╪¬╪║█î█î╪▒ ╪º╪▓ ┘ü┘ä╪º┘å ╪▓┘à╪º┘å┬╗ ┘å█î╪│╪¬.
                 ┘ü┘é╪╖ ╪º╪«╪¬┘ä╪º┘ü ╪¬╪╣╪»╪º╪»╪î ┘ü┘ç╪▒╪│╪¬ ┘ç┘à╪º┘å ┘à╪¼┘à┘ê╪╣┘ç ╪▒╪º ┘à█îΓÇî╪«┘ê╪º┘å╪». */
              records = [];
            } else {
              setProgress('download', 5 + (i / syncStores.length) * 40, `╪»╪▒█î╪º┘ü╪¬ ╪¬╪║█î█î╪▒╪º╪¬ ΓÇö ${entry.collection}`);
              try {
                records = await fetchChangedSince(pb, entry.collection, ownerId, previousFloor[entry.collection]);
              } catch (error) {
                /* ╪│╪▒┘ê╪▒┘ç╪º█î█î ┌⌐┘ç ╪│╪¬┘ê┘å updated ┘å╪»╪º╪▒┘å╪» ╪º█î┘å ┘╛╪▒╪│╪┤ ╪▒╪º ╪¿╪º 400 ╪▒╪» ┘à█îΓÇî┌⌐┘å┘å╪». */
                records = [];
                stampsSupported = false;
              }
            }
            /* ╪▒┌⌐┘ê╪▒╪»┘ç╪º█î█î ┌⌐┘ç ┘╛█î╪┤ΓÇî╪¬╪▒ ╪▒┘ê█î ╪│╪▒┘ê╪▒ ┘å╪¿┘ê╪»┘çΓÇî╪º┘å╪»╪¢ ╪¿┘é█î┘ç ┘ü┘é╪╖ ┘ê█î╪▒╪º█î╪┤ΓÇî╪º┘å╪» */
            const seen = new Set();
            let added = 0;
            records.forEach(item => {
              const canonical = pbCanonicalLocalId(entry.store, item.localId);
              if (!canonical || seen.has(canonical)) return;
              seen.add(canonical);
              if (knownMap[canonical] === undefined) added++;
            });
            if (knownCount + added !== serverCount) {
              /* ╪┤╪º█î╪» ╪┤┘à╪º╪▒╪┤ ┘ê ╪»╪▒█î╪º┘ü╪¬ ┘ç┘àΓÇî╪▓┘à╪º┘å ╪¿╪º ╪¬╪║█î█î╪▒ ╪»█î┌»╪▒█î ╪¿┘ê╪»┘ç ╪¿╪º╪┤┘å╪» */
              const recheck = await fetchOwnerCount(pb, entry.collection, ownerId);
              if (recheck !== serverCount) serverCount = recheck;
              if (knownCount + added !== serverCount) {
                setProgress('download', 5 + (i / syncStores.length) * 40, `╪¿╪º╪▓╪¿█î┘å█î ┘ü┘ç╪▒╪│╪¬ ΓÇö ${entry.collection}`);
                records = await fetchOwnerManifest(pb, entry.collection, ownerId);
                serverCount = records.length;
                needManifest = true;
              }
            }
          } else if (knownCount > 0) {
            /* ┘à╪¼┘à┘ê╪╣┘ç ╪▒┘ê█î ╪│╪▒┘ê╪▒ ╪«╪º┘ä█î ╪┤╪»┘ç ╪º╪│╪¬╪¢ ┘ü┘ç╪▒╪│╪¬ ╪«╪º┘ä█î╪î ╪¡╪░┘üΓÇî┘ç╪º ╪▒╪º ╪º╪╣┘à╪º┘ä ┘à█îΓÇî┌⌐┘å╪» */
            setProgress('download', 5 + (i / syncStores.length) * 40, `╪¿╪º╪▓╪¿█î┘å█î ┘ü┘ç╪▒╪│╪¬ ΓÇö ${entry.collection}`);
            records = await fetchOwnerManifest(pb, entry.collection, ownerId);
            serverCount = records.length;
            needManifest = true;
          }
        }

        /* ╪¿╪º ┘ü┘ç╪▒╪│╪¬ ╪¬╪º╪▓┘ç ┘à█îΓÇî┘ü┘ç┘à█î┘à ╪│╪▒┘ê╪▒ ╪│╪¬┘ê┘å updated ╪»╪º╪▒╪» █î╪º ┘å┘ç. */
        if (records.length) {
          stampsSupported = records.some(item =>
            !!item && Object.prototype.hasOwnProperty.call(item, 'updated'));
        }
        fetchedByStore.set(entry.store, { records, full: needManifest, count: serverCount, stamps: stampsSupported });
      }

      const serverTotal = syncStores.reduce((sum, entry) =>
        sum + ((fetchedByStore.get(entry.store) || {}).count || 0), 0);
      if (!serverTotal) {
        throw new Error('╪»╪º╪»┘çΓÇî┘ç╪º█î ╪¡╪│╪º╪¿ ╪▒┘ê█î ╪│╪▒┘ê╪▒ ┘╛█î╪»╪º ┘å╪┤╪»╪¢ ╪╣┘à┘ä█î╪º╪¬ ╪¿╪▒╪º█î ╪¼┘ä┘ê┌»█î╪▒█î ╪º╪▓ ╪¡╪░┘ü ╪»╪º╪»┘ç ┘à╪¬┘ê┘é┘ü ╪┤╪».');
      }
      const appMetaFetched = fetchedByStore.get('app-meta') || { records: [] };
      const hasMainRecord = (appMetaFetched.records || []).some(record =>
        pbCanonicalLocalId('app-meta', record.localId) === DB_STATE_ID
      );
      if (!hasMainRecord) {
        throw new Error('╪»╪º╪»┘çΓÇî┘ç╪º█î ╪│╪▒┘ê╪▒ ┌⌐╪º┘à┘ä ┘å█î╪│╪¬ (╪▒┌⌐┘ê╪▒╪» ╪¬┘å╪╕█î┘à╪º╪¬ ┘╛█î╪»╪º ┘å╪┤╪»)╪¢ ╪╣┘à┘ä█î╪º╪¬ ╪¿╪▒╪º█î ╪¼┘ä┘ê┌»█î╪▒█î ╪º╪▓ ╪¡╪░┘ü ╪»╪º╪»┘ç ┘à╪¬┘ê┘é┘ü ╪┤╪».');
      }

      /* ┘ü╪º╪▓ █▓: ╪¬╪╣█î█î┘å ╪▒┌⌐┘ê╪▒╪»┘ç╪º█î ╪¬╪º╪▓┘ç ┘ê ╪¡╪░┘üΓÇî╪┤╪»┘çΓÇî┘ç╪º.
         ┘ü┘ç╪▒╪│╪¬ ╪│╪¿┌⌐ (`full`) ┘à┘é╪»╪º╪▒ ╪▒┌⌐┘ê╪▒╪» ╪▒╪º ┘å╪»╪º╪▒╪»╪¢ ╪¿┘å╪º╪¿╪▒╪º█î┘å ┘à┘é╪»╪º╪▒ ┘ç┘à╪º┘å ┌å┘å╪»
         ╪▒┌⌐┘ê╪▒╪» ╪¬╪║█î█î╪▒┌⌐╪▒╪»┘ç ╪¿╪º █î┌⌐ ╪»╪▒╪«┘ê╪º╪│╪¬ ┘ç╪»┘ü┘à┘å╪» ╪«┘ê╪º┘å╪»┘ç ┘à█îΓÇî╪┤┘ê╪». */
      const localSnapshot = normalizedStorageSnapshot(compactStateForStorage(state));
      const puts = [];
      const deletes = [];
      const acknowledge = [];
      const nextRemote = { ...previousRemote };
      const floor = { ...previousFloor };
      const counts = { ...previousCounts };
      const nextStamps = { ...previousStamps };
      let remoteTracker = null;
      let remoteTimer = null;
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
        /* ╪▒┌⌐┘ê╪▒╪»┘ç╪º█î█î ┌⌐┘ç ╪¿┘çΓÇî╪«╪º╪╖╪▒ ╪¬╪║█î█î╪▒ ┘à╪¡┘ä█î ╪»╪▒ ╪º┘å╪¬╪╕╪º╪▒ ╪º╪▒╪│╪º┘ä ╪º╪╣┘à╪º┘ä ┘å╪┤╪»┘å╪».
           ╪▓┘à╪º┘å ╪ó┘åΓÇî┘ç╪º ╪»╪▒ ┘ü╪▒╪º╪»╪º╪»┘ç ╪½╪¿╪¬ ┘å┘à█îΓÇî╪┤┘ê╪» ╪¬╪º ┘ê█î╪▒╪º█î╪┤ ╪»╪│╪¬┌»╪º┘ç ╪»█î┌»╪▒ ╪¿╪▒╪º█î ┘ç┘à█î╪┤┘ç
           ┘╛┘å┘ç╪º┘å ┘å┘à╪º┘å╪» ┘ê ┌⌐╪º┘ê╪┤ ╪¿╪╣╪»█î ╪»┘ê╪¿╪º╪▒┘ç ╪ó┘å ╪▒╪º ┘╛█î╪»╪º ┌⌐┘å╪». */
        const skippedCanonical = new Set();
        /* ╪▒┌⌐┘ê╪▒╪»┘ç╪º█î█î ┌⌐┘ç ╪»╪▒ ┘ç┘à█î┘å ┌å╪▒╪«┘ç ┘à┘é╪»╪º╪▒╪┤╪º┘å ┘å┘ê╪┤╪¬┘ç ╪┤╪» (█î╪º ╪»╪▒ ╪¡╪º┘ä ┘å┘ê╪┤╪¬┘å ╪º╪│╪¬) */
        const handledCanonical = new Set();

        (info.records || []).forEach(item => {
          const canonical = pbCanonicalLocalId(entry.store, item.localId);
          if (!canonical) return;
          const updated = pbManifestTimestamp(item);
          seen.add(canonical);

          if (info.full) {
            /* ╪¬╪║█î█î╪▒ ┘à╪¡┘ä█î ╪»╪▒ ╪º┘å╪¬╪╕╪º╪▒ ╪º╪▒╪│╪º┘ä ╪¿╪▒┘å╪»┘ç ╪º╪│╪¬╪¢ ┘à┘é╪»╪º╪▒ ╪│╪▒┘ê╪▒ ╪º╪╣┘à╪º┘ä ┘å┘à█îΓÇî╪┤┘ê╪» */
            const pending = hasPendingChange(entry.store, canonical, item.localId);
            if (pending.any) { pendingSkipped++; skippedCanonical.add(canonical); return; }
            nextMap[canonical] = updated;
            const unchanged = prevMap[canonical] === updated;
            let needsValue = !unchanged;
            /* app-meta ┘ü┘é╪╖ ┌å┘å╪» ╪▒┌⌐┘ê╪▒╪» ┌⌐┘ê┌å┌⌐ (┘╛╪▒┘ê┘ü╪º█î┘ä/╪¬┘å╪╕█î┘à╪º╪¬/╪┤┘à╪º╪▒┘å╪»┘ç) ╪»╪º╪▒╪»╪¢
               ╪¿╪»┘ê┘å ╪│╪¬┘ê┘å updated ┘ç┘à█î╪┤┘ç ╪¿╪º ┘à┘é╪»╪º╪▒ ┌⌐╪º┘à┘ä ┘ç┘àΓÇî╪¬╪▒╪º╪▓ ┘à█îΓÇî╪┤┘ê╪». */
            if (!needsValue && (deepCheck || entry.store === 'app-meta')) {
              if (entry.store === 'app-meta') {
                needsValue = true;
              } else {
                const storeSnapshot = localSnapshot.get(entry.store);
                const rawLocal = storeSnapshot && storeSnapshot.get(canonical);
                /* ╪▒┌⌐┘ê╪▒╪» ╪▒┘ê█î ╪º█î┘å ╪»╪│╪¬┌»╪º┘ç ┘ç╪│╪¬ ┘ê┘ä█î ╪¿╪»┘ê┘å ┘à┘é╪»╪º╪▒ ╪░╪«█î╪▒┘ç ╪┤╪»┘ç (╪«╪▒╪º╪¿█î ┘å╪│╪«┘ç┘ö ┘é╪»█î┘à█î)╪î
                   █î╪º ╪º╪╡┘ä╪º┘ï ╪▒┘ê█î ╪º█î┘å ╪»╪│╪¬┌»╪º┘ç ┘å█î╪│╪¬╪¢ ┘ç╪▒ ╪»┘ê ╪¿╪º█î╪» ╪º╪▓ ╪│╪▒┘ê╪▒ ╪¿╪º╪▓╪«┘ê╪º┘å█î ╪┤┘ê┘å╪». */
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

          if (prevMap[canonical] === updated) return; /* ╪¿╪º╪▓╪¬╪º╪¿ ╪¬╪║█î█î╪▒ ┘ç┘à█î┘å ╪»╪│╪¬┌»╪º┘ç */
          if (hasPendingChange(entry.store, canonical, item.localId).any) {
            /* ┘ê█î╪▒╪º█î╪┤/╪¡╪░┘ü ╪¬╪º╪▓┘ç┘ö ┘ç┘à█î┘å ╪»╪│╪¬┌»╪º┘ç ┘ç┘å┘ê╪▓ ╪º╪▒╪│╪º┘ä ┘å╪┤╪»┘ç ╪º╪│╪¬ */
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
          if (entry.store === 'app-meta' && canonical === POCKETBASE_TIMER_ID) {
            remoteTimer = item.value;
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
            /* ╪º┌»╪▒ ╪¿╪▒╪º█î ╪º█î┘å ╪▒┌⌐┘ê╪▒╪» ╪¬╪║█î█î╪▒█î ╪»╪▒ ╪º┘å╪¬╪╕╪º╪▒ ╪º╪▒╪│╪º┘ä ╪º╪│╪¬╪î ╪¡╪░┘ü ╪│╪▒┘ê╪▒ ╪º╪╣┘à╪º┘ä
               ┘å┘à█îΓÇî╪┤┘ê╪» ╪¬╪º ┘ê█î╪▒╪º█î╪┤ ╪¬╪º╪▓┘ç┘ö ╪»╪│╪¬┌»╪º┘ç ╪»█î┌»╪▒ █î╪º ╪¡╪░┘ü ╪»╪▒ ╪º┘å╪¬╪╕╪º╪▒ ╪º╪▓ ╪¿█î┘å ┘å╪▒┘ê╪». */
            if (hasPendingChange(entry.store, localId, localId).any) { pendingSkipped++; return; }
            deletes.push({ store: entry.store, id: localId });
            acknowledge.push({ store: entry.store, id: localId });
            applied++;
          });
        }

        if (missingValues.length) {
          setProgress('download', 55, `╪»╪▒█î╪º┘ü╪¬ ${fa(missingValues.length)} ╪▒┌⌐┘ê╪▒╪» ╪¬╪║█î█î╪▒┌⌐╪▒╪»┘ç ΓÇö ${entry.collection}`, true);
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
              if (canonical === POCKETBASE_TIMER_ID) {
                checkedMap[canonical] = itemUpdated;
                if (pbSameJsonValue(item.value, currentTimerPayload())) return;
                remoteTimer = item.value;
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
        /* ┘ü╪▒╪º╪»╪º╪»┘ç ┘ü┘é╪╖ ╪▓┘à╪º┘å█î ┬½╪»█î╪»┘çΓÇî╪┤╪»┘ç┬╗ ╪▒╪º ╪¼┘ä┘ê ┘à█îΓÇî╪¿╪▒╪» ┌⌐┘ç ┘à┘é╪»╪º╪▒ ┘ê╪º┘é╪╣╪º┘ï ╪º╪╣┘à╪º┘ä ╪┤╪»┘ç
           ╪¿╪º╪┤╪»╪¢ ┘ê┌»╪▒┘å┘ç ┘ç┘à╪º┘å ╪▒┌⌐┘ê╪▒╪» ╪¿╪▒╪º█î ┘ç┘à█î╪┤┘ç ┘╛┘å┘ç╪º┘å ┘à█îΓÇî┘à╪º┘å╪». */
        if (missingCanonical.size) {
          missingCanonical.forEach(canonical => {
            if (!handledCanonical.has(canonical)) delete nextMap[canonical];
          });
        }
        /* ┘ç╪▒ ╪│█î┘å┌⌐ = ╪¬╪▒┘à█î┘à: ╪▒┌⌐┘ê╪▒╪»┘ç╪º█î ╪┤┘å╪º╪«╪¬┘ç╪┤╪»┘ç╪º█î ┌⌐┘ç ╪▓┘à╪º┘å╪┤╪º┘å ╪¿╪º ╪ó╪«╪▒█î┘å ╪¿╪▒╪▒╪│█î
           ┘ê╪º┘é╪╣█î ┘ü╪▒┘é ╪»╪º╪▒╪» ╪»┘ê╪¿╪º╪▒┘ç ╪«┘ê╪º┘å╪»┘ç ┘ê ╪¿╪º ┘à┘é╪»╪º╪▒ ┘à╪¡┘ä█î ┘à┘é╪º█î╪│┘ç ┘à█î╪┤┘ê┘å╪». */
        if (entry.store !== 'app-meta') {
          const storeSnapshot = localSnapshot.get(entry.store);
          const knownIds = Object.keys(prevMap).sort();
          const targetIds = knownIds.filter(canonical => {
            if (handledCanonical.has(canonical) || skippedCanonical.has(canonical)) return false;
            if (explicitVerify || integrityOutdated) return true;
            const stamp = prevMap[canonical];
            /* ╪¿╪»┘ê┘å ╪│╪¬┘ê┘å updated╪î ┬½╪▓┘à╪º┘å ╪¬╪║█î█î╪▒┬╗ ┘å╪º┘à╪╣┘ä┘ê┘à ╪º╪│╪¬. ┘à┘é╪º█î╪│┘ç┘ö ┘à┘é╪»╪º╪▒ ┘ç┘à┘ç┘ö
               ╪▒┌⌐┘ê╪▒╪»┘ç╪º ╪»╪▒ ┘ç╪▒ ╪│█î┘å┌⌐ ╪«┘ê╪»┌⌐╪º╪▒ ┘ç┘à╪º┘å ╪»╪▒█î╪º┘ü╪¬ ┌⌐╪º┘à┘ä┘É ┌⌐┘å╪» ╪º╪│╪¬╪¢ ╪¬╪║█î█î╪▒┘ç╪º ╪º╪▓
               ╪▒╪º┘ç ╪▒┘ê█î╪»╪º╪» ╪▓┘å╪»┘ç/╪┤┘à╪º╪▒╪┤ ┌»╪▒┘ü╪¬┘ç ┘à█îΓÇî╪┤┘ê┘å╪» ┘ê ╪¬╪▒┘à█î┘à ┌⌐╪º┘à┘ä ╪¿╪º ╪│█î┘å┌⌐ ╪»╪│╪¬█î. */
            if (!stamp) return false;
            return checkedMap[canonical] !== stamp;
          });
          if (targetIds.length) {
            setProgress('download', 62, `╪¿╪▒╪▒╪│█î ${fa(targetIds.length)} ╪▒┌⌐┘ê╪▒╪» ΓÇö ${entry.collection}`, true);
            const detailed = await fetchRemoteValuesByLocalIds(pb, entry.collection, ownerId, targetIds);
            const byCanonical = new Map();
            detailed.forEach(item => {
              const canonical = pbCanonicalLocalId(entry.store, item.localId);
              if (canonical) byCanonical.set(canonical, item);
            });
            targetIds.forEach(canonical => {
              const item = byCanonical.get(canonical);
              /* ┘å╪¿┘ê╪» ╪▒┌⌐┘ê╪▒╪» ╪▒┘ê█î ╪│╪▒┘ê╪▒ ╪▒╪º ╪¿╪º╪▓╪¿█î┘å█î ┘ü┘ç╪▒╪│╪¬ ╪¬╪┤╪«█î╪╡ ┘à█î╪»┘ç╪» */
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

        /* ╪▒┌⌐┘ê╪▒╪»┘ç╪º█î ┌⌐┘å╪º╪▒┌»╪░╪º╪┤╪¬┘çΓÇî╪┤╪»┘ç ┬½╪¬╪º╪▓┘çΓÇî╪¬╪▒█î┘å ╪▓┘à╪º┘å ╪┤┘å╪º╪«╪¬┘çΓÇî╪┤╪»┘ç┬╗ ╪▒╪º ╪¿╪º┘ä╪º ┘å┘à█îΓÇî╪¿╪▒┘å╪»╪¢
           ┘ê┌»╪▒┘å┘ç ┌⌐╪º┘ê╪┤ ╪¿╪╣╪»█î ┘ü┌⌐╪▒ ┘à█îΓÇî┌⌐┘å╪» ┘ç┘à┘çΓÇî┌å█î╪▓ ╪»█î╪»┘ç ╪┤╪»┘ç ┘ê ╪ó┘å ╪¬╪║█î█î╪▒ ┌»┘à ┘à█îΓÇî╪┤┘ê╪». */
        const observedRecords = skippedCanonical.size
          ? (info.records || []).filter(item => {
              const canonical = pbCanonicalLocalId(entry.store, item.localId);
              return !canonical || !skippedCanonical.has(canonical);
            })
          : (info.records || []);
        const observedMax = maxUpdatedTimestamp(observedRecords);
        if (observedMax && observedMax > (floor[entry.collection] || '')) floor[entry.collection] = observedMax;
        if (typeof info.count === 'number') counts[entry.collection] = info.count;
        if (typeof info.stamps === 'boolean') nextStamps[entry.collection] = info.stamps;
        nextRemote[entry.collection] = nextMap;
      }

      /* ╪¬╪║█î█î╪▒┘ç╪º█î ┘à╪¡┘ä█îΓÇî╪º█î ┌⌐┘ç ┌⌐┘å╪º╪▒ ┌»╪░╪º╪┤╪¬┘ç ╪┤╪»┘å╪» ╪¿╪º█î╪» ┘ç╪▒┌å┘ç ╪▓┘ê╪»╪¬╪▒ ╪º╪▒╪│╪º┘ä ╪┤┘ê┘å╪» */
      if (pendingSkipped) scheduleAutoUpload(600);
      /* ┘╛█î┘à╪º█î╪┤ ┌å╪▒╪«┘ç╪º█î ┘é╪»█î┘à█î ╪¼╪º█î ╪«┘ê╪» ╪▒╪º ╪¿┘ç ╪¿╪▒╪▒╪│█î ┌⌐╪º┘à┘ä ┘ç╪▒ ┌å╪▒╪«┘ç ╪»╪º╪» */

      if (!applied && !trackerChangedRemotely && !remoteTimer) {
        saveSyncMeta(server, ownerId, {
          ...meta,
          remote: nextRemote,
          floor,
          counts,
          countsAt: now,
          integrity: PB_SYNC_INTEGRITY_VERSION,
          verify: verifyState || meta.verify || null,
          stamps: nextStamps,
          checked: nextChecked,
          lastSyncAt: now
        });
        setLastSyncTimestamp(now);
        syncNotice = 'Γ£ô ╪»╪º╪»┘çΓÇî┘ç╪º ╪º╪▓ ┘é╪¿┘ä ╪¿┘çΓÇî╪▒┘ê╪▓ ╪º╪│╪¬';
        return { ok: true, changed: 0, noChanges: true };
      }

      /* ┘ü╪º╪▓ █│: ┘å┘ê╪┤╪¬┘å ╪¬╪║█î█î╪▒╪º╪¬ ╪▒┘ê█î ╪»╪│╪¬┌»╪º┘ç */
      setProgress('download', 85, '╪░╪«█î╪▒┘çΓÇî╪│╪º╪▓█î ╪¬╪║█î█î╪▒╪º╪¬ ╪▒┘ê█î ╪º█î┘å ╪»╪│╪¬┌»╪º┘çΓÇª', true);
      /* ┘å┘ê╪┤╪¬┘åΓÇî┘ç╪º█î ┘ç┘à█î┘å ╪»╪▒█î╪º┘ü╪¬ ┘å╪¿╪º█î╪» ┌å╪▒╪«┘ç┘ö ╪º╪▒╪│╪º┘ä ╪¬╪º╪▓┘ç ╪¿╪│╪º╪▓┘å╪» */
      autoSyncSuppressUpload++;
      try {
        save();
        await flushStorage();
        await window.storageSync.applyRemoteChanges({ puts, deletes, acknowledge });
        if (trackerChangedRemotely && remoteTracker) applyRemoteTracker(remoteTracker);
        if (remoteTimer) applyRemoteTimer(remoteTimer);
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
        stamps: nextStamps,
        checked: nextChecked,
        tracker: trackerChangedRemotely && remoteTracker ? JSON.stringify(remoteTracker) : (meta.tracker || null),
        timer: remoteTimer ? JSON.stringify(remoteTimer) : (meta.timer || null),
        lastSyncAt: now
      });
      setLastSyncTimestamp(now);

      syncNotice = applied
        ? `Γ£ô ${fa(applied)} ╪¬╪║█î█î╪▒ ╪º╪▓ ╪¡╪│╪º╪¿ ╪┤┘à╪º ╪º╪╣┘à╪º┘ä ╪┤╪»`
        : 'Γ£ô ╪┤┘à╪º╪▒┘å╪»┘çΓÇî┘ç╪º█î ╪¬╪│╪¬ ╪¿┘çΓÇî╪▒┘ê╪▓ ╪┤╪»';
      if (applied) await refreshAppAfterSync();
      return { ok: true, changed: applied, downloadAt: now };
    }

    /* ╪º┘ê┘ä█î┘å ╪│█î┘å┌⌐ █î╪º ┘å╪¿┘ê╪» ╪º┘à┌⌐╪º┘å ╪│█î┘å┌⌐ ╪¬╪»╪▒█î╪¼█î: ╪»╪▒█î╪º┘ü╪¬ ┌⌐╪º┘à┘ä */
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
      setProgress('download', (counted / stores.length) * 5, '╪┤┘à╪º╪▒╪┤ ╪▒┌⌐┘ê╪▒╪»┘ç╪º█î ╪│╪▒┘ê╪▒ΓÇª');
    }

    const total = [...totals.values()].reduce((sum, value) => sum + value, 0);
    if (!total) {
      syncNotice = '╪¡╪│╪º╪¿ ╪┤┘à╪º ┘ç┘å┘ê╪▓ ╪»╪º╪»┘çΓÇî╪º█î ┘å╪»╪º╪▒╪»╪¢ ╪º╪▓ ╪»╪│╪¬┌»╪º┘ç█î ┌⌐┘ç ╪º╪╖┘ä╪º╪╣╪º╪¬ ╪»╪º╪▒╪» ┘ç┘à┌»╪º┘àΓÇî╪│╪º╪▓█î ┌⌐┘å█î╪».';
      return { ok: true, changed: 0, empty: true };
    }

    const records = Object.fromEntries([...NORMALIZED_STORES, ...LEGACY_STORES].map(store => [store, []]));
    const rawRecords = new Map();
    let done = 0;
    let remoteTracker = null;
    let remoteTimer = null;
    const tick = amount => {
      done += amount;
      const percent = 5 + (Math.min(done, total) / total) * 95;
      setProgress('download', percent, `${fa(Math.min(done, total))} ╪º╪▓ ${fa(total)} ╪▒┌⌐┘ê╪▒╪»`);
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
        const timerRecord = remoteRecords.find(record => String(record.localId || '') === POCKETBASE_TIMER_ID);
        if (timerRecord && timerRecord.value) remoteTimer = timerRecord.value;
      }
      if (records[entry.store]) {
        records[entry.store] = remoteToLocalRecords(entry.store, remoteRecords);
      }
      tick(remoteRecords.length);
    }

    const rawState = stateFromNormalizedRecords(records);
    if (!rawState) throw new Error('╪»╪º╪»┘çΓÇî┘ç╪º█î ╪│╪▒┘ê╪▒ ┌⌐╪º┘à┘ä ┘å█î╪│╪¬ (╪▒┌⌐┘ê╪▒╪» ╪¬┘å╪╕█î┘à╪º╪¬ ┘╛█î╪»╪º ┘å╪┤╪»).');

    const normalized = normalizeStateData(rawState);
    normalized.subjects.forEach(subject => {
      if (!normalized.classes[subject.name]) {
        normalized.classes[subject.name] = { total: subject.sessions || 0, sessions: {} };
      } else if (!normalized.classes[subject.name].total) {
        normalized.classes[subject.name].total = subject.sessions || 0;
      }
    });

    setProgress('download', 100, '╪░╪«█î╪▒┘çΓÇî╪│╪º╪▓█î ╪▒┘ê█î ╪º█î┘å ╪»╪│╪¬┌»╪º┘çΓÇª', true);
    autoSyncSuppressUpload++;
    try {
      /* ╪º╪¿╪¬╪»╪º ╪¬╪║█î█î╪▒╪º╪¬ ┘à╪╣┘ä┘é ┘é╪¿┘ä█î ╪░╪«█î╪▒┘ç ┘à█îΓÇî╪┤┘ê┘å╪» ╪¬╪º ╪¿╪º ╪»╪º╪»┘ç┘ö ╪¬╪º╪▓┘ç ┘é╪º╪╖█î ┘å╪┤┘ê┘å╪» */
      save();
      await flushStorage();
      replaceTrackedState(normalized, true);
      if (remoteTracker) applyRemoteTracker(remoteTracker);
      if (remoteTimer) applyRemoteTimer(remoteTimer);
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
      timer: remoteTimer ? JSON.stringify(remoteTimer) : null,
      lastSyncAt: now
    });

    setLastSyncTimestamp(now);
    syncNotice = `Γ£ô ${fa(total)} ╪▒┌⌐┘ê╪▒╪» ╪º╪▓ ╪¡╪│╪º╪¿ ╪┤┘à╪º ╪»╪▒█î╪º┘ü╪¬ ╪┤╪»`;
    await refreshAppAfterSync();
    return { ok: true, changed: total, downloadAt: now, full: true };
  } catch (error) {
    console.error('[PB] download failed:', error);
    syncError = '╪»╪▒█î╪º┘ü╪¬ ┘å╪º┘à┘ê┘ü┘é ╪¿┘ê╪» ΓÇö ' + pocketBaseErrorMessage(error);
    return { ok: false, error: syncError };
  } finally {
    syncBusy = null;
    resetProgress();
    renderSyncUI();
    refreshPendingBadge();
    if (!silent) {
      if (syncError) toast('Γ¥î ' + syncError);
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
    const previousId = state.profile && state.profile.id ? String(state.profile.id) : '';
    if (previousId && previousId !== String(record.id)) accountSwitchPending = true;
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
/* ╪»╪▒█î╪º┘ü╪¬ ╪▓┘å╪»┘ç: ╪│╪▒┘ê╪▒ ┘ç╪▒ ╪¬╪║█î█î╪▒ ╪▒╪º ┘ç┘à╪º┘å ┘ä╪¡╪╕┘ç ╪º╪╣┘ä╪º┘à ┘à█îΓÇî┌⌐┘å╪»╪î ╪¿┘å╪º╪¿╪▒╪º█î┘å ┘ä╪º╪▓┘à ┘å█î╪│╪¬
   ╪¿╪▒┘å╪º┘à┘ç ┘à╪»╪º┘à ╪¿╪▒╪º█î ┬½┌å█î╪▓█î ╪¬╪º╪▓┘ç ┘ç╪│╪¬╪ƒ┬╗ ╪│╪▒┘ê╪▒ ╪▒╪º ╪¿┘╛╪▒╪│╪». ╪º┌»╪▒ ╪º╪¬╪╡╪º┘ä ┘à┘à┌⌐┘å ┘å╪¿╪º╪┤╪»
   (┘╛╪▒╪º┌⌐╪│█î╪î ┘à╪▒┘ê╪▒┌»╪▒ ┘é╪»█î┘à█î╪î ╪ó┘ü┘ä╪º█î┘å) ╪¿█îΓÇî╪╡╪»╪º ╪¿┘ç ┘ç┘à╪º┘å ┌⌐╪º┘ê╪┤ ╪»┘ê╪▒┘çΓÇî╪º█î ╪¿╪▒┘à█îΓÇî┌»╪▒╪»█î┘à. */
const REALTIME_RETRY_MS = 5 * 60 * 1000;
const REALTIME_DEAD_RETRY_MS = 20 * 60 * 1000;
const realtimePush = {
  supported: typeof EventSource !== 'undefined',
  started: false,
  connected: false,
  identity: '',
  unsubs: [],
  lastEventAt: 0,
  failedAt: 0,
  missedChecks: 0,
  deadTransport: false
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

/* ╪¿╪▒╪«█î ┘à█î╪▓╪¿╪º┘å┘ç╪º ╪º╪¬╪╡╪º┘ä SSE ╪▒╪º ┘╛╪│ ╪º╪▓ ┘à╪»╪¬█î ┘à█î╪¿┘å╪»┘å╪»╪¢ SDK ╪¿┘ç╪¬┘å┘ç╪º█î█î ╪»┘ê╪¿╪º╪▒┘ç ┘ê╪╡┘ä
   ┘à█î╪┤┘ê╪» ┘ê ┘╛█î╪º┘à┘ç╪º█î ┘à┌⌐╪▒╪▒ ╪»╪▒ ┌⌐┘å╪│┘ê┘ä ┘à█î┌»╪░╪º╪▒╪». ╪¬╪╣╪»╪º╪» ╪¬┘ä╪º╪┤┘ç╪º ┘à╪¡╪»┘ê╪» ┘à█î╪┤┘ê╪» ┘ê ╪º┌»╪▒
   ╪º╪¬╪╡╪º┘ä ╪»╪▒ ╪╣┘à┘ä ╪▓┘å╪»┘ç ┘å╪¿╪º╪┤╪»╪î ┘å╪┤╪º┘å ┬½╪▓┘å╪»┘ç┬╗ ┘ç┘à ╪¿┘ç╪▒┘ê╪▓ ┘à█î╪┤┘ê╪» ╪¬╪º ┌⌐╪º┘ê╪┤ ╪»┘ê╪▒┘ç╪º█î ╪º╪»╪º┘à┘ç █î╪º╪¿╪». */
function realtimeTransportAlive() {
  try {
    const pb = getPocketBaseClient();
    return !!(pb && pb.realtime && pb.realtime.isConnected);
  } catch (error) { return false; }
}
function checkRealtimeTransport() {
  if (!realtimePush.connected || !autoSyncEnabled || !isLoggedIn()) return;
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return;
  if (realtimeTransportAlive()) { realtimePush.missedChecks = 0; return; }
  realtimePush.missedChecks++;
  if (realtimePush.missedChecks < 2) return;
  realtimePush.missedChecks = 0;
  realtimePush.connected = false;
  realtimePush.started = false;
  realtimePush.identity = '';
  realtimePush.failedAt = Date.now();
  realtimePush.deadTransport = true;
  renderSyncUI();
}

function stopRealtimePush() {
  const unsubs = realtimePush.unsubs;
  realtimePush.started = false;
  realtimePush.connected = false;
  realtimePush.identity = '';
  realtimePush.unsubs = [];
  realtimePush.missedChecks = 0;
  /* ╪▒┘ê█î╪»╪º╪»┘ç╪º█î ╪╡┘ü╪¿┘å╪»█î ╪┤╪»┘ç ┘å╪¿╪º█î╪» ┘╛╪│ ╪º╪▓ ╪«╪▒┘ê╪¼ █î╪º ╪¬╪║█î█î╪▒ ┘ç┘ê█î╪¬ ╪¿╪º┘é█î ╪¿┘à╪º┘å┘å╪» */
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
  const retryGap = realtimePush.deadTransport ? REALTIME_DEAD_RETRY_MS : REALTIME_RETRY_MS;
  if (Date.now() - realtimePush.failedAt < retryGap) return false;
  await stopRealtimePush();
  realtimePush.started = true;
  realtimePush.identity = identity;
  try {
    const pb = getPocketBaseClient();
    try {
      if (pb.realtime && typeof pb.realtime === 'object') pb.realtime.maxReconnectAttempts = 3;
    } catch (error) {}
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
    realtimePush.missedChecks = 0;
    realtimePush.deadTransport = false;
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
/* ╪▒┘ê█î╪»╪º╪» ╪│╪▒┘ê╪▒ ┘ü┘é╪╖ ┬½█î┌⌐ ╪¬╪║█î█î╪▒ ┘ç╪│╪¬┬╗ ╪▒╪º ╪º╪╣┘ä╪º┘à ┘à█îΓÇî┌⌐┘å╪»╪¢ ╪º╪╣┘à╪º┘ä ╪ó┘å ╪¿╪º ┘ç┘à╪º┘å ┘à╪│█î╪▒
   ╪¬╪»╪▒█î╪¼█î┘É ╪ó╪▓┘à┘ê╪»┘çΓÇî╪┤╪»┘ç ╪º┘å╪¼╪º┘à ┘à█îΓÇî╪┤┘ê╪» ╪¬╪º ╪º╪»╪║╪º┘à ┘ü█î┘ä╪»┘ç╪º ┘ê ┘ê█î╪▒╪º█î╪┤ΓÇî┘ç╪º█î ┘à╪╣┘ä┘é ╪¡┘ü╪╕ ╪┤┘ê┘å╪». */
/* ╪▒┘ê█î╪»╪º╪» ╪│╪▒┘ê╪▒ ╪»┘é█î┘é╪º┘ï ┘ç┘à╪º┘å ╪▒┌⌐┘ê╪▒╪»█î ╪▒╪º ┌⌐┘ç ╪¬╪║█î█î╪▒ ┌⌐╪▒╪»┘ç ╪º╪╣┘ä╪º┘à ┘à█î┌⌐┘å╪». ╪¿┘ç╪¼╪º█î
   ╪¿╪º╪▓╪¿█î┘å█î ╪¬┘à╪º┘à ┘à╪¼┘à┘ê╪╣┘ç┘ç╪º╪î ┘ü┘é╪╖ ┘ç┘à╪º┘å ┘å╪┤╪º┘å┘ç┘ç╪º ╪▒╪º ┘å┌»┘ç ┘à█î╪»╪º╪▒█î┘à ┘ê ╪º╪╣┘à╪º┘ä ┘à█î┌⌐┘å█î┘à. */
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
      /* ┘╛┌ÿ┘ê╪º┌⌐ ┘å┘ê╪┤╪¬┘å ╪«┘ê╪»┘à╪º┘å █î╪º ╪▒┌⌐┘ê╪▒╪»█î ┌⌐┘ç ┘ç┘à█î┘å ╪¡╪º┘ä╪º ╪º╪╣┘à╪º┘ä ╪┤╪»┘ç */
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

/* ╪º╪╣┘à╪º┘ä ┘ç╪»┘ü┘à┘å╪» ╪▒┘ê█î╪»╪º╪»┘ç╪º█î ╪▓┘å╪»┘ç: ┘å┘ç ┘ü┘ç╪▒╪│╪¬ ┌⌐╪º┘à┘ä╪î ┘å┘ç ╪┤┘à╪º╪▒╪┤╪î ┘å┘ç ╪¿╪º╪▓╪¿█î┘å█î ╪▒┌⌐┘ê╪▒╪»┘ç╪º█î ╪¿█î╪▒╪¿╪╖.
   ╪¬┘å┘ç╪º ╪▒┌⌐┘ê╪▒╪»┘ç╪º█î█î ┌⌐┘ç ╪│╪▒┘ê╪▒ ╪º╪╣┘ä╪º┘à ┌⌐╪▒╪»┘ç ╪¿╪º ┘ç┘à╪º┘å ┘é┘ê╪º╪╣╪» ╪º█î┘à┘å ╪│█î┘å┌⌐ ╪¬╪»╪▒█î╪¼█î ┘å┘ê╪┤╪¬┘ç ┘à█î╪┤┘ê┘å╪». */
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

    /* ┌å┘å╪» ╪▒┘ê█î╪»╪º╪» ┘╛╪┤╪¬╪│╪▒┘ç┘à ╪¿╪▒╪º█î █î┌⌐ ╪▒┌⌐┘ê╪▒╪»: ╪¬╪º╪▓┘ç╪¬╪▒█î┘å╪┤╪º┘å ╪¿╪▒┘å╪»┘ç ╪º╪│╪¬. */
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

    /* ╪▒┘ê█î╪»╪º╪» ┘à╪╣┘à┘ê┘ä█î ┘à┘é╪»╪º╪▒ ╪▒┌⌐┘ê╪▒╪» ╪▒╪º ┘ç┘à ╪»╪º╪▒╪»╪¢ ┘ü┘é╪╖ ╪º┌»╪▒ ┘å╪º┘é╪╡ ╪¿┘ê╪» ┘ç┘à╪º┘å ╪▒┌⌐┘ê╪▒╪» ╪▒╪º ┘à█î╪«┘ê╪º┘å█î┘à. */
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
    let remoteTimer = null;

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
        fallbackFull = true; /* ╪▒┌⌐┘ê╪▒╪» ╪▒┘ê█î ╪│╪▒┘ê╪▒ ┘å█î╪│╪¬╪¢ ╪¿╪º╪▓╪¿█î┘å█î ┘ü┘ç╪▒╪│╪¬ ┘ä╪º╪▓┘à ╪º╪│╪¬ */
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
      if (store === 'app-meta' && canonical === POCKETBASE_TIMER_ID) {
        if (!pbSameJsonValue(item.value, currentTimerPayload())) remoteTimer = item.value;
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

    if (applied || remoteTracker || remoteTimer) {
      autoSyncSuppressUpload++;
      try {
        save();
        await flushStorage();
        await window.storageSync.applyRemoteChanges({ puts, deletes, acknowledge });
        if (remoteTracker) applyRemoteTracker(remoteTracker);
        if (remoteTimer) applyRemoteTimer(remoteTimer);
      } finally {
        autoSyncSuppressUpload--;
      }
      const now = Date.now();
      nextMeta.lastSyncAt = now;
      saveSyncMeta(server, ownerId, {
        ...nextMeta,
        tracker: remoteTracker ? JSON.stringify(remoteTracker) : (meta.tracker || null),
        timer: remoteTimer ? JSON.stringify(remoteTimer) : (meta.timer || null)
      });
      setLastSyncTimestamp(now);
      syncNotice = `Γ£ô ${fa(applied)} ╪¬╪║█î█î╪▒ ╪▓┘å╪»┘ç ╪º╪╣┘à╪º┘ä ╪┤╪»`;
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
/* ╪¬╪║█î█î╪▒ ┘à╪¡┘ä█î ┘å╪¿╪º█î╪» █│█░ ╪½╪º┘å█î┘ç ┘à╪╣╪╖┘ä ╪¿┘à╪º┘å╪»╪¢ ┘ü┘é╪╖ █î┌⌐ ┘ü╪º╪╡┘ä┘ç┘ö ┌⌐┘ê╪¬╪º┘ç ╪¿╪▒╪º█î ╪º╪»╪║╪º┘à
   ┌å┘å╪» ┘ê█î╪▒╪º█î╪┤ ┘╛╪┤╪¬ΓÇî╪│╪▒┘ç┘à ┘ä╪º╪▓┘à ╪º╪│╪¬. */
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
/* A login into a different account must never seed that account with records
   left over from the previous one. */
let accountSwitchPending = false;
let pendingBadgeToken = 0;

/* Automatic sync is mandatory: no visible toggle and no persisted off state
   can leave a device disconnected after a reload. */
function readAutoSyncEnabled() { return true; }
function setAutoSyncEnabled() {
  autoSyncEnabled = true;
  try { localStorage.setItem(AUTO_SYNC_ENABLED_KEY, '1'); } catch (e) {}
  scheduleAutoUpload(700);
  startRealtimePush();
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
    if (manual) toast('Γ¥î ╪º╪¬╪╡╪º┘ä ╪º█î┘å╪¬╪▒┘å╪¬ ╪¿╪▒┘é╪▒╪º╪▒ ┘å█î╪│╪¬');
    renderSyncUI();
    return { ok: false, offline: true };
  }
  if (syncBusy || autoSyncRunning) {
    if (!manual) autoSyncPending = true;
    /* ╪▒┘ê█î╪»╪º╪» ╪▓┘å╪»┘ç ┘å╪¿╪º█î╪» ╪»╪▒ ┘à█î╪º┘å █î┌⌐ ┌å╪▒╪«┘ç┘ö ╪»█î┌»╪▒ ┌»┘à ╪┤┘ê╪» */
    if (reason === 'realtime' || reason === 'probe') realtimePending = true;
    return { ok: false, busy: true };
  }
  if (!manual) {
    const cooldown = autoSyncCooldownUntil - Date.now();
    if (cooldown > 0) { scheduleAutoCycle(cooldown, reason); return { ok: false, cooldown: true }; }
    /* ┘ê┘é╪¬█î ╪│╪▒┘ê╪▒ ┘ê╪º┘é╪╣╪º┘ï ╪¬╪║█î█î╪▒ ┌⌐╪▒╪»┘ç █î╪º ┌⌐╪º╪▒╪¿╪▒ ╪¬╪º╪▓┘ç ╪¿┘ç ╪¿╪▒┘å╪º┘à┘ç ╪¿╪▒┌»╪┤╪¬┘ç╪î
       ┘ü╪º╪╡┘ä┘ç┘ö █│█░ ╪½╪º┘å█î┘çΓÇî╪º█î ┌å╪▒╪«┘ç ┘å╪¿╪º█î╪» ╪º╪╣┘à╪º┘ä ╪¬╪║█î█î╪▒ ╪▒╪º ╪╣┘é╪¿ ╪¿█î┘å╪»╪º╪▓╪». */
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

    /* ╪º┘ê┘ä█î┘å ┘ç┘à┌»╪º┘àΓÇî╪│╪º╪▓█î: ╪»╪│╪¬┌»╪º┘ç ╪¬╪º╪▓┘ç ╪º┘ê┘ä ╪»╪▒█î╪º┘ü╪¬ ┘à█îΓÇî┌⌐┘å╪»╪¢ ╪º┌»╪▒ ╪»╪º╪»┘ç┘ö ┘à╪¡┘ä█î ┘ê╪¼┘ê╪» ╪»╪º╪▒╪» ╪º┘ê┘ä ╪º╪▒╪│╪º┘ä */
    if (firstSync) {
      outcome = await performDownload({ silent: true, deferCheck: !manual });
      if (outcome && outcome.ok) {
        lastDownloadAt = Date.now();
        registerAutoSuccess();
        lastAutoStatus = 'idle';
        /* ╪¡╪│╪º╪¿ ╪«╪º┘ä█î ╪º╪│╪¬: ┘ç┘à█î┘å ╪»╪│╪¬┌»╪º┘ç ┘╛╪º█î┘ç┘ö ╪º┘ê┘ä█î┘ç ╪▒╪º ┘à█îΓÇî╪│╪º╪▓╪» ╪¬╪º ╪│█î┘å┌⌐ ╪¿╪╣╪»█î ┘à╪╣┘å╪º ╪»╪º╪┤╪¬┘ç ╪¿╪º╪┤╪» */
        if (outcome.empty) {
          /* After an account switch, seed from a clean default state instead of
             copying records that belonged to the previous account. */
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
          const seed = await performUpload({ silent: true });
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
    /* ┘ü┘é╪╖ ╪«╪╖╪º█î ╪º╪¡╪▒╪º╪▓ ┘ç┘ê█î╪¬ ╪¿╪º█î╪» ┌å╪▒╪«┘ç ╪▒╪º ┘à╪¬┘ê┘é┘ü ┌⌐┘å╪». █î┌⌐ ╪▒┌⌐┘ê╪▒╪» ┘à╪┤┌⌐┘äΓÇî╪»╪º╪▒ ┘å╪¿╪º█î╪»
       ┘à╪º┘å╪╣ ╪»╪▒█î╪º┘ü╪¬ ╪¬╪║█î█î╪▒╪º╪¬ ╪»╪│╪¬┌»╪º┘çΓÇî┘ç╪º█î ╪»█î┌»╪▒ ╪┤┘ê╪». */
    if (!up || (!up.ok && up.fatal)) {
      outcome = up || { ok: false };
      registerAutoFailure(up && up.error);
      lastAutoStatus = 'error';
      return outcome;
    }
    const uploadFailed = !!up && !up.ok;
    if (uploadFailed) {
      uploadFailure = up.error || '╪º╪▒╪│╪º┘ä ┘å╪º┘à┘ê┘ü┘é ╪¿┘ê╪»';
      registerAutoFailure(uploadFailure);
    }

    /* ┌⌐╪º┘ê╪┤ ╪│╪▒┘ê╪▒ █î╪º ╪▒┘ê█î╪»╪º╪» ╪▓┘å╪»┘ç █î╪╣┘å█î ╪¬╪║█î█î╪▒ ┘ê╪º┘é╪╣█î ┘╛█î╪»╪º ╪┤╪»┘ç╪¢ ╪»╪▒█î╪º┘ü╪¬ ┘å╪¿╪º█î╪» ╪¿┘ç
       ┘ü╪º╪╡┘ä┘ç┘ö █╢█░ ╪½╪º┘å█î┘çΓÇî╪º█î ┘à╪¡╪»┘ê╪» ╪┤┘ê╪» */
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

    /* ╪¬╪║█î█î╪▒┘ç╪º█î█î ┌⌐┘ç ┘ç┘à█î┘å ╪¡╪º┘ä╪º ╪º╪╣┘ä╪º┘à ╪┤╪»┘çΓÇî╪º┘å╪» ╪¿╪º ┘ç┘à█î┘å ╪»╪▒█î╪º┘ü╪¬ ╪«┘ê╪º┘å╪»┘ç ┘à█îΓÇî╪┤┘ê┘å╪» */
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
    syncError = '┘ç┘à┌»╪º┘àΓÇî╪│╪º╪▓█î ┘å╪º┘à┘ê┘ü┘é ╪¿┘ê╪» ΓÇö ' + pocketBaseErrorMessage(error);
    registerAutoFailure(syncError);
    lastAutoStatus = 'error';
    return { ok: false, error: syncError };
  } finally {
    autoSyncRunning = false;
    if (realtimePending) {
      /* ╪▒┘ê█î╪»╪º╪»█î ┌⌐┘ç ┘ç┘å┌»╪º┘à ╪º█î┘å ┌å╪▒╪«┘ç ╪▒╪│█î╪»╪î ╪»╪▒ ┌å╪▒╪«┘ç┘ö ╪¿╪╣╪»█î (┘ü┘ê╪▒█î) ╪«┘ê╪º┘å╪»┘ç ┘à█îΓÇî╪┤┘ê╪» */
      realtimePending = false;
      scheduleAutoCycle(200, 'realtime');
    }
    if (autoSyncPending) {
      autoSyncPending = false;
      scheduleAutoUpload(400);
    }
    /* ╪»╪▒█î╪º┘ü╪¬╪î ┘╛█î╪º┘à ╪«╪╖╪º ╪▒╪º ┘╛╪º┌⌐ ┘à█îΓÇî┌⌐┘å╪»╪¢ ╪«╪╖╪º█î ╪º╪▒╪│╪º┘ä ╪¿╪º█î╪» ╪¬╪º ┘à┘ê┘ü┘é█î╪¬ ╪¿╪╣╪»█î ╪»█î╪»┘ç ╪┤┘ê╪» */
    if (uploadFailure) syncError = uploadFailure;
    renderSyncUI();
    refreshPendingBadge();
    if (manual) {
      if (outcome && outcome.ok) toast(syncError ? 'Γ¥î ' + syncError : (syncNotice || 'Γ£ô ┘ç┘à┌»╪º┘àΓÇî╪│╪º╪▓█î ╪º┘å╪¼╪º┘à ╪┤╪»'));
      else if (outcome && outcome.offline) toast('Γ¥î ╪º╪¬╪╡╪º┘ä ╪º█î┘å╪¬╪▒┘å╪¬ ╪¿╪▒┘é╪▒╪º╪▒ ┘å█î╪│╪¬');
      else if (syncError) toast('Γ¥î ' + syncError);
    }
  }
}

function syncNow() {
  /* ╪»┌⌐┘à┘ç┘ö ╪│█î┘å┌⌐ ┘ç┘à╪º┘å ┌⌐╪º╪▒█î ╪▒╪º ┘à█î┌⌐┘å╪» ┌⌐┘ç ╪¬╪▒┘à█î┘à ┘à█î┌⌐╪▒╪»: ╪º╪▒╪│╪º┘ä ┘à╪¡┘ä█î╪î ╪¿╪º╪▓╪¿█î┘å█î
     ┌⌐╪º┘à┘ä ┘ü┘ç╪▒╪│╪¬┘ç╪º ┘ê ┘à┘é╪º█î╪│┘ç┘ö ┘à┘é╪»╪º╪▒ ╪¬┘à╪º┘à ╪▒┌⌐┘ê╪▒╪»┘ç╪º█î ╪┤┘å╪º╪«╪¬┘ç╪┤╪»┘ç ╪¿╪º ╪│╪▒┘ê╪▒. */
  return syncCycle({ reason: 'manual', verify: true, full: true });
}
/* ┘å╪º┘à ┘é╪»█î┘à█î ╪¿╪▒╪º█î ╪│╪º╪▓┌»╪º╪▒█î╪¢ ╪º┌⌐┘å┘ê┘å ┘ç┘à╪º┘å ┬½┘ç┘à┌»╪º┘à╪│╪º╪▓█î┬╗ ╪º╪│╪¬ ┘ê ╪»┌⌐┘à┘ç┘ö ╪¼╪»╪º┌»╪º┘å┘ç ╪¡╪░┘ü ╪┤╪». */
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
}
/* ┌⌐╪º┘ê╪┤ ╪º╪▒╪▓╪º┘å: ╪ó█î╪º ╪▒┘ê█î ╪│╪▒┘ê╪▒ ╪▒┌⌐┘ê╪▒╪»█î ╪¬╪º╪▓┘çΓÇî╪¬╪▒ ╪º╪▓ ╪ó╪«╪▒█î┘å ┘ê╪╢╪╣█î╪¬ ╪┤┘å╪º╪«╪¬┘çΓÇî╪┤╪»┘ç ┘ç╪│╪¬╪ƒ
   ╪¿┘çΓÇî╪¼╪º█î ╪│█î┘å┌⌐ ┌⌐╪º┘à┘ä ╪»┘ê╪▒┘çΓÇî╪º█î╪î ┘ü┘é╪╖ ╪º█î┘å ┘╛╪▒╪│╪┤ ┌⌐┘ê┌å┌⌐ ╪º┘å╪¼╪º┘à ┘à█îΓÇî╪┤┘ê╪». */
async function probeRemoteChanges(force) {
  if (!autoSyncEnabled || !isLoggedIn()) return false;
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return false;
  if (syncBusy || autoSyncRunning || probeInFlight) return false;
  const now = Date.now();
  /* ┌⌐╪º┘ê╪┤ ╪º╪¼╪¿╪º╪▒█î (╪¿╪º╪▓┌»╪┤╪¬ ╪¿┘ç ╪¿╪▒┘å╪º┘à┘ç) ┘ü┘é╪╖ ┌å┘å╪» ╪½╪º┘å█î┘ç ┘ü╪º╪╡┘ä┘ç ┘ä╪º╪▓┘à ╪»╪º╪▒╪» */
  if (now - lastProbeAt < (force ? 5000 : AUTO_PROBE_GAP)) return false;
  lastProbeAt = now;
  probeInFlight = true;
  try {
    const pb = await requirePocketBaseAuth();
    const ownerId = pocketBaseUserId(pb);
    if (!ownerId) return false;
    const server = normalizeBaseUrl(pocketBaseBaseUrl());
    const meta = loadSyncMeta(server, ownerId);
    if (!meta || !meta.remote) return true; /* ┘ü╪▒╪º╪»╪º╪»┘ç ┘å╪»╪º╪▒█î┘à╪¢ ╪│█î┘å┌⌐ ┌⌐╪º┘à┘ä ┘ä╪º╪▓┘à ╪º╪│╪¬ */
    for (const store of PB_DOWNLOAD_STORES) {
      const collection = pbCollectionName(store);
      const knownMap = meta.remote[collection] || {};
      const knownMax = syncKnownMax(meta, collection);
      try {
        /* ╪¿╪▒╪«█î ╪│╪▒┘ê╪▒┘ç╪º ╪│╪¬┘ê┘å updated ┘å╪»╪º╪▒┘å╪»╪¢ ┘ü┘ç╪▒╪│╪¬ ╪│╪¿┌⌐ ╪¿╪»┘ê┘å sort ┘ê ╪¿╪»┘ê┘å ┘ü█î┘ä╪¬╪▒
           ╪▓┘à╪º┘å ╪«┘ê╪º┘å╪»┘ç ┘à█î╪┤┘ê╪» ╪¬╪º ╪«╪╖╪º█î 400 ╪º█î╪¼╪º╪» ┘å╪┤┘ê╪». */
        const records = await fetchOwnerManifest(pb, collection, ownerId);
        if (knownMax) {
          const serverMax = maxUpdatedTimestamp(records);
          if (!serverMax || serverMax > knownMax) return true;
          if (serverMax < knownMax) {
            /* ┘ü╪▒╪º╪»╪º╪»┘ç ╪¼┘ä┘ê╪¬╪▒ ╪º╪▓ ╪│╪▒┘ê╪▒ ╪º╪│╪¬╪¢ ┘╛╪º┌⌐╪│╪º╪▓█î ┘ç┘à╪º┘å ┘à╪¼┘à┘ê╪╣┘ç ╪¬╪º ╪│█î┘å┌⌐ ╪¿╪╣╪»█î
               ┘ü┘ç╪▒╪│╪¬ ┌⌐╪º┘à┘ä ╪▒╪º ╪¿╪«┘ê╪º┘å╪» ┘ê ┘à╪│█î╪▒ ╪¬╪»╪▒█î╪¼█î ╪«┘ê╪»╪┤ ╪▒╪º ╪¬╪▒┘à█î┘à ┌⌐┘å╪». */
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
        } else if (records.length !== Object.keys(knownMap).length) {
          return true;
        } else {
          const serverIds = new Set(records.map(item => pbCanonicalLocalId(store, item.localId)));
          if (Object.keys(knownMap).some(id => !serverIds.has(id))) return true;
        }
      } catch (error) {
        /* ┘à╪¼┘à┘ê╪╣┘ç╪º█î ╪▒┘ê█î ╪│╪▒┘ê╪▒ ┘å█î╪│╪¬ █î╪º ┘à┘ê┘é╪¬╪º┘ï ╪»╪▒ ╪»╪│╪¬╪▒╪│ ┘å█î╪│╪¬╪¢ ┌⌐╪º┘ê╪┤ ╪º╪»╪º┘à┘ç ┘à█î█î╪º╪¿╪» */
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

/* ╪º┌»╪▒ ╪¿╪▒┘å╪º┘à┘ç ╪¿┘ç ┘╛╪│ΓÇî╪▓┘à█î┘å┘ç ╪¿╪▒┘ê╪»╪î ╪¬╪║█î█î╪▒┘ç╪º█î ╪░╪«█î╪▒┘çΓÇî╪┤╪»┘ç ╪¿┘ä╪º┘ü╪º╪╡┘ä┘ç ╪º╪▒╪│╪º┘ä ┘à█îΓÇî╪┤┘ê┘å╪»
   ╪¬╪º ╪¼╪º╪¿┘çΓÇî╪¼╪º█î█î █î┌⌐ ╪¿┘ä┘ê┌⌐ ┘╛█î╪┤ ╪º╪▓ ╪¿╪│╪¬┘å/╪¬╪▒┌⌐ ╪¿╪▒┘å╪º┘à┘ç ╪▒┘ê█î ╪│╪▒┘ê╪▒ ╪¿┘å╪┤█î┘å╪». */
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
    /* ╪¿╪º ╪º╪¬╪╡╪º┘ä ╪▓┘å╪»┘ç╪î ┘╛╪▒╪│ΓÇî┘ê╪¼┘ê█î ╪»┘é█î┘é┘çΓÇî╪º█î ┘ä╪º╪▓┘à ┘å█î╪│╪¬╪¢ ┘ç┘à╪º┘å ┘╛╪º█î╪┤ ╪»┘çΓÇî╪»┘é█î┘é┘çΓÇî╪º█î ┘à█îΓÇî┘à╪º┘å╪» */
    checkRealtimeTransport();
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
    el.textContent = count ? `${fa(count)} ╪¬╪║█î█î╪▒ ╪»╪▒ ╪º┘å╪¬╪╕╪º╪▒ ╪º╪▒╪│╪º┘ä` : 'Γ£ô ┘ç┘à┘ç ╪¬╪║█î█î╪▒╪º╪¬ ╪░╪«█î╪▒┘ç ╪┤╪»┘å╪»';
    el.classList.toggle('pending', count > 0);
    el.classList.toggle('saved', count === 0);
  }).catch(() => {});
}

/* ============ sync UI ============ */
function syncProgressMarkup() {
  const kindTitle = syncProgress.kind === 'upload' ? '╪º╪▒╪│╪º┘ä ╪»╪º╪»┘çΓÇî┘ç╪º' : '╪»╪▒█î╪º┘ü╪¬ ╪»╪º╪»┘çΓÇî┘ç╪º';
  return `
    <div class="sync-progress" id="syncProgressBar" role="group" aria-label="${kindTitle}" hidden>
      <div class="sync-progress-head">
        <span id="syncProgressTitle">${kindTitle}</span>
        <span class="sync-progress-value">
          <span id="syncProgressPercentLabel">${syncProgress.kind === 'upload' ? '╪»╪▒╪╡╪» ╪º╪▒╪│╪º┘ä' : '╪»╪▒╪╡╪» ╪»╪▒█î╪º┘ü╪¬'}</span>
          <b id="syncProgressPercent">${fa(syncProgress.percent)}┘¬</b>
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
  if (!loggedIn) return { text: '┘å█î╪º╪▓ ╪¿┘ç ┘ê╪▒┘ê╪»', cls: 'warn' };
  if (busy) return { text: '╪»╪▒ ╪¡╪º┘ä ╪│█î┘å┌⌐', cls: 'busy' };
  if (!online) return { text: '╪ó┘ü┘ä╪º█î┘å', cls: 'warn' };
  if (!autoSyncEnabled) return { text: '╪«╪º┘à┘ê╪┤', cls: 'warn' };
  if (realtimePush.connected) return { text: '╪▓┘å╪»┘ç', cls: 'live' };
  return { text: '╪ó┘à╪º╪»┘ç', cls: '' };
}

/* ┘ç┘ê█î╪¬ ╪¡╪│╪º╪¿ ┘ê ┘╛╪▒┘ê┘ü╪º█î┘ä ╪»╪▒ █î┌⌐ ┘å┘é╪╖┘ç ╪»█î╪»┘ç ┘à█î╪┤┘ê╪»: ┘å╪º┘à ┘ê ╪▒╪┤╪¬┘ç ╪»╪▒ ╪¿╪º┘ä╪º╪î ╪º█î┘à█î┘ä ┘ê
   ┘ê╪▒┘ê╪»/╪«╪▒┘ê╪¼ ╪¿┘ä╪º┘ü╪º╪╡┘ä┘ç ╪▓█î╪▒ ┘ç┘à╪º┘å ┌⌐╪º╪▒╪¬. */
function renderLegacyPbAccountUI(loggedIn, email, online, busy, lastSync) {
  const box = document.getElementById('legacyPbAccountUI');
  if (!box) return;
  const stateKey = loggedIn ? `in|${email}|${online}|${busy}|${lastSync}` : 'out';
  const active = document.activeElement;
  if (active && box.contains(active) && /^(INPUT|TEXTAREA|SELECT)$/.test(String(active.tagName || '').toUpperCase()) && accountRenderState === stateKey) return;
  accountRenderState = stateKey;

  if (loggedIn) {
    const initial = String(email || '?').trim().charAt(0).toUpperCase() || '?';
    box.innerHTML = `
      <div class="account-row">
        <span class="account-avatar">${esc(initial)}</span>
        <div class="account-identity">
          <div class="account-email" dir="ltr">${esc(email || 'حساب متصل')}</div>
          <div class="account-sub"><span class="sync-status-${online ? 'online' : 'offline'}">${online ? 'آنلاین' : 'آفلاین'}</span> · آخرین سینک: ${esc(lastSync)}</div>
        </div>
        <button class="btn ghost account-btn" id="syncLogoutBtn" ${busy ? 'disabled' : ''}>خروج</button>
      </div>`;
    const logoutBtn = document.getElementById('syncLogoutBtn');
    if (logoutBtn) logoutBtn.onclick = () => {
      if (busy) return;
      if (!confirm('از حساب PocketBase قدیمی خارج می‌شوید؟')) return;
      logoutPocketBase();
      toast('خارج شد');
      renderSyncUI();
    };
    return;
  }

  box.innerHTML = `
    <div class="account-row">
      <span class="account-avatar muted-avatar">☁️</span>
      <div class="account-identity">
        <div class="account-email">حساب PocketBase قدیمی متصل نیست</div>
        <div class="account-sub">برای انتقال تدریجی، با ایمیل/رمز قدیمی وارد شوید</div>
      </div>
    </div>
    <div class="account-login-form">
      <input class="input" id="syncEmail" type="email" placeholder="ایمیل" dir="ltr" autocomplete="username" inputmode="email" aria-label="ایمیل">
      <input class="input" id="syncPassword" type="password" placeholder="رمز عبور" autocomplete="current-password" aria-label="رمز عبور">
      <button class="btn primary" id="syncLoginBtn">ورود PocketBase قدیمی</button>
      <div id="syncLoginError" class="sync-login-error"></div>
    </div>`;
  const loginBtn = document.getElementById('syncLoginBtn');
  const passwordEl = document.getElementById('syncPassword');
  if (passwordEl) passwordEl.onkeydown = event => { if (event.key === 'Enter') { event.preventDefault(); if (loginBtn) loginBtn.click(); } };
  if (!loginBtn) return;
  loginBtn.onclick = async () => {
    const emailEl = document.getElementById('syncEmail');
    const errEl = document.getElementById('syncLoginError');
    const emailValue = (emailEl ? emailEl.value : '').trim();
    const password = passwordEl ? passwordEl.value : '';
    if (errEl) { errEl.textContent = ''; errEl.classList.remove('show'); }
    if (!emailValue || !password) {
      if (errEl) { errEl.textContent = 'ایمیل و رمز عبور را کامل کنید.'; errEl.classList.add('show'); }
      return;
    }
    loginBtn.disabled = true;
    loginBtn.textContent = 'در حال ورود...';
    try {
      await loginWithPassword(emailValue, password);
      syncError = null;
      syncNotice = 'ورود PocketBase قدیمی انجام شد.';
      toast('✅ ورود انجام شد');
      renderSyncUI();
      startAutoSync();
      if (autoSyncEnabled) scheduleAutoCycle(300, 'login');
    } catch (error) {
      console.error('[PB] login failed:', error);
      if (errEl) { errEl.textContent = 'خطا در ورود: ' + pocketBaseErrorMessage(error); errEl.classList.add('show'); }
      loginBtn.disabled = false;
      loginBtn.textContent = 'ورود PocketBase قدیمی';
    }
  };
}

function renderSyncUI() {
  const box = document.getElementById('legacyPbSyncUI');
  if (!box) return;

  const loggedIn = isLoggedIn();
  const email = getLoggedInEmail();
  const lastSync = formatLastSync();
  const online = typeof navigator !== 'undefined' ? navigator.onLine !== false : true;
  const busy = !!syncBusy || autoSyncRunning || realtimeApplyRunning;
  const badge = syncStateBadge(online, loggedIn, busy);

  /* ╪¡╪│╪º╪¿ ┌⌐╪º╪▒╪¿╪▒█î ╪¿╪«╪┤█î ╪º╪▓ ┘ç┘à╪º┘å ┌⌐╪º╪▒╪¬ ┘╛╪▒┘ê┘ü╪º█î┘ä ╪º╪│╪¬╪î ┘å┘ç ╪¿╪«╪┤ ╪¼╪»╪º┌»╪º┘å┘ç ╪¬┘å╪╕█î┘à╪º╪¬. */
  renderLegacyPbAccountUI(loggedIn, email, online, busy, lastSync);

  if (!loggedIn) {
    box.innerHTML = `
      <div class="sync-card-head">
        <div class="sync-card-title">┘ç┘à┌»╪º┘à╪│╪º╪▓█î ╪º╪¿╪▒█î</div>
        <span class="sync-state-pill warn">${badge.text}</span>
      </div>
      <div class="sync-empty-note">┘╛╪│ ╪º╪▓ ┘ê╪▒┘ê╪»╪î ╪¬┘å╪╕█î┘à╪º╪¬ ┘ç┘à┌»╪º┘à╪│╪º╪▓█î ╪º█î┘å╪¼╪º ┘å┘à╪º█î╪┤ ╪»╪º╪»┘ç ┘à█î╪┤┘ê╪».</div>`;
    return;
  }

  box.innerHTML = `
    <div class="sync-card-head">
      <div class="sync-card-title">PocketBase قدیمی (موقت)</div>
      <span class="sync-state-pill ${badge.cls}">${badge.text}</span>
    </div>
    <div class="sync-pending-row">
      <span class="sync-pending" id="syncPendingStatus">در حال بررسی تغییرات…</span>
    </div>
    <div class="sync-auto-note">برای انتقال تدریجی از ایمیل/رمز قدیمی استفاده کنید.</div>
    ${syncProgressMarkup()}
    ${syncError ? `<div class="sync-login-error show">⚠️ ${esc(syncError)}</div>` : ''}
  `;

  if (busy) setProgress(syncProgress.kind, syncProgress.percent, syncProgress.note, true);
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


// Temporary migration shim
window.legacyPbSync = window.pbSync || window.pocketBaseSync || { renderSyncUI: typeof renderSyncUI==='function'?renderSyncUI:function(){} };
