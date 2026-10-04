'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { saveLesson } from '../lib/lesson-store';

const ACCEPT = '.mp3,.mp4,.mpeg,.mpga,.m4a,.wav,.webm,.flac,.ogg';
const LANGUAGES = [
  ['auto', 'Auto-detect'], ['en', 'English'], ['pt', 'Português'], ['es', 'Español'],
  ['fr', 'Français'], ['de', 'Deutsch'], ['it', 'Italiano'], ['ja', '日本語'],
  ['ko', '한국어'], ['zh', '中文'], ['ru', 'Русский'], ['ar', 'العربية'],
];

export default function UploadPage() {
  const router = useRouter();
  const fileInput = useRef(null);
  const [file, setFile] = useState(null);
  const [language, setLanguage] = useState('auto');
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  function choose(next) {
    setError('');
    if (!next) return;
    if (next.size > 25 * 1024 * 1024) {
      setFile(null);
      setError('This file is over the 25 MB transcription limit. Try a shorter or compressed file.');
      return;
    }
    setFile(next);
  }

  async function transcribe() {
    if (!file || busy) return;
    setBusy(true);
    setError('');
    try {
      const body = new FormData();
      body.append('file', file);
      body.append('language', language);
      const response = await fetch('/api/transcribe', { method: 'POST', body });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Transcription failed. Try again.');
      if (!result.segments?.length) throw new Error('No speech was found in this file. Try a clip with clearer speech.');
      const lesson = {
        id: crypto.randomUUID(), title: file.name.replace(/\.[^.]+$/, '') || 'Untitled lesson',
        fileName: file.name, blob: file, language, duration: result.duration,
        transcript: result.text, words: result.words, segments: result.segments, done: [], createdAt: Date.now(),
      };
      await saveLesson(lesson);
      sessionStorage.setItem('shadow-active-lesson', lesson.id);
      router.push('/practice');
    } catch (e) {
      setError(e.message || 'Something went wrong. Check your connection and try again.');
      setBusy(false);
    }
  }

  return <main className="upload-page">
    <header className="app-header upload-header">
      <button className="brand brand-button" onClick={() => router.push('/')}><span className="brand-mark">↗</span>shadow</button>
      <button className="library-button" onClick={() => router.push('/lessons')}>My Lessons</button>
    </header>
    <div className="upload-content">
      <div className="hero-brand"><span className="hero-mark">↗</span><span className="hero-name">shadow</span></div>
      <p className="intro">Upload a video or audio clip. We’ll transcribe it, find the natural sentence breaks, and build your practice lesson.</p>

      <section className="upload-card">
        <div className="steps"><span className="step active"><i>1</i> Upload</span><b /><span className="step"><i>2</i> Transcribe</span><b /><span className="step"><i>3</i> Shadow</span></div>
        <button className={`drop-area${dragging ? ' dragging' : ''}${file ? ' has-file' : ''}`} type="button"
          onClick={() => !busy && fileInput.current?.click()}
          onDragOver={e => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={e => { e.preventDefault(); setDragging(false); choose(e.dataTransfer.files?.[0]); }}>
          <input ref={fileInput} type="file" accept={ACCEPT} hidden onChange={e => choose(e.target.files?.[0])} />
          <span className="upload-symbol">{file ? '♫' : '↑'}</span>
          {file ? <><strong>{file.name}</strong><small>{formatSize(file.size)} · Ready to transcribe</small></> : <><strong>Drop your video or audio here</strong><small>or click to browse your files</small></>}
          <span className="file-types">MP4 · MP3 · WAV · M4A · WEBM</span>
        </button>
        <div className="upload-options">
          <label htmlFor="language-select">What language is spoken?</label>
          <select id="language-select" value={language} onChange={e => setLanguage(e.target.value)} disabled={busy}>
            {LANGUAGES.map(([value, label]) => <option value={value} key={value}>{label}</option>)}
          </select>
        </div>
        {error && <div className="error-box" role="alert"><span>!</span><div>{error}{error.includes('OPENAI_API_KEY') && <p>Set it in <code>.env.local</code> in the app folder, then restart the server.</p>}</div></div>}
        {busy ? <div className="transcribing" aria-live="polite"><span className="spinner" /><div><strong>Listening closely…</strong><small>Transcribing and finding natural phrase breaks. This can take a minute for longer clips.</small></div></div> : <button className="start-button" disabled={!file} onClick={transcribe}>Transcribe &amp; make my lesson <span>→</span></button>}
        <div className="upload-foot"><span>✦</span> Your audio is sent to the speech-to-text service to create the transcript. The lesson is saved in this browser.</div>
      </section>
      <div className="next-hint"><span>♫</span><p><b>Then you shadow.</b> Listen to each phrase, repeat it in your own voice, and let the lesson guide you through.</p></div>
    </div>
  </main>;
}

function formatSize(n) { return n < 1024 * 1024 ? `${Math.max(1, Math.round(n / 1024))} KB` : `${(n / 1024 / 1024).toFixed(1)} MB`; }
