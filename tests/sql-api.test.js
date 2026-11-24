'use strict';
/* Tests for the browser SQL adapter groundwork.
   Run: node tests/sql-api.test.js
   The adapter is browser-oriented, so the source is loaded into a small vm
   sandbox with fetch/WebSocket/timer stubs; no network or DOM is required. */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const SOURCE = fs.readFileSync(path.join(ROOT, 'js/13-sql-api.js'), 'utf8');
const INDEX = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const ORDER_TABLES = ['subjects', 'sessions', 'activities', 'classes', 'sleeps',
  'phones', 'exams', 'questions', 'app_meta'];

function harness(options) {
  const opts = options || {};
  const calls = [];
  const sockets = [];
  const events = [];
  const timers = [];
  let timerId = 0;
  let responseFor = opts.response || (() => JSON.stringify({ ok: true }));

  const fakeFetch = async (url, init) => {
    calls.push({ url, init });
    if (opts.fetchHook) return opts.fetchHook(url, init);
    return { ok: true, status: 200, text: async () => responseFor(url, init) };
  };
  class FakeAbortController {
    constructor() {
      const self = this;
      this.signal = {
        aborted: false,
        addEventListener(type, listener) {
          if (type === 'abort' && !self.signal.aborted) self.listener = listener;
        }
      };
    }
    abort() {
      this.signal.aborted = true;
      if (this.listener) this.listener();
    }
  }
  class FakeWebSocket {
    constructor(url) {
      this.url = url;
      this.readyState = 0;
      sockets.push(this);
    }
    send(payload) { this.sent = (this.sent || []).concat(payload); }
    close() { this.readyState = 3; }
    emit(type, payload) {
      if (type === 'close') this.readyState = 3;
      if (typeof this['on' + type] === 'function') this['on' + type]({ data: payload });
    }
  }
  const forbiddenStorage = {
    getItem() { throw new Error('storage read is not allowed in the SQL adapter'); },
    setItem() { throw new Error('storage write is not allowed in the SQL adapter'); },
    removeItem() { throw new Error('storage remove is not allowed in the SQL adapter'); },
    clear() { throw new Error('storage clear is not allowed in the SQL adapter'); }
  };
  const sandbox = {
    window: {},
    fetch: fakeFetch,
    WebSocket: FakeWebSocket,
    AbortController: FakeAbortController,
    localStorage: forbiddenStorage,
    sessionStorage: forbiddenStorage,
    console,
    setTimeout(fn, ms) {
      const id = ++timerId;
      timers.push({ id, fn, ms, cleared: false });
      return id;
    },
    clearTimeout(id) {
      const timer = timers.find((entry) => entry.id === id);
      if (timer) timer.cleared = true;
    }
  };
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(SOURCE, sandbox);
  const api = sandbox.window.MasirSqlApi;
  const client = new api.MasirSqlClient({
    baseUrl: 'https://sql.example.test/',
    getToken: opts.getToken || (() => 'test-token'),
    onEvent: (event) => events.push(event)
  });
  return {
    api, client, calls, sockets, events, timers,
    fireTimer(predicate) {
      const timer = timers.filter((entry) => !entry.cleared && predicate(entry)).pop();
      assert.ok(timer, 'expected a pending timer');
      timer.cleared = true;
      timer.fn();
    }
  };
}

const results = [];
const tests = [];
function test(name, fn) { tests.push({ name, fn }); }

test('TRANSPORT: SQL adapter is the single active transport', () => {
  const h = harness();
  assert.ok(h.api && typeof h.api.MasirSqlClient === 'function');
  assert.ok(/window\.MasirSqlApi/.test(SOURCE));
  assert.ok(!/cdn|jsdelivr|unpkg/i.test(SOURCE), 'adapter must not load external runtime scripts');
  assert.ok(INDEX.includes('<script src="js/13-sql-api.js"></script>'), 'adapter is available to the source app');
  assert.ok(INDEX.includes('<script src="js/00-localstate.js"></script>'), 'local state helper is available to the source app');
  ['requestOtp', 'verifyOtp', 'login', 'completeSignup', 'resetPassword',
    'changePassword', 'createUser', 'resetUserPassword', 'me', 'snapshot',
    'sendChanges', 'inviteAdvisor', 'acceptAdvisor', 'advisorLinks',
    'assignStudent', 'connect', 'disconnect']
    .forEach((name) => assert.strictEqual(typeof h.client[name], 'function', name));
});

test('MAPPING: typed tables and local stores are complete and unique', () => {
  const h = harness();
  const expected = ['subjects', 'sessions', 'activities', 'classes', 'sleeps',
    'phones', 'exams', 'questions', 'app_meta', 'tracker', 'timer'];
  assert.deepStrictEqual(Array.from(h.api.SQL_TABLES).slice().sort(), expected.slice().sort());
  const stores = h.api.SQL_TABLES.map((table) => h.api.localStoreForTable(table));
  assert.strictEqual(new Set(stores).size, stores.length, 'store names must be unique');
  stores.forEach((store, index) => {
    assert.ok(store, 'every table needs a store name');
    assert.strictEqual(h.api.tableForLocalStore(store), h.api.SQL_TABLES[index]);
  });
  assert.strictEqual(h.api.localStoreForTable('app_meta'), 'app-meta');
  assert.strictEqual(h.api.tableForLocalStore('app-meta'), 'app_meta');
  assert.strictEqual(h.api.localStoreForTable('not-a-table'), '');
  assert.strictEqual(h.api.tableForLocalStore('not-a-store'), '');
});

test('CONVERTERS: question note/text survive and tracker coef stays 1/3', () => {
  const h = harness();
  const { toTypedRow, fromTypedRow } = h.api;
  const question = {
    id: 'q1', examId: 'e1', number: 3, subject: 'ریاضی', topic: 'احتمال',
    status: 'wrong', note: 'نکته', questionText: 'صورت سوال',
    answerText: 'جواب سوال', options: ['الف', 'ب'], tags: ['t1'],
    starred: true, figureRef: 'fig-1', noteHidden: true, ts: 1234,
    legacyJunk: 'must be ignored'
  };
  const typed = toTypedRow('questions', question);
  assert.strictEqual(typed.note, 'نکته');
  assert.strictEqual(typed.question_text, 'صورت سوال');
  assert.strictEqual(typed.answer_text, 'جواب سوال');
  assert.strictEqual(typed.exam_id, 'e1');
  assert.strictEqual(typed.figure_ref, 'fig-1');
  assert.strictEqual(typed.note_hidden, true);
  assert.strictEqual(typed.legacyJunk, undefined);
  const local = fromTypedRow('questions', typed);
  assert.strictEqual(local.note, 'نکته');
  assert.strictEqual(local.questionText, 'صورت سوال');
  assert.strictEqual(local.answerText, 'جواب سوال');
  assert.strictEqual(local.examId, 'e1');

  const tracker = toTypedRow('tracker', { correct: 2, wrong: 1, blank: 0, coef: 1, custom: true });
  assert.strictEqual(tracker.coef, 1 / 3, 'legacy custom coef must not survive');
  assert.strictEqual(tracker.custom, undefined);
  assert.strictEqual(fromTypedRow('tracker', tracker).coef, 1 / 3);
});

test('CONVERTERS: every declared field maps in both directions', () => {
  const h = harness();
  const { toTypedRow, fromTypedRow } = h.api;
  const samples = {
    app_meta: { theme: 'dark' },
    subjects: { name: 'ریاضی', color: '#fff', type: 'specialized', field: ['a'], config: { x: 1 } },
    sessions: {
      subject: 'ریاضی', topic: 'جبر', durMin: 60, date: '1404/1/1', startMin: 480,
      done: true, doneAt: 'now', activityId: 'a1', examId: 'e1', ts: 7
    },
    activities: {
      subject: 'ریاضی', topic: 'جبر', minutes: 30, date: '1404/1/1',
      startMin: 480, endMin: 510, note: 'n'
    },
    classes: { subject: 'ریاضی', total: 10, sessions: 4 },
    sleeps: { date: '1404/1/1', endDate: '1404/1/2', startMin: 0, endMin: 480, nap: false },
    phones: { date: '1404/1/1', startMin: 600, endMin: 630, subject: 'فیزیک', note: 'n' },
    exams: {
      name: 'آزمون', date: '1404/1/1', hasResults: true, totalTaraz: 700,
      subjects: ['ریاضی'], questionsCount: 25
    },
    questions: {
      examId: 'e1', number: 1, subject: 'ریاضی', topic: 'جبر', status: 'correct',
      note: 'n', questionText: 'q', answerText: 'a', options: ['1'], tags: ['t'],
      starred: false, figureRef: 'f', noteHidden: false, ts: 9
    },
    tracker: { correct: 1, wrong: 2, blank: 3, coef: 1 / 3 },
    timer: { running: true, startedAt: 1000, elapsedMs: 2000, mode: 'study' }
  };
  const typedNames = {
    app_meta: ['value'], subjects: ['name', 'color', 'type', 'field', 'config'],
    sessions: ['subject', 'topic', 'dur_min', 'date', 'start_min', 'done', 'done_at', 'activity_id', 'exam_id', 'ts'],
    activities: ['subject', 'topic', 'minutes', 'date', 'start_min', 'end_min', 'note'],
    classes: ['subject', 'total', 'sessions'],
    sleeps: ['date', 'end_date', 'start_min', 'end_min', 'nap'],
    phones: ['date', 'start_min', 'end_min', 'subject', 'note'],
    exams: ['name', 'date', 'has_results', 'total_taraz', 'subjects', 'questions_count'],
    questions: ['exam_id', 'number', 'subject', 'topic', 'status', 'note', 'question_text', 'answer_text',
      'options', 'tags', 'starred', 'figure_ref', 'note_hidden', 'ts'],
    tracker: ['correct', 'wrong', 'blank', 'coef'],
    timer: ['running', 'started_at', 'elapsed_ms', 'mode']
  };
  /* Local row order is a first-class typed field on every non-singleton table. */
  ORDER_TABLES.forEach((store) => typedNames[store].push('local_order'));
  Object.keys(samples).forEach((store) => {
    const input = { id: 'r1', value: samples[store], junk: true };
    if (ORDER_TABLES.includes(store)) input.localOrder = 7;
    const typed = toTypedRow(store, input);
    const roundTrip = fromTypedRow(h.api.localStoreForTable(store), typed);
    /* app_meta is stored locally as { value: <payload> }; every other store
       keeps the payload fields directly on the normalized record. */
    const expectedLocal = store === 'app_meta' ? { value: samples[store] } : samples[store];
    typedNames[store].forEach((column) => {
      assert.ok(Object.prototype.hasOwnProperty.call(typed, column), store + '.' + column);
    });
    assert.strictEqual(typed.junk, undefined, store + ' must drop unknown fields');
    Object.keys(expectedLocal).forEach((key) => {
      assert.deepStrictEqual(roundTrip[key], expectedLocal[key], store + '.' + key);
    });
  });
});

test('ORDER: local order maps through localOrder to typed local_order', () => {
  const h = harness();
  ORDER_TABLES.forEach((store) => {
    const typed = h.api.toTypedRow(store, { id: 'r1', order: 4, localOrder: 4 });
    assert.strictEqual(typed.local_order, 4, store + ' must persist local_order');
    const local = h.api.fromTypedRow(h.api.localStoreForTable(store), typed);
    assert.ok(local.localOrder === 4 || local.order === 4, store + ' must restore local order');
  });
});

test('SAFETY: adapter never reads or writes browser storage', () => {
  assert.ok(!/\blocalStorage\b/.test(SOURCE), 'localStorage call found in adapter');
  assert.ok(!/\bsessionStorage\b/.test(SOURCE), 'sessionStorage call found in adapter');
  const h = harness();
  return h.client.me().then((result) => {
    assert.ok(result && result.ok, 'me() must work without touching storage');
  });
});

test('HTTP: Bearer token, JSON headers and OTP/snapshot/changes endpoints', async () => {
  const h = harness({ response: () => JSON.stringify({ ok: true, token: 'server-token' }) });
  await h.client.requestOtp('09123456789');
  await h.client.verifyOtp('09123456789', '1234');
  await h.client.me();
  await h.client.snapshot({ since: '2026-01-01T00:00:00Z', limit: 25 });
  await h.client.sendChanges([{
    store: 'questions', id: 'q1', op: 'upsert', updated: '2026-01-02T00:00:00Z',
    data: { note: 'نکته', questionText: 'q', answerText: 'a', legacyJunk: 1 }
  }]);

  const paths = h.calls.map((call) => call.url);
  assert.deepStrictEqual(paths, [
    'https://sql.example.test/api/auth/request-otp',
    'https://sql.example.test/api/auth/verify-otp',
    'https://sql.example.test/api/me',
    'https://sql.example.test/api/snapshot?since=2026-01-01T00%3A00%3A00Z&limit=25',
    'https://sql.example.test/api/changes'
  ]);
  h.calls.forEach((call) => {
    assert.strictEqual(call.init.headers.Authorization, 'Bearer test-token');
    assert.strictEqual(call.init.headers['Content-Type'], 'application/json');
    assert.ok(call.init.signal, 'each request needs an abort signal for timeouts');
  });
  const otpRequest = JSON.parse(h.calls[0].init.body);
  const otpVerify = JSON.parse(h.calls[1].init.body);
  assert.strictEqual(otpRequest.phone, '09123456789');
  assert.strictEqual(otpVerify.phone, '09123456789');
  assert.strictEqual(otpVerify.code, '1234');
  /* Purpose is optional in the browser adapter; the server defaults to signup. */
  if ('purpose' in otpRequest) assert.ok(['signup', 'reset'].includes(otpRequest.purpose));
  if ('purpose' in otpVerify) assert.ok(['signup', 'reset'].includes(otpVerify.purpose));
  const sent = JSON.parse(h.calls[4].init.body).changes[0];
  assert.strictEqual(sent.table, 'questions');
  assert.strictEqual(sent.updated, '2026-01-02T00:00:00Z');
  assert.strictEqual(sent.data.question_text, 'q');
  assert.strictEqual(sent.data.legacyJunk, undefined);
});

test('HTTP: advisor and admin endpoints use the agreed paths', async () => {
  const h = harness();
  await h.client.inviteAdvisor();
  await h.client.acceptAdvisor('ABC-123');
  await h.client.advisorLinks();
  await h.client.assignStudent('09123456789', '09123456780');
  assert.deepStrictEqual(h.calls.map((call) => call.url.replace('https://sql.example.test', '')), [
    '/api/advisors/invite',
    '/api/advisors/accept',
    '/api/advisors/links',
    '/api/admin/advisor-links'
  ]);
  assert.strictEqual(h.calls[3].init.headers.Authorization, 'Bearer test-token');
  assert.deepStrictEqual(JSON.parse(h.calls[3].init.body), {
    advisor: '09123456789', student: '09123456780'
  });
});

test('HTTP: server errors and timeouts produce clear English messages', async () => {
  const denied = harness({
    fetchHook: async () => ({ ok: false, status: 401, text: async () => JSON.stringify({ message: 'expired' }) })
  });
  await assert.rejects(() => denied.client.me(), (error) => {
    assert.strictEqual(error.status, 401);
    assert.ok(/Not signed in \(HTTP 401\)/.test(error.message));
    assert.ok(/expired/.test(error.message));
    return true;
  });

  const stalled = harness({
    fetchHook: (url, init) => new Promise((resolve, reject) => {
      init.signal.addEventListener('abort', () => {
        const error = new Error('aborted');
        error.name = 'AbortError';
        reject(error);
      });
    })
  });
  const pending = stalled.client.me().then(() => null, (error) => error);
  await new Promise((resolve) => setImmediate(resolve));
  stalled.fireTimer((timer) => timer.ms === 15000);
  const timedOut = await pending;
  assert.ok(timedOut && /timed out after 15000 ms/.test(timedOut.message));
});

test('WEBSOCKET: /api/ws token, change events and exponential reconnect', async () => {
  const h = harness();
  await h.client.connect();
  assert.strictEqual(h.sockets.length, 1);
  assert.strictEqual(h.sockets[0].url, 'wss://sql.example.test/api/ws?token=test-token');

  h.sockets[0].emit('message', JSON.stringify({
    table: 'questions', id: 'q1', op: 'upsert', updated: 't1',
    data: { note: 'نکته' }, unrelated: 'ignored'
  }));
  assert.deepStrictEqual(JSON.parse(JSON.stringify(h.events[0])), {
    table: 'questions', id: 'q1', op: 'upsert', updated: 't1', data: { note: 'نکته' }
  });

  h.sockets[0].emit('close');
  const firstBackoff = h.timers.filter((timer) => !timer.cleared && timer.ms < 5000).pop();
  assert.ok(firstBackoff && firstBackoff.ms >= 500, 'reconnect must use a backoff delay');
  h.fireTimer((timer) => timer.ms < 5000);
  assert.strictEqual(h.sockets.length, 2, 'reconnect must open a new socket');

  h.sockets[1].emit('close');
  const secondBackoff = h.timers.filter((timer) => !timer.cleared && timer.ms < 5000).pop();
  assert.ok(secondBackoff && secondBackoff.ms > firstBackoff.ms, 'backoff must grow after repeated drops');
  h.client.disconnect();
  assert.strictEqual(h.client.socket, null);
  assert.strictEqual(h.sockets[1].readyState, 3);
});

(async () => {
  for (const entry of tests) {
    try {
      await entry.fn();
      results.push(`  ✓ ${entry.name}`);
    } catch (error) {
      results.push(`  ✗ ${entry.name}\n      ${error.message}`);
      process.exitCode = 1;
    }
  }
  console.log('SQL API — browser groundwork checks');
  console.log(results.join('\n'));
  console.log(process.exitCode ? 'FAILED' : 'ALL PASSED');
})();
