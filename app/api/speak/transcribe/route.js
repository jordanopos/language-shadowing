import { NextResponse } from 'next/server';
import { SPEAK_LIMITS } from '../../../../lib/speak/categories';

// Speak & Improve transcription. Deliberately separate from /api/transcribe
// (the shadowing route): no word timestamps, no phrase splitting, and the
// prompt nudges Whisper towards a verbatim transcript that keeps mistakes,
// hesitations and English words instead of "cleaning them up".

export const runtime = 'nodejs';
export const maxDuration = 300;

// Whisper follows the *style* of the prompt. A short example containing a
// grammar slip, fillers and an English word encourages verbatim output.
const VERBATIM_PROMPT = 'Então, tipo, eu acho que eles também tinha razão, né? Mas minha opinião é meio biased, sabe?';

const EXT_RE = new RegExp(`\\.(${SPEAK_LIMITS.audioExtensions.join('|')})$`, 'i');

export async function POST(request) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: 'Transcription is not configured yet. Add OPENAI_API_KEY to the app\u2019s .env.local file, then restart the server.' },
      { status: 503 },
    );
  }

  let file;
  try {
    const data = await request.formData();
    file = data.get('file');
  } catch {
    return NextResponse.json({ error: 'The upload could not be read. Try again.' }, { status: 400 });
  }

  if (!(file instanceof File) || !file.size) {
    return NextResponse.json({ error: 'No audio was received. Record or choose an audio file first.' }, { status: 400 });
  }
  if (file.size > SPEAK_LIMITS.maxAudioBytes) {
    return NextResponse.json({ error: 'This audio is over the 25 MB transcription limit. Try a shorter recording.' }, { status: 413 });
  }
  if (!EXT_RE.test(file.name || '')) {
    return NextResponse.json({ error: 'Unsupported audio format. Use MP3, M4A, WAV, WEBM, OGG, FLAC or MP4.' }, { status: 415 });
  }

  try {
    const form = new FormData();
    form.append('file', new Blob([await file.arrayBuffer()], { type: file.type || 'application/octet-stream' }), file.name);
    form.append('model', 'whisper-1');
    form.append('language', 'pt');
    form.append('response_format', 'verbose_json');
    form.append('temperature', '0');
    form.append('prompt', VERBATIM_PROMPT);

    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form,
      signal: AbortSignal.any([request.signal, AbortSignal.timeout(180_000)]),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      const status = response.status === 401 ? 502 : response.status === 429 ? 429 : response.status >= 500 ? 502 : 400;
      return NextResponse.json(
        { error: result?.error?.message || 'The speech-to-text service could not process this audio.' },
        { status },
      );
    }

    const text = String(result.text || '').trim();
    // Whisper occasionally echoes the prompt on silent audio — treat as empty.
    if (!text || text === VERBATIM_PROMPT) {
      return NextResponse.json(
        { error: 'No speech was detected. Check your microphone and try recording again.' },
        { status: 422 },
      );
    }
    return NextResponse.json({ text, duration: Number(result.duration) || null });
  } catch (error) {
    if (error?.name === 'AbortError') {
      return NextResponse.json({ error: 'Transcription was cancelled.' }, { status: 499 });
    }
    const message = error?.name === 'TimeoutError'
      ? 'Transcription took too long. Try a shorter recording.'
      : 'Could not reach the transcription service. Check your connection and try again.';
    return NextResponse.json({ error: message }, { status: 504 });
  }
}
