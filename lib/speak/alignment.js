// Deterministic text segmentation + correction span alignment for Speak & Improve.
//
// Strategy (see speak-and-improve.md §8 "Correction-to-Text Alignment"):
//  1. The confirmed transcription is the canonical original text.
//  2. We split it into sentence segments ourselves, keeping the exact
//     whitespace between them, so `segments.map(s => s.text + s.sep).join('')`
//     always reconstructs the original byte-for-byte.
//  3. The model only returns, per segment ID, the corrected sentence plus the
//     exact substrings that changed. It never returns character offsets.
//  4. We locate each substring ourselves with exact string matching. When a
//     substring occurs more than once in a segment we disambiguate with a
//     word-level diff (the occurrence that actually changed) and the model's
//     1-based occurrence hint. If it is still ambiguous, or not found, the
//     correction is kept but marked unaligned so the UI shows it in the
//     explanation panel without guessing an inline highlight.

const TERMINAL = /[.!?\u2026]/u;
const CLOSERS = /[.!?\u2026"'\u201d\u2019)\]»]/u;
const WS = /\s/u;
const WORD_CHAR = /[\p{L}\p{N}]/u;

export function normalizeTranscript(text) {
  return String(text ?? '')
    .replace(/\r\n?/g, '\n')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/[ \t]+\n/g, '\n')
    .trim();
}

/** Split normalized text into sentence segments that reconstruct it exactly. */
export function splitSegments(text) {
  const segments = [];
  const n = text.length;
  let i = 0;
  while (i < n) {
    let j = i;
    while (j < n) {
      const ch = text[j];
      if (ch === '\n') break;
      if (TERMINAL.test(ch)) {
        let k = j + 1;
        while (k < n && CLOSERS.test(text[k])) k++;
        if (k >= n || WS.test(text[k])) { j = k; break; }
        j = k;
        continue;
      }
      j++;
    }
    const body = text.slice(i, j);
    let k = j;
    while (k < n && WS.test(text[k])) k++;
    const sep = text.slice(j, k);
    if (body) segments.push({ id: `s${segments.length + 1}`, text: body, sep });
    else if (segments.length) segments[segments.length - 1].sep += sep;
    i = k;
  }
  return segments;
}

// ── Word-level diff (LCS) ────────────────────────────────────────────────────

function normToken(raw) {
  const plain = raw.normalize('NFC').toLocaleLowerCase('pt-BR').replace(/[^\p{L}\p{N}]+/gu, '');
  return plain || raw;
}

function tokenize(s) {
  const out = [];
  const re = /\S+/gu;
  let m;
  while ((m = re.exec(s))) out.push({ t: normToken(m[0]), start: m.index, end: m.index + m[0].length });
  return out;
}

/** Char ranges in `a` and `b` that are not part of the word-level LCS. */
export function diffRanges(a, b) {
  const A = tokenize(a);
  const B = tokenize(b);
  if (A.length * B.length > 250_000) return null;
  const dp = Array.from({ length: A.length + 1 }, () => new Uint16Array(B.length + 1));
  for (let i = A.length - 1; i >= 0; i--) {
    for (let j = B.length - 1; j >= 0; j--) {
      dp[i][j] = A[i].t === B[j].t ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const orig = [];
  const corr = [];
  let i = 0;
  let j = 0;
  while (i < A.length && j < B.length) {
    if (A[i].t === B[j].t) { i++; j++; }
    else if (dp[i + 1][j] >= dp[i][j + 1]) orig.push([A[i].start, A[i].end]), i++;
    else corr.push([B[j].start, B[j].end]), j++;
  }
  while (i < A.length) orig.push([A[i].start, A[i].end]), i++;
  while (j < B.length) corr.push([B[j].start, B[j].end]), j++;
  return { orig, corr };
}

// ── Exact substring location ────────────────────────────────────────────────

const overlaps = (s, e, ranges) => ranges.some(([rs, re]) => s < re && e > rs);

function allOccurrences(haystack, needle) {
  const out = [];
  if (!needle) return out;
  let idx = haystack.indexOf(needle);
  while (idx !== -1) {
    out.push(idx);
    idx = haystack.indexOf(needle, idx + 1);
  }
  return out;
}

function atWordBoundary(text, start, end) {
  const before = start > 0 ? text[start - 1] : '';
  const after = end < text.length ? text[end] : '';
  const firstIsWord = WORD_CHAR.test(text[start] || '');
  const lastIsWord = WORD_CHAR.test(text[end - 1] || '');
  return !(firstIsWord && WORD_CHAR.test(before)) && !(lastIsWord && WORD_CHAR.test(after));
}

/**
 * Find the start index of `needle` in `text`, or null if it can't be pinned
 * down confidently. Never falls back to "first occurrence" when ambiguous.
 */
export function locate(text, needle, { changed, used = [], hint } = {}) {
  let target = needle;
  let occ = allOccurrences(text, target);
  if (!occ.length && target.trim() !== target) {
    target = target.trim();
    occ = allOccurrences(text, target);
  }
  if (!occ.length) return null;
  const len = target.length;

  const whole = occ.filter(o => atWordBoundary(text, o, o + len));
  if (whole.length) occ = whole;

  let cands = occ.filter(o => !overlaps(o, o + len, used));
  if (changed?.length) {
    const inDiff = cands.filter(o => overlaps(o, o + len, changed));
    if (inDiff.length) cands = inDiff;
  }
  if (cands.length === 1) return { start: cands[0], end: cands[0] + len };
  if (Number.isInteger(hint) && hint >= 1 && hint <= occ.length && cands.includes(occ[hint - 1])) {
    return { start: occ[hint - 1], end: occ[hint - 1] + len };
  }
  return null;
}

/**
 * Combine canonical segments with the validated model output.
 * Returns segments with corrected text, plus corrections with verified spans.
 */
export function alignAnalysis(segments, modelSegments) {
  const byId = new Map(modelSegments.map(s => [s.id, s]));
  const outSegments = [];
  const corrections = [];
  let origCursor = 0;
  let corrCursor = 0;

  segments.forEach((seg, segIndex) => {
    const model = byId.get(seg.id);
    let corrected = typeof model?.corrected === 'string' ? model.corrected.trim() : '';
    // A segment the model dropped or blanked keeps the original wording, so the
    // corrected text never loses content.
    if (!corrected) corrected = seg.text;

    const diff = diffRanges(seg.text, corrected);
    const usedOrig = [];
    const usedCorr = [];
    const segCorrections = [];

    for (const raw of model?.corrections || []) {
      const o = locate(seg.text, raw.original, { changed: diff?.orig, used: usedOrig, hint: raw.occurrence });
      if (o) usedOrig.push([o.start, o.end]);
      const sameText = raw.replacement === raw.original;
      const r = !sameText && raw.replacement
        ? locate(corrected, raw.replacement, { changed: diff?.corr, used: usedCorr, hint: raw.replacement_occurrence })
        : null;
      if (r) usedCorr.push([r.start, r.end]);

      segCorrections.push({
        segment_id: seg.id,
        segment_index: segIndex,
        original: raw.original,
        replacement: raw.replacement,
        category: raw.category,
        type: raw.type,
        severity: raw.severity,
        short_explanation: raw.short_explanation,
        detailed_explanation: raw.detailed_explanation,
        rule: raw.rule,
        alternatives: raw.alternatives,
        examples: raw.examples,
        original_span: o ? { start: o.start, end: o.end, global_start: origCursor + o.start, global_end: origCursor + o.end } : null,
        corrected_span: r ? { start: r.start, end: r.end, global_start: corrCursor + r.start, global_end: corrCursor + r.end } : null,
      });
    }

    // Reading order within the segment; unaligned ones go last.
    segCorrections.sort((a, b) => (a.original_span?.start ?? Infinity) - (b.original_span?.start ?? Infinity));
    corrections.push(...segCorrections);

    outSegments.push({
      id: seg.id,
      original: seg.text,
      corrected,
      sep: seg.sep,
      paragraph_break: /\n\s*\n/.test(seg.sep),
      line_break: seg.sep.includes('\n'),
    });
    origCursor += seg.text.length + seg.sep.length;
    corrCursor += corrected.length + seg.sep.length;
  });

  corrections.forEach((c, i) => { c.id = `c${i + 1}`; });
  const idsBySegment = new Map();
  corrections.forEach(c => {
    if (!idsBySegment.has(c.segment_id)) idsBySegment.set(c.segment_id, []);
    idsBySegment.get(c.segment_id).push(c.id);
  });
  outSegments.forEach(s => { s.correction_ids = idsBySegment.get(s.id) || []; });

  const originalText = outSegments.map(s => s.original + s.sep).join('');
  const correctedText = outSegments.map(s => s.corrected + s.sep).join('');
  return {
    segments: outSegments,
    corrections,
    originalText,
    correctedText,
    alignment: {
      total: corrections.length,
      original_aligned: corrections.filter(c => c.original_span).length,
      corrected_aligned: corrections.filter(c => c.corrected_span).length,
    },
  };
}
