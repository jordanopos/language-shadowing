import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const maxDuration = 300;
const MAX_BYTES = 25 * 1024 * 1024;

// ── Rule-based sentence splitting ───────────────────────────────────────────
//
// Strategy:
//  1. Whisper returns result.text (full transcript WITH punctuation) and
//     result.words (bare words with start/end timestamps but often NO
//     punctuation).
//  2. We align the punctuated text tokens from result.text to the timed
//     words so each token carries both its punctuation AND its timestamp.
//  3. We split directly on that punctuation with plain code — no LLM call.
//     A period/question mark/exclamation mark ends a sentence. A sentence
//     longer than ~15 words gets split again at the comma closest to its
//     midpoint (only if both halves would be at least 4 words).
//
// Why not an LLM for step 3: asking a model to return numeric word-index
// ranges over a long (700+ word) numbered list causes it to lose count
// partway through — sentences near the start of the transcript come out
// correct, then every boundary after a certain point is off by one word,
// consistently, for the rest of the file. Punctuation-based splitting has
// no such failure mode since it's deterministic.

function plainToken(value = '') {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '');
}

// ── Align punctuated text tokens to timestamped words ────────────────────────

/**
 * Merge result.text (has punctuation) with result.words (has timestamps).
 * Returns an array of { index, word, start, end } where `word` carries
 * punctuation from the text and `start`/`end` come from Whisper timing.
 */
function alignTextToTimestamps(transcriptText, timestampedWords) {
  const textTokens = (String(transcriptText || '').match(/\S+/gu) || []);
  const timed = (timestampedWords || [])
    .filter((w) => w?.word?.trim() && Number.isFinite(w.start) && Number.isFinite(w.end))
    .map((w) => ({ word: w.word.trim(), start: w.start, end: w.end, normalized: plainToken(w.word) }))
    .filter((w) => w.normalized);

  if (!textTokens.length) return [];
  if (!timed.length) return textTokens.map((t, i) => ({ index: i + 1, word: t, start: 0, end: 0 }));

  let cursor = 0;
  let lastEnd = 0;
  const aligned = [];

  for (let t = 0; t < textTokens.length; t++) {
    const token = textTokens[t];
    const norm = plainToken(token);

    // Find the matching timed word by scanning forward
    let found = -1;
    if (norm) {
      const searchEnd = Math.min(timed.length, cursor + 10);
      for (let i = cursor; i < searchEnd; i++) {
        if (timed[i].normalized === norm) {
          found = i;
          break;
        }
      }
      if (found < 0) {
        const wideEnd = Math.min(timed.length, cursor + 30);
        for (let i = cursor; i < wideEnd; i++) {
          if (timed[i].normalized === norm) {
            found = i;
            break;
          }
        }
      }
    }

    let start, end;
    if (found >= 0) {
      start = timed[found].start;
      end = timed[found].end;
      cursor = found + 1;
      lastEnd = end;
    } else {
      start = lastEnd;
      end = lastEnd;
    }

    aligned.push({ index: t + 1, word: token, start, end });
  }

  return aligned;
}

// ── Deterministic sentence-boundary detection ───────────────────────────────

const TERMINAL_RE = /[.!?\u2026]+["'\u201d\u2019)\]]*$/u;
const COMMA_END_RE = /,["'\u201d\u2019)\]]*$/u;

function isTerminal(word) {
  return TERMINAL_RE.test(word);
}

function isCommaEnd(word) {
  return COMMA_END_RE.test(word);
}

const LONG_SENTENCE_WORDS = 15;
const MIN_SPLIT_HALF = 4;

/**
 * If a sentence's token list is longer than LONG_SENTENCE_WORDS, split it
 * at the comma closest to its midpoint — but only if both resulting halves
 * would have at least MIN_SPLIT_HALF words, so we never produce a dangling
 * fragment. Recurses in case a half is still long.
 */
function splitLongRange(tokens) {
  const n = tokens.length;
  if (n <= LONG_SENTENCE_WORDS) return [tokens];

  const commaIdx = [];
  tokens.forEach((t, i) => {
    if (isCommaEnd(t.word)) commaIdx.push(i);
  });
  if (!commaIdx.length) return [tokens];

  const mid = n / 2;
  let best = null;
  let bestDist = Infinity;
  for (const idx of commaIdx) {
    const leftLen = idx + 1;
    const rightLen = n - leftLen;
    if (leftLen < MIN_SPLIT_HALF || rightLen < MIN_SPLIT_HALF) continue;
    const dist = Math.abs(idx - mid);
    if (dist < bestDist) {
      bestDist = dist;
      best = idx;
    }
  }
  if (best === null) return [tokens];

  const left = tokens.slice(0, best + 1);
  const right = tokens.slice(best + 1);
  return [...splitLongRange(left), ...splitLongRange(right)];
}

/**
 * Group aligned tokens into sentences by walking forward and cutting at
 * terminal punctuation. Any trailing tokens with no terminal punctuation
 * (audio cut off mid-sentence) become a final fragment segment.
 */
function buildSentenceGroups(alignedWords) {
  const groups = [];
  let current = [];
  for (const w of alignedWords) {
    current.push(w);
    if (isTerminal(w.word)) {
      groups.push(current);
      current = [];
    }
  }
  if (current.length) groups.push(current);

  const final = [];
  for (const g of groups) {
    final.push(...splitLongRange(g));
  }
  return final;
}

// ── Segment construction ────────────────────────────────────────────────────

function capitalize(text) {
  const first = text.search(/[\p{L}\p{N}]/u);
  if (first < 0) return text;
  return text.slice(0, first) + text[first].toLocaleUpperCase('pt-BR') + text.slice(first + 1);
}

function buildSegmentFromTokens(tokens) {
  if (!tokens.length) return null;
  let text = tokens.map((w) => w.word).join(' ');
  text = text.replace(/\s+([,.;:!?\u2026])/gu, '$1').trim();
  text = capitalize(text);

  return {
    text,
    start: Math.max(0, tokens[0].start),
    end: Math.max(tokens[0].start + 0.12, tokens[tokens.length - 1].end),
  };
}

/**
 * Main entry: align punctuated text with timestamps, split on punctuation,
 * build segments from the original tokens (no rewriting, so hallucination
 * is impossible and punctuation is preserved).
 */
function makeSentences(transcriptText, whisperWords) {
  const aligned = alignTextToTimestamps(transcriptText, whisperWords);
  if (!aligned.length) return [];

  const groups = buildSentenceGroups(aligned);
  return groups.map(buildSegmentFromTokens).filter(Boolean);
}

// ── Route handler ────────────────────────────────────────────────────────────

export async function POST(request) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "Transcription is not configured yet. Add OPENAI_API_KEY to the app\u2019s .env.local file, then restart the server." },
      { status: 503 },
    );
  }
  try {
    const data = await request.formData();
    const file = data.get('file');
    const language = data.get('language');
    if (!(file instanceof File) || !file.size) return NextResponse.json({ error: 'Choose a non-empty audio or video file first.' }, { status: 400 });
    if (file.size > MAX_BYTES) return NextResponse.json({ error: 'This file is over the 25 MB transcription limit. Compress or trim it, then try again.' }, { status: 413 });
    if (!/\.(mp3|mp4|mpeg|mpga|m4a|wav|webm|flac|ogg)$/i.test(file.name)) {
      return NextResponse.json({ error: 'Use an MP3, MP4, WAV, M4A, WEBM, FLAC, or OGG file.' }, { status: 415 });
    }

    // Step 1: Transcribe with Whisper (word-level timestamps)
    const form = new FormData();
    form.append('file', new Blob([await file.arrayBuffer()], { type: file.type || 'application/octet-stream' }), file.name);
    form.append('model', 'whisper-1');
    form.append('response_format', 'verbose_json');
    form.append('timestamp_granularities[]', 'word');
    if (language && language !== 'auto') form.append('language', String(language).split('-')[0]);

    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST', headers: { Authorization: `Bearer ${apiKey}` }, body: form,
      signal: AbortSignal.timeout(240_000),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      return NextResponse.json({ error: result?.error?.message || 'The speech-to-text service could not process this file.' }, { status: response.status === 401 ? 502 : response.status });
    }
    const words = (result.words || []).map(({ word, start, end }) => ({ word, start, end }));

    // Step 2: Split into sentences deterministically, from punctuation
    const segments = makeSentences(result.text || '', words);

    if (!segments.length && result.text) {
      return NextResponse.json({ error: 'A transcript was returned, but sentence splitting failed. Try again.' }, { status: 502 });
    }
    return NextResponse.json({ text: result.text || '', duration: Number(result.duration) || segments.at(-1)?.end || 0, segments, words });
  } catch (error) {
    const message = error?.name === 'TimeoutError' ? 'Transcription took too long. Try a shorter audio clip.' : 'Could not transcribe this file. Check your connection and try again.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}