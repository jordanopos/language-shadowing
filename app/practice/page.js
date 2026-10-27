'use client';

import { useCallback, useEffect, useRef, useState, memo } from 'react';
import { useRouter } from 'next/navigation';

// ── Translate helper ────────────────────────────────────────────────────────
async function fetchTranslation(text) {
  const res = await fetch('/api/translate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Translation failed');
  return data.translation;
}
import { getLesson, saveLesson } from '../../lib/lesson-store';

// A lesson might have a video track if it's a video container. Some of these
// (e.g. .webm / .mp4) can also be audio-only, so we confirm on
// loadedmetadata by checking videoWidth before showing the player.
function mightHaveVideo(lesson) {
  const type = lesson?.blob?.type || '';
  if (type.startsWith('video/')) return true;
  return /\.(mp4|m4v|mov|webm|mkv|ogv)$/i.test(lesson?.fileName || '');
}

export default function PracticePage() {
  const router = useRouter();
  const canvasRef = useRef(null);
  const rafRef = useRef(0);
  const audioRafRef = useRef(0);
  const fadeTimerRef = useRef(0);
  const endTimerRef = useRef(0);
  const tokenRef = useRef(0);
  const activeRef = useRef(0);
  const automaticRef = useRef(true);
  const micRef = useRef(null);
  const analyserRef = useRef(null);
  const audioContextRef = useRef(null);
  const audioGainRef = useRef(null);
  const audioBufferRef = useRef(null);
  const sourceRef = useRef(null);
  const lastTickRef = useRef(0);
  const lessonRef = useRef(null);
  // Optional video layer. It's always muted: the Web Audio buffer stays the
  // single source of sound and timing, and the video just follows it.
  const videoRef = useRef(null);
  const [videoUrl, setVideoUrl] = useState('');
  const [hasVideo, setHasVideo] = useState(false);
  const [lesson, setLesson] = useState(null);
  const [active, setActive] = useState(0);
  const [done, setDone] = useState(new Set());
  const [status, setStatus] = useState('paused');
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [repeat, setRepeat] = useState(1);
  const [speed, setSpeed] = useState(1);
  const [automatic, setAutomatic] = useState(true);
  const [showText, setShowText] = useState(true);
  const [showStatus, setShowStatus] = useState(true);
  const [dark, setDark] = useState(false);
  const [silence, setSilence] = useState(1.2);
  const [micMessage, setMicMessage] = useState('Microphone turns on after each phrase.');
  const [micHot, setMicHot] = useState(false);
  const [error, setError] = useState('');
  const [ready, setReady] = useState(false);
  const [peaks, setPeaks] = useState([]);
  const [retranscribing, setRetranscribing] = useState(false);
  const [translations, setTranslations] = useState({});
  const current = lesson?.segments?.[active];

  const persist = useCallback(async (patch = {}) => {
    const base = lessonRef.current;
    if (!base) return;
    const next = { ...base, ...patch };
    lessonRef.current = next;
    setLesson(next);
    try { await saveLesson(next); } catch { /* Keep the active session usable if storage is full. */ }
  }, []);

  const translateSegment = useCallback(async (index, text) => {
    // If already translated or currently loading, do nothing
    if (translations[index]?.text || translations[index]?.loading) return;
    setTranslations(prev => ({ ...prev, [index]: { loading: true } }));
    try {
      const translation = await fetchTranslation(text);
      setTranslations(prev => {
        const next = { ...prev, [index]: { text: translation } };
        persist({ translations: next });
        return next;
      });
    } catch (e) {
      setTranslations(prev => ({ ...prev, [index]: { error: e.message || 'Translation failed' } }));
    }
  }, [translations, persist]);

  useEffect(() => {
    let objectUrl = '';
    let disposed = false;
    (async () => {
      const id = sessionStorage.getItem('shadow-active-lesson');
      if (!id) { router.replace('/'); return; }
      const saved = await getLesson(id);
      if (!saved) { router.replace('/'); return; }
      lessonRef.current = saved;
      setLesson(saved);
      setDone(new Set(saved.done || []));
      setTranslations(saved.translations || {});
      if (!disposed && saved.blob && mightHaveVideo(saved)) {
        objectUrl = URL.createObjectURL(saved.blob);
        setVideoUrl(objectUrl);
      }

      // Decode the whole file once into a raw AudioBuffer. This is what we
      // play segments from — no seeking a compressed stream, so no
      // decode-recovery gaps and no quality dip after a jump.
      let decodeContext;
      try {
        decodeContext = new (window.AudioContext || window.webkitAudioContext)();
        const decoded = await decodeContext.decodeAudioData(await saved.blob.arrayBuffer());
        audioBufferRef.current = decoded;
        setDuration(decoded.duration || saved.duration || 0);

        const channel = decoded.getChannelData(0);
        const count = 900; const chunk = Math.max(1, Math.floor(channel.length / count));
        const values = Array.from({ length: count }, (_, i) => { let peak = 0; for (let j = i * chunk; j < Math.min(channel.length, (i + 1) * chunk); j++) peak = Math.max(peak, Math.abs(channel[j])); return peak; });
        setPeaks(values);
        setReady(true);
      } catch {
        setError('This browser could not decode this audio file. Try a different format.');
        setReady(true);
      } finally {
        try { await decodeContext?.close(); } catch { /* already closed */ }
      }
    })().catch(() => setError('Could not open this saved lesson. Please upload the file again.'));
    return () => {
      disposed = true;
      cancelAnimationFrame(audioRafRef.current);
      window.clearTimeout(fadeTimerRef.current);
      window.clearTimeout(endTimerRef.current);
      stopMic(); tokenRef.current++;
      try { sourceRef.current?.stop(); } catch { /* already stopped */ }
      sourceRef.current = null;
      audioContextRef.current?.close();
      try { videoRef.current?.pause(); } catch { /* no video */ }
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [router]);

  const stopMic = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    if (micRef.current) micRef.current.getTracks().forEach(track => track.stop());
    micRef.current = null;
    analyserRef.current = null;
    setMicHot(false);
  }, []);

  // One persistent AudioContext + master gain, created the first time we
  // need it. Deliberately left at the browser/hardware's default sample
  // rate — forcing a custom rate here (to "match" the decoded file) sounds
  // like a good idea but instead makes the OS renegotiate the actual output
  // device's stream, which is what caused the brief static/quality dip a
  // few seconds into playback. Any mismatch between the file's sample rate
  // and the context's rate is handled transparently and cleanly by Web
  // Audio's own per-buffer resampling when the source connects — no need
  // to force it at the context level.
  const ensureAudioContext = useCallback(() => {
    if (audioContextRef.current) return audioContextRef.current;
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) throw new Error('Audio playback is not supported in this browser.');
    const context = new AudioContextClass();
    const gain = context.createGain();
    gain.gain.value = 0;
    gain.connect(context.destination);
    audioContextRef.current = context;
    audioGainRef.current = gain;
    return context;
  }, []);

  const markComplete = useCallback((index) => {
    setDone(previous => {
      const next = new Set(previous); next.add(index);
      persist({ done: [...next] });
      return next;
    });
  }, [persist]);

  const beginMic = useCallback(async (token) => {
    setStatus('listening');
    setMicMessage('Listening for your voice…');
    if (!navigator.mediaDevices?.getUserMedia) {
      setMicMessage('Microphone access needs a secure browser connection.'); return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (token !== tokenRef.current) { stream.getTracks().forEach(track => track.stop()); return; }
      micRef.current = stream;
      const context = ensureAudioContext();
      await context.resume();
      const source = context.createMediaStreamSource(stream);
      const analyser = context.createAnalyser();
      analyser.fftSize = 512;
      source.connect(analyser);
      analyserRef.current = analyser;
      const values = new Uint8Array(analyser.fftSize);
      let heardSpeech = false;
      let lastVoice = Date.now();
      const startedAt = Date.now();
      const scan = () => {
        if (token !== tokenRef.current || !analyserRef.current) return;
        analyser.getByteTimeDomainData(values);
        let sum = 0;
        for (const sample of values) { const normalized = (sample - 128) / 128; sum += normalized * normalized; }
        const rms = Math.sqrt(sum / values.length);
        if (rms > 0.027) {
          heardSpeech = true; lastVoice = Date.now(); setMicHot(true); setMicMessage('I hear you. Keep going…');
        } else if (heardSpeech && Date.now() - lastVoice > silence * 1000) {
          const completedIndex = activeRef.current;
          stopMic(); markComplete(completedIndex);
          setStatus('processing'); setMicMessage('Nice work — moving to the next phrase.');
          window.setTimeout(() => {
            if (token !== tokenRef.current) return;
            if (completedIndex >= (lessonRef.current?.segments?.length || 1) - 1) {
              setStatus('complete'); setMicMessage('Lesson complete. You did it!'); return;
            }
            const next = completedIndex + 1; activeRef.current = next; setActive(next);
            if (automaticRef.current) playRef.current(next); else setStatus('paused');
          }, 650);
          return;
        } else if (!heardSpeech && Date.now() - startedAt > 10_000) {
          stopMic(); setMicMessage('No speech detected. Replay or skip when you’re ready.'); return;
        }
        rafRef.current = requestAnimationFrame(scan);
      };
      rafRef.current = requestAnimationFrame(scan);
    } catch {
      setMicMessage('Microphone permission was denied. Allow it in your browser settings, then replay.');
    }
  }, [ensureAudioContext, markComplete, silence, stopMic]);

  // ── Video sync helpers ─────────────────────────────────────────────────────
  // The video never drives playback; it's only told where the audio is.
  const seekVideo = useCallback((seconds) => {
    const video = videoRef.current;
    if (!video || !hasVideo) return;
    try { video.currentTime = Math.max(0, seconds); } catch { /* not seekable yet */ }
  }, [hasVideo]);
  const startVideo = useCallback((seconds, rate) => {
    const video = videoRef.current;
    if (!video || !hasVideo) return;
    try {
      video.playbackRate = rate;
      video.currentTime = Math.max(0, seconds);
      const p = video.play();
      if (p?.catch) p.catch(() => { /* autoplay blocked / interrupted — audio continues */ });
    } catch { /* ignore */ }
  }, [hasVideo]);
  const pauseVideo = useCallback(() => {
    try { videoRef.current?.pause(); } catch { /* no video */ }
  }, []);
  const syncVideo = useCallback((seconds) => {
    const video = videoRef.current;
    if (!video || !hasVideo || video.seeking || video.paused) return;
    // Only hard-correct noticeable drift; constant tiny seeks would stutter.
    if (Math.abs(video.currentTime - seconds) > 0.25) {
      try { video.currentTime = seconds; } catch { /* ignore */ }
    }
  }, [hasVideo]);

  const playRef = useRef(null);
  const FADE = 0.012;
  const playSegment = useCallback(async (index = active) => {
    const buffer = audioBufferRef.current;
    const segment = lessonRef.current?.segments?.[index];
    if (!buffer || !segment) return;
    const token = ++tokenRef.current;
    cancelAnimationFrame(audioRafRef.current);
    window.clearTimeout(fadeTimerRef.current);
    window.clearTimeout(endTimerRef.current);
    stopMic(); setError(''); activeRef.current = index; setActive(index); setStatus('playing'); setMicMessage('Microphone off while the clip plays.');

    let context, gain;
    try {
      context = ensureAudioContext();
      await context.resume();
      gain = audioGainRef.current;
    } catch (e) {
      setStatus('paused'); setError(e.message || 'Could not prepare audio playback.'); return;
    }
    if (token !== tokenRef.current) return;

    // If something is still playing (e.g. user tapped a new sentence mid-clip),
    // fade it out quickly before starting the next one.
    if (sourceRef.current) {
      const now = context.currentTime;
      gain.gain.cancelScheduledValues(now);
      gain.gain.setValueAtTime(gain.gain.value, now);
      gain.gain.linearRampToValueAtTime(0, now + 0.01);
      const stale = sourceRef.current;
      sourceRef.current = null;
      window.setTimeout(() => { try { stale.stop(); } catch { /* already stopped */ } }, 15);
      await new Promise(resolve => window.setTimeout(resolve, 15));
      if (token !== tokenRef.current) return;
    }

    let count = 0;
    const playOnce = () => {
      if (token !== tokenRef.current) return;
      count++;
      const rate = speed;
      const clipStart = Math.max(0, segment.start);
      const clipDuration = Math.max(0.05, Math.min(buffer.duration - clipStart, segment.end - segment.start));
      const realDuration = clipDuration / rate;

      const source = context.createBufferSource();
      source.buffer = buffer;
      source.playbackRate.value = rate;
      source.connect(gain);
      sourceRef.current = source;

      const now = context.currentTime;
      gain.gain.cancelScheduledValues(now);
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(1, now + FADE);
      const fadeOutStart = Math.max(now + FADE, now + realDuration - FADE);
      gain.gain.setValueAtTime(1, fadeOutStart);
      gain.gain.linearRampToValueAtTime(0, fadeOutStart + FADE);

      let finished = false;
      const finish = () => {
        if (finished || token !== tokenRef.current) return;
        finished = true;
        cancelAnimationFrame(audioRafRef.current);
        window.clearTimeout(endTimerRef.current);
        if (sourceRef.current === source) sourceRef.current = null;
        pauseVideo();
        if (count < repeat) window.setTimeout(playOnce, 30);
        else { setStatus('listening'); beginMic(token); }
      };
      source.onended = finish;
      // Safety net in case onended is ever delayed by the browser.
      endTimerRef.current = window.setTimeout(finish, Math.max(50, realDuration * 1000 + 60));

      try { source.start(now, clipStart, clipDuration); }
      catch { setStatus('paused'); setError('Could not play this media in your browser.'); return; }
      startVideo(clipStart, rate);

      const tick = () => {
        if (token !== tokenRef.current) return;
        const elapsed = (context.currentTime - now) * rate;
        const nowMs = performance.now();
        // Update state at ~20fps rather than every animation frame (~60fps).
        // The playhead still looks smooth at this rate, and it cuts the
        // number of full-page re-renders during playback by roughly 3x —
        // fewer re-renders means less garbage for the JS engine to collect
        // mid-playback, which is what was causing the audio thread to miss
        // its buffer deadline and produce that static/quality dip.
        if (nowMs - lastTickRef.current >= 50) {
          lastTickRef.current = nowMs;
          setTime(Math.min(segment.end, clipStart + elapsed));
          syncVideo(clipStart + elapsed);
        }
        audioRafRef.current = requestAnimationFrame(tick);
      };
      audioRafRef.current = requestAnimationFrame(tick);
    };
    playOnce();
  }, [active, beginMic, ensureAudioContext, pauseVideo, repeat, speed, startVideo, stopMic, syncVideo]);
  playRef.current = playSegment;

  const pause = useCallback(() => {
    tokenRef.current++;
    cancelAnimationFrame(audioRafRef.current);
    window.clearTimeout(fadeTimerRef.current);
    window.clearTimeout(endTimerRef.current);
    const context = audioContextRef.current;
    const gain = audioGainRef.current;
    const source = sourceRef.current;
    if (source && gain && context) {
      const now = context.currentTime;
      gain.gain.cancelScheduledValues(now);
      gain.gain.setValueAtTime(gain.gain.value, now);
      gain.gain.linearRampToValueAtTime(0, now + 0.01);
      fadeTimerRef.current = window.setTimeout(() => { try { source.stop(); } catch { /* already stopped */ } }, 15);
    }
    sourceRef.current = null;
    pauseVideo();
    stopMic(); setStatus('paused'); setMicMessage('Paused. Press play when you’re ready.');
  }, [pauseVideo, stopMic]);
  const goTo = useCallback((index, start = true) => {
    const end = lessonRef.current?.segments?.length || 0;
    if (!end) return;
    const next = Math.max(0, Math.min(end - 1, index));
    stopMic(); tokenRef.current++;
    activeRef.current = next; setActive(next); setTime(lessonRef.current.segments[next].start);
    if (start) playRef.current(next); else { pause(); seekVideo(lessonRef.current.segments[next].start); }
  }, [pause, seekVideo, stopMic]);

  useEffect(() => {
    function keydown(event) {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName) || document.activeElement?.isContentEditable) return;
      if (event.code === 'Space') { event.preventDefault(); status === 'playing' ? pause() : playSegment(); }
      if (event.key === 'ArrowLeft') { event.preventDefault(); goTo(active - 1); }
      if (event.key === 'ArrowRight') { event.preventDefault(); goTo(active + 1); }
      if (event.key.toLowerCase() === 'r') playSegment();
    }
    window.addEventListener('keydown', keydown);
    return () => window.removeEventListener('keydown', keydown);
  }, [active, goTo, pause, playSegment, status]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !ready) return;
    const draw = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas.width = rect.width * dpr; canvas.height = rect.height * dpr;
      const ctx = canvas.getContext('2d'); ctx.scale(dpr, dpr);
      const w = rect.width, h = rect.height;
      ctx.clearRect(0, 0, w, h);
      const bars = Math.max(120, Math.floor(w / 4));
      const wavePeaks = peaks;
      for (let i = 0; i < bars; i++) {
        const fraction = i / bars;
        const amp = wavePeaks?.length ? Math.max(.1, wavePeaks[Math.floor(fraction * wavePeaks.length)] || .1) : .1 + Math.abs(Math.sin(i * .21) * .19) + Math.abs(Math.sin(i * .067) * .18) + (Math.sin(i * .016) ** 10) * .25;
        const height = Math.max(4, amp * h * .85);
        const second = fraction * duration;
        const selected = current && second >= current.start && second <= current.end;
        ctx.fillStyle = selected ? '#a9cfb4' : '#dfe7ef';
        ctx.beginPath(); ctx.roundRect(i * w / bars + 1, (h - height) / 2, Math.max(1, w / bars - 1), height, 2); ctx.fill();
      }
    };
    draw(); window.addEventListener('resize', draw);
    return () => window.removeEventListener('resize', draw);
  }, [current, duration, peaks, ready]);

  function seek(e) {
    if (!duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const point = (e.clientX - rect.left) / rect.width * duration;
    const found = lesson?.segments.findIndex(item => point >= item.start && point <= item.end) ?? -1;
    if (found >= 0) { goTo(found, false); setTime(point); seekVideo(point); }
  }
  async function refreshTranscription() {
    const saved = lessonRef.current;
    if (!saved?.blob || retranscribing) return;
    const approved = window.confirm('This will send the saved audio to the transcription service again to rebuild its sentence breaks. Continue?');
    if (!approved) return;
    setRetranscribing(true); setError(''); pause(); setStatus('processing');
    try {
      const body = new FormData();
      body.append('file', saved.blob, saved.fileName || 'lesson-audio.mp3');
      body.append('language', saved.language || 'auto');
      const response = await fetch('/api/transcribe', { method: 'POST', body });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Could not refresh this transcript.');
      if (!result.segments?.length) throw new Error('No speech was found in this file.');
      activeRef.current = 0; setActive(0); setDone(new Set()); setTime(0);
      await persist({ transcript: result.text, words: result.words, segments: result.segments, duration: result.duration, done: [] });
      setStatus('paused'); setMicMessage('Updated sentence breaks are ready. Press play to practice.');
    } catch (e) {
      setError(e.message || 'Could not refresh this transcript.'); setStatus('paused');
    } finally { setRetranscribing(false); }
  }
  function updateTitle(value) { persist({ title: value }); }
  if (!ready || !lesson) return <main className="loading-screen"><span className="spinner"/> Opening your lesson…</main>;

  const rows = lesson.segments;
  return <main className={dark ? 'practice-page dark' : 'practice-page'}>
    <header className="app-header practice-header"><button className="brand brand-button" onClick={() => router.push('/')}><span className="brand-mark">↗</span>shadow</button><button className="library-button" onClick={() => router.push('/lessons')}>My Lessons</button></header>
    <div className="practice-shell">
      <div className="practice-title-row"><h1 contentEditable suppressContentEditableWarning onBlur={e => updateTitle(e.currentTarget.textContent)}>{lesson.title}</h1><span className={`status-pill ${status} ${showStatus ? '' : 'status-off'}`}><i/>{status === 'complete' ? 'Lesson complete' : status[0].toUpperCase() + status.slice(1)}</span></div>
      {error && <div className="inline-error">{error}</div>}
      <section className="player-card">{videoUrl && <div className={`video-stage ${hasVideo ? '' : 'video-hidden'}`} onClick={() => status === 'playing' ? pause() : playSegment()}><video
          ref={videoRef}
          src={videoUrl}
          muted
          playsInline
          preload="auto"
          disablePictureInPicture
          aria-label="Lesson video"
          onLoadedMetadata={e => {
            const v = e.currentTarget;
            if (v.videoWidth > 0 && v.videoHeight > 0) {
              setHasVideo(true);
              // Show the first frame of the current phrase instead of a black box.
              try { v.currentTime = Math.max(0.001, lessonRef.current?.segments?.[activeRef.current]?.start || 0); } catch { /* ignore */ }
            }
          }}
        /></div>}<div className="wave-row"><button className="big-play" onClick={() => status === 'playing' ? pause() : playSegment()} aria-label={status === 'playing' ? 'Pause' : 'Play'}>{status === 'playing' ? 'Ⅱ' : '▶'}</button><button className="wave-wrap" onClick={seek} aria-label="Seek to a point in the audio"><canvas ref={canvasRef}/><i className="playhead" style={{ left: `${duration ? time / duration * 100 : 0}%` }}/><span className="wave-time">{formatTime(time)} / {formatTime(duration)}</span></button></div>
        <div className="player-bar"><div className="control-pill"><span>↻</span><select value={repeat} onChange={e => setRepeat(+e.target.value)} aria-label="Repeat count"><option value="1">1×</option><option value="2">2×</option><option value="3">3×</option></select></div><div className="control-pill"><span>»</span><select value={speed} onChange={e => setSpeed(+e.target.value)} aria-label="Playback speed"><option value="0.5">0.50x</option><option value="0.75">0.75x</option><option value="0.9">0.90x</option><option value="1">1.00x</option><option value="1.1">1.10x</option><option value="1.25">1.25x</option><option value="1.5">1.50x</option></select></div><span className="bar-spacer"/><button className="bar-button" onClick={() => setShowText(!showText)}>{showText ? 'Hide text' : 'Show text'}</button><button className="bar-button green-button" onClick={() => { const next = !automatic; automaticRef.current = next; setAutomatic(next); }}>{automatic ? 'Auto' : 'Manual'}</button><button className="bar-button green-button" onClick={() => setShowStatus(!showStatus)}>{showStatus ? 'Hide Status' : 'Show Status'}</button></div>
      </section>
      <section className={`practice-content ${showText ? '' : 'text-hidden'}`}><div className="transcript-card"><div className="transcript-header"><h2>Transcript <span>·</span> <small>{rows.length} sentences</small></h2><span>Click a sentence to practice it</span></div><TranscriptList rows={rows} active={active} done={done} onSelect={goTo} translations={translations} onTranslate={translateSegment}/></div>
        <aside className="practice-sidebar"><section className="side-card"><h2>Practice controls</h2><div className="manual-controls"><button onClick={() => goTo(active - 1)}>← Previous</button><button onClick={() => playSegment()}>↻ Replay</button><button onClick={() => { if (active < rows.length - 1) { markComplete(active); goTo(active + 1); } else { markComplete(active); setStatus('complete'); } }}>Next →</button></div><div className="setting"><label htmlFor="silence-range">Silence to finish <span>{silence.toFixed(1)}s</span></label><input id="silence-range" type="range" min="0.8" max="2.5" step="0.1" value={silence} onChange={e => setSilence(+e.target.value)}/></div><div className={`mic-note ${micHot ? 'mic-hot' : ''}`}><i/><div><b>{status === 'playing' ? 'Microphone is off' : status === 'listening' ? 'Your turn to speak' : status === 'complete' ? 'Lesson complete' : 'Microphone ready'}</b><span>{micMessage}</span></div></div><div className="keyboard-hint">SPACE play/pause <span>← → navigate</span> <span>R replay</span></div></section>
        <section className="side-card lesson-info"><h2>Lesson audio</h2><p>{lesson.fileName}</p><button onClick={refreshTranscription} className="refresh-transcript" disabled={retranscribing}>{retranscribing ? 'Refreshing phrase breaks…' : '↻ Refresh transcript & phrase breaks'}</button><small>This sends the saved audio for transcription again.</small><button onClick={() => router.push('/')} className="replace-audio">＋ Upload another lesson</button></section>
        <button
          type="button"
          className="side-translations-btn"
          onClick={() => {
            sessionStorage.setItem('shadow-active-lesson', lesson.id);
            router.push(`/practice/translations?id=${lesson.id}`);
          }}
        >
          <div className="st-btn-content">
            <span className="st-btn-icon">文A</span>
            <div className="st-btn-text">
              <strong>Saved Translations</strong>
              <small>View spreadsheet & audio cuts</small>
            </div>
          </div>
          <span className="st-btn-arrow">→</span>
        </button>
      </aside>
      </section>
    </div>
  </main>;
}

function formatTime(seconds) { if (!Number.isFinite(seconds)) seconds = 0; return `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`; }

// Isolated so the frequent `time` updates in PracticePage (driving the
// playhead) never cause this list to re-render — it only cares about
// which row is active and which are done, not the playhead position.
const TranscriptList = memo(function TranscriptList({ rows, active, done, onSelect, translations, onTranslate }) {
  return <div className="sentence-list">{rows.map((segment, i) => {
    const t = translations?.[i];
    return <div key={`${segment.start}-${i}`} className={`sentence-row-wrap ${i === active ? 'active' : ''} ${done.has(i) ? 'done' : ''}`}>
      <button className="sentence-row-btn" onClick={() => onSelect(i)}>
        <i className="sentence-dot"/>
        <span className="sentence-text">{segment.text}</span>
      </button>
      <button
        className={`translate-btn ${t?.text ? 'translated' : ''} ${t?.loading ? 'translating' : ''}`}
        onClick={(e) => { e.stopPropagation(); onTranslate(i, segment.text); }}
        title={t?.text ? 'Translation shown below' : 'Translate to English'}
        disabled={t?.loading}
        aria-label="Translate to English"
      >
        {t?.loading
          ? <span className="translate-spinner"/>
          : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 8l6 0"/><path d="M4 6l6.5 0M7.5 4v2"/><path d="M4.5 11c1.2-2 3-4.5 3-4.5s1.8 2.5 3 4.5"/><path d="M13 20l2.5-6.5L18 20"/><path d="M14 18h4"/><path d="M11 12l2.5-1"/></svg>
        }
      </button>
      {t?.text && <div className="translation-text">{t.text}</div>}
      {t?.error && <div className="translation-error">{t.error}</div>}
    </div>;
  })}</div>;
});