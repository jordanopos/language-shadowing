import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const maxDuration = 30;

export async function POST(request) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: 'Translation is not configured yet. Add OPENAI_API_KEY to the app\u2019s .env.local file, then restart the server.' },
      { status: 503 },
    );
  }

  try {
    const { text } = await request.json();
    if (!text || typeof text !== 'string' || !text.trim()) {
      return NextResponse.json({ error: 'No text provided to translate.' }, { status: 400 });
    }

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        temperature: 0.2,
        max_tokens: 1024,
        messages: [
          {
            role: 'system',
            content:
              'You are a precise translator. Translate the following text into English. Return ONLY the English translation, nothing else — no quotes, no explanation, no preamble.',
          },
          { role: 'user', content: text.trim() },
        ],
      }),
      signal: AbortSignal.timeout(20_000),
    });

    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      return NextResponse.json(
        { error: result?.error?.message || 'The translation service could not process this text.' },
        { status: response.status === 401 ? 502 : response.status },
      );
    }

    const translation = result.choices?.[0]?.message?.content?.trim();
    if (!translation) {
      return NextResponse.json({ error: 'No translation was returned.' }, { status: 502 });
    }

    return NextResponse.json({ translation });
  } catch (error) {
    const message =
      error?.name === 'TimeoutError'
        ? 'Translation took too long. Try again.'
        : 'Could not translate this text. Check your connection and try again.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
