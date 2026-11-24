'use strict';

/* ============================================================
   MASIR SQL API — the only browser transport for the SQL backend.
   - No external SDK: only fetch, WebSocket and AbortController.
   - Access tokens are supplied through getToken(); this file never
     writes them anywhere.
   - Auth, sync snapshots, changes, advisor links and admin tools all
     go through MasirSqlClient.
   ============================================================ */

(function (factory) {
  const api = factory();
  if (typeof window !== 'undefined' && window) window.MasirSqlApi = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(function () {
  'use strict';

  const DEFAULT_TIMEOUT_MS = 15000;
  const DEFAULT_SNAPSHOT_LIMIT = 500;
  const BASE_RECONNECT_DELAY_MS = 500;
  const MAX_RECONNECT_DELAY_MS = 30000;
  /* The Konkur penalty is fixed in the app; legacy custom values are ignored. */
  const FIXED_TRACKER_COEF = 1 / 3;

  /* Typed PostgreSQL table names <-> local IndexedDB store names. */
  const SQL_TABLES = Object.freeze([
    'subjects', 'sessions', 'activities', 'classes', 'sleeps', 'phones',
    'exams', 'questions', 'app_meta', 'tracker', 'timer'
  ]);
  const TABLE_TO_STORE = Object.freeze({
    subjects: 'subjects',
    sessions: 'sessions',
    activities: 'activities',
    classes: 'classes',
    sleeps: 'sleeps',
    phones: 'phones',
    exams: 'exams',
    questions: 'questions',
    app_meta: 'app-meta',
    tracker: 'tracker',
    timer: 'timer'
  });
  const STORE_TO_TABLE = Object.freeze(SQL_TABLES.reduce((map, table) => {
    map[TABLE_TO_STORE[table]] = table;
    return map;
  }, {}));

  function localStoreForTable(table) {
    return TABLE_TO_STORE[String(table == null ? '' : table)] || '';
  }
  function tableForLocalStore(store) {
    return STORE_TO_TABLE[String(store == null ? '' : store)] || '';
  }

  /* Only these fields cross the wire. Unknown legacy fields are dropped.
     Keys are local field names; values are typed SQL column names. */
  const FIELD_MAPS = Object.freeze({
    app_meta: Object.freeze({ value: 'value' }),
    subjects: Object.freeze({ name: 'name', color: 'color', type: 'type', field: 'field', config: 'config', localOrder: 'local_order' }),
    sessions: Object.freeze({
      subject: 'subject', topic: 'topic', durMin: 'dur_min', date: 'date',
      startMin: 'start_min', done: 'done', doneAt: 'done_at',
      activityId: 'activity_id', examId: 'exam_id', ts: 'ts', localOrder: 'local_order'
    }),
    activities: Object.freeze({
      subject: 'subject', topic: 'topic', minutes: 'minutes', date: 'date',
      startMin: 'start_min', endMin: 'end_min', note: 'note', localOrder: 'local_order'
    }),
    classes: Object.freeze({ subject: 'subject', total: 'total', sessions: 'sessions', localOrder: 'local_order' }),
    sleeps: Object.freeze({
      date: 'date', endDate: 'end_date', startMin: 'start_min',
      endMin: 'end_min', nap: 'nap', localOrder: 'local_order'
    }),
    phones: Object.freeze({
      date: 'date', startMin: 'start_min', endMin: 'end_min',
      subject: 'subject', note: 'note', localOrder: 'local_order'
    }),
    exams: Object.freeze({
      name: 'name', date: 'date', hasResults: 'has_results',
      totalTaraz: 'total_taraz', subjects: 'subjects',
      questionsCount: 'questions_count', localOrder: 'local_order'
    }),
    questions: Object.freeze({
      examId: 'exam_id', number: 'number', subject: 'subject', topic: 'topic',
      status: 'status', note: 'note', questionText: 'question_text',
      answerText: 'answer_text', options: 'options', tags: 'tags',
      starred: 'starred', figureRef: 'figure_ref', noteHidden: 'note_hidden',
      ts: 'ts', localOrder: 'local_order'
    }),
    tracker: Object.freeze({ correct: 'correct', wrong: 'wrong', blank: 'blank', coef: 'coef' }),
    timer: Object.freeze({
      running: 'running', startedAt: 'started_at',
      elapsedMs: 'elapsed_ms', mode: 'mode'
    })
  });

  const PERSIAN_DIGITS = /[۰-۹٠-٩]/g;
  function englishDigits(value) {
    return String(value).replace(PERSIAN_DIGITS, (digit) => {
      const code = digit.charCodeAt(0);
      return String(code >= 0x06F0 ? code - 0x06F0 : code - 0x0660);
    });
  }
  function normalizePhone(phone) {
    const value = englishDigits(phone == null ? '' : phone).replace(/[\s\-()+]/g, '');
    if (!/^[0-9]{10,15}$/.test(value)) {
      throw new Error('Invalid phone number. Enter 10 to 15 digits, for example 09123456789.');
    }
    return value;
  }
  function normalizeCode(code) {
    const value = englishDigits(code == null ? '' : code).trim();
    if (!/^[0-9]{4,8}$/.test(value)) {
      throw new Error('Invalid verification code. Enter the 4 to 8 digit code from the SMS.');
    }
    return value;
  }
  function normalizePassword(password) {
    const value = String(password == null ? '' : password);
    if (value.length < 8) {
      throw new Error('Password must be at least 8 characters long.');
    }
    return value;
  }
  function normalizePurpose(purpose) {
    const value = String(purpose == null ? '' : purpose).trim().toLowerCase();
    if (value !== 'signup' && value !== 'reset') {
      throw new Error('Invalid OTP purpose.');
    }
    return value;
  }
  function normalizeBaseUrl(url) {
    const value = String(url == null ? '' : url).trim().replace(/\/+$/, '');
    if (!/^https?:\/\//i.test(value)) {
      throw new Error('Invalid server address. Use a full http:// or https:// URL.');
    }
    return value;
  }
  function encodeQuery(params) {
    return Object.keys(params)
      .filter((key) => params[key] !== undefined && params[key] !== null && params[key] !== '')
      .map((key) => encodeURIComponent(key) + '=' + encodeURIComponent(String(params[key])))
      .join('&');
  }
  function statusMessage(status, detail) {
    let message;
    switch (status) {
      case 400: message = 'The server rejected the request (HTTP 400).'; break;
      case 401: message = 'Not signed in (HTTP 401). Sign in again to continue.'; break;
      case 403: message = 'Access denied (HTTP 403). This account cannot perform that action.'; break;
      case 404: message = 'Not found (HTTP 404). The requested record does not exist.'; break;
      case 409: message = 'Conflict (HTTP 409). The record changed elsewhere; refresh and try again.'; break;
      case 429: message = 'Too many requests (HTTP 429). Wait a moment and try again.'; break;
      default:
        message = status >= 500
          ? 'Server error (HTTP ' + status + '). Try again in a moment.'
          : 'Request failed (HTTP ' + status + ').';
    }
    if (detail && !/[<>]/.test(detail)) message += ' ' + detail;
    return message;
  }
  function responseError(status, text) {
    let detail = '';
    if (text) {
      try {
        const parsed = JSON.parse(text);
        detail = String((parsed && (parsed.message || parsed.error || parsed.detail)) || '').slice(0, 200);
      } catch (_) {
        detail = String(text).slice(0, 200);
      }
    }
    const error = new Error(statusMessage(status, detail));
    error.status = status;
    return error;
  }

  function envelopeOf(row) {
    const out = {};
    if (!row || typeof row !== 'object' || Array.isArray(row)) return out;
    if (row.id !== undefined && row.id !== null) out.id = String(row.id);
    if (row.updated !== undefined && row.updated !== null) out.updated = String(row.updated);
    return out;
  }
  function sourceRecord(store, record) {
    if (!record || typeof record !== 'object' || Array.isArray(record)) return {};
    /* app_meta stores its JSON payload directly in `value`; other stores
       arrive as normalized records with the payload under `value`. */
    if (store === 'app_meta' || store === 'app-meta') return record;
    if (record.value && typeof record.value === 'object' && !Array.isArray(record.value)) return record.value;
    return record;
  }
  function typedTableOf(store) {
    return tableForLocalStore(store) || String(store == null ? '' : store);
  }

  /** Local record -> typed SQL row. Unknown fields are ignored. */
  function toTypedRow(store, record) {
    const table = typedTableOf(store);
    const out = envelopeOf(record);
    const source = sourceRecord(store, record);
    if (table === 'app_meta') {
      if (Object.prototype.hasOwnProperty.call(source, 'value')) out.value = source.value;
      const order = record.localOrder !== undefined ? record.localOrder : record.order;
      if (order !== undefined && order !== null) out.local_order = Number(order) || 0;
      return out;
    }
    const fields = FIELD_MAPS[table];
    if (!fields) return out;
    Object.keys(fields).forEach((localKey) => {
      if (!Object.prototype.hasOwnProperty.call(source, localKey)) return;
      const value = source[localKey];
      if (value === undefined) return;
      out[fields[localKey]] = value;
    });
    if (out.local_order === undefined) {
      const order = record.localOrder !== undefined ? record.localOrder : record.order;
      if (order !== undefined && order !== null) out.local_order = Number(order) || 0;
    }
    if (table === 'tracker') out.coef = FIXED_TRACKER_COEF;
    return out;
  }

  /** Typed SQL row -> local record. Unknown columns are ignored. */
  function fromTypedRow(table, row) {
    const name = String(table == null ? '' : table);
    const store = localStoreForTable(name) || name;
    const out = envelopeOf(row);
    const source = row && typeof row === 'object' && !Array.isArray(row) ? row : {};
    if (store === 'app-meta' || name === 'app_meta') {
      if (Object.prototype.hasOwnProperty.call(source, 'value')) out.value = source.value;
      if (source.local_order !== undefined) out.localOrder = Number(source.local_order) || 0;
      return out;
    }
    const fields = FIELD_MAPS[name] || FIELD_MAPS[store];
    if (!fields) return out;
    Object.keys(fields).forEach((localKey) => {
      const typedKey = fields[localKey];
      if (!Object.prototype.hasOwnProperty.call(source, typedKey)) return;
      const value = source[typedKey];
      if (value === undefined) return;
      out[localKey] = value;
    });
    if (store === 'tracker' || name === 'tracker') out.coef = FIXED_TRACKER_COEF;
    return out;
  }

  /** A local pending mutation -> the typed change envelope accepted by /api/changes. */
  function normalizeChange(change) {
    if (!change || typeof change !== 'object' || Array.isArray(change)) {
      throw new Error('Invalid change. Expected a change object.');
    }
    const table = change.table ? String(change.table) : tableForLocalStore(change.store || '');
    if (!SQL_TABLES.includes(table)) {
      throw new Error('Invalid change. Unknown table or local store.');
    }
    const rawOp = String(change.op || change.operation || 'upsert').toLowerCase();
    const op = rawOp === 'delete' || rawOp === 'remove' ? 'delete' : 'upsert';
    const rawId = change.id !== undefined && change.id !== null ? change.id : change.recordId;
    if (rawId === undefined || rawId === null || String(rawId) === '') {
      throw new Error('Invalid change. Missing record id.');
    }
    const localUpdated = firstDefined(change.clientUpdated, change.updatedAt, change.changedAt, change.updated);
    const payload = {
      table,
      id: String(rawId),
      op,
      /* LWW hint for server; server also has its own updated timestamp. */
      clientUpdated: localUpdated ? new Date(localUpdated).toISOString() : new Date().toISOString(),
      updated: change.updated !== undefined && change.updated !== null
        ? String(change.updated)
        : new Date().toISOString()
    };
    if (op === 'upsert') {
      const source = change.data !== undefined && change.data !== null
        ? change.data
        : (change.record !== undefined && change.record !== null ? change.record : change);
      payload.data = toTypedRow(change.store || localStoreForTable(table), source);
    }
    return payload;
  }

  function normalizeEvent(raw) {
    if (!raw) return null;
    let payload = raw;
    if (typeof raw === 'string') {
      try { payload = JSON.parse(raw); } catch (_) { return null; }
    }
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return null;
    const table = payload.table ? String(payload.table)
      : (payload.store ? tableForLocalStore(payload.store) : '');
    if (!SQL_TABLES.includes(table)) return null;
    return {
      table,
      id: payload.id === undefined || payload.id === null ? '' : String(payload.id),
      op: payload.op ? String(payload.op) : 'upsert',
      updated: payload.updated === undefined || payload.updated === null ? '' : String(payload.updated),
      data: payload.data === undefined || payload.data === null ? null : payload.data
    };
  }

  class MasirSqlClient {
    constructor(options) {
      const opts = options || {};
      this.baseUrl = normalizeBaseUrl(opts.baseUrl);
      this.getToken = typeof opts.getToken === 'function' ? opts.getToken : () => '';
      this.onEvent = typeof opts.onEvent === 'function' ? opts.onEvent : () => {};
      this.timeoutMs = Number(opts.timeoutMs) > 0 ? Number(opts.timeoutMs) : DEFAULT_TIMEOUT_MS;

      this.socket = null;
      this.reconnectTimer = null;
      this.reconnectAttempt = 0;
      this.closedByUser = false;
      this.generation = 0;
    }

    async _token(required) {
      let token = '';
      try {
        const supplied = await this.getToken();
        token = String(supplied == null ? '' : supplied).trim();
      } catch (_) {
        throw new Error('Could not read the access token. Sign in again to continue.');
      }
      if (required && !token) {
        throw new Error('No access token. Sign in again to continue.');
      }
      return token;
    }

    async _request(path, config) {
      const cfg = config || {};
      if (typeof fetch !== 'function') {
        throw new Error('Fetch is unavailable in this browser. Update the browser and try again.');
      }
      const token = await this._token(cfg.auth !== false);
      const query = cfg.query ? '?' + encodeQuery(cfg.query) : '';
      const url = this.baseUrl + path + query;
      const controller = new AbortController();
      let timedOut = false;
      const timer = setTimeout(() => { timedOut = true; controller.abort(); }, this.timeoutMs);
      const init = {
        method: cfg.method || 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': 'Bearer ' + token
        },
        signal: controller.signal
      };
      if (cfg.body !== undefined) init.body = JSON.stringify(cfg.body);

      try {
        if (cfg.signal) {
          if (cfg.signal.aborted) controller.abort();
          else if (typeof cfg.signal.addEventListener === 'function') {
            cfg.signal.addEventListener('abort', () => controller.abort(), { once: true });
          }
        }
        const response = await fetch(url, init);
        const text = await response.text();
        if (!response.ok) throw responseError(response.status, text);
        if (!text) return null;
        try { return JSON.parse(text); }
        catch (_) { throw new Error('Invalid response from the server. Expected JSON.'); }
      } catch (error) {
        if (error && error.name === 'AbortError') {
          if (timedOut) {
            throw new Error('Request timed out after ' + this.timeoutMs + ' ms. Check your connection and try again.');
          }
          throw new Error('Request was cancelled before the server replied.');
        }
        throw error;
      } finally {
        clearTimeout(timer);
      }
    }

    /** Public endpoint: SMS code for signup or password reset. */
    requestOtp(phone, purpose) {
      const body = { phone: normalizePhone(phone) };
      if (purpose !== undefined && purpose !== null && String(purpose).trim()) {
        body.purpose = normalizePurpose(purpose);
      }
      return this._request('/api/auth/request-otp', {
        method: 'POST', auth: false, body
      });
    }

    /** Public endpoint: exchange the SMS code for a short-lived purpose token. */
    verifyOtp(phone, code, purpose) {
      const body = { phone: normalizePhone(phone), code: normalizeCode(code) };
      if (purpose !== undefined && purpose !== null && String(purpose).trim()) {
        body.purpose = normalizePurpose(purpose);
      }
      return this._request('/api/auth/verify-otp', {
        method: 'POST', auth: false, body
      });
    }

    completeSignup(token, password, displayName) {
      const body = { token: String(token == null ? '' : token).trim(), password: normalizePassword(password) };
      if (displayName !== undefined && displayName !== null && String(displayName).trim()) {
        body.displayName = String(displayName).trim();
      }
      if (!body.token) throw new Error('The signup code is missing. Request a new SMS code.');
      return this._request('/api/auth/complete-signup', { method: 'POST', auth: false, body });
    }

    login(phone, password) {
      return this._request('/api/auth/login', {
        method: 'POST', auth: false,
        body: { phone: normalizePhone(phone), password: normalizePassword(password) }
      });
    }

    resetPassword(token, password) {
      const value = String(token == null ? '' : token).trim();
      if (!value) throw new Error('The reset code is missing. Request a new SMS code.');
      return this._request('/api/auth/reset-password', {
        method: 'POST', auth: false,
        body: { token: value, password: normalizePassword(password) }
      });
    }

    changePassword(currentPassword, newPassword) {
      return this._request('/api/auth/change-password', {
        method: 'POST',
        body: {
          currentPassword: String(currentPassword == null ? '' : currentPassword),
          newPassword: normalizePassword(newPassword)
        }
      });
    }

    /** Remove every synced row belonging to the signed-in account. */
    deleteAccountData() {
      return this._request('/api/account/clear-data', { method: 'POST', body: {} });
    }

    /** Update first/last name, field and grade for the signed-in account. */
    updateProfile(profile) {
      const p = profile && typeof profile === 'object' ? profile : {};
      return this._request('/api/account/profile', {
        method: 'PUT',
        body: {
          firstName: String(p.firstName == null ? '' : p.firstName),
          lastName: String(p.lastName == null ? '' : p.lastName),
          field: String(p.field == null ? '' : p.field),
          grade: String(p.grade == null ? '' : p.grade),
        },
      });
    }

    /** Admin only: list users for account management. */
    listUsers(limit) {
      const query = Number.isFinite(Number(limit)) ? `?limit=${encodeURIComponent(String(limit))}` : '';
      return this._request(`/api/admin/users${query}`);
    }

    createUser(phone, password, options) {
      const opts = options || {};
      const body = { phone: normalizePhone(phone), password: normalizePassword(password) };
      if (opts.role) body.role = String(opts.role).trim();
      if (opts.displayName) body.displayName = String(opts.displayName).trim();
      return this._request('/api/admin/users', { method: 'POST', body });
    }

    resetUserPassword(phone, password) {
      return this._request('/api/admin/users/reset-password', {
        method: 'POST',
        body: { phone: normalizePhone(phone), password: normalizePassword(password) }
      });
    }

    me() {
      return this._request('/api/me', { method: 'GET' });
    }

    snapshot(options) {
      const opts = options || {};
      const rawLimit = Number(opts.limit);
      const limit = rawLimit > 0 ? Math.min(5000, Math.floor(rawLimit)) : DEFAULT_SNAPSHOT_LIMIT;
      return this._request('/api/snapshot', {
        method: 'GET',
        query: { since: opts.since == null ? '' : String(opts.since), limit }
      });
    }

    sendChanges(changes) {
      const payload = (Array.isArray(changes) ? changes : []).map(normalizeChange);
      if (!payload.length) return Promise.resolve({ changes: [] });
      return this._request('/api/changes', { method: 'POST', body: { changes: payload } });
    }

    inviteAdvisor() {
      return this._request('/api/advisors/invite', { method: 'POST', body: {} });
    }

    acceptAdvisor(code) {
      const value = String(code == null ? '' : code).trim();
      if (!value) throw new Error('Invalid advisor code. Enter the code shared by your advisor.');
      return this._request('/api/advisors/accept', { method: 'POST', body: { code: value } });
    }

    advisorLinks() {
      return this._request('/api/advisors/links', { method: 'GET' });
    }

    assignStudent(advisorPhone, studentPhone) {
      return this._request('/api/admin/advisor-links', {
        method: 'POST',
        body: {
          advisor: normalizePhone(advisorPhone),
          student: normalizePhone(studentPhone)
        }
      });
    }

    _socketUrl(token) {
      const wsBase = this.baseUrl
        .replace(/^http:\/\//i, 'ws://')
        .replace(/^https:\/\//i, 'wss://');
      return wsBase + '/api/ws?token=' + encodeURIComponent(token);
    }

    async connect() {
      if (this.socket || this.reconnectTimer) return;
      const token = await this._token(true);
      this.closedByUser = false;
      this._openSocket(token);
    }

    _openSocket(token) {
      if (typeof WebSocket === 'undefined') {
        throw new Error('WebSocket is unavailable in this browser. Live updates are disabled.');
      }
      const socket = new WebSocket(this._socketUrl(token));
      this.socket = socket;
      const generation = this.generation;

      socket.onopen = () => {
        if (generation !== this.generation) return;
        this.reconnectAttempt = 0;
      };
      socket.onmessage = (message) => {
        if (generation !== this.generation) return;
        const event = normalizeEvent(message && message.data);
        if (!event) return;
        try { this.onEvent(event); }
        catch (error) { console.warn('[SQL API] change event handler failed:', error); }
      };
      socket.onerror = () => {
        if (generation !== this.generation) return;
        /* Closing here makes onclose the single reconnect path. */
        try { socket.close(); } catch (_) {}
      };
      socket.onclose = () => {
        if (generation !== this.generation || this.closedByUser) return;
        this.socket = null;
        this._scheduleReconnect(token);
      };
    }

    /* Reconnect with exponential backoff and a cap; a failed hint never
       loses changes because the caller falls back to a full snapshot. */
    _scheduleReconnect(token) {
      const attempt = this.reconnectAttempt++;
      const delay = Math.min(MAX_RECONNECT_DELAY_MS, BASE_RECONNECT_DELAY_MS * Math.pow(2, attempt));
      if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
      this.reconnectTimer = setTimeout(() => {
        this.reconnectTimer = null;
        if (this.closedByUser) return;
        try { this._openSocket(token); }
        catch (_) { this._scheduleReconnect(token); }
      }, delay);
    }

    disconnect() {
      this.closedByUser = true;
      this.generation++;
      if (this.reconnectTimer) {
        clearTimeout(this.reconnectTimer);
        this.reconnectTimer = null;
      }
      const socket = this.socket;
      this.socket = null;
      if (socket) {
        try {
          socket.onopen = null;
          socket.onmessage = null;
          socket.onerror = null;
          socket.onclose = null;
          socket.close();
        } catch (_) {}
      }
    }
  }

  return {
    SQL_TABLES,
    MasirSqlClient,
    localStoreForTable,
    tableForLocalStore,
    toTypedRow,
    fromTypedRow,
    normalizeChange,
    normalizeEvent
  };
});
