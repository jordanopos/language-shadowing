import { NextResponse } from 'next/server';
import { SPEAK_LIMITS } from '../../../../lib/speak/categories';
import { normalizeTranscript, splitSegments, alignAnalysis } from '../../../../lib/speak/alignment';
import { TUTOR_SYSTEM_PROMPT, ANALYSIS_JSON_SCHEMA, validateAnalysis, InvalidAnalysisError } from '../../../../lib/speak/analysis-schema';

export const runtime = 'nodejs';
export const maxDuration = 300;

// Override with OPENAI_ANALYSIS_MODEL in .env.local. Must support
// Structured Outputs (response_format: json_schema, strict: true).
const MODEL = process.env.OPENAI_ANALYSIS_MODEL || 'gpt-4o';

export async function POST(request) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: 'Analysis is not configured yet. Add OPENAI_API_KEY to the app\u2019s .env.local file, then restart the server.' },
      { status: 503 },
    );
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }

  const text = normalizeTranscript(typeof body?.text === 'string' ? body.text : '');
  if (!text) return NextResponse.json({ error: 'There is no Portuguese text to analyse yet.' }, { status: 400 });
  if (text.length > SPEAK_LIMITS.maxTextChars) {
    return NextResponse.json(
      { error: `This transcription is too long (${text.length.toLocaleString()} characters). Keep it under ${SPEAK_LIMITS.maxTextChars.toLocaleString()} characters.` },
      { status: 413 },
    );
  }

  const segments = splitSegments(text);
  if (!segments.length) return NextResponse.json({ error: 'There is no Portuguese text to analyse yet.' }, { status: 400 });

  // The transcription is untrusted learner content: it goes in the user turn as
  // JSON data and the system prompt tells the model to treat it only as speech.
  const userContent = JSON.stringify({ segments: segments.map(({ id, text: t }) => ({ id, text: t })) });

  let completion;
  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: MODEL,
        temperature: 0.2,
        max_completion_tokens: 16_000,
        messages: [
          { role: 'system', content: TUTOR_SYSTEM_PROMPT },
          { role: 'user', content: userContent },
        ],
        response_format: {
          type: 'json_schema',
          json_schema: { name: 'portuguese_speaking_analysis', strict: true, schema: ANALYSIS_JSON_SCHEMA },
        },
      }),
      signal: AbortSignal.any([request.signal, AbortSignal.timeout(240_000)]),
    });
    completion = await response.json().catch(() => ({}));
    if (!response.ok) {
      const status = response.status === 401 ? 502 : response.status === 429 ? 429 : response.status >= 500 ? 502 : 400;
      return NextResponse.json(
        { error: completion?.error?.message || 'The analysis service returned an error. Try again.', retryable: true },
        { status },
      );
    }
  } catch (error) {
    if (error?.name === 'AbortError') {
      return NextResponse.json({ error: 'Analysis was cancelled.' }, { status: 499 });
    }
    const message = error?.name === 'TimeoutError'
      ? 'The analysis took too long. Try again, or analyse a shorter passage.'
      : 'Could not reach the analysis service. Check your connection and try again.';
    return NextResponse.json({ error: message, retryable: true }, { status: 504 });
  }

  const choice = completion?.choices?.[0];
  if (choice?.message?.refusal) {
    return NextResponse.json({ error: 'The model declined to analyse this text.', retryable: false }, { status: 422 });
  }
  if (choice?.finish_reason === 'length') {
    return NextResponse.json(
      { error: 'The analysis was cut off because the passage is long. Try a shorter passage.', retryable: true },
      { status: 502 },
    );
  }

  try {
    const parsed = JSON.parse(choice?.message?.content || '');
    const validated = validateAnalysis(parsed, segments.map(s => s.id));
    const aligned = alignAnalysis(segments, validated.segments);

    return NextResponse.json({
      model: completion.model || MODEL,
      original_text: aligned.originalText,
      corrected_text: aligned.correctedText,
      segments: aligned.segments,
      corrections: aligned.corrections,
      alignment: { ...aligned.alignment, missing_segments: validated.missing_segment_ids.length },
      detailed_analysis_markdown: validated.detailed_analysis_markdown,
      vocabulary: validated.vocabulary,
      overall_feedback: validated.overall_feedback,
    });
  } catch (error) {
    const message = error instanceof InvalidAnalysisError
      ? `${error.message} Try again.`
      : 'The analysis came back in an unexpected format. Try again.';
    return NextResponse.json({ error: message, retryable: true }, { status: 502 });
  }
}
