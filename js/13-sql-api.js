'use strict';

/* ============================================================
   MASIR PocketBase-native API (no custom server hooks required).
   - Uses PocketBase REST API directly from browser fetch.
   - Keeps the method surface used by js/12-sql-sync.js.
   - Designed for PocketBase v0.22+ collections imported via pb_schema_masir_native.json.
   ============================================================ */

(function (factory) {
  const api = factory();
  if (typeof window !== 'undefined' && window) window.MasirSqlApi = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(function () {
  'use strict';

  const DEFAULT_TIMEOUT_MS = 15000;
  const DEFAULT_SNAPSHOT_LIMIT = 500;
  const FIXED_TRACKER_COEF = 1 / 3;

  const SQL_TABLES = Object.freeze([
    'subjects', 'sessions', 'activities', 'classes', 'sleeps', 'phones',
    'exams', 'questions', 'app_meta', 'tracker', 'timer'
  ]);
  const TABLE_TO_STORE = Object.freeze({
    subjects: 'subjects', sessions: 'sessions', activities: 'activities', classes: 'classes',
    sleeps: 'sleeps', phones: 'phones', exams: 'exams', questions: 'questions',
    app_meta: 'app-meta', tracker: 'tracker', timer: 'timer'
  });
  const STORE_TO_TABLE = Object.freeze(SQL_TABLES.reduce((map, table) => { map[TABLE_TO_STORE[table]] = table; return map; }, {}));
  const TABLE_TO_COLLECTION = Object.freeze(SQL_TABLES.reduce((map, table) => { map[table] = 'masir_' + table; return map; }, {}));

  function localStoreForTable(table) { return TABLE_TO_STORE[String(table == null ? '' : table)] || ''; }
  function tableForLocalStore(store) { return STORE_TO_TABLE[String(store == null ? '' : store)] || ''; }

  const FIELD_MAPS = Object.freeze({
    app_meta: Object.freeze({ value: 'value', localOrder: 'local_order' }),
    subjects: Object.freeze({ name: 'name', color: 'color', type: 'type', field: 'field', config: 'config', sessionsCount: 'sessions_count', localOrder: 'local_order' }),
    sessions: Object.freeze({ subject: 'subject', topic: 'topic', durMin: 'dur_min', date: 'date', startMin: 'start_min', done: 'done', doneAt: 'done_at', activityId: 'activity_id', examId: 'exam_id', ts: 'ts', localOrder: 'local_order' }),
    activities: Object.freeze({ subject: 'subject', topic: 'topic', minutes: 'minutes', date: 'date', startMin: 'start_min', endMin: 'end_min', note: 'note', localOrder: 'local_order' }),
    classes: Object.freeze({ subject: 'subject', total: 'total', sessions: 'sessions', localOrder: 'local_order' }),
    sleeps: Object.freeze({ date: 'date', endDate: 'end_date', startMin: 'start_min', endMin: 'end_min', nap: 'nap', localOrder: 'local_order' }),
    phones: Object.freeze({ date: 'date', startMin: 'start_min', endMin: 'end_min', subject: 'subject', note: 'note', localOrder: 'local_order' }),
    exams: Object.freeze({ name: 'name', date: 'date', hasResults: 'has_results', totalTaraz: 'total_taraz', subjects: 'subjects', questionsCount: 'questions_count', localOrder: 'local_order' }),
    questions: Object.freeze({ examId: 'exam_id', number: 'number', subject: 'subject', topic: 'topic', status: 'status', note: 'note', questionText: 'question_text', answerText: 'answer_text', options: 'options', tags: 'tags', starred: 'starred', figureRef: 'figure_ref', noteHidden: 'note_hidden', ts: 'ts', localOrder: 'local_order' }),
    tracker: Object.freeze({ correct: 'correct', wrong: 'wrong', blank: 'blank', coef: 'coef' }),
    timer: Object.freeze({ running: 'running', startedAt: 'started_at', elapsedMs: 'elapsed_ms', mode: 'mode' })
  });

  const PERSIAN_DIGITS = /[?-??-?]/g;
  function englishDigits(value) {
    return String(value).replace(PERSIAN_DIGITS, (digit) => {
      const code = digit.charCodeAt(0);
      return String(code >= 0x06F0 ? code - 0x06F0 : code - 0x0660);
    });
  }
  function normalizePhone(phone) {
    let value = englishDigits(phone == null ? '' : phone).replace(/[\s\-()+]/g, '');
    if (/^09\d{9}$/.test(value)) value = '+98' + value.slice(1);
    if (/^9\d{9}$/.test(value)) value = '+98' + value;
    if (/^98\d{10}$/.test(value)) value = '+' + value;
    if (!/^\+98\d{10}$/.test(value)) throw new Error('????? ?????? ??????? ???. ?????: 09123456789');
    return value;
  }
  function phoneUsername(phone) { return 'u' + normalizePhone(phone).replace(/^\+/, ''); }
  function normalizeCode(code) {
    const value = englishDigits(code == null ? '' : code).trim();
    if (!/^[0-9]{4,8}$/.test(value)) throw new Error('?? ????? ??????? ???.');
    return value;
  }
  function normalizePassword(password) {
    const value = String(password == null ? '' : password);
    if (value.length < 8) throw new Error('??? ???? ???? ????? ? ??????? ????.');
    return value;
  }
  function normalizeBaseUrl(url) {
    const value = String(url == null ? '' : url).trim().replace(/\/+$/, '');
    if (!/^https?:\/\//i.test(value)) throw new Error('???? ???? ??????? ???.');
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
      case 400: message = '??????? ??????? (400).'; break;
      case 401: message = '????? ???? ?????? (401). ?????? ???? ????.'; break;
      case 403: message = '?????? ???? ???? (403).'; break;
      case 404: message = '???? ??? (404).'; break;
      case 409: message = '????? ???? (409).'; break;
      default: message = status >= 500 ? `???? ???? (${status}).` : `??? (${status}).`;
    }
    if (detail && !/[<>]/.test(detail)) message += ' ' + detail;
    return message;
  }
  async function responseError(response) {
    let detail = '';
    try {
      const text = await response.text();
      if (text) {
        try { const parsed = JSON.parse(text); detail = String(parsed.message || parsed.error || '').slice(0, 200); }
        catch (_) { detail = String(text).slice(0, 200); }
      }
    } catch (_) {}
    const error = new Error(statusMessage(response.status, detail));
    error.status = response.status;
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
    if (store === 'app_meta' || store === 'app-meta') return record;
    if (record.value && typeof record.value === 'object' && !Array.isArray(record.value)) return record.value;
    return record;
  }
  function typedTableOf(store) { return tableForLocalStore(store) || String(store == null ? '' : store); }

  function toTypedRow(store, record) {
    const table = typedTableOf(store);
    const out = envelopeOf(record);
    const source = sourceRecord(store, record);
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
  function normalizeChange(change) {
    if (!change || typeof change !== 'object' || Array.isArray(change)) throw new Error('Invalid change.');
    const table = change.table ? String(change.table) : tableForLocalStore(change.store || '');
    if (!SQL_TABLES.includes(table)) throw new Error('Invalid change table.');
    const rawOp = String(change.op || change.operation || 'upsert').toLowerCase();
    const op = rawOp === 'delete' || rawOp === 'remove' ? 'delete' : 'upsert';
    const rawId = change.id !== undefined && change.id !== null ? change.id : change.recordId;
    if (rawId === undefined || rawId === null || String(rawId) === '') throw new Error('Invalid change id.');
    const localUpdated = change.clientUpdated || change.updatedAt || change.changedAt || change.updated;
    const payload = {
      table, id: String(rawId), op,
      clientUpdated: localUpdated ? new Date(localUpdated).toISOString() : new Date().toISOString(),
      updated: change.updated ? String(change.updated) : new Date().toISOString()
    };
    if (op === 'upsert') {
      const source = change.data !== undefined && change.data !== null ? change.data : (change.record !== undefined && change.record !== null ? change.record : change);
      payload.data = toTypedRow(change.store || localStoreForTable(table), source);
    }
    return payload;
  }
  function normalizeEvent(raw) {
    if (!raw) return null;
    let payload = raw;
    if (typeof raw === 'string') { try { payload = JSON.parse(raw); } catch (_) { return null; } }
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return null;
    const table = payload.table ? String(payload.table) : (payload.store ? tableForLocalStore(payload.store) : '');
    if (!SQL_TABLES.includes(table)) return null;
    return { table, id: payload.id == null ? '' : String(payload.id), op: payload.op ? String(payload.op) : 'upsert', updated: payload.updated == null ? '' : String(payload.updated), data: payload.data == null ? null : payload.data };
  }

  class MasirSqlClient {
    constructor(options) {
      const opts = options || {};
      this.baseUrl = normalizeBaseUrl(opts.baseUrl);
      this.getToken = typeof opts.getToken === 'function' ? opts.getToken : () => '';
      this.onEvent = typeof opts.onEvent === 'function' ? opts.onEvent : () => {};
      this.timeoutMs = Number(opts.timeoutMs) > 0 ? Number(opts.timeoutMs) : DEFAULT_TIMEOUT_MS;
      this._auth = null; // {token, record}
      this._lastEventAt = 0;
    }

    async _token(required) {
      let token = '';
      try { token = String((await this.getToken()) == null ? '' : await this.getToken()).trim(); } catch (_) {}
      if (required && !token) throw new Error('No access token. Sign in again to continue.');
      return token;
    }
    _authHeaders(token) {
      const h = { 'Content-Type': 'application/json', 'Accept': 'application/json' };
      if (token) h['Authorization'] = 'Bearer ' + token;
      return h;
    }
    async _request(path, config) {
      const cfg = config || {};
      const token = await this._token(cfg.auth !== false);
      const query = cfg.query ? '?' + encodeQuery(cfg.query) : '';
      const url = this.baseUrl + path + query;
      const controller = new AbortController();
      let timedOut = false;
      const timer = setTimeout(() => { timedOut = true; controller.abort(); }, this.timeoutMs);
      try {
        const init = { method: cfg.method || 'GET', headers: this._authHeaders(token), signal: controller.signal };
        if (cfg.body !== undefined) init.body = JSON.stringify(cfg.body);
        const response = await fetch(url, init);
        if (!response.ok) throw await responseError(response);
        const text = await response.text();
        if (!text) return null;
        try { return JSON.parse(text); } catch (_) { throw new Error('Invalid response from server.'); }
      } catch (error) {
        if (error && error.name === 'AbortError') throw new Error(timedOut ? 'Request timed out.' : 'Request cancelled.');
        throw error;
      } finally { clearTimeout(timer); }
    }

    _pbFilter(parts) { return parts.filter(Boolean).join(' && '); }
    _escape(v) { return String(v == null ? '' : v).replace(/\\/g, '\\\\').replace(/"/g, '\\"'); }

    async _pbList(collection, params) {
      return this._request(`/api/collections/${encodeURIComponent(collection)}/records`, { method: 'GET', query: params || {} });
    }
    async _pbFirst(collection, filter) {
      const res = await this._pbList(collection, { page: 1, perPage: 1, filter, skipTotal: 1 });
      const items = res && Array.isArray(res.items) ? res.items : [];
      return items[0] || null;
    }
    async _pbCreate(collection, body) {
      return this._request(`/api/collections/${encodeURIComponent(collection)}/records`, { method: 'POST', body });
    }
    async _pbUpdate(collection, id, body) {
      return this._request(`/api/collections/${encodeURIComponent(collection)}/records/${encodeURIComponent(id)}`, { method: 'PATCH', body });
    }

    async _resolveUsersCollection() {
      if (this._usersCollection) return this._usersCollection;
      for (const name of ['masir_users', 'users']) {
        try {
          const res = await fetch(this.baseUrl + '/api/collections/' + encodeURIComponent(name) + '/auth-methods', { headers: { 'Accept': 'application/json' } });
          if (res.ok) { this._usersCollection = name; return name; }
        } catch (_) {}
      }
      this._usersCollection = 'masir_users';
      return this._usersCollection;
    }

    async _authRecordByToken(token) {
      const col = await this._resolveUsersCollection();
      const res = await fetch(this.baseUrl + '/api/collections/' + encodeURIComponent(col) + '/auth-refresh', {
        method: 'POST', headers: this._authHeaders(token)
      });
      if (!res.ok) throw await responseError(res);
      return res.json();
    }

    _userFromRecord(record) {
      const r = record || {};
      return {
        id: String(r.id || ''),
        phone: String(r.phone || ''),
        role: String(r.role || 'student'),
        displayName: String(r.display_name || r.name || r.displayName || ''),
        firstName: String(r.first_name || r.firstName || ''),
        lastName: String(r.last_name || r.lastName || ''),
        field: String(r.field || ''),
        grade: String(r.grade || ''),
        createdAt: r.created || null,
      };
    }

    async requestOtp() { throw new Error('OTP ??? ???? PocketBase ?????? ???? ????. ????? ?? ?????/??? ???? ????.'); }
    async verifyOtp() { throw new Error('OTP ??? ???? PocketBase ?????? ???? ????.'); }
    async completeSignup() { throw new Error('??????? OTP ??? ???? PocketBase ?????? ???? ????. ?? ????? PB ?? ????? ????? ??????? ????.'); }
    async resetPassword() { throw new Error('??????? ??? OTP ??? ???? PocketBase ?????? ???? ????.'); }

    async login(phone, password) {
      const p = normalizePhone(phone);
      const pass = normalizePassword(password);
      const identities = [p, phoneUsername(p), englishDigits(phone == null ? '' : phone).replace(/[\s\-()+]/g, '')].filter(Boolean);
      const col = await this._resolveUsersCollection();
      let lastErr;
      for (const identity of [...new Set(identities)]) {
        try {
          const res = await this._request(`/api/collections/${encodeURIComponent(col)}/auth-with-password`, { method: 'POST', auth: false, body: { identity, password: pass } });
          const token = String(res && res.token || '');
          const record = res && res.record || {};
          if (!token || !record.id) throw new Error('???? ?????? ???.');
          this._auth = { token, record };
          return { token, user: this._userFromRecord(record) };
        } catch (e) { lastErr = e; }
      }
      throw lastErr || new Error('???? ?????? ???.');
    }

    async changePassword(currentPassword, newPassword) {
      const token = await this._token(true);
      const auth = await this._authRecordByToken(token);
      const rec = auth && auth.record || auth || {};
      const id = rec.id;
      if (!id) throw new Error('????? ??????? ???.');
      const col = await this._resolveUsersCollection();
      const body = {
        oldPassword: String(currentPassword || ''),
        password: normalizePassword(newPassword),
        passwordConfirm: normalizePassword(newPassword)
      };
      await this._request(`/api/collections/${encodeURIComponent(col)}/records/${encodeURIComponent(id)}`, { method: 'PATCH', body });
      return { ok: true };
    }

    async me() {
      const token = await this._token(true);
      const auth = await this._authRecordByToken(token);
      const rec = auth && auth.record || {};
      this._auth = { token: auth && auth.token ? String(auth.token) : token, record: rec };
      return { user: this._userFromRecord(rec), expiresAt: null };
    }

    async updateProfile(profile) {
      const token = await this._token(true);
      const auth = await this._authRecordByToken(token);
      const rec = auth && auth.record || {};
      const id = rec.id;
      const p = profile && typeof profile === 'object' ? profile : {};
      const body = {
        first_name: String(p.firstName == null ? '' : p.firstName),
        last_name: String(p.lastName == null ? '' : p.lastName),
        field: String(p.field == null ? '' : p.field),
        grade: String(p.grade == null ? '' : p.grade),
      };
      body.display_name = [body.first_name, body.last_name].filter(Boolean).join(' ');
      const col = await this._resolveUsersCollection();
      const updated = await this._request(`/api/collections/${encodeURIComponent(col)}/records/${encodeURIComponent(id)}`, { method: 'PATCH', body });
      return { ok: true, user: this._userFromRecord(updated) };
    }

    async deleteAccountData() {
      const token = await this._token(true);
      const me = await this.me();
      const ownerId = me.user.id;
      const cleared = [];
      for (const table of SQL_TABLES) {
        const collection = TABLE_TO_COLLECTION[table];
        let page = 1; let rows = 0;
        while (true) {
          const res = await this._pbList(collection, { page, perPage: 200, filter: `owner="${this._escape(ownerId)}" && deleted=false`, skipTotal: 1 });
          const items = res && Array.isArray(res.items) ? res.items : [];
          if (!items.length) break;
          for (const rec of items) {
            await this._pbUpdate(collection, rec.id, { deleted: true, updated: new Date().toISOString(), data: { id: rec.local_id, deleted: true } });
            rows++;
          }
          if (items.length < 200) break;
          page++;
        }
        if (rows) cleared.push({ table, rows });
      }
      return { ok: true, cleared };
    }

    async listUsers() { return { users: [] }; }
    async createUser() { throw new Error('???? ????? ?? ???? PB ?????? ?? ??? ????? PocketBase ????? ???.'); }
    async resetUserPassword() { throw new Error('???? ??? ?? ???? PB ?????? ?? ??? ????? PocketBase ????? ???.'); }
    async inviteAdvisor() { throw new Error('???? ????? ?? ???? PB ?????? ???? ????.'); }
    async acceptAdvisor() { throw new Error('???? ????? ?? ???? PB ?????? ???? ????.'); }
    async advisorLinks() { return { links: [] }; }
    async assignStudent() { throw new Error('?????? ????? ?? ???? PB ?????? ???? ????.'); }

    connect() { return Promise.resolve(); }
    disconnect() {}

    async snapshot(options) {
      const opts = options || {};
      const rawLimit = Number(opts.limit);
      const limit = rawLimit > 0 ? Math.min(5000, Math.floor(rawLimit)) : DEFAULT_SNAPSHOT_LIMIT;
      const since = String(opts.since || opts.cursor || '').trim();
      const me = await this.me();
      const ownerId = me.user.id;
      const changes = [];
      for (const table of SQL_TABLES) {
        const collection = TABLE_TO_COLLECTION[table];
        let page = 1;
        while (true) {
          const filterParts = [`owner="${this._escape(ownerId)}"`];
          if (since) filterParts.push(`updated>"${this._escape(since)}"`);
          const res = await this._pbList(collection, {
            page, perPage: 200, skipTotal: 1, sort: 'updated',
            filter: filterParts.join(' && ')
          });
          const items = res && Array.isArray(res.items) ? res.items : [];
          for (const rec of items) {
            const updated = String(rec.updated || rec.created || new Date().toISOString());
            changes.push({
              table,
              id: String(rec.local_id || rec.id || ''),
              op: rec.deleted ? 'delete' : 'upsert',
              updated,
              data: this._rowToData(table, rec)
            });
          }
          if (items.length < 200) break;
          page++;
          if (changes.length >= limit * 4) break;
        }
      }
      changes.sort((a,b)=> String(a.updated).localeCompare(String(b.updated)) || String(a.table).localeCompare(String(b.table)) || String(a.id).localeCompare(String(b.id)));
      const sliced = changes.slice(0, limit);
      const body = { serverTime: new Date().toISOString(), changes: sliced };
      if (changes.length > limit) body.nextCursor = sliced[sliced.length - 1].updated;
      return body;
    }

    _rowToData(table, rec) {
      const localId = String(rec.local_id || rec.id || '');
      const updated = String(rec.updated || rec.created || new Date().toISOString());
      if (rec.deleted) return { id: localId, updated, deleted: true };
      if (rec.data && typeof rec.data === 'object' && !Array.isArray(rec.data)) {
        return Object.assign({ id: localId, updated }, rec.data);
      }
      const out = { id: localId, updated };
      const fields = FIELD_MAPS[table] || {};
      Object.keys(fields).forEach((localKey) => {
        const col = fields[localKey];
        if (rec[col] !== undefined && rec[col] !== null && rec[col] !== '') out[localKey] = rec[col];
        if (rec[localKey] !== undefined && out[localKey] === undefined) out[localKey] = rec[localKey];
      });
      if (table === 'tracker') out.coef = FIXED_TRACKER_COEF;
      return out;
    }

    async sendChanges(changes) {
      const payload = (Array.isArray(changes) ? changes : []).map(normalizeChange);
      if (!payload.length) return { applied: [], conflicts: [] };
      const me = await this.me();
      const ownerId = me.user.id;
      const applied = [];
      const conflicts = [];
      for (const ch of payload) {
        try {
          const res = await this._applyChange(ownerId, ch);
          if (res.applied) applied.push(ch.id);
          if (res.conflict) conflicts.push({ id: ch.id, table: ch.table, serverUpdated: res.serverUpdated || null });
        } catch (e) {
          conflicts.push({ id: ch.id, table: ch.table, error: 'rejected' });
        }
      }
      return { applied, conflicts };
    }

    async _applyChange(ownerId, ch) {
      const collection = TABLE_TO_COLLECTION[ch.table];
      const filter = `owner="${this._escape(ownerId)}" && local_id="${this._escape(ch.id)}"`;
      const existing = await this._pbFirst(collection, filter);
      if (existing) {
        const existingUpdated = new Date(existing.updated || existing.created || 0).toISOString();
        const clientUpdated = new Date(ch.clientUpdated || ch.updated || 0).toISOString();
        if (clientUpdated < existingUpdated) {
          return { conflict: true, serverUpdated: existingUpdated };
        }
      }
      const body = this._bodyForChange(ownerId, ch);
      if (existing) await this._pbUpdate(collection, existing.id, body);
      else await this._pbCreate(collection, body);
      return { applied: true };
    }

    _bodyForChange(ownerId, ch) {
      const data = ch.op === 'delete' ? { id: ch.id, deleted: true } : Object.assign({ id: ch.id }, ch.data || {});
      const body = {
        owner: ownerId,
        local_id: ch.id,
        deleted: ch.op === 'delete',
        updated: new Date().toISOString(),
        data
      };
      const fields = FIELD_MAPS[ch.table] || {};
      Object.keys(fields).forEach((localKey) => {
        const col = fields[localKey];
        if (ch.data && Object.prototype.hasOwnProperty.call(ch.data, col)) body[col] = ch.data[col];
        if (ch.data && Object.prototype.hasOwnProperty.call(ch.data, localKey)) body[col] = ch.data[localKey];
      });
      if (ch.table === 'tracker') body.coef = FIXED_TRACKER_COEF;
      return body;
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
