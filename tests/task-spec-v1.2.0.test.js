'use strict';
/* Tests for TASK SPEC v1.2.0 — EXAM SECTION + TIMELINE.
   Run: node tests/task-spec-v1.2.0.test.js
   The app is browser-oriented, so pure functions are extracted from source and
   evaluated in a small vm sandbox; no DOM or network is required. */

const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

function extractFunction(source, name) {
  const match = new RegExp(`(?:function|const|let|var)\\s+${name}\\s*(?:=\\s*)?\\(`).exec(source);
  if (!match) throw new Error(`function ${name} not found`);
  /* Skip the parameter list so default values such as `metadata={}` are not
     mistaken for the start of the function body. */
  const parenStart = source.indexOf('(', match.index);
  let parenDepth = 0;
  let parenEnd = -1;
  for (let i = parenStart; i < source.length; i++) {
    if (source[i] === '(') parenDepth++;
    else if (source[i] === ')') {
      parenDepth--;
      if (parenDepth === 0) { parenEnd = i; break; }
    }
  }
  const open = source.indexOf('{', parenEnd + 1);
  if (open < 0) throw new Error(`body of ${name} not found`);
  let depth = 0;
  for (let i = open; i < source.length; i++) {
    if (source[i] === '{') depth++;
    else if (source[i] === '}') {
      depth--;
      if (depth === 0) return source.slice(match.index, i + 1);
    }
  }
  throw new Error(`unterminated function ${name}`);
}

function loadFunctions(file, names, sandboxGlobals) {
  const source = read(file);
  const sandbox = Object.assign({
    Math, JSON, Set, Map, Number, String, Array, Object, Date,
    fa: (n) => String(n), esc: (s) => String(s == null ? '' : s),
    getErr: () => null, errColor: () => '#fff', subjColor: () => '#fff',
    qStatus: (q) => (['correct', 'wrong', 'blank', 'pending'].includes(q && q.status) ? q.status : 'pending'),
    topicGrade: () => '',
    FA_DIGITS_MAP: '۰۱۲۳۴۵۶۷۸۹',
    EN_DIGIT_RE: /[0-9]/g,
    FA_DIGIT_RE: /[۰-۹]/g,
    ANY_LOCAL_DIGIT_RE: /[۰-۹٠-٩]/g
  }, sandboxGlobals || {});
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  names.forEach((name) => vm.runInContext(extractFunction(source, name), sandbox));
  return sandbox;
}

const results = [];
function test(name, fn) {
  try { fn(); results.push(`  ✓ ${name}`); }
  catch (error) { results.push(`  ✗ ${name}\n      ${error.message}`); process.exitCode = 1; }
}

/* ---------- BUGFIX-1: timeline block layout ---------- */
const timeline = loadFunctions('js/03-plan.js', ['timelineBlockRange', 'layoutTimelineBlocks']);
const { layoutTimelineBlocks } = timeline;

test('BUGFIX-1: 3 chained 30min tasks touch without overlapping', () => {
  const blocks = [
    { id: 'a', startMin: 480, endMin: 510 },
    { id: 'b', startMin: 510, endMin: 540 },
    { id: 'c', startMin: 540, endMin: 570 }
  ];
  const out = layoutTimelineBlocks(blocks, 600, { minWidth: 32, minGap: 4 });
  assert.strictEqual(out.blocks.length, 3);
  assert.deepStrictEqual(Array.from(out.blocks.map(b => b.id)), ['a', 'b', 'c']);
  for (let i = 1; i < out.blocks.length; i++) {
    const prev = out.blocks[i - 1];
    const cur = out.blocks[i];
    assert.strictEqual(cur.left, prev.left + prev.width, 'chained blocks must share an edge');
  }
});

test('BUGFIX-1: unsorted input is sorted by startMin', () => {
  const out = layoutTimelineBlocks([
    { id: 'c', startMin: 540, endMin: 570 },
    { id: 'a', startMin: 480, endMin: 510 },
    { id: 'b', startMin: 510, endMin: 540 }
  ], 600);
  assert.deepStrictEqual(Array.from(out.blocks.map(b => b.id)), ['a', 'b', 'c']);
});

test('BUGFIX-1: 5 consecutive 08:00-12:00 tasks stay readable', () => {
  const blocks = Array.from({ length: 5 }, (_, i) => ({
    id: `t${i}`, startMin: 480 + i * 48, endMin: 480 + (i + 1) * 48
  }));
  const out = layoutTimelineBlocks(blocks, 900, { minWidth: 32, minGap: 4 });
  assert.strictEqual(out.blocks.length, 5);
  out.blocks.forEach(b => assert.ok(b.width >= 32, `width ${b.width} below minimum`));
  for (let i = 1; i < out.blocks.length; i++) {
    assert.ok(out.blocks[i].left >= out.blocks[i - 1].left + out.blocks[i - 1].width);
  }
});

test('BUGFIX-1: a 5 minute gap renders as visible space', () => {
  const out = layoutTimelineBlocks([
    { id: 'a', startMin: 480, endMin: 540 },
    { id: 'b', startMin: 545, endMin: 600 }
  ], 960, { minWidth: 32, minGap: 4, startMin: 480, endMin: 1200 });
  const gap = out.blocks[1].left - (out.blocks[0].left + out.blocks[0].width);
  assert.ok(gap > 0, 'gap must be visible');
  assert.ok(Math.abs(gap - 5 * (960 / 720)) < 1e-6, 'gap must stay proportional');
});

test('BUGFIX-1: overflowing chain is marked scrollable and never overlaps', () => {
  const blocks = Array.from({ length: 40 }, (_, i) => ({
    id: `s${i}`, startMin: 480 + i * 5, endMin: 485 + i * 5
  }));
  const out = layoutTimelineBlocks(blocks, 400, { minWidth: 32, minGap: 4 });
  assert.strictEqual(out.scrollable, true);
  assert.ok(out.contentWidth > 400);
  for (let i = 1; i < out.blocks.length; i++) {
    assert.ok(out.blocks[i].left >= out.blocks[i - 1].left + out.blocks[i - 1].width);
  }
});

const paintedLanes = loadFunctions('js/03-plan.js', ['visualLaneEnd', 'assignLanes'], { PX_PER_MIN: 0.5 });

test('BUGFIX-1: short adjacent blocks use separate lanes instead of overlapping', () => {
  const items = [
    { id: 'a', startMin: 600, endMin: 605, _minH: 8, _inset: 3 },
    { id: 'b', startMin: 605, endMin: 610, _minH: 8, _inset: 3 }
  ];
  assert.ok(paintedLanes.visualLaneEnd(items[0]) > items[0].endMin,
    'a painted short block must extend its lane range');
  const out = paintedLanes.assignLanes(items);
  assert.strictEqual(out.laneCount, 2, 'visually touching short blocks need two lanes');
  assert.notStrictEqual(out.items[0]._lane, out.items[1]._lane);
});

test('BUGFIX-1: timeline and week renderers feed painted heights into lane packing', () => {
  const plan = read('js/03-plan.js');
  assert.ok(/function visualLaneEnd\(item\)/.test(plan), 'painted lane range helper missing');
  assert.ok(/_laneEnd: visualLaneEnd\(it\)/.test(plan), 'assignLanes ignores painted heights');
  assert.ok(/_minH: 6, _inset: 3/.test(plan), 'day sessions need their painted height');
  assert.ok(/_minH: 4, _inset: 2/.test(plan), 'week sessions need their painted height');
});

test('BUGFIX: exam topic edits relabel exam-linked sessions without losing them', () => {
  const state = {
    exams: [{ id: 'e1', topics: { ریاضی: ['جبر'] } }],
    sessions: [
      { id: 's1', examId: 'e1', subject: 'ریاضی', topic: 'احتمال', date: '1400/01/01', startMin: 480, durMin: 60, done: true },
      { id: 's2', examId: 'other', subject: 'ریاضی', topic: 'احتمال', date: '1400/01/02', startMin: 540, durMin: 30, done: false }
    ]
  };
  let reloads = 0;
  const ctx = loadFunctions('js/03-plan.js', ['syncExamSessionsTopics'], {
    state, examSelectedId: 'e1', loadExamTopics: () => { reloads++; }
  });
  assert.strictEqual(ctx.syncExamSessionsTopics('e1'), 1);
  assert.strictEqual(state.sessions[0].topic, 'جبر');
  assert.strictEqual(state.sessions[0].date, '1400/01/01');
  assert.strictEqual(state.sessions[0].startMin, 480);
  assert.strictEqual(state.sessions[0].done, true);
  assert.strictEqual(state.sessions[1].topic, 'احتمال', 'other exams must stay untouched');
  assert.strictEqual(reloads, 1, 'the active exam setup must reload');

  state.exams[0].topics.ریاضی = ['جبر', 'احتمال'];
  state.sessions[0].topic = 'هندسه';
  ctx.syncExamSessionsTopics('e1');
  assert.strictEqual(state.sessions[0].topic, '', 'ambiguous topics clear the stale label instead of deleting the session');
  assert.strictEqual(state.sessions[0].date, '1400/01/01');
});

test('BUGFIX: exam settings save refreshes exam-linked timeline topics', () => {
  const exam = read('js/05-exam.js');
  const start = exam.indexOf("document.getElementById('esSave').onclick");
  const end = exam.indexOf("document.getElementById('esDeleteExam').onclick");
  const save = exam.slice(start, end);
  assert.ok(/exam\.topics=tp/.test(save), 'exam topics save missing');
  assert.ok(/syncExamSessionsTopics\(id\)/.test(save), 'exam-linked sessions must be relabelled on save');
  assert.ok(/renderPlan\(\)/.test(save), 'timeline must re-render after exam topic changes');
});

test('BUGFIX: daily timeline draws three quarter-hour guides per hour', () => {
  const plan = read('js/03-plan.js');
  const css = read('css/07-plan.css');
  assert.ok(plan.includes('<i class="tl-quarter q1"></i><i class="tl-quarter q2"></i><i class="tl-quarter q3"></i>'),
    'daily hour rows need 15/30/45 minute guides');
  assert.ok(/\.tl-quarter\{[\s\S]*?pointer-events:none/.test(css), 'guides must not capture pointer events');
  assert.ok(/\.tl-quarter\.q1\{top:calc\(var\(--row-h,58px\)\*\.25/.test(css));
  assert.ok(/\.tl-quarter\.q2\{top:calc\(var\(--row-h,58px\)\*\.50/.test(css));
  assert.ok(/\.tl-quarter\.q3\{top:calc\(var\(--row-h,58px\)\*\.75/.test(css));
  assert.ok(/const SNAP=15/.test(read('js/01-core.js')), 'snapping must stay on the 15-minute grid');
});

test('BUGFIX: question notes/questions/answers survive sync store rebuilds', () => {
  const core = loadFunctions('js/01-core.js', ['stateFromNormalizedRecords'], {
    DB_STATE_ID: 'main',
    migrateLegacyRecordsToSessions: () => []
  });
  const rebuilt = core.stateFromNormalizedRecords({
    'app-meta': [{ id: 'main', value: {} }],
    exams: [{ id: 'e1', value: { id: 'e1', name: 'آزمون' }, order: 0 }],
    questions: [{
      id: 'e1::q1',
      value: { id: 'q1', note: 'نکته', questionText: 'صورت', answerText: 'جواب' },
      order: 0
    }]
  });
  assert.strictEqual(rebuilt.exams[0].questions.length, 1, 'a question without examId must not be dropped');
  assert.strictEqual(rebuilt.exams[0].questions[0].note, 'نکته');
  assert.strictEqual(rebuilt.exams[0].questions[0].questionText, 'صورت');
  assert.strictEqual(rebuilt.exams[0].questions[0].answerText, 'جواب');

  const coreSource = read('js/01-core.js');
  const sync = read('js/12-sql-sync.js');
  const api = read('js/13-sql-api.js');
  assert.ok(/const NORMALIZED_STORES=.*'questions'\]/.test(coreSource), 'questions must be a normalized store');
  const storeList = /const SYNC_UPLOAD_STORES = Object\.freeze\(\[([^\]]+)\]\)/.exec(sync);
  assert.ok(storeList, 'SYNC_UPLOAD_STORES must be declared and frozen');
  const uploadStores = Array.from(storeList[1].matchAll(/'([^']+)'/g), (m) => m[1]);
  assert.deepStrictEqual(uploadStores, [
    'app-meta', 'subjects', 'activities', 'classes', 'sessions',
    'sleeps', 'phones', 'exams', 'questions'
  ], 'all nine stores, including questions, must be uploaded');
  assert.ok(/localStoreForTable\(table\) \|\| table/.test(sync),
    'downloaded rows must decode through the SQL adapter');
  assert.ok(/questions: 'questions'/.test(api), 'questions must map to the SQL questions table');
  assert.ok(/examId: 'exam_id'/.test(api), 'question rows must carry examId');
  assert.ok(/if \(data\.exam_id\) record\.examId = String\(data\.exam_id\)/.test(sync),
    'downloaded question rows must restore examId');
});

test('BUGFIX: note/question/answer edits are tracked as question sync mutations', () => {
  const core = loadFunctions('js/01-core.js', [
    'rawStorageValue', 'unwrapStorageValue', 'storageFieldSignature', 'changedFieldNames',
    'mergeMutationFields', 'markStorageMutation', 'markStorageDeletion', 'entityIdFor',
    'markArrayReplacement', 'markStorageCollection', 'storageContextForChild',
    'storageMutationRecord', 'trackStorageState', 'takeStorageMutations'
  ], {
    DB_STATE_ID: 'main',
    STORAGE_COLLECTIONS: {
      subjects: 'subjects', activities: 'activities', classes: 'classes',
      sessions: 'sessions', sleeps: 'sleeps', phones: 'phones', exams: 'exams'
    },
    pendingStorageMutations: new Map(),
    storageProxyTargets: new WeakMap()
  });
  const tracked = core.trackStorageState({
    exams: [{ id: 'e1', questions: [{ id: 'q1', note: 'قدیمی', questionText: '', answerText: '' }] }]
  });
  const question = tracked.exams[0].questions[0];
  question.note = 'نکته تازه';
  question.questionText = 'صورت تازه';
  question.answerText = 'جواب تازه';
  const mutations = core.takeStorageMutations();
  const questionMutation = mutations.find((mutation) => mutation.store === 'questions');
  assert.ok(questionMutation, 'editing a question must queue a questions mutation');
  assert.strictEqual(questionMutation.id, 'e1::q1');
  assert.strictEqual(questionMutation.examId, 'e1');
  for (const field of ['note', 'questionText', 'answerText']) {
    assert.ok(questionMutation.fields.includes(field), `${field} must be reported as changed`);
  }
  assert.strictEqual(questionMutation.record().value.note, 'نکته تازه');
  assert.strictEqual(questionMutation.record().value.questionText, 'صورت تازه');
  assert.strictEqual(questionMutation.record().value.answerText, 'جواب تازه');
});

test('RESTORED: image report keeps the compact frame with exact minute blocks', () => {
  const ctx = loadFunctions('js/02-dashboard.js', ['reportTimelineExactLayout', 'reportTimelineItemName']);
  const items = [
    { id: 'a', startMin: 480, endMin: 540 },
    { id: 'b', startMin: 510, endMin: 570 },
    { id: 'c', startMin: 600, endMin: 615 }
  ];
  const out = ctx.reportTimelineExactLayout(items, 960, 0, 1440);
  assert.strictEqual(out.blocks.length, 3);
  assert.strictEqual(out.blocks[0].left, 320, '08:00 stays at one third of the compact axis');
  assert.ok(Math.abs(out.blocks[0].width - 40) < 0.001, 'a 60 minute block is exactly 40px wide');
  assert.strictEqual(out.blocks[1].left, 340, 'overlapping items keep their real x position');
  assert.strictEqual(out.blocks[1]._lane, 1, 'overlaps use lanes instead of shifting blocks');
  assert.strictEqual(out.blocks[2].left, 400, 'gaps stay proportional');
  assert.strictEqual(out.blocks[2]._lane, 0, 'a later non-overlapping item reuses the first lane');
  assert.strictEqual(out.lanes, 2);

  const dashboard = read('js/02-dashboard.js');
  const section = dashboard.slice(dashboard.indexOf('function drawReportTimelineDaySection'),
    dashboard.indexOf('function drawReportTimelineWeekSection'));
  const shortOnly = ctx.reportTimelineExactLayout([{ startMin: 600, endMin: 615 }], 960, 0, 1440);
  assert.strictEqual(shortOnly.blocks[0].width, 10, '15 minutes stays 10px, not widened to fit a label');
  const endOnly = ctx.reportTimelineExactLayout([{ startMin: 1435, endMin: 1440 }], 960, 0, 1440);
  assert.ok(endOnly.blocks[0].left + endOnly.blocks[0].width <= 960, 'the last block stays inside the frame');
  assert.ok(section.includes('reportTimelineExactLayout(allTimelineItems,tlW,START_MIN,END_MIN)'),
    'daily image timeline must use the exact horizontal layout');
  assert.ok(section.includes('tlTop=y0+60,tlH=130') && section.includes('const tickStep=180'),
    'the original compact frame geometry must be restored');
  assert.ok(section.includes('const laneH=Math.max(8,Math.floor((blockH-4)/layout.lanes));'),
    'blocks must fill their lane at normal height');
  assert.ok(!section.includes('Math.min(26') && !section.includes('Math.min(30'),
    'the short compact block-height cap must be gone');
  assert.ok(section.includes('timeLabel') && section.includes('x.fillText(timeLabel'),
    'original blocks show their real start-end range');
  assert.ok(!section.includes('widthScale') && !section.includes('minVisualWidth'),
    'block stretching and minimum-width widening must be gone');
  assert.ok(!dashboard.includes('REPORT_TIMELINE_DAY_HEIGHT') && !dashboard.includes('reportTimelineVerticalLayout'),
    'the temporary vertical rail must be gone');
  assert.ok(dashboard.includes('(isDay?260:'),
    'canvas height must match the restored compact section');

  assert.strictEqual(ctx.reportTimelineItemName({ subject: 'ریاضی' }), 'ریاضی');
  assert.strictEqual(ctx.reportTimelineItemName({ _kind: 'other', subject: 'دیگر', topic: 'سایر' }), 'سایر');
  assert.strictEqual(ctx.reportTimelineItemName({ _kind: 'sleep' }), '🌙 خواب');
  assert.ok(section.includes('reportTimelineItemName(a)'), 'original name labels must be restored');
});

test('REWORK: activity heading is gone and test penalty is fixed at 1/3', () => {
  const html = read('index.html');
  assert.ok(!html.includes('میخوام بخونم — تایمر + شمارنده تست'),
    'the timer/test-counter heading must be removed');
  assert.ok(html.includes('id="timerToggle"') && html.includes('id="trkClear"'),
    'the timer and counter tools themselves stay available');
  assert.ok(!html.includes('id="trkCoef"'), 'the negative-coefficient select must be removed');
  assert.ok(!html.includes('ضریب نمره منفی</label>'), 'the old coefficient label must be removed');
  assert.ok(html.includes('۱/۳ نمره منفی (کنکور)'), 'the fixed Konkur penalty must be shown');

  const stored = { correct: 2, wrong: 1, blank: 0, coef: 1 };
  let written = null;
  const ctx = loadFunctions('js/04-activity.js', ['loadTracker', 'saveTracker'], {
    TRK_STATE_KEY: 'tracker',
    TRK_COEF: 1 / 3,
    trkCounts: { correct: 0, wrong: 0, blank: 0 },
    trkCoef: 1,
    localState: {
      getSync: (key) => (key === 'tracker' ? JSON.stringify(stored) : null),
      setSync: (key, value) => { written = { key, value }; }
    },
    window: {}
  });
  ctx.loadTracker();
  assert.strictEqual(ctx.trkCoef, 1 / 3, 'stored custom coefficients must not override 1/3');
  ctx.saveTracker();
  assert.strictEqual(written.key, 'tracker', 'tracker must go through localState');
  assert.strictEqual(JSON.parse(written.value).coef, 1 / 3, 'saved tracker data must use 1/3');
  assert.deepStrictEqual(JSON.parse(written.value), { correct: 2, wrong: 1, blank: 0, coef: 1 / 3 });

  let timerWritten = null;
  const timerCtx = loadFunctions('js/10-timer.js',
    ['defaultTimerState', 'loadTimerState', 'saveTimerState'], {
      TIMER_STATE_KEY: 'timer',
      localState: {
        getSync: (key) => (key === 'timer' ? JSON.stringify({ mode: 'pomodoro', isRunning: true }) : null),
        setSync: (key, value) => { timerWritten = { key, value }; }
      },
      window: {}
    });
  const loadedTimer = timerCtx.loadTimerState();
  assert.strictEqual(loadedTimer.mode, 'pomodoro');
  assert.strictEqual(loadedTimer.pomWork, 25, 'missing timer fields keep their defaults');
  timerCtx.timerState = loadedTimer;
  timerCtx.saveTimerState();
  assert.strictEqual(timerWritten.key, 'timer', 'timer must go through localState');
  assert.strictEqual(JSON.parse(timerWritten.value).mode, 'pomodoro');

  const activity = read('js/04-activity.js');
  const sync = read('js/12-sql-sync.js');
  assert.ok(activity.includes('const TRK_COEF=1/3;'), 'the app must define one fixed penalty constant');
  assert.ok(!activity.includes('trkCoef=+d.coef') && !activity.includes("getElementById('trkCoef')"),
    'no loader or select can change the penalty');
  assert.ok(!read('js/11-backup.js').includes('trkCoef = +tracker.coef'),
    'backup restore must not bring back a custom penalty');
  assert.ok(sync.includes("trkCoef = (typeof TRK_COEF !== 'undefined' ? TRK_COEF : 1 / 3);"),
    'sync must apply only the fixed penalty from a remote tracker');
  assert.ok(sync.includes("coef: (typeof TRK_COEF !== 'undefined' ? TRK_COEF : 1 / 3)"),
    'tracker uploads must force the fixed coefficient');
  assert.ok(!/trkCoef\s*=\s*\+/.test(sync), 'remote custom coefficients must never be parsed');
  const legacyTrackerKey = 'konkur-' + 'trk-v1';
  const legacyTimerKey = 'konkur-' + 'timer-v1';
  ['js/00-localstate.js', 'js/01-core.js', 'js/04-activity.js',
    'js/10-timer.js', 'js/11-backup.js', 'js/12-sql-sync.js',
    'js/13-sql-api.js', 'js/14-auth-ui.js'].forEach(file => {
      const source = read(file);
      assert.ok(!source.includes(legacyTrackerKey), `${file} must not use the legacy tracker key`);
      assert.ok(!source.includes(legacyTimerKey), `${file} must not use the legacy timer key`);
    });
});

test('FEAT: volume planning shows exact phase slices and no tick marks', () => {
  const ctx = loadFunctions('js/03-plan.js', ['itemTimeRange', 'phaseCellItems']);
  const sessions = [
    { id: 's1', startMin: 480, durMin: 60 },
    { id: 's2', startMin: 600, durMin: 60, activityId: 'a-linked' }
  ];
  const activities = [
    { id: 'a1', date: 'day1', subject: 'ریاضی', startMin: 510, endMin: 540, minutes: 30 },
    { id: 'a-linked', date: 'day1', subject: 'فیزیک', startMin: 600, endMin: 660, minutes: 60 },
    { id: 'a2', date: 'day1', subject: 'شیمی', startMin: 660, endMin: 675, minutes: 15 },
    { id: 'a-other-day', date: 'day2', subject: 'ادبیات', startMin: 510, endMin: 540, minutes: 30 },
    { id: 'a-outside', date: 'day1', subject: 'ادبیات', startMin: 720, endMin: 780, minutes: 60 }
  ];
  const out = ctx.phaseCellItems('day1', sessions, activities, 480, 720);
  assert.strictEqual(out.map(item => item.id).join(','), 's1,a1,s2,a2');
  assert.strictEqual(out[1]._kind, 'activity');
  assert.strictEqual(out[2]._kind, 'session');

  const pillCtx = loadFunctions('js/03-plan.js',
    ['itemTimeRange', 'phasePillTimeLabel', 'renderPhasePill'], {
      minToStr: (m) => `T${m}`
    });
  assert.strictEqual(pillCtx.phasePillTimeLabel(480, 540), 'T480–T540');

  /* A 16:00–22:00 block must own phases 9, 10 and 11 only, with each pill
     showing its own two-hour slice instead of the full shifted range. */
  const longBlock = { id: 'long', _kind: 'session', subject: 'ریاضی', startMin: 960, durMin: 360 };
  const expected = { 9: 'T960–T1080', 10: 'T1080–T1200', 11: 'T1200–T1320' };
  Object.keys(expected).forEach((p) => {
    const start = (+p - 1) * 120;
    const cells = ctx.phaseCellItems('day1', [longBlock], [], start, start + 120);
    assert.strictEqual(cells.length, 1, `phase ${p} must contain the continuous block`);
    const pill = pillCtx.renderPhasePill(cells[0], start, start + 120);
    assert.ok(pill.includes(`<span class="sp-dur">${expected[p]}</span>`),
      `phase ${p} must show its own ${expected[p]} slice`);
    assert.ok(pill.includes(`data-seg-start="${start}" data-seg-end="${start + 120}"`));
  });
  assert.strictEqual(ctx.phaseCellItems('day1', [longBlock], [], 1320, 1440).length, 0,
    'a block ending at 22:00 must not spill into phase 12');

  const activityPill = pillCtx.renderPhasePill(
    { id: 'a1', _kind: 'activity', subject: 'ریاضی', topic: 'احتمال', startMin: 480, endMin: 540 },
    480, 600
  );
  assert.ok(activityPill.includes('T480–T540'), 'adjacent blocks need an explicit start-end range');
  assert.ok(activityPill.includes('data-act-id="a1"'));
  assert.ok(!activityPill.includes('✓'), 'recorded activity pills must not show a check mark');

  const plan = read('js/03-plan.js');
  assert.ok(plan.includes('phaseCellItems(k, timedOfDay(k), state.activities, phaseStart, phaseEnd)'),
    'volume cells must include recorded activities');
  assert.ok(plan.includes("classes.push('activity-pill', 'tl-activity')"),
    'activity pills need their own clickable style');
  assert.ok(plan.includes('<span class="sp-dur">${segmentLabel}</span>'),
    'volume pills must display their own phase slice');
  const css = read('css/07-plan.css');
  assert.ok(/\.phase-pill\.activity-pill\s*\{/.test(css));
  assert.ok(/\.phase-pill\s*\{[^}]*flex-wrap:\s*wrap/.test(css),
    'time ranges need their own line in narrow volume cells');
});

test('FEAT: timeline month mode renders a real Persian calendar', () => {
  const calendar = {
    j2d: (jy, jm, jd) => jy * 360 + (jm - 1) * 30 + jd,
    d2j: (n) => {
      const jy = Math.floor((n - 1) / 360);
      const rem = (n - 1) % 360;
      return { jy, jm: Math.floor(rem / 30) + 1, jd: rem % 30 + 1 };
    },
    jKey: (j) => `${j.jy}/${j.jm}/${j.jd}`,
    dowIndex: () => 0,
    jMonthLength: () => 30,
    MONTHS: Array(12).fill('ماه'),
    DOW_SHORT: ['ش', 'ی', 'د', 'س', 'چ', 'پ', 'ج'],
    TODAY_KEY: '1404/1/1',
    calYear: 1404,
    calMonth: 1,
    calSelected: '1404/1/1',
    tlSelectedKey: '1404/1/1',
    state: { activities: [], exams: [], settings: { examsEnabled: false } },
    timedOfDay: () => [{ id: 's1', subject: 'ریاضی', startMin: 480, durMin: 60 }],
    minToStr: (m) => `T${m}`
  };
  const ctx = loadFunctions('js/03-plan.js',
    ['shiftPersianMonth', 'monthKeysOf', 'itemTimeRange', 'monthDayItems', 'renderTimelineMonth'],
    calendar);
  const moved = ctx.shiftPersianMonth(1403, 12, 1);
  assert.strictEqual(`${moved.jy}/${moved.jm}`, '1404/1');
  const back = ctx.shiftPersianMonth(1404, 1, -1);
  assert.strictEqual(`${back.jy}/${back.jm}`, '1403/12');
  const ahead = ctx.shiftPersianMonth(1404, 7, 2);
  assert.strictEqual(`${ahead.jy}/${ahead.jm}`, '1404/9');

  const keys = ctx.monthKeysOf(1404, 1);
  assert.strictEqual(keys.length, 30, 'a month must use the real calendar month length');
  assert.strictEqual(keys[0], '1404/1/1');
  assert.strictEqual(keys[keys.length - 1], '1404/1/30');

  const html = ctx.renderTimelineMonth();
  assert.ok(html.includes('class="month-cal"'), 'month mode must render a calendar');
  assert.ok(html.includes('class="mc-weekdays"') && html.includes('class="mc-grid"'),
    'calendar needs a weekday header and a 7-column grid');
  const cellCount = (html.match(/data-key="\d+\/\d+\/\d+"/g) || []).length;
  const adjacentCount = (html.match(/class="mc-cell adjacent"/g) || []).length;
  assert.strictEqual(cellCount - adjacentCount, 30,
    'every day of the Persian month gets one calendar cell');
  assert.strictEqual(adjacentCount, 5, 'the final week is padded to a full row');
  assert.ok(html.includes('class="mc-chip"'), 'calendar cells must show the day plan');
  assert.ok(html.includes('class="mc-hint"'), 'calendar must explain how to open a day');
  assert.ok(!html.includes('week-view') && !html.includes('wv-scroll'),
    'the wide timeline strip must be gone');

  const plan = read('js/03-plan.js');
  assert.ok(plan.includes('<button data-tlmode="month"'), 'month must sit beside the week button');
  assert.ok(plan.includes("if (tlMode === 'month') return `${MONTHS[calMonth - 1]} ${fa(calYear)}`;"),
    'month mode needs a month-and-year title');
  assert.ok(plan.includes('body.innerHTML = renderTimelineMonth();'),
    'month mode must render the calendar');
  assert.ok(plan.includes('html = renderTimelineMonth();'),
    'swipe previews must render the calendar too');
  assert.ok(plan.includes("tlMode = 'day';"), 'clicking a calendar day must open its day timeline');
  assert.ok(plan.includes("if (tlMode === 'month') return calYear === TODAY_J.jy && calMonth === TODAY_J.jm;"),
    'the today shortcut must recognize the current month');
  assert.ok(plan.includes('shiftTimelineAnchor(+btn.dataset.nav)'),
    'month navigation must advance one month, not a fixed number of days');
  assert.ok(!plan.includes('month-view'), 'the removed wide month strip must not linger');
  const css = read('css/07-plan.css');
  assert.ok(css.includes('.month-cal') && css.includes('.mc-grid'),
    'calendar needs its own responsive styling');
  assert.ok(!css.includes('.week-view.month-view'), 'old month-strip styling must be removed');
});

test('REWORK: dashboard report dialog uses the plan export design', () => {
  const dashboard = read('js/02-dashboard.js');
  const css = read('css/13-reports.css');
  assert.ok(dashboard.includes('class="modal-head report-modal-head"'), 'report needs the app-style header');
  assert.ok(dashboard.includes('class="wr-logo report-modal-logo"'), 'report needs the app-style logo');
  assert.ok(dashboard.includes("classList.add('report-modal', 'plan-export-modal')"), 'report must share the export shell');
  assert.ok(dashboard.includes('class="cwr-preview plan-preview"'), 'report preview must reuse the plan preview card');
  assert.ok(/\.plan-export-modal #dlReport\{\n?\s*position:sticky/.test(css), 'report download must stay fixed on mobile');
  assert.ok(/\.plan-export-modal #dlReport\{position:static;box-shadow:none\}/.test(css), 'report download returns to normal flow on desktop');
});

/* ---------- FEAT-1: analyzed state ---------- */
const examCore = loadFunctions('js/05-exam.js', ['isQuestionAnalyzed']);
const { isQuestionAnalyzed } = examCore;

test('FEAT-1: pending question is never analyzed', () => {
  assert.strictEqual(isQuestionAnalyzed({ status: 'pending', note: 'x', errorTypes: ['e'] }), false);
});

test('FEAT-1: every analysis field counts independently', () => {
  const base = { status: 'wrong', note: '', questionText: '', answerText: '', errorTypes: [], specialTags: [], questionTypes: [], reviewSolvable: null };
  assert.strictEqual(isQuestionAnalyzed(base), false);
  const fields = ['note', 'questionText', 'answerText'];
  fields.forEach(field => {
    assert.strictEqual(isQuestionAnalyzed({ ...base, [field]: 'text' }), true, field);
  });
  ['errorTypes', 'specialTags', 'questionTypes'].forEach(field => {
    assert.strictEqual(isQuestionAnalyzed({ ...base, [field]: ['id'] }), true, field);
  });
  assert.strictEqual(isQuestionAnalyzed({ ...base, reviewSolvable: false }), true);
  assert.strictEqual(isQuestionAnalyzed({ ...base, reviewSolvable: true }), true);
  assert.strictEqual(isQuestionAnalyzed({ ...base, status: 'correct' }), false, 'status alone is not analysis');
});

/* ---------- REWORK: general-tag-only analysis percentage ---------- */
const tagProgress = loadFunctions('js/05-exam.js', ['isQuestionTagAnalyzed', 'subjectAnalysisStats'], {
  state: { commonErrors: [{ id: 'e1' }, { id: 'e2' }] }
});
test('REWORK: only wrong/blank questions with a general tag count as analysed', () => {
  const questions = [
    { id: 'w1', status: 'wrong', errorTypes: ['e1'] },
    { id: 'b1', status: 'blank', topics: ['t1'] },
    { id: 'w2', status: 'wrong', specialTags: ['s1'] },
    { id: 'w3', status: 'wrong', errorTypes: ['unknown-tag'] },
    { id: 'c1', status: 'correct', note: 'note', errorTypes: ['e1'] },
    { id: 'p1', status: 'pending', errorTypes: ['e1'] }
  ];
  assert.strictEqual(tagProgress.isQuestionTagAnalyzed(questions[0]), true);
  assert.strictEqual(tagProgress.isQuestionTagAnalyzed(questions[1]), false, 'topic is not a general tag');
  assert.strictEqual(tagProgress.isQuestionTagAnalyzed(questions[2]), false, 'special tag is not a general tag');
  assert.strictEqual(tagProgress.isQuestionTagAnalyzed(questions[3]), false, 'deleted tag must not complete it');
  assert.strictEqual(tagProgress.isQuestionTagAnalyzed(questions[4]), false, 'correct is excluded');
  assert.strictEqual(tagProgress.isQuestionTagAnalyzed(questions[5]), false, 'pending is excluded');
  const stats = tagProgress.subjectAnalysisStats(questions);
  assert.strictEqual(stats.total, 4);
  assert.strictEqual(stats.analyzed, 1);
  assert.strictEqual(stats.remaining, 3);
  assert.strictEqual(stats.pct, 25);
  assert.strictEqual(stats.done, false);
  const done = tagProgress.subjectAnalysisStats([{ status: 'blank', errorTypes: ['e2'] }]);
  assert.strictEqual(done.done, true);
  const exam = read('js/05-exam.js');
  assert.ok(/class=\"nsp-pct nsp-done\">تحلیل شد/.test(exam), 'finished subject needs the done badge');
  assert.ok(/if\(stats\.done\)\{pct\.textContent='تحلیل شد'/.test(exam), 'live updates must flip to the done badge');
  assert.ok(/class=\"nsp-progress\$\{stats\.done\?' hidden':''\}/.test(exam), 'progress bar must be hidden at 100%');
});

/* ---------- REWORK: topic-bound, user-created question types ---------- */
const typeSandbox = loadFunctions(
  'js/05-exam.js',
  ['subjectQuestionTypes', 'typesForQuestion', 'questionTypeLabel'],
  {
    state: {
      subjects: [{
        name: 'ریاضی',
        questionTypes: [
          { id: 'qt1', label: 'مثلثات', topics: ['احتمال'] },
          { id: 'qt2', label: 'عمومی', topics: [] },
          { id: 'qt3', label: 'جبری', topics: ['جبر'] }
        ]
      }]
    }
  }
);
test('REWORK: question types are children of a topic, never subject-wide', () => {
  assert.deepStrictEqual(Array.from(typeSandbox.typesForQuestion({ subject: 'ریاضی', topics: ['احتمال'] }).map(t => t.id)), ['qt1']);
  assert.deepStrictEqual(Array.from(typeSandbox.typesForQuestion({ subject: 'ریاضی', topics: ['جبر'] }).map(t => t.id)), ['qt3']);
  assert.deepStrictEqual(Array.from(typeSandbox.typesForQuestion({ subject: 'ریاضی', topics: [] }).map(t => t.id)), []);
  assert.strictEqual(typeSandbox.questionTypeLabel('qt1', 'ریاضی'), 'مثلثات');
});

/* ---------- CLARIFIED: global analysis is a note/type review list ---------- */
const contentCore = loadFunctions('js/05-exam.js', ['qHasAnalysisContent']);
test('CLARIFIED: the analysis list only includes notes or question types', () => {
  assert.strictEqual(contentCore.qHasAnalysisContent({ status: 'pending' }), false);
  assert.strictEqual(contentCore.qHasAnalysisContent({ questionText: 'legacy question' }), false);
  assert.strictEqual(contentCore.qHasAnalysisContent({ answerText: 'legacy answer' }), false);
  assert.strictEqual(contentCore.qHasAnalysisContent({ errorTypes: ['e1'] }), false);
  assert.strictEqual(contentCore.qHasAnalysisContent({ options: ['a', 'b'], correctOptions: [0] }), false);
  assert.strictEqual(contentCore.qHasAnalysisContent({ note: 'n' }), true);
  assert.strictEqual(contentCore.qHasAnalysisContent({ questionTypes: ['qt1'] }), true);
});

/* ---------- CLARIFIED: legacy question/answer text survives normalization ---------- */
const normalizeCore = loadFunctions('js/01-core.js', ['normalizeQuestion'], {
  uid: () => 'fixed-id',
  GRADES: ['دهم', 'یازدهم', 'دوازدهم'],
  TODAY_KEY: '1400/01/01'
});
test('CLARIFIED: normalizing keeps legacy text and structured options', () => {
  const q = normalizeCore.normalizeQuestion({
    id: 'q1',
    questionText: 'متن قدیمی سوال',
    answerText: 'پاسخ قدیمی',
    options: ['الف', 'ب', 'ج', 'د', 'هـ'],
    correctOptions: [2],
    legacyCorrectOptions: [0, 1]
  });
  assert.strictEqual(q.questionText, 'متن قدیمی سوال');
  assert.strictEqual(q.answerText, 'پاسخ قدیمی');
  assert.deepStrictEqual(Array.from(q.options), ['الف', 'ب', 'ج', 'د', 'هـ']);
  assert.deepStrictEqual(Array.from(q.correctOptions), [2]);
  assert.deepStrictEqual(Array.from(q.legacyCorrectOptions), [0, 1]);
});

/* ---------- FEAT-2: draft storage removed ---------- */
test('FEAT-2: examNoteDrafts and the register button are gone', () => {
  const source = read('js/05-exam.js');
  assert.ok(!/examNoteDraft\s*\(/.test(source), 'examNoteDraft() still present');
  assert.ok(!/examNoteDrafts/.test(source), 'examNoteDrafts still present');
  assert.ok(!/data-register-note|ثبت تحلیل/.test(source), 'register button still present');
});

/* ---------- FEAT-3: topic prefill rule ---------- */
const topicCore = loadFunctions('js/05-exam.js', ['applyExamTopicsToQuestions']);
test('FEAT-3: wrong/blank questions are not prefilled from exam topics', () => {
  const questions = [
    { id: 'w', subject: 'ریاضی', status: 'wrong', topics: [] },
    { id: 'b', subject: 'ریاضی', status: 'blank', topics: [] },
    { id: 'c', subject: 'ریاضی', status: 'correct', topics: [] },
    { id: 'p', subject: 'ریاضی', status: 'pending', topics: [] }
  ];
  const exam = { topics: { ریاضی: ['احتمال'] }, questions };
  topicCore.applyExamTopicsToQuestions(exam);
  assert.deepStrictEqual(Array.from(questions[0].topics), []);
  assert.deepStrictEqual(Array.from(questions[1].topics), []);
  assert.deepStrictEqual(Array.from(questions[2].topics), ['احتمال']);
  assert.deepStrictEqual(Array.from(questions[3].topics), ['احتمال']);
});

/* ---------- FEAT-5: digit helpers ---------- */
const utils = loadFunctions('js/00-utils.js', [
  'toFaDigits', 'toEnDigits', 'levenshtein', 'jaccard',
  'normalizeTypeLabel', 'questionTypeSimilarity', 'suggestQuestionTypeGroups',
  'normalizeNumericInputValue'
]);
const {
  toFaDigits, toEnDigits, levenshtein, jaccard,
  questionTypeSimilarity, suggestQuestionTypeGroups, normalizeNumericInputValue
} = utils;

test('FEAT-5: digit conversion is idempotent', () => {
  assert.strictEqual(toFaDigits('a1b2'), 'a۱b۲');
  assert.strictEqual(toFaDigits(toFaDigits('a1b2')), 'a۱b۲');
  assert.strictEqual(toEnDigits('a۱b۲'), 'a1b2');
  assert.strictEqual(toEnDigits('a١b٢'), 'a1b2');
  assert.strictEqual(toEnDigits(toEnDigits('a۱b۲')), 'a1b2');
});

test('FEAT-5: levenshtein and jaccard are pure', () => {
  assert.strictEqual(levenshtein('kitten', 'sitting'), 3);
  assert.strictEqual(jaccard('a b c', 'a b d'), 0.5);
});

test('FEAT-5: numeric input normalization preserves caret offset', () => {
  const out = normalizeNumericInputValue('12a۳');
  assert.strictEqual(out.value, '123');
  assert.strictEqual(out.removed, 1);
});

test('FEAT-5: removals after the caret do not move the caret', () => {
  const out = normalizeNumericInputValue('12a345', 2, 2);
  assert.strictEqual(out.value, '12345');
  assert.strictEqual(out.removed, 0);
  assert.strictEqual(out.removedEnd, 0);
});

/* ---------- FEAT-6/7: question type similarity + grouping ---------- */
test('FEAT-6: similar type labels score at least 0.65', () => {
  assert.ok(questionTypeSimilarity('مثلثات', 'مثلثات ۱') >= 0.65);
  assert.ok(questionTypeSimilarity('احتمال', 'احتمالات') >= 0.65);
  assert.ok(questionTypeSimilarity('مثلثات', '能夠') < 0.65);
});

test('FEAT-6: auto-group needs 2+ types and 30% share', () => {
  const pair = [
    { id: 'a', label: 'مثلثات' },
    { id: 'b', label: 'مثلثات ۱' },
    { id: 'c', label: 'احتمال' },
    { id: 'd', label: 'hcp' }
  ];
  const groups = suggestQuestionTypeGroups(pair);
  assert.strictEqual(groups.length, 1, '2 of 4 types = 50% share');
  assert.ok(groups[0].share >= 0.3);

  const tooSmallShare = [
    ...pair,
    { id: 'e', label: 'e' }, { id: 'f', label: 'f' },
    { id: 'g', label: 'g' }, { id: 'h', label: 'h' },
    { id: 'i', label: 'i' }, { id: 'j', label: 'j' }
  ];
  assert.strictEqual(suggestQuestionTypeGroups(tooSmallShare).length, 0, '2 of 10 types = 20% share');
});

test('REWORK: dashboard insights are a mistake-tag distribution, not progress', () => {
  const sandbox = loadFunctions('js/05-exam.js', ['isQuestionAnalyzed', 'examInsights'], {
    state: {
      subjects: [{ name: 'ریاضی', type: 'specialized' }],
      commonErrors: [{ id: 'e1', label: 'tag-e1' }],
      exams: [{
        id: 'e1',
        questions: [
          { id: 'q1', subject: 'ریاضی', status: 'wrong', errorTypes: ['e1'] },
          { id: 'q2', subject: 'ریاضی', status: 'blank', specialTags: ['s1'] },
          { id: 'q3', subject: 'ریاضی', status: 'correct', errorTypes: ['e1'] },
          { id: 'q4', subject: 'ریاضی', status: 'pending', errorTypes: ['e1'] }
        ]
      }]
    },
    getErr: (id) => ({ id, label: 'tag-' + id, color: '#fff' }),
    errColor: () => '#fff',
    getSortedQuestions: (exam) => exam.questions
  });
  const d = sandbox.examInsights();
  assert.strictEqual(d.total, 2, 'correct and pending questions are excluded');
  assert.deepStrictEqual(Array.from(d.tags.map(t => t.id)), ['e1'],
    'only general mistake tags belong in the dashboard distribution');
  assert.strictEqual(d.byTag['tag-e1'], 1);
  assert.strictEqual(d.byTag['tag-s1'], undefined, 'special tags must be ignored');
});

/* ---------- Static integration checks ---------- */
test('REWORK: dashboard widget text is general-only and free of raw escapes', () => {
  const html = read('index.html');
  const exam = read('js/05-exam.js');
  assert.ok(html.includes('🏷️ پراکندگی تگهای عمومی اشتباهات'));
  assert.ok(!html.includes('\\u200c'), 'literal JS escape leaked into HTML');
  assert.ok(!exam.includes('<div class="ei-title">'), 'widget title is duplicated');
});

test('CLARIFIED: exams keep the calendar; analysis uses a comprehensive filter sidebar', () => {
  const css = read('css/09-exam.css');
  const html = read('index.html');
  const desktop = read('css/14-desktop.css');
  const exam = read('js/05-exam.js');
  const examSection = html.slice(html.indexOf('<section class="view" id="view-exam">'), html.indexOf('<!-- ===== OVERVIEW ===== -->'));
  assert.ok(examSection.indexOf('id="examSide"') < examSection.indexOf('id="examListPane"'),
    'calendar sidebar must come before the exam list');
  assert.ok(examSection.includes('id="examAnalysisSide"'), 'analysis filter sidebar missing');
  assert.ok(examSection.includes('id="gaFilterDetails"'), 'collapsible mobile filter panel missing');
  assert.ok(examSection.includes('id="analysisFilterBox"'), 'filter box missing');
  assert.ok(examSection.includes('id="gaBody"'), 'results panel missing');
  assert.ok(examSection.includes('id="examSidebarToggle"'), 'calendar drawer button missing');
  assert.ok(examSection.includes('id="gaFilterToggle"'), 'filter drawer button missing');
  assert.ok(!examSection.includes('id="examNotesBody"'), 'notes must not be a separate analysis page');
  assert.ok(!examSection.includes('id="analysisExamSelect"'), 'exam picker no longer belongs in analysis');
  assert.ok(!examSection.includes('exam-global-analysis-fold'), 'global analysis must not be folded away');
  assert.ok(/grid-template-columns:\s*minmax\(0,\s*1fr\)\s+340px/.test(css));
  assert.ok(/grid-template-columns:\s*minmax\(0,\s*1fr\)\s+340px/.test(desktop));
  assert.ok(/#view-exam\.filters-open \.exam-analysis-side/.test(css));
  assert.ok(/#view-exam\.sidebar-open \.exam-side/.test(css));
  assert.ok(/\.ga-filter-summary\{display:none\}/.test(css), 'desktop filter summary must stay hidden');
  assert.ok(/\.ga-filter-summary\{[^}]*display:flex/.test(css), 'mobile filter summary must be visible');
  assert.ok(/#view-exam \.exam-analysis-side\{[\s\S]*?position:static/.test(css),
    'mobile filters must sit inline above the analysis list');
  assert.ok(/function setAnalysisFilterOpen\(/.test(exam));
  assert.ok(/function setExamSidebarOpen\(/.test(exam));
  assert.ok(/فیلترهای تحلیل/.test(exam), 'filter sidebar needs a clear title');
  const overlay = exam.slice(exam.indexOf('function renderExamAnalysisTab'), exam.indexOf('/* ============ EXAM SETTINGS MODAL'));
  assert.ok(/renderExamNotesTab\(exam,analysisBody\)/.test(overlay),
    'per-exam analysis must stay inside the exam overlay');
  assert.ok(!/رفتن به تب تحلیل آزمون/.test(exam), 'obsolete link out of the overlay is gone');
});

test('CLARIFIED: tag chips stay inline in overlay cards', () => {
  const exam = read('js/05-exam.js');
  const card = exam.slice(exam.indexOf('function noteQuestionCardHTML'), exam.indexOf('function bindQuestionTagHandlers'));
  assert.ok(!card.includes('note-tag-sidebar'), 'note cards must not carry a separate sidebar');
  assert.ok(!/function renderAnalysisTagSidebar\(/.test(exam), 'obsolete sidebar renderer still present');
  assert.ok(/function bindQuestionTagHandlers\(/.test(exam));
});

test('CLARIFIED: note cards start collapsed with an add button and a kind picker', () => {
  const exam = read('js/05-exam.js');
  const core = read('js/01-core.js');
  const css = read('css/09-exam.css');
  assert.ok(/nc-static-note/.test(exam));
  assert.ok(/nc-static-note/.test(css));
  assert.ok(!/<details class="nc-fold nc-note-fold"/.test(exam), 'note is still collapsible');
  assert.ok(/questionPaperLauncherHTML\(q\)/.test(exam), 'note card lacks the collapsed add launcher');
  assert.ok(/＋ افزودن سوال و پاسخ/.test(exam), 'add question button missing');
  assert.ok(/data-q-kind="mcq"/.test(exam), 'four-option kind missing');
  assert.ok(/data-q-kind="case"/.test(exam), 'case-based kind missing');
  assert.ok(/data-q-kind="case">چندموردی</.test(exam), 'multi-item kind must be labelled چندموردی');
  assert.ok(!/موردی \(پیش فرض ۴\)/.test(exam), 'old case label is gone');
  assert.ok(/data-case-step/.test(exam), 'case count cannot be adjusted');
  assert.ok(/q\.correctOptions=q\.correctOptions\[0\]===index\?\[\]:\[index\]/.test(exam),
    'correct answer must toggle off when pressed again');
  assert.ok(/data-q-delete/.test(exam), 'delete question/answer button missing');
  assert.ok(/questionPaperHTML\(s,q\.id\)/.test(exam), 'full editor lacks the question paper');
  assert.ok(/ensureQuestionPaperDraft\(s\)/.test(exam), 'draft is not prepared before saving');
  assert.ok(/questionKind/.test(core), 'question kind must survive normalization');
  assert.ok(/legacyCorrectOptions/.test(exam), 'legacy correct answers must survive');
});

test('REWORK: چندموردی has a main stem, editable items and numeric options', () => {
  const exam = read('js/05-exam.js');
  const core = read('js/01-core.js');
  const css = read('css/09-exam.css');
  assert.ok(/سوال چندموردی/.test(exam), 'multi-item paper title');
  assert.ok(/nc-case-item-input/.test(exam), 'sub-item statements must be editable');
  assert.ok(/data-case-item=/.test(exam), 'sub-item changes are bound');
  assert.ok(/data-case-item-del/.test(exam), 'sub-items can be removed');
  assert.ok(/q\.caseItems\.length\+/.test(exam), 'stepper adjusts the item count, not the options');
  assert.ok(!/q\.options=Array\.from\(\{length:next\}/.test(exam), 'stepper no longer overwrites options with indices');
  assert.ok(!/q\.options=Array\.from\(\{length:count\},/.test(exam), 'draft no longer replaces numeric options');
  assert.ok(/inputmode="numeric"/.test(exam), 'answer options are numeric');
  assert.ok(/گزینه ها \(عدد تعداد موارد درست\)/.test(exam), 'numeric option hint');
  assert.ok(!/const numeric=options\.length>0/.test(exam), 'numeric MCQ options are no longer misclassified');
  assert.ok(/hasCaseItems\|\|options\.length>4/.test(exam), 'case inference is conservative');
  assert.ok(/caseItems:Array\.isArray\(q\.caseItems\)/.test(exam), 'full editor keeps sub-items');
  assert.ok(/caseItems:draft\.caseItems\.slice\(\)/.test(exam), 'new questions save sub-items');
  assert.ok(/const caseItems=Array\.isArray\(q\.caseItems\)/.test(exam), 'analysis list renders sub-items');
  assert.ok(!/q\.options\.slice\(0,4\)/.test(exam), 'analysis list no longer truncates options');
  assert.ok(/caseItems: Array\.isArray\(q\.caseItems\)/.test(core), 'normalization preserves sub-items');
  assert.ok(/q\.caseItems && q\.caseItems\.some/.test(core), 'compaction keeps sub-items');
  assert.ok(/\.ac-case-items\{/.test(css), 'analysis sub-item styles');
});

test('CLARIFIED: comprehensive filters live in the analysis sidebar', () => {
  const exam = read('js/05-exam.js');
  assert.ok(/const filterBox=document\.getElementById\('analysisFilterBox'\)/.test(exam));
  assert.ok(/filterBox\.innerHTML=filterHtml\.join\(''\)/.test(exam));
  ['exam', 'subject', 'grade', 'error', 'questionType'].forEach(key => {
    assert.ok(new RegExp('data-f="' + key + '"').test(exam), 'missing filter: ' + key);
  });
  assert.ok(/data-st="wrong"/.test(exam));
  assert.ok(/data-quick="starred"/.test(exam));
  assert.ok(/data-quick="hasNote"/.test(exam));
  assert.ok(/data-sub-error/.test(exam));
  assert.ok(/data-special/.test(exam));
  assert.ok(/data-reset-filters/.test(exam));
  assert.ok(/if\(f\.subject&&availableTopics\.length\)/.test(exam));
  assert.ok(/class="ac-type"/.test(exam));
  assert.ok(/f\.questionType=''/.test(exam));
  assert.ok(/examsWithContent\.set\(exam\.id/.test(exam), 'exam filter must track exams with analysis content');
  assert.ok(/\[\.\.\.examsWithContent\.values\(\)\]/.test(exam), 'exam filter must list only those exams');
  assert.ok(/const availableTypes=f\.subject&&f\.topic/.test(exam),
    'type filter must depend on the selected topic, not only the subject');
  assert.ok(/t\.topics\.includes\(f\.topic\)/.test(exam), 'type filter must match the selected topic');
});

test('REWORK: service worker cache bypasses the API and is bumped to r44', () => {
  const sw = read('sw.js');
  assert.ok(sw.includes('konkur-shell-v1-0-9-5-r44'), 'cache name must match the API bypass release');
  assert.ok(!sw.includes('konkur-shell-v1-0-9-5-r43'), 'the previous cache name must be gone');
  assert.ok(sw.includes("url.origin !== self.location.origin"), 'external origins must bypass the cache');
  assert.ok(/url\.pathname\.(?:startsWith\('\/api\/'\)|indexOf\('\/api\/'\)\s*===\s*0)/.test(sw),
    'same-origin /api/ requests must bypass the cache');
  [
    './js/00-localstate.js', './css/16-auth.css', './js/12-sql-sync.js',
    './js/13-sql-api.js', './js/14-auth-ui.js'
  ].forEach(path => assert.ok(sw.includes(`'${path}'`), `${path} must be precached`));
  assert.ok(!/12-pocketbase|00-pocketbase|pocketbase/i.test(sw),
    'the offline shell must not precache the retired transport');
});

test('REWORK: phone auth UI and SQL runtime are wired into the app', () => {
  const html = read('index.html');
  const auth = read('js/14-auth-ui.js');
  const sync = read('js/12-sql-sync.js');
  assert.ok(html.includes('<link rel="stylesheet" href="css/16-auth.css">'), 'auth styles must load');
  assert.ok(html.includes('<div class="auth-overlay" id="authOverlay" hidden>'));
  assert.ok(html.includes('<div id="authContent" aria-live="polite"></div>'));
  assert.ok(!html.includes('id="syncNowBtn"') && !html.includes('id="syncAutoToggle"'),
    'sync is automatic-only: status, never a button or toggle');

  const scripts = Array.from(html.matchAll(/<script src="([^"]+)"><\/script>/g), (m) => m[1]);
  const apiIndex = scripts.indexOf('js/13-sql-api.js');
  const syncIndex = scripts.indexOf('js/12-sql-sync.js');
  const authIndex = scripts.indexOf('js/14-auth-ui.js');
  const initIndex = scripts.indexOf('js/99-init.js');
  assert.ok(apiIndex >= 0 && apiIndex < syncIndex &&
    syncIndex < authIndex && authIndex < initIndex,
  'SQL API, sync, auth UI and init must load in that order');

  assert.ok(auth.includes('window.masirAuth = {') && /\bshow,/.test(auth),
    'masirAuth.show must be public');
  const modes = ['login', 'signup', 'reset', 'password', 'admin', 'advisor-code', 'pair-advisor'];
  modes.forEach(mode => assert.ok(auth.includes(`'${mode}'`), `auth mode ${mode} is missing`));
  assert.ok(!/type="email"|email\s*:/i.test(auth), 'auth is phone/password only, with no email inputs');
  assert.ok(sync.includes('window.sqlSync = {') && sync.includes('window.masirSqlSync = window.sqlSync;'));

  const activeJs = fs.readdirSync(path.join(ROOT, 'js')).filter(name => name.endsWith('.js'));
  activeJs.forEach(name => {
    assert.ok(!/pocketbase/i.test(read(path.join('js', name))),
      `${name} must not reference the retired runtime`);
  });
  ['index.html', 'sw.js', 'build.py'].forEach(file => {
    assert.ok(!/pocketbase/i.test(read(file)), `${file} must not reference the retired runtime`);
  });
});

test('FEAT-6/7: question types persist, render in cards and merge needs confirmation', () => {
  const core = read('js/01-core.js');
  const settings = read('js/08-settings.js');
  const exam = read('js/05-exam.js');
  assert.ok(core.includes('questionTypes') && core.includes('emphasis') && core.includes('group'));
  assert.ok(/data-qt-merge/.test(settings) && /confirm\(/.test(settings));
  assert.ok(/data-edit-question-type/.test(exam) && /q\.questionTypes=s\.questionTypes/.test(exam));
});

test('FEAT-8: dashboard exam insights card is rendered', () => {
  const html = read('index.html');
  const dashboard = read('js/02-dashboard.js');
  const exam = read('js/05-exam.js');
  assert.ok(html.includes('examInsightsCard'));
  assert.ok(dashboard.includes('renderExamInsights()'));
  assert.ok(/function renderExamInsights\(/.test(exam));
});

/* ---------- REWORK: exam side stats, comparison toolbar and overview merge ---------- */
test('REWORK: analysis heading is gone and general-tag stats live under the calendar', () => {
  const html = read('index.html');
  const examSection = html.slice(html.indexOf('<section class="view" id="view-exam">'), html.indexOf('<!-- ===== OVERVIEW / SUBJECT PROGRESS ===== -->'));
  assert.ok(!examSection.includes('تحلیل جامع آزمونها'), 'obsolete analysis heading still present');
  assert.ok(examSection.includes('id="gaSub"'), 'analysis count must stay visible without the heading');
  const sidebar = examSection.slice(examSection.indexOf('id="examSide"'), examSection.indexOf('</aside>', examSection.indexOf('id="examSide"')));
  const listPane = examSection.slice(examSection.indexOf('id="examListPane"'), examSection.indexOf('id="examAnalysisPane"'));
  assert.ok(sidebar.includes('id="examTagStats"'), 'tag distribution must be inside the sidebar');
  assert.ok(sidebar.indexOf('id="examCalendarDetails"') < sidebar.indexOf('id="examTagStats"'),
    'tag distribution must come after the calendar');
  assert.ok(!listPane.includes('id="examTagStats"'), 'tag distribution must leave the exam list');
});

test('REWORK: exam comparison text stays above the image-export button', () => {
  const css = read('css/13-reports.css');
  const block = css.slice(css.indexOf('.exam-compare-toolbar{'), css.indexOf('.exam-compare-summary{'));
  assert.ok(/flex-direction:\s*column/.test(block), 'toolbar must stack its text above the button');
  assert.ok(!/justify-content:\s*space-between/.test(block), 'side-by-side layout is gone');
  assert.ok(/align-self:\s*flex-start/.test(block), 'button must not stretch on desktop');
});

test('REWORK: exam compare uses the app shell and a desktop chart side column', () => {
  const exam = read('js/05-exam.js');
  const overlays = read('css/05-overlays.css');
  const reports = read('css/13-reports.css');
  const desktop = read('css/14-desktop.css');
  assert.ok(exam.includes('class="exam-compare-layout"'), 'compare body lacks the app layout grid');
  assert.ok(exam.includes('class="exam-compare-main"'), 'compare details must live in the main column');
  assert.ok(exam.includes('<aside class="exam-compare-side">'), 'charts must live in a side column');
  assert.ok(exam.includes('exam-compare-charts-card'), 'charts need an app-style card');
  assert.ok(!/class="card exam-compare-summary">[\s\S]*?exam-charts-row/.test(exam),
    'charts must leave the old summary card');
  assert.ok(/#examCompareOverlay \.wr-top\{/.test(overlays), 'compare header must match the app topbar');
  assert.ok(/backdrop-filter:blur\(18px\) saturate\(150%\)/.test(overlays.slice(overlays.indexOf('#examCompareOverlay .wr-top{'), overlays.indexOf('#examCompareOverlay .wr-logo{'))),
    'compare header needs the app glass treatment');
  assert.ok(/\.exam-compare-layout\{display:flex;flex-direction:column/.test(reports), 'compare layout stacks on mobile');
  assert.ok(/#examCompareOverlay \.exam-compare-layout \{[\s\S]*?grid-template-columns: minmax\(0, 1fr\) 340px/.test(desktop),
    'desktop must place charts beside the details');
  assert.ok(/#examCompareOverlay \.exam-compare-side \{ position: sticky/.test(desktop), 'desktop chart column must stay in view');
});

test('REWORK: exam compare top section matches the app topbar dimensions', () => {
  const overlays = read('css/05-overlays.css');
  const desktop = read('css/14-desktop.css');
  const header = overlays.slice(overlays.indexOf('#examCompareOverlay .wr-top{'), overlays.indexOf('#examCompareOverlay .wr-logo{'));
  assert.ok(/rgba\(11,16,34,\.76\)/.test(header), 'compare header must use the app topbar glass base');
  assert.ok(/top:10px/.test(header), 'compare header sticky offset must match the app topbar');
  assert.ok(/#examCompareOverlay \.wr-close\{width:38px;height:38px;border-radius:14px\}/.test(overlays),
    'compare close button must match the app icon button size');
  assert.ok(/#examCompareOverlay \.wr-shell \{ padding: 16px 24px 80px; \}/.test(desktop),
    'tablet compare shell must match the app side padding');
  assert.ok(/#examCompareOverlay \.wr-top \{ margin: 0 0 14px; padding: 13px 16px; \}/.test(desktop),
    'tablet compare header padding/margin must match the app topbar');
  assert.ok(/#examCompareOverlay \.wr-shell \{ max-width: 100%; padding: 8px 14px 60px; \}/.test(desktop),
    'desktop compare header must span the same full-width inset as the app topbar');
  assert.ok(/#examCompareOverlay \.wr-top \{ margin: 0 0 14px; padding: 12px 18px; position: relative; top: auto; \}/.test(desktop),
    'desktop compare header must use the app topbar padding and flow');
  assert.ok(/#examCompareOverlay \.wr-logo \{ width: 38px; height: 38px; border-radius: 12px; font-size: 16px; \}/.test(desktop),
    'desktop compare logo must shrink like the app logo');
});

test('REWORK: classes are merged into the renamed overview as a third segment', () => {
  const html = read('index.html');
  const core = read('js/01-core.js');
  const overview = read('js/06-overview.js');
  const desktop = read('css/14-desktop.css');
  assert.ok(html.includes('data-view="overview"') && html.includes('پیشرفت دروس'));
  assert.ok(html.includes('data-view="activity"') && html.includes('ثبت فعالیت'));
  assert.ok(!html.includes('data-view="class"'), 'standalone class tab must be removed');
  assert.ok(!html.includes('id="view-class"'), 'standalone class view must be removed');
  assert.ok(html.includes('id="ovClassTab"') && html.includes('data-ovt="class"'));
  assert.ok(html.includes('id="overviewClassPane"') && html.includes('id="clsSessions"'));
  assert.ok(/function setOverviewTab\(/.test(overview));
  assert.ok(/const classTab=ovTab==='class'/.test(overview));
  assert.ok(/if\(classTab\)\{[\s\S]*?renderClass\(\)/.test(overview));
  assert.ok(/getElementById\('ovClassTab'\)/.test(core), 'hide-classes setting must target the segment');
  assert.ok(/#overviewClassPane/.test(desktop), 'class pane needs the desktop layout rules');
  assert.ok(!/#view-class/.test(desktop), 'old class-view selectors must be gone');
});

test('REWORK: bottom navigation mirrors the rounded topbar card without a centre bubble', () => {
  const nav = read('css/05-overlays.css');
  const block = nav.slice(nav.indexOf('/* NAV — rounded glass bar, matching the topbar */'), nav.indexOf('/* MODAL */'));
  assert.ok(/position:fixed;bottom:10px;left:50%;transform:translateX\(-50%\)/.test(block),
    'bar must be inset from the bottom edge');
  assert.ok(/width:calc\(100% - 28px\);max-width:452px/.test(block), 'bar must be a spaced card');
  assert.ok(/backdrop-filter:blur\(18px\) saturate\(150%\)/.test(block), 'glass must match the topbar');
  assert.ok(/border:1px solid rgba\(255,255,255,\.10\)/.test(block));
  assert.ok(/border-radius:18px/.test(block));
  assert.ok(!/nav::before/.test(block), 'extra gloss layer is gone');
  assert.ok(!/nth-child\(3\)/.test(block), 'raised centre bubble is gone');
  assert.ok(!/border-radius:22px 22px 0 0/.test(block), 'old floating radius is gone');
  const desktop = read('css/14-desktop.css');
  const navBtnAt = desktop.indexOf('.nav-btn {');
  const desktopNav = desktop.slice(desktop.lastIndexOf('.nav {', navBtnAt), navBtnAt);
  assert.ok(/backdrop-filter:\s*blur\(18px\) saturate\(150%\)/.test(desktopNav), 'desktop sidebar must match the topbar glass card');
  assert.ok(!/backdrop-filter:\s*none/.test(desktopNav), 'flat sidebar is gone');
  assert.ok(!/\.nav::before/.test(desktop));
  assert.ok(/margin: 8px 14px 14px 14px/.test(desktopNav), 'sidebar right edge and top spacing match the topbar');
  assert.ok(!/\.nav-btn:nth-child\(3\)/.test(desktop));
  assert.ok(read('css/02-typography.css').includes('[hidden]{display:none!important}'));
});

test('REWORK: topbar is a rounded spaced card with a rounded-square app icon', () => {
  const overlays = read('css/05-overlays.css');
  const topbar = overlays.slice(overlays.indexOf('/* TOPBAR */'), overlays.indexOf('/* NAV — rounded glass bar, matching the topbar */'));
  assert.ok(/margin:0 0 12px/.test(topbar), 'topbar must sit inside the app padding');
  assert.ok(!/margin:-14px/.test(topbar), 'negative full-bleed margin is gone');
  assert.ok(/top:10px/.test(topbar), 'sticky topbar needs breathing room');
  assert.ok(/border-radius:18px/.test(topbar));
  assert.ok(/backdrop-filter:blur\(18px\) saturate\(150%\)/.test(topbar));
  assert.ok(/border:1px solid rgba\(255,255,255,\.10\)/.test(topbar));
  const appLogo = topbar.slice(topbar.indexOf('.logo.app-logo{'), topbar.indexOf('.brand-title{'));
  assert.ok(/border-radius:15px/.test(appLogo), 'app icon must be a rounded square');
  assert.ok(!/border-radius:50%/.test(appLogo), 'circular app icon is gone');

  const html = read('index.html');
  const settingsBtn = html.slice(html.indexOf('id="settingsBtn"'), html.indexOf('</button>', html.indexOf('id="settingsBtn"')));
  assert.ok(/<svg viewBox="0 0 24 24"/.test(settingsBtn), 'settings must use a stroke SVG');
  assert.ok(!settingsBtn.includes('⚙️'), 'emoji gear is gone');
  const buttons = read('css/03-buttons.css');
  const settingsCss = buttons.slice(buttons.indexOf('.icon-btn.settings-btn{'), buttons.indexOf('.day-arrow-sm{'));
  assert.ok(/border:0;background:transparent/.test(settingsCss));
  assert.ok(/stroke:currentColor;fill:none/.test(settingsCss));
});

test('REWORK: topbar action buttons use minimal icons and output labels', () => {
  const core = read('js/01-core.js');
  const html = read('index.html');
  const buttons = read('css/03-buttons.css');
  assert.ok(/const CTX_ICONS=/.test(core), 'context icons must be reusable stroke SVGs');
  assert.ok(core.includes("label:'خروجی گزارش'"));
  assert.ok(core.includes("label:'خروجی برنامه'"));
  assert.ok(core.includes("label:'خروجی مقایسه'"));
  assert.ok(core.includes("btn.querySelector('.ctx-icon').innerHTML=cfg.icon"));
  assert.ok(!/label:'گزارش'/.test(core));
  assert.ok(!/label:'برنامه هفتگی'/.test(core));
  assert.ok(!/label:'مقایسه آزمون‌ها'/.test(core));
  const ctxBtn = html.slice(html.indexOf('id="contextActionBtn"'), html.indexOf('</button>', html.indexOf('id="contextActionBtn"')));
  assert.ok(/<svg viewBox="0 0 24 24"/.test(ctxBtn));
  assert.ok(!/📊|🖼️/.test(ctxBtn), 'emoji action icons are gone');
  const ctxCss = buttons.slice(buttons.indexOf('.icon-btn.context-btn{'), buttons.indexOf('/* Settings version footer */'));
  assert.ok(/border-color:rgba\(34,211,238,\.38\)/.test(ctxCss), 'output buttons keep their cyan border');
  assert.ok(/background:rgba\(34,211,238,\.12\)/.test(ctxCss));
  assert.ok(/color:#4de2f5/.test(ctxCss), 'output button text colour is restored');
  assert.ok(/stroke:currentColor;fill:none/.test(ctxCss));
});

test('REWORK: settings stays inside the app shell with visible active tabs', () => {
  const html = read('index.html');
  const overlays = read('css/05-overlays.css');
  const settings = read('js/08-settings.js');
  const desktop = read('css/14-desktop.css');
  const topbar = html.slice(html.indexOf('<header class="topbar">'), html.indexOf('</header>'));
  assert.ok(topbar.includes('id="settingsBackBtn"'), 'back button replaces the app logo');
  assert.ok(topbar.includes('id="appLogo"'));
  assert.ok(topbar.includes('id="brandTitle"') && topbar.includes('>مسیر کنکور<'));
  assert.ok(topbar.includes('id="settingsTitle"') && topbar.includes('>تنظیمات<'));
  const settingsCss = overlays.slice(overlays.indexOf('/* SETTINGS — lives inside the app shell'), overlays.indexOf('#gaBody>.flt-card{'));
  assert.ok(/#settingsOverlay\{\s*position:fixed;inset:0;z-index:0/.test(settingsCss));
  assert.ok(/#settingsOverlay \.wr-top\{display:none\}/.test(settingsCss), 'no separate app-within-app header');
  assert.ok(/\.app\.settings-open > main\{display:none\}/.test(settingsCss));
  assert.ok(!/\.app\.settings-open \.nav-btn\{pointer-events:none/.test(settingsCss), 'tabs must remain active');
  assert.ok(/\.icon-btn\.settings-back-btn svg/.test(settingsCss));
  assert.ok(/\.icon-btn\.settings-back-btn\{\s*width:44px;height:44px/.test(settingsCss), 'settings back button matches the 44px logo');
  assert.ok(settings.includes('setSettingsChrome(true)') && settings.includes('setSettingsChrome(false)'));
  assert.ok(settings.includes("app.classList.toggle('settings-open',open)"));
  assert.ok(settings.includes("document.getElementById('settingsBackBtn').onclick=closeSettingsOverlay"));
  assert.ok(!settings.includes("aria-disabled"), 'no disabled tab state remains');
  assert.ok(/#settingsOverlay \{/.test(desktop), 'desktop settings must use the app grid');
  assert.ok(/#settingsOverlay \.wr-shell \{ max-width: 1120px/.test(desktop));
  assert.ok(/\.icon-btn\.settings-back-btn \{ width: 38px; height: 38px; \}/.test(desktop), 'desktop back button matches the desktop logo');
});

test('REWORK: settings is paged, with merged sync/account and automatic sync only', () => {
  const html = read('index.html');
  const settings = read('js/08-settings.js');
  const sync = read('js/12-sql-sync.js');
  const overlays = read('css/05-overlays.css');
  const body = html.slice(html.indexOf('<main class="wr-body" id="settingsBody">'), html.indexOf('</main>', html.indexOf('<main class="wr-body" id="settingsBody">')));
  const pages = ['home', 'profile', 'subjects', 'exam', 'sync', 'backup', 'danger'];
  pages.forEach(p => assert.ok(body.includes(`data-page="${p}"`), `${p} page is missing`));
  assert.ok(!body.includes('data-acc-toggle'), 'settings sections must not collapse');
  assert.ok(!body.includes('acc-chevron'), 'accordion chevrons are gone');
  assert.ok(body.includes('id="editProfileBtn"') && body.includes('>پروفایل<'), 'profile card uses a profile button instead of a pencil');
  assert.ok(!body.includes('✎'), 'pencil is gone');
  assert.ok(body.includes('id="accountUI"') && body.includes('id="syncUI"'), 'account and sync settings are merged');
  const syncPage = body.slice(body.indexOf('data-page="sync"'), body.indexOf('data-page="backup"'));
  assert.ok(syncPage.indexOf('id="accountUI"') < syncPage.indexOf('id="syncUI"'), 'login UI lives inside the sync page');
  const homePage = body.slice(body.indexOf('data-page="home"'), body.indexOf('data-page="profile"'));
  assert.ok(!homePage.includes('id="homeSyncNowBtn"'), 'home manual-sync button is gone');
  assert.ok(homePage.includes('class="card settings-link sync-link-row"'), 'sync row remains');
  assert.ok(!homePage.includes('sync-mini-card'), 'separate manual-sync card is gone');
  assert.ok(homePage.includes('data-go="sync"'), 'sync row opens the sync page');
  assert.ok(/#settingsBody \.card\{margin-bottom:0\}/.test(overlays), 'settings cards drop the global bottom margin');
  assert.ok(/#settingsBody\{display:flex;flex-direction:column;gap:8px\}/.test(overlays), 'settings gaps are compact');
  assert.ok(/#settingsOverlay\{[\s\S]*?overflow-x:hidden/.test(overlays), 'settings overlay cannot scroll sideways');
  assert.ok(settings.includes('function setSettingsPage('));
  assert.ok(settings.includes("setSettingsPage('home')"));
  assert.ok(!settings.includes('_homeSyncNowBtn'), 'home manual-sync handler is gone');
  assert.ok(!sync.includes('id="syncNowBtn"'), 'settings manual-sync button is gone');
  assert.ok(!sync.includes('id="syncAutoToggle"'), 'auto-sync toggle is gone');
  assert.ok(!/function readAutoSyncEnabled\(/.test(sync), 'the old auto-sync toggle reader is gone');
  assert.ok(sync.includes('const autoSyncEnabled = true;'), 'automatic sync is always on');
  assert.ok(sync.includes('همگامسازی خودکار فعال است'), 'sync page shows status only');
  assert.ok(!settings.includes("editFields.hidden"), 'profile fields no longer toggle hidden inline');
  const profileStart = settings.indexOf('state.profile = {');
  const profileBlock = settings.slice(profileStart, settings.indexOf('};', profileStart));
  assert.ok(!/email\s*:/.test(profileBlock) && !profileBlock.includes('state.profile.email'),
    'saving a profile must not preserve an email address');
});

test('REWORK: weekly totals show correct/wrong/blank and plan images have a preview', () => {
  const reports = read('js/09-reports.js');
  const plan = read('js/03-plan.js');
  const reportsCss = read('css/13-reports.css');
  assert.ok(reports.includes('totBadges.push(testBadge(s.total.c,s.total.w,s.total.b))'), 'activity weekly table last column');
  assert.ok(reports.includes('grandBadges.push(testBadge(data.grand.c,data.grand.w,data.grand.b))'), 'activity weekly grand total');
  assert.ok(reports.includes('drawTriplet(s.total.c,s.total.w,s.total.b'), 'weekly report image subject total');
  assert.ok(reports.includes('drawTriplet(data.grand.c,data.grand.w,data.grand.b'), 'weekly report image grand total');
  assert.ok(/async function generatePlanWeekCanvas\(/.test(plan), 'plan canvas generator is reusable');
  assert.ok(plan.includes('return cv;'), 'generator returns the canvas instead of downloading immediately');
  assert.ok(/async function downloadPlanWeekImage\(/.test(plan), 'download remains a separate step');
  assert.ok(plan.includes('id="piPreview"'), 'plan picker renders a preview');
  assert.ok(plan.includes("generatePlanWeekCanvas(ws).then((cv)"), 'preview is generated for the selected week');
  assert.ok(/\.plan-preview img\{/.test(reportsCss), 'preview has sizing rules');
  assert.ok(plan.includes('class="modal-head report-modal-head"'), 'plan overlay needs the app-style header');
  assert.ok(plan.includes('class="wr-logo report-modal-logo"'), 'plan overlay needs the app-style logo');
  assert.ok(plan.includes("classList.add('report-modal', 'plan-export-modal')"), 'plan overlay uses the app report shell');
  assert.ok(/\.plan-export-modal \.report-modal-head\{/.test(reportsCss), 'plan header needs glass styling');
  assert.ok(/\.plan-export-modal \.plan-preview\{\n?\s*max-height:26vh/.test(reportsCss), 'mobile preview must stay compact');
  assert.ok(/\.plan-export-modal #piDownload\{\n?\s*position:sticky/.test(reportsCss), 'download button must stay fixed');
});

test('REWORK: app version is 0.9.5 everywhere', () => {
  assert.ok(read('js/01-core.js').includes("const APP_VERSION = '0.9.5';"));
  assert.strictEqual(JSON.parse(read('manifest.json')).version, '0.9.5');
  assert.strictEqual(JSON.parse(read('pwa/twa-manifest.json')).appVersion, '0.9.5');
});

test('REWORK: installed PWA uses a black status bar, not purple', () => {
  const html = read('index.html');
  const manifest = JSON.parse(read('manifest.json'));
  assert.ok(/<meta name="theme-color" content="#000000">/.test(html));
  assert.ok(/<meta name="apple-mobile-web-app-status-bar-style" content="black">/.test(html));
  assert.ok(!html.includes('content="#7c5cff"'));
  assert.strictEqual(manifest.theme_color, '#000000');
  assert.strictEqual(manifest.background_color, '#000000');
});

test('ASSETS: app icons use the cropped artwork with no white margin', () => {
  const expected = {
    'apple-touch-icon.png': [180, 'c3e970cd0098f4d847445cbf25e15bf1ee2447b0b66719ef35a1badc9803d8b4'],
    'favicon-32.png': [32, '21016d4ca5b5a85d23558d3e621ed0e6530213cd8030f807daa3ecc475705068'],
    'icon-192.png': [192, 'dcd5e5e05a07882fbfac6dd7af62c7170721d8715c4f07bac3435ab28051255a'],
    'icon-512.png': [512, '9fe778fa8af3a9919825f49296f3a1f1a1b24bdf54911726a439e0385b227635'],
    'icon-maskable-192.png': [192, '5f623429adac5d95e3d90c6d31ff748032f3bc715f0d05bbd48d5b2534c2a1c4'],
    'icon-maskable-512.png': [512, '05cb7a93df099fb9195be737de424641b20d67ef7d3174d5113957be07abd013']
  };
  const manifest = JSON.parse(read('manifest.json'));
  for (const [name, [size, hash]] of Object.entries(expected)) {
    const buf = fs.readFileSync(path.join(ROOT, 'icons', name));
    assert.strictEqual(buf.subarray(1, 4).toString('ascii'), 'PNG', `${name} is not a PNG`);
    assert.strictEqual(buf.readUInt32BE(16), size, `${name} has the wrong width`);
    assert.strictEqual(buf.readUInt32BE(20), size, `${name} has the wrong height`);
    assert.strictEqual(crypto.createHash('sha256').update(buf).digest('hex'), hash,
      `${name} is not the cropped icon artwork`);
    assert.ok(manifest.icons.some(icon => icon.src === `icons/${name}`) ||
      ['apple-touch-icon.png', 'favicon-32.png'].includes(name),
      `${name} must remain referenced or intentionally kept outside the manifest`);
  }
});

test('FIX: topic grid has a سایر column that drag-and-drop can target', () => {
  const plan = read('js/03-plan.js');
  assert.ok(plan.includes('subjects.push(...allSubjects.filter(s => s.name === OTHER_SUBJECT));'),
    'the other subject must be appended as the final grid column');
  assert.ok(plan.includes('? { date: target.date, subject: target.subject }'),
    'dropping into a subject column must update the session subject');
});

test('FIX: multi-day reserve band uses one shared height', () => {
  const plan = read('js/03-plan.js');
  const css = read('css/07-plan.css');
  assert.ok(plan.includes('const reserves = keys.map(k => reservedOfDay(k));'));
  assert.ok(plan.includes('const reserveH = Math.max(52, ...reserves.map(r => 21 * r.length + 21));'));
  assert.ok(plan.includes('const reserved = reserves[dayIdx];'));
  assert.ok(plan.includes('style="--reserve-h:${reserveH}px"'));
  assert.ok(/\.wv-reserve-spacer \{\s*height: var\(--reserve-h, 52px\);\s*flex: 0 0 var\(--reserve-h, 52px\);/.test(css));
  assert.ok(/\.wv-reserve-row \{\s*height: var\(--reserve-h, 52px\);/.test(css));
  assert.ok(!/\.wv-reserve-row \{\s*min-height: 52px/.test(css),
    'a per-column minimum height would let one day push its ruler down');
});

test('FIX: week navigation clears the selected-day highlight', () => {
  const plan = read('js/03-plan.js');
  assert.ok(plan.includes('let tlSelectedKey = TODAY_KEY;'));
  assert.ok(/tlSelectedKey = null;\s*if \(tlMode === 'month'\)/.test(plan),
    'navigation must clear the explicit selection');
  assert.ok(plan.includes("if (k === tlSelectedKey) cls.push('sel');"));
  assert.ok(!/if \(k === calSelected\) cls\.push\('sel'\)/.test(plan),
    'the moving anchor must never be painted as a selected day');
  assert.ok(plan.includes("body.querySelectorAll('.wv-day[data-key]')"),
    'weekday headers must still allow explicit day selection');
  assert.ok(plan.includes('const savedSelectedKey = tlSelectedKey;'),
    'swipe previews must not paint a false selection');
});

test('FIX: exam compare stays inside the app shell with active bottom tabs', () => {
  const overlays = read('css/05-overlays.css');
  const desktop = read('css/14-desktop.css');
  const exam = read('js/05-exam.js');
  const core = read('js/01-core.js');
  const init = read('js/99-init.js');
  const shellCss = overlays.slice(overlays.indexOf('/* EXAM COMPARE — lives inside the app shell'));
  assert.ok(/#examCompareOverlay\{\s*position:fixed;inset:0;z-index:0/.test(shellCss));
  assert.ok(/#examCompareOverlay \.wr-top\{display:none\}/.test(shellCss), 'no app-within-app header');
  assert.ok(/\.app\.compare-open \.nav\{pointer-events:auto\}/.test(shellCss), 'tabs stay tappable');
  assert.ok(/\.app\.compare-open > main\{display:none\}/.test(shellCss));
  assert.ok(exam.includes("app.classList.toggle('compare-open',open)"));
  assert.ok(exam.includes('setCompareChrome(true)') && exam.includes('setCompareChrome(false)'));
  assert.ok(core.includes("app.classList.contains('compare-open') && typeof closeExamCompare==='function'"),
    'tab taps must close compare before switching views');
  assert.ok(init.includes('try{ closeExamCompare(true); }catch(_){}'));
  assert.ok(/#examCompareOverlay \{ left: 0; right: var\(--sidebar-w\); top: var\(--topbar-h\); bottom: 0; \}/.test(desktop));
});

test('FIX: first sync downloads before uploading so a new device cannot wipe an account', () => {
  const sync = read('js/12-sql-sync.js');
  assert.ok(/if \(firstSync\) \{\s*outcome = await performDownload/.test(sync),
    'first sync must read the SQL account before writing local records');
  assert.ok(!/firstSync && !hasLocalStudyData\(\)/.test(sync),
    'local study data must not turn the first sync into an upload');
  assert.ok(sync.includes('if (outcome.empty) {'),
    'uploading is only a fallback for an empty downloaded account');
  assert.ok(sync.includes('performUpload({ silent: true, all: true });'),
    'seeding an empty account must use a full upload');
  assert.ok(sync.includes('if (accountSwitchPending) {'));
  assert.ok(sync.includes('replaceTrackedState(defaultState(), true)'),
    'a different account must be seeded from clean defaults, not the previous account');
  assert.ok(sync.includes('accountSwitchPending = false;'));
});

console.log('TASK SPEC v1.2.0 — all phase checks');
console.log(results.join('\n'));
console.log(process.exitCode ? 'FAILED' : 'ALL PASSED');
