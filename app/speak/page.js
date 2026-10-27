'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import FeatureTabs from '../_components/FeatureTabs';
import SpeakHeader, { formatDuration, formatSize } from './_components/SpeakHeader';
import Recorder from './_components/Recorder';
import { SPEAK_LIMITS } from '../../lib/speak/categories';
import { saveSession, SESSION_SCHEMA_VERSION } from '../../lib/speak/session-store';

const ACCEPT = SPEAK_LIMITS.audioExtensions.map(e => `.${e}`).join(',') + ',audio/*';
const DRAFT_KEY = 'speak-improve-draft';
const MODES = [
  { id: 'record', label: 'Record', icon: '🎙' },
  { id: 'upload', label: 'Upload audio', icon: '↑' },
  { id: 'text', label: 'Paste text', icon: '✎' },
];

function newId() {
  return typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `s-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function makeTitle(text) {
  const words = text.replace(/\s+/g, ' ').trim().split(' ');
  return words.slice(0, 8).join(' ') + (words.length > 8 ? '…' : '');
}

async function readJson(response) {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const err = new Error(data.error || `Request failed (${response.status}). Try again.`);
    err.status = response.status;
    throw err;
  }
  return data;
}

export default function SpeakPage() {
  const router = useRouter();
  const fileInput = useRef(null);
  const abortRef = useRef(null);

  const [mode, setMode] = useState('record');
  const [audio, setAudio] = useState(null); // { blob, fileName, duration, source }
  const [audioUrl, setAudioUrl] = useState('');
  const [stage, setStage] = useState('input'); // input | transcribing | review | analyzing | saving
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState(null); // { message, action }
  const [dragging, setDragging] = useState(false);
  const [pending, setPending] = useState(null); // analysed session that failed to save
  const [restored, setRestored] = useState(false);

  // Object URL for preview playback.
  useEffect(() => {
    if (!audio?.blob) { setAudioUrl(''); return; }
    const url = URL.createObjectURL(audio.blob);
    setAudioUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [audio]);

  // Restore a draft transcription after an accidental refresh.
  useEffect(() => {
    try {
      const draft = JSON.parse(sessionStorage.getItem(DRAFT_KEY) || 'null');
      if (draft?.transcript) {
        setTranscript(draft.transcript);
        setMode(draft.mode === 'text' ? 'text' : draft.mode || 'record');
        if (draft.mode !== 'text') setStage('review');
        setRestored(true);
      }
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    try {
      if (transcript.trim()) sessionStorage.setItem(DRAFT_KEY, JSON.stringify({ transcript, mode }));
      else sessionStorage.removeItem(DRAFT_KEY);
    } catch { /* ignore */ }
  }, [transcript, mode]);

  useEffect(() => () => abortRef.current?.abort(), []);

  const busy = stage === 'transcribing' || stage === 'analyzing' || stage === 'saving';
  const tooLong = transcript.length > SPEAK_LIMITS.maxTextChars;
  const showEditor = stage === 'review' || (mode === 'text' && stage !== 'transcribing') || (stage === 'analyzing' || stage === 'saving');

  function switchMode(next) {
    if (busy || next === mode) return;
    setError(null);
    setMode(next);
    if (next === 'text') setStage('input');
    else if (stage === 'review' && !audio) setStage('input');
  }

  function chooseFile(file) {
    setError(null);
    if (!file) return;
    const ext = (file.name.split('.').pop() || '').toLowerCase();
    if (!SPEAK_LIMITS.audioExtensions.includes(ext)) {
      setError({ message: `“.${ext}” files aren’t supported. Use MP3, M4A, WAV, WEBM, OGG, FLAC or MP4.` });
      return;
    }
    if (file.size > SPEAK_LIMITS.maxAudioBytes) {
      setError({ message: `This file is ${formatSize(file.size)} — over the 25 MB transcription limit. Trim or compress it and try again.` });
      return;
    }
    setAudio({ blob: file, fileName: file.name, duration: null, source: 'upload' });
  }

  function discardAudio() {
    setAudio(null);
    setError(null);
    if (fileInput.current) fileInput.current.value = '';
  }

  function cancel() {
    abortRef.current?.abort();
  }

  async function transcribe() {
    if (!audio || busy) return;
    setError(null);
    setStage('transcribing');
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const body = new FormData();
      body.append('file', audio.blob, audio.fileName);
      const data = await readJson(await fetch('/api/speak/transcribe', { method: 'POST', body, signal: controller.signal }));
      if (!data.text?.trim()) throw new Error('No speech was detected. Try recording again a little closer to the microphone.');
      setTranscript(data.text.trim());
      if (data.duration && !audio.duration) setAudio(a => (a ? { ...a, duration: data.duration } : a));
      setRestored(false);
      setStage('review');
    } catch (e) {
      setStage('input');
      if (e.name === 'AbortError') return;
      setError({
        message: e.message === 'Failed to fetch' ? 'Network error — check your connection and try again.' : e.message,
        action: 'transcribe',
      });
    }
  }

  async function persist(session) {
    setStage('saving');
    try {
      await saveSession(session);
      setPending(null);
      try { sessionStorage.removeItem(DRAFT_KEY); } catch {}
      router.push(`/speak/analysis/${session.id}`);
    } catch (e) {
      setPending(session);
      setStage('review');
      setError({
        message: `Your analysis is ready, but it couldn’t be saved in this browser (${e?.message || 'storage error'}). Free up space or close other tabs, then retry — or download it so nothing is lost.`,
        action: 'save',
      });
    }
  }

  async function analyze() {
    const text = transcript.trim();
    if (!text || tooLong || busy) return;
    setError(null);
    setStage('analyzing');
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const r = await readJson(await fetch('/api/speak/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
        signal: controller.signal,
      }));
      const session = {
        id: newId(),
        schemaVersion: SESSION_SCHEMA_VERSION,
        createdAt: Date.now(),
        status: 'complete',
        model: r.model || null,
        source: audio && mode !== 'text' ? audio.source : 'text',
        title: makeTitle(r.original_text),
        audio: audio && mode !== 'text' ? audio.blob : null,
        audioName: audio && mode !== 'text' ? audio.fileName : null,
        audioType: audio && mode !== 'text' ? audio.blob.type : null,
        audioDuration: audio && mode !== 'text' ? audio.duration : null,
        originalText: r.original_text,
        correctedText: r.corrected_text,
        segments: r.segments,
        corrections: r.corrections,
        alignment: r.alignment,
        detailedAnalysisMarkdown: r.detailed_analysis_markdown,
        vocabulary: r.vocabulary,
        overallFeedback: r.overall_feedback,
      };
      await persist(session);
    } catch (e) {
      setStage(mode === 'text' ? 'input' : 'review');
      if (e.name === 'AbortError') return;
      setError({
        message: e.message === 'Failed to fetch' ? 'Network error — your transcription is safe. Check your connection and try again.' : `${e.message} Your transcription has been kept.`,
        action: 'analyze',
      });
    }
  }

  function downloadPending() {
    if (!pending) return;
    const { audio: _omit, ...data } = pending;
    const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `speak-analysis-${new Date(pending.createdAt).toISOString().slice(0, 10)}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function retry() {
    if (error?.action === 'transcribe') transcribe();
    else if (error?.action === 'analyze') analyze();
    else if (error?.action === 'save' && pending) persist(pending);
  }

  const stepIndex = { input: mode === 'text' ? 2 : audio ? 1 : 0, transcribing: 1, review: 2, analyzing: 3, saving: 3 }[stage];
  const steps = ['Audio', 'Transcribe', 'Review', 'Analyze'];

  return (
    <main className="upload-page si-page">
      <SpeakHeader />
      <div className="upload-content si-content">
        <FeatureTabs />
        <div className="si-hero">
          <span className="si-hero-mark" aria-hidden="true">✦</span>
          <h1>Speak &amp; <span>Improve</span></h1>
          <p className="intro">Record yourself speaking Portuguese. You’ll get tutor-style corrections, clear explanations, and new vocabulary — so you sound more natural every time.</p>
        </div>

        <section className="upload-card si-card" aria-labelledby="si-card-title">
          <h2 id="si-card-title" className="si-visually-hidden">Create a speaking analysis</h2>
          <ol className="si-steps" aria-label="Progress">
            {steps.map((label, i) => (
              <li key={label} className={`si-step${i === stepIndex ? ' active' : ''}${i < stepIndex ? ' done' : ''}`} aria-current={i === stepIndex ? 'step' : undefined}>
                <i>{i < stepIndex ? '✓' : i + 1}</i> {label}
              </li>
            ))}
          </ol>

          <div className="si-mode-tabs" role="tablist" aria-label="Input method">
            {MODES.map(m => (
              <button key={m.id} id={`mode-${m.id}`} role="tab" type="button" aria-selected={mode === m.id}
                className={`si-mode-tab${mode === m.id ? ' active' : ''}`} onClick={() => switchMode(m.id)} disabled={busy && mode !== m.id}>
                <span aria-hidden="true">{m.icon}</span> {m.label}
              </button>
            ))}
          </div>

          {/* ── Audio input ───────────────────────────────────── */}
          {mode !== 'text' && stage !== 'review' && !showEditor && (
            audio ? (
              <div className="si-audio-preview">
                <div className="si-audio-meta">
                  <span className="si-audio-icon" aria-hidden="true">{audio.source === 'record' ? '🎙' : '♫'}</span>
                  <div>
                    <strong title={audio.fileName}>{audio.fileName}</strong>
                    <small>{formatSize(audio.blob.size)} · {formatDuration(audio.duration)}</small>
                  </div>
                  <button type="button" id="audio-discard" className="si-btn si-btn-ghost si-btn-sm" onClick={discardAudio} disabled={busy}>
                    {audio.source === 'record' ? '↺ Discard & re-record' : '✕ Remove'}
                  </button>
                </div>
                {audioUrl && (
                  <audio controls src={audioUrl} className="si-audio-player" preload="metadata"
                    onLoadedMetadata={e => {
                      const d = e.currentTarget.duration;
                      if (Number.isFinite(d) && !audio.duration) setAudio(a => (a ? { ...a, duration: d } : a));
                    }} />
                )}
              </div>
            ) : mode === 'record' ? (
              <Recorder onRecorded={setAudio} disabled={busy} />
            ) : (
              <button type="button" id="audio-dropzone" className={`drop-area si-drop${dragging ? ' dragging' : ''}`}
                onClick={() => fileInput.current?.click()}
                onDragOver={e => { e.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={e => { e.preventDefault(); setDragging(false); chooseFile(e.dataTransfer.files?.[0]); }}>
                <input ref={fileInput} type="file" accept={ACCEPT} hidden onChange={e => chooseFile(e.target.files?.[0])} />
                <span className="upload-symbol">↑</span>
                <strong>Drop a recording of yourself speaking</strong>
                <small>or click to browse · up to 25 MB</small>
                <span className="file-types">MP3 · M4A · WAV · WEBM · OGG · FLAC</span>
              </button>
            )
          )}

          {/* ── Transcription editor (review / text mode) ─────── */}
          {showEditor && (
            <div className="si-editor">
              <div className="si-editor-head">
                <label htmlFor="transcript-input">
                  {mode === 'text' ? 'Paste or type your Portuguese' : 'Review your transcription'}
                </label>
                <span className={`si-count${tooLong ? ' over' : ''}`}>{transcript.length.toLocaleString()} / {SPEAK_LIMITS.maxTextChars.toLocaleString()}</span>
              </div>
              {mode !== 'text' && (
                <p className="si-editor-help">
                  Fix anything the transcriber <em>misheard</em> — restore English words, add punctuation — but <strong>keep your own mistakes</strong>. That’s what we’ll analyse.
                </p>
              )}
              {restored && <p className="si-restored">↺ Restored your unsaved draft.</p>}
              <textarea id="transcript-input" className="si-textarea" value={transcript} lang="pt-BR" spellCheck={false}
                onChange={e => setTranscript(e.target.value)} disabled={busy}
                placeholder="Ex.: Ontem eu fui no mercado e comprei muitas coisas, mas eu esqueci de comprar o leite, né?" rows={8} />
              {audioUrl && mode !== 'text' && (
                <audio controls src={audioUrl} className="si-audio-player si-audio-compact" preload="metadata" aria-label="Your recording" />
              )}
            </div>
          )}

          {/* ── Errors ─────────────────────────────────────────── */}
          {error && (
            <div className="error-box si-error" role="alert">
              <span>!</span>
              <div>
                {error.message}
                {error.message.includes('OPENAI_API_KEY') && <p>Set it in <code>.env.local</code> in the app folder, then restart the server.</p>}
                {(error.action || pending) && (
                  <div className="si-error-actions">
                    {error.action && <button type="button" id="error-retry" className="si-btn si-btn-sm" onClick={retry}>↻ Retry {error.action === 'save' ? 'saving' : error.action === 'transcribe' ? 'transcription' : 'analysis'}</button>}
                    {pending && <button type="button" id="error-download" className="si-btn si-btn-ghost si-btn-sm" onClick={downloadPending}>⤓ Download analysis</button>}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── Actions / progress ────────────────────────────── */}
          {stage === 'transcribing' && (
            <div className="transcribing si-progress" aria-live="polite">
              <span className="spinner" />
              <div><strong>Transcribing your Portuguese…</strong><small>Keeping your exact words — mistakes included.</small></div>
              <button type="button" id="cancel-transcribe" className="si-btn si-btn-ghost si-btn-sm" onClick={cancel}>Cancel</button>
            </div>
          )}
          {(stage === 'analyzing' || stage === 'saving') && (
            <div className="transcribing si-progress" aria-live="polite">
              <span className="spinner" />
              <div>
                <strong>{stage === 'saving' ? 'Saving your analysis…' : 'Analyzing your Portuguese…'}</strong>
                <small>{stage === 'saving' ? 'Almost there.' : 'Your tutor is reviewing grammar, tenses, vocabulary and naturalness. This usually takes 20–60 seconds.'}</small>
              </div>
              {stage === 'analyzing' && <button type="button" id="cancel-analyze" className="si-btn si-btn-ghost si-btn-sm" onClick={cancel}>Cancel</button>}
            </div>
          )}

          {!busy && mode !== 'text' && stage !== 'review' && audio && (
            <button type="button" id="transcribe-button" className="start-button" onClick={transcribe}>Transcribe my recording <span>→</span></button>
          )}

          {!busy && showEditor && (
            <div className="si-actions">
              {mode !== 'text' && (
                <button type="button" id="back-to-audio" className="si-btn si-btn-ghost" onClick={() => { setStage('input'); setError(null); }}>
                  ← {audio ? 'Back to audio' : 'Record again'}
                </button>
              )}
              {mode !== 'text' && audio && (
                <button type="button" id="retranscribe" className="si-btn si-btn-ghost" onClick={transcribe}>↻ Re-transcribe</button>
              )}
              <button type="button" id="analyze-button" className="start-button si-analyze" onClick={analyze} disabled={!transcript.trim() || tooLong}>
                Analyze My Portuguese <span>→</span>
              </button>
            </div>
          )}

          <div className="upload-foot"><span>✦</span> Audio and text are sent to OpenAI for transcription and analysis. Results are saved only in this browser.</div>
        </section>

        <div className="next-hint"><span>✎</span><p><b>Then you improve.</b> See what you said next to how a native speaker would say it, with every correction explained.</p></div>
      </div>
    </main>
  );
}
