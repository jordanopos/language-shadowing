# Shadow — language shadowing practice

A two-page Next.js app. The first page accepts an audio/video file and spoken-language choice, transcribes it on the server, splits the word-timestamped result into practice phrases, saves the media and transcript in IndexedDB, then navigates to `/practice`. The practice page plays each timed phrase with short audio fades at the phrase boundaries, turns the microphone on between phrases, detects speech followed by silence, and advances automatically (or waits for Next in Manual mode). It preserves the timestamped words with spaces and favors punctuation, longer pauses, and clause starters such as “Mas” when splitting phrases. Existing saved lessons can use **Refresh transcript & phrase breaks** to rebuild their rows; choosing this sends that audio to the transcription service again.

## Run locally

1. Install Node.js 20.9 or newer.
2. In this directory, install packages with `npm install`.
3. Copy `.env.example` to `.env.local` and set `OPENAI_API_KEY` to an OpenAI API key that can use audio transcription.
4. Run `npm run dev` and open the local URL printed by Next.js.
5. Open the app over `localhost` or HTTPS so the browser can grant microphone access.

Transcription uses OpenAI's `/v1/audio/transcriptions` endpoint with the `whisper-1` model and word-level timestamps. Keep the API key on the server in `.env.local`; it is never sent to the browser. The transcription endpoint currently accepts files up to 25 MB. API usage may incur provider charges. Audio must be sent to the transcription provider to create the lesson.

The browser saves the original media and lesson in IndexedDB on that device. Clearing site data removes saved lessons. Supported upload types are MP3, MP4, MPEG, MPGA, M4A, WAV, WEBM, FLAC, and OGG. Playback format support depends on the browser.
