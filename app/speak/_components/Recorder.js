'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { SPEAK_LIMITS } from '../../../lib/speak/categories';
import { formatDuration } from './SpeakHeader';

// Independent from the shadowing microphone / silence-detection code.
const MIME_CANDIDATES = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4;codecs=mp4a.40.2', 'audio/mp4', 'audio/ogg;codecs=opus', 'audio/ogg'];

function pickMime() {
  if (typeof MediaRecorder === 'undefined' || typeof MediaRecorder.isTypeSupported !== 'function') return '';
  return MIME_CANDIDATES.find(m => MediaRecorder.isTypeSupported(m)) || '';
}

// Whisper decides the format from the file extension, so it must match the container.
function extFor(mime = '') {
  if (mime.includes('webm')) return 'webm';
  if (mime.includes('mp4') || mime.includes('aac')) return 'm4a';
  if (mime.includes('ogg')) return 'ogg';
  if (mime.includes('wav')) return 'wav';
  return 'webm';
}

function micErrorMessage(e) {
  switch (e?.name) {
    case 'NotAllowedError':
    case 'SecurityError':
      return 'Microphone access was blocked. Allow microphone access for this site in your browser settings, then try again. (Recording only works on localhost or HTTPS.)';
    case 'NotFoundError':
    case 'OverconstrainedError':
      return 'No microphone was found. Connect a microphone and try again.';
    case 'NotReadableError':
      return 'Your microphone is being used by another app. Close it and try again.';
    default:
      return 'Could not start the microphone. Try again, or upload an audio file instead.';
  }
}

export default function Recorder({ onRecorded, disabled }) {
  const [status, setStatus] = useState('idle'); // idle | requesting | recording | paused
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState('');
  const [support, setSupport] = useState({ checked: false, ok: true, pause: true });

  const recRef = useRef(null);
  const streamRef = useRef(null);
  const chunksRef = useRef([]);
  const ctxRef = useRef(null);
  const analyserRef = useRef(null);
  const rafRef = useRef(0);
  const timerRef = useRef(0);
  const canvasRef = useRef(null);
  const clockRef = useRef({ startedAt: 0, accumulated: 0, paused: false });
  const onRecordedRef = useRef(onRecorded);
  onRecordedRef.current = onRecorded;

  useEffect(() => {
    const ok = Boolean(navigator.mediaDevices?.getUserMedia) && typeof window.MediaRecorder !== 'undefined';
    const pause = ok && typeof MediaRecorder.prototype.pause === 'function';
    setSupport({ checked: true, ok, pause });
  }, []);

  const currentElapsed = () => {
    const c = clockRef.current;
    return c.accumulated + (c.paused || !c.startedAt ? 0 : (performance.now() - c.startedAt) / 1000);
  };

  const teardown = useCallback(() => {
    clearInterval(timerRef.current);
    cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    ctxRef.current?.close().catch(() => {});
    ctxRef.current = null;
    analyserRef.current = null;
  }, []);

  useEffect(() => () => {
    const rec = recRef.current;
    if (rec && rec.state !== 'inactive') {
      rec.onstop = null;
      try { rec.stop(); } catch {}
    }
    teardown();
  }, [teardown]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const analyser = analyserRef.current;
    if (!canvas) { rafRef.current = requestAnimationFrame(draw); return; }
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (canvas.width !== w * dpr) { canvas.width = w * dpr; canvas.height = h * dpr; }
    const g = canvas.getContext('2d');
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, w, h);
    const bars = 42;
    const gap = 3;
    const bw = (w - gap * (bars - 1)) / bars;
    let data = null;
    if (analyser && !clockRef.current.paused) {
      data = new Uint8Array(analyser.frequencyBinCount);
      analyser.getByteFrequencyData(data);
    }
    for (let i = 0; i < bars; i++) {
      // Mirror around the centre: low frequencies (where voice lives) in the middle.
      const dist = Math.abs(i + 0.5 - bars / 2) / (bars / 2);
      const v = data ? data[Math.min(data.length - 1, Math.floor(dist * data.length * 0.6))] / 255 : 0;
      const bh = Math.max(4, v * h * 0.95);
      const x = i * (bw + gap);
      const y = (h - bh) / 2;
      g.fillStyle = clockRef.current.paused ? '#c9d6cd' : `rgba(214, 69, 65, ${0.45 + v * 0.55})`;
      g.beginPath();
      g.roundRect ? g.roundRect(x, y, bw, bh, bw / 2) : g.rect(x, y, bw, bh);
      g.fill();
    }
    rafRef.current = requestAnimationFrame(draw);
  }, []);

  async function start() {
    if (disabled || status !== 'idle') return;
    setError('');
    setStatus('requesting');
    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
    } catch (e) {
      setError(micErrorMessage(e));
      setStatus('idle');
      return;
    }
    streamRef.current = stream;

    const mime = pickMime();
    let rec;
    try {
      rec = mime ? new MediaRecorder(stream, { mimeType: mime, audioBitsPerSecond: 64_000 }) : new MediaRecorder(stream);
    } catch {
      try { rec = new MediaRecorder(stream); } catch {
        teardown();
        setError('This browser cannot record audio. Upload an audio file or paste your text instead.');
        setStatus('idle');
        return;
      }
    }
    recRef.current = rec;
    chunksRef.current = [];
    rec.ondataavailable = e => { if (e.data?.size) chunksRef.current.push(e.data); };
    rec.onerror = () => {
      setError('Recording stopped unexpectedly. Please try again.');
    };
    rec.onstop = () => {
      const type = (rec.mimeType || mime || 'audio/webm').split(';')[0];
      const blob = new Blob(chunksRef.current, { type });
      const duration = currentElapsed();
      teardown();
      clockRef.current = { startedAt: 0, accumulated: 0, paused: false };
      setStatus('idle');
      setElapsed(0);
      if (!blob.size || duration < 0.6) {
        setError('That recording was too short. Hold on a little longer and try again.');
        return;
      }
      const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
      onRecordedRef.current?.({ blob, fileName: `recording-${stamp}.${extFor(type)}`, duration, source: 'record' });
    };

    // Live level meter (its own AudioContext; never shared with shadowing).
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      const ctx = new Ctx();
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.75;
      ctx.createMediaStreamSource(stream).connect(analyser);
      ctxRef.current = ctx;
      analyserRef.current = analyser;
    } catch { /* visualiser is optional */ }

    rec.start(1000);
    clockRef.current = { startedAt: performance.now(), accumulated: 0, paused: false };
    timerRef.current = setInterval(() => {
      const t = currentElapsed();
      setElapsed(t);
      if (t >= SPEAK_LIMITS.maxRecordingSeconds && rec.state !== 'inactive') {
        setError(`Recording stopped automatically at ${SPEAK_LIMITS.maxRecordingSeconds / 60} minutes.`);
        rec.stop();
      }
    }, 200);
    setStatus('recording');
    rafRef.current = requestAnimationFrame(draw);
  }

  function pause() {
    const rec = recRef.current;
    if (!rec || rec.state !== 'recording' || !support.pause) return;
    rec.pause();
    const c = clockRef.current;
    c.accumulated += (performance.now() - c.startedAt) / 1000;
    c.paused = true;
    setStatus('paused');
  }

  function resume() {
    const rec = recRef.current;
    if (!rec || rec.state !== 'paused') return;
    rec.resume();
    clockRef.current.startedAt = performance.now();
    clockRef.current.paused = false;
    setStatus('recording');
  }

  function stop() {
    const rec = recRef.current;
    if (rec && rec.state !== 'inactive') rec.stop();
  }

  if (support.checked && !support.ok) {
    return (
      <div className="si-recorder si-recorder-unsupported" role="alert">
        <span className="si-rec-icon" aria-hidden="true">🎙</span>
        <strong>Recording isn&apos;t supported in this browser</strong>
        <small>Use a recent Chrome, Edge, Firefox or Safari over localhost/HTTPS — or upload an audio file or paste your text instead.</small>
      </div>
    );
  }

  const active = status === 'recording' || status === 'paused';
  const remaining = SPEAK_LIMITS.maxRecordingSeconds - elapsed;

  return (
    <div className={`si-recorder${active ? ' is-active' : ''}${status === 'paused' ? ' is-paused' : ''}`}>
      {!active ? (
        <>
          <button type="button" id="record-start" className="si-rec-button" onClick={start} disabled={disabled || status === 'requesting'} aria-label="Start recording">
            {status === 'requesting' ? <span className="spinner" /> : <span className="si-rec-dot" />}
          </button>
          <strong>{status === 'requesting' ? 'Waiting for microphone permission…' : 'Tap to start recording'}</strong>
          <small>Talk about anything — your day, an opinion, a story. 30 seconds to a few minutes works best.</small>
        </>
      ) : (
        <>
          <div className="si-rec-live" aria-live="polite">
            <span className={`si-rec-badge${status === 'paused' ? ' paused' : ''}`}>
              <i aria-hidden="true" /> {status === 'paused' ? 'Paused' : 'Recording'}
            </span>
            <span className="si-rec-time" aria-label={`Elapsed ${formatDuration(elapsed)}`}>{formatDuration(elapsed)}</span>
            {remaining < 60 && <span className="si-rec-remaining">{Math.ceil(remaining)}s left</span>}
          </div>
          <canvas ref={canvasRef} className="si-rec-wave" aria-hidden="true" />
          <div className="si-rec-controls">
            {support.pause && (status === 'paused'
              ? <button type="button" id="record-resume" className="si-btn si-btn-ghost" onClick={resume}>▶ Resume</button>
              : <button type="button" id="record-pause" className="si-btn si-btn-ghost" onClick={pause}>❚❚ Pause</button>)}
            <button type="button" id="record-stop" className="si-btn si-btn-stop" onClick={stop}><span aria-hidden="true">■</span> Stop &amp; review</button>
          </div>
        </>
      )}
      {error && <p className="si-inline-error" role="alert">{error}</p>}
    </div>
  );
}
