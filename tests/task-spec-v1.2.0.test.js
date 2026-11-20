'use strict';
/* Tests for TASK SPEC v1.2.0 — EXAM SECTION + TIMELINE.
   Run: node tests/task-spec-v1.2.0.test.js
   The app is browser-oriented, so pure functions are extracted from source and
   evaluated in a small vm sandbox; no DOM or network is required. */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

function extractFunction(source, name) {
  const match = new RegExp(`(?:function|const|let|var)\\s+${name}\\s*(?:=\\s*)?\\(`).exec(source);
  if (!match) throw new Error(`function ${name} not found`);
  const open = source.indexOf('{', match.index);
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

test('FEAT-8: pending questions never count as analyzed in dashboard insights', () => {
  const sandbox = loadFunctions('js/05-exam.js', ['isQuestionAnalyzed', 'examInsights'], {
    state: {
      subjects: [{ name: 'ریاضی', type: 'specialized' }],
      exams: [{
        id: 'e1',
        questions: [
          { id: 'q1', subject: 'ریاضی', status: 'wrong', note: 'note', questionTypes: [] },
          { id: 'q2', subject: 'ریاضی', status: 'pending', note: 'draft only', questionTypes: [] }
        ]
      }]
    },
    getSortedQuestions: (exam) => exam.questions
  });
  const d = sandbox.examInsights();
  assert.strictEqual(d.total, 2);
  assert.strictEqual(d.answered, 1);
  assert.strictEqual(d.analyzed, 1, 'pending question with text must not count as analyzed');
});

/* ---------- Static integration checks ---------- */
test('P4: exam layout uses 280px grid, sticky sidebar and mobile drawer', () => {
  const css = read('css/09-exam.css');
  const html = read('index.html');
  assert.ok(/grid-template-columns:\s*280px minmax\(0,1fr\)/.test(css));
  assert.ok(/position:sticky;top:16px/.test(css));
  assert.ok(/max-height:90vh/.test(css));
  assert.ok(/overflow-y:auto/.test(css));
  assert.ok(html.includes('examSidebarToggle'), 'mobile drawer button missing');
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

console.log('TASK SPEC v1.2.0 — all phase checks');
console.log(results.join('\n'));
console.log(process.exitCode ? 'FAILED' : 'ALL PASSED');
