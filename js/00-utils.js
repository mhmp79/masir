'use strict';

/* ============================================================
   UTILS — shared pure helpers
   نسخه ۱.۰.۰ — string similarity
   ============================================================ */

const FA_DIGITS_MAP = '۰۱۲۳۴۵۶۷۸۹';

/** Levenshtein edit distance (case-sensitive by design; callers normalize). */
function levenshtein(a, b) {
  const left = String(a == null ? '' : a);
  const right = String(b == null ? '' : b);
  if (left === right) return 0;
  if (!left.length) return right.length;
  if (!right.length) return left.length;
  let previous = Array.from({ length: right.length + 1 }, (_, i) => i);
  for (let i = 1; i <= left.length; i++) {
    const current = [i];
    for (let j = 1; j <= right.length; j++) {
      const cost = left[i - 1] === right[j - 1] ? 0 : 1;
      current[j] = Math.min(
        current[j - 1] + 1,
        previous[j] + 1,
        previous[j - 1] + cost
      );
    }
    previous = current;
  }
  return previous[right.length];
}

/** Jaccard similarity over a token list/string. */
function jaccard(a, b) {
  const tokens = (value) => new Set(
    String(value == null ? '' : value)
      .split(/[\s,،_/\-]+/)
      .map((token) => token.trim())
      .filter(Boolean)
  );
  const left = tokens(a);
  const right = tokens(b);
  if (!left.size && !right.size) return 1;
  if (!left.size || !right.size) return 0;
  let intersection = 0;
  left.forEach((token) => { if (right.has(token)) intersection++; });
  const union = left.size + right.size - intersection;
  return union ? intersection / union : 0;
}

/* ---------- FEAT-7: question-type similarity / auto-group ---------- */
function normalizeTypeLabel(label) {
  return String(label == null ? '' : label)
    .replace(/[۰-۹]/g, (d) => String(FA_DIGITS_MAP.indexOf(d)))
    .replace(/[\u064B-\u065F\u0640]/g, '')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function questionTypeSimilarity(a, b) {
  const left = normalizeTypeLabel(a);
  const right = normalizeTypeLabel(b);
  if (!left || !right) return 0;
  if (left === right) return 1;
  const maxLen = Math.max(left.length, right.length);
  const editScore = 1 - levenshtein(left, right) / maxLen;
  const tokenScore = jaccard(left, right);
  return Math.max(editScore, tokenScore);
}

/* FEAT-7 thresholds: at least two similar types, and the suggested cluster
   must cover at least 30% of the subject's question types. */
function suggestQuestionTypeGroups(types, options) {
  const opts = options || {};
  const threshold = opts.threshold == null ? 0.65 : +opts.threshold;
  const minCount = opts.minCount == null ? 2 : +opts.minCount;
  const minShare = opts.minShare == null ? 0.3 : +opts.minShare;
  const list = (types || []).filter(Boolean).map((type, index) => ({
    type, index, label: type.label != null ? type.label : String(type)
  }));
  if (list.length < minCount) return [];
  const parent = list.map((_, i) => i);
  const find = (i) => { while (parent[i] !== i) { parent[i] = parent[parent[i]]; i = parent[i]; } return i; };
  const union = (a, b) => { const ra = find(a), rb = find(b); if (ra !== rb) parent[rb] = ra; };
  for (let i = 0; i < list.length; i++) {
    for (let j = i + 1; j < list.length; j++) {
      if (questionTypeSimilarity(list[i].label, list[j].label) >= threshold) union(i, j);
    }
  }
  const clusters = new Map();
  list.forEach((item, i) => {
    const root = find(i);
    if (!clusters.has(root)) clusters.set(root, []);
    clusters.get(root).push(item);
  });
  return [...clusters.values()]
    .filter((members) => members.length >= minCount && members.length / list.length >= minShare)
    .map((members) => ({
      members,
      count: members.length,
      share: members.length / list.length,
      score: members.slice(1).reduce((sum, member) =>
        sum + questionTypeSimilarity(members[0].label, member.label), 0) / (members.length - 1)
    }))
    .sort((a, b) => b.score - a.score || b.count - a.count);
}


/* Test/debug hook: harmless in the browser, useful for node-based checks. */
if (typeof globalThis !== 'undefined') {
  globalThis.__masirUtils = {
    levenshtein, jaccard,
    normalizeTypeLabel, questionTypeSimilarity, suggestQuestionTypeGroups,
  };
}
