// 'use client';

// import { useCallback, useEffect, useRef, useState } from 'react';
// import { useRouter } from 'next/navigation';
// import { getLesson, saveLesson } from '../../lib/lesson-store';

// export default function PracticePage() {
//   const router = useRouter();
//   const audioRef = useRef(null);
//   const canvasRef = useRef(null);
//   const rafRef = useRef(0);
//   const audioRafRef = useRef(0);
//   const fadeTimerRef = useRef(0);
//   const tokenRef = useRef(0);
//   const activeRef = useRef(0);
//   const automaticRef = useRef(true);
//   const micRef = useRef(null);
//   const analyserRef = useRef(null);
//   const audioContextRef = useRef(null);
//   const audioSourceRef = useRef(null);
//   const audioGainRef = useRef(null);
//   const lessonRef = useRef(null);
//   const [lesson, setLesson] = useState(null);
//   const [sourceUrl, setSourceUrl] = useState('');
//   const [active, setActive] = useState(0);
//   const [done, setDone] = useState(new Set());
//   const [status, setStatus] = useState('paused');
//   const [time, setTime] = useState(0);
//   const [duration, setDuration] = useState(0);
//   const [repeat, setRepeat] = useState(1);
//   const [speed, setSpeed] = useState(1);
//   const [automatic, setAutomatic] = useState(true);
//   const [showText, setShowText] = useState(true);
//   const [showStatus, setShowStatus] = useState(true);
//   const [dark, setDark] = useState(false);
//   const [silence, setSilence] = useState(1.2);
//   const [micMessage, setMicMessage] = useState('Microphone turns on after each phrase.');
//   const [micHot, setMicHot] = useState(false);
//   const [error, setError] = useState('');
//   const [ready, setReady] = useState(false);
//   const [peaks, setPeaks] = useState([]);
//   const [retranscribing, setRetranscribing] = useState(false);
//   const current = lesson?.segments?.[active];

//   useEffect(() => {
//     let objectUrl;
//     (async () => {
//       const id = sessionStorage.getItem('shadow-active-lesson');
//       if (!id) { router.replace('/'); return; }
//       const saved = await getLesson(id);
//       if (!saved) { router.replace('/'); return; }
//       lessonRef.current = saved;
//       setLesson(saved);
//       setDone(new Set(saved.done || []));
//       const url = URL.createObjectURL(saved.blob);
//       objectUrl = url;
//       setSourceUrl(url);
//       setReady(true);
//       try {
//         const context = new (window.AudioContext || window.webkitAudioContext)();
//         const decoded = await context.decodeAudioData(await saved.blob.arrayBuffer());
//         const channel = decoded.getChannelData(0);
//         const count = 900; const chunk = Math.max(1, Math.floor(channel.length / count));
//         const values = Array.from({ length: count }, (_, i) => { let peak = 0; for (let j = i * chunk; j < Math.min(channel.length, (i + 1) * chunk); j++) peak = Math.max(peak, Math.abs(channel[j])); return peak; });
//         setPeaks(values); await context.close();
//       } catch { /* Some video containers cannot be decoded for waveform display. */ }
//     })().catch(() => setError('Could not open this saved lesson. Please upload the file again.'));
//     return () => {
//       if (objectUrl) URL.revokeObjectURL(objectUrl);
//       cancelAnimationFrame(audioRafRef.current);
//       window.clearTimeout(fadeTimerRef.current);
//       stopMic(); tokenRef.current++;
//       audioRef.current?.pause();
//       audioContextRef.current?.close();
//     };
//   }, [router]);

//   const persist = useCallback(async (patch = {}) => {
//     const base = lessonRef.current;
//     if (!base) return;
//     const next = { ...base, ...patch };
//     lessonRef.current = next;
//     setLesson(next);
//     try { await saveLesson(next); } catch { /* Keep the active session usable if storage is full. */ }
//   }, []);

//   const stopMic = useCallback(() => {
//     cancelAnimationFrame(rafRef.current);
//     if (micRef.current) micRef.current.getTracks().forEach(track => track.stop());
//     micRef.current = null;
//     analyserRef.current = null;
//     setMicHot(false);
//   }, []);

//   const getAudioOutput = useCallback(async (audio) => {
//     const AudioContextClass = window.AudioContext || window.webkitAudioContext;
//     if (!AudioContextClass) throw new Error('Audio playback is not supported in this browser.');
//     audioContextRef.current ||= new AudioContextClass();
//     const context = audioContextRef.current;
//     await context.resume();
//     if (!audioSourceRef.current) {
//       const source = context.createMediaElementSource(audio);
//       const gain = context.createGain();
//       gain.gain.value = 0;
//       source.connect(gain);
//       gain.connect(context.destination);
//       audioSourceRef.current = source;
//       audioGainRef.current = gain;
//     }
//     return { context, gain: audioGainRef.current };
//   }, []);

//   const markComplete = useCallback((index) => {
//     setDone(previous => {
//       const next = new Set(previous); next.add(index);
//       persist({ done: [...next] });
//       return next;
//     });
//   }, [persist]);

//   const beginMic = useCallback(async (token) => {
//     setStatus('listening');
//     setMicMessage('Listening for your voice…');
//     if (!navigator.mediaDevices?.getUserMedia) {
//       setMicMessage('Microphone access needs a secure browser connection.'); return;
//     }
//     try {
//       const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
//       if (token !== tokenRef.current) { stream.getTracks().forEach(track => track.stop()); return; }
//       micRef.current = stream;
//       const AudioContextClass = window.AudioContext || window.webkitAudioContext;
//       audioContextRef.current ||= new AudioContextClass();
//       const source = audioContextRef.current.createMediaStreamSource(stream);
//       const analyser = audioContextRef.current.createAnalyser();
//       analyser.fftSize = 512;
//       source.connect(analyser);
//       analyserRef.current = analyser;
//       const values = new Uint8Array(analyser.fftSize);
//       let heardSpeech = false;
//       let lastVoice = Date.now();
//       const startedAt = Date.now();
//       const scan = () => {
//         if (token !== tokenRef.current || !analyserRef.current) return;
//         analyser.getByteTimeDomainData(values);
//         let sum = 0;
//         for (const sample of values) { const normalized = (sample - 128) / 128; sum += normalized * normalized; }
//         const rms = Math.sqrt(sum / values.length);
//         if (rms > 0.027) {
//           heardSpeech = true; lastVoice = Date.now(); setMicHot(true); setMicMessage('I hear you. Keep going…');
//         } else if (heardSpeech && Date.now() - lastVoice > silence * 1000) {
//           const completedIndex = activeRef.current;
//           stopMic(); markComplete(completedIndex);
//           setStatus('processing'); setMicMessage('Nice work — moving to the next phrase.');
//           window.setTimeout(() => {
//             if (token !== tokenRef.current) return;
//             if (completedIndex >= (lessonRef.current?.segments?.length || 1) - 1) {
//               setStatus('complete'); setMicMessage('Lesson complete. You did it!'); return;
//             }
//             const next = completedIndex + 1; activeRef.current = next; setActive(next);
//             if (automaticRef.current) playRef.current(next); else setStatus('paused');
//           }, 650);
//           return;
//         } else if (!heardSpeech && Date.now() - startedAt > 10_000) {
//           stopMic(); setMicMessage('No speech detected. Replay or skip when you’re ready.'); return;
//         }
//         rafRef.current = requestAnimationFrame(scan);
//       };
//       rafRef.current = requestAnimationFrame(scan);
//     } catch {
//       setMicMessage('Microphone permission was denied. Allow it in your browser settings, then replay.');
//     }
//   }, [markComplete, silence, stopMic]);

//   const playRef = useRef(null);
//   const playSegment = useCallback(async (index = active) => {
//     const audio = audioRef.current;
//     const segment = lessonRef.current?.segments?.[index];
//     if (!audio || !segment || !sourceUrl) return;
//     const token = ++tokenRef.current;
//     cancelAnimationFrame(audioRafRef.current);
//     window.clearTimeout(fadeTimerRef.current);
//     stopMic(); setError(''); activeRef.current = index; setActive(index); setStatus('playing'); setMicMessage('Microphone off while the clip plays.');
//     let output;
//     try { output = await getAudioOutput(audio); }
//     catch (e) { setStatus('paused'); setError(e.message || 'Could not prepare clean audio playback.'); return; }
//     if (!audio.paused) {
//       const fadeAt = output.context.currentTime;
//       output.gain.gain.cancelScheduledValues(fadeAt);
//       output.gain.gain.setValueAtTime(output.gain.gain.value, fadeAt);
//       output.gain.gain.linearRampToValueAtTime(0, fadeAt + 0.01);
//       await new Promise(resolve => window.setTimeout(resolve, 15));
//       audio.pause();
//       if (token !== tokenRef.current) return;
//     }
//     let count = 0;
//     const playOnce = async () => {
//       if (token !== tokenRef.current) return;
//       count++;
//       audio.playbackRate = speed;
//       const cutoff = Math.min(Number.isFinite(audio.duration) ? audio.duration : segment.end, segment.end + 0.025);
//       audio.currentTime = Math.max(0, segment.start - 0.025);
//       const now = output.context.currentTime;
//       output.gain.gain.cancelScheduledValues(now);
//       output.gain.gain.setValueAtTime(0, now);
//       output.gain.gain.linearRampToValueAtTime(1, now + 0.012);
//       try { await audio.play(); }
//       catch { setStatus('paused'); setError('Could not play this media in your browser.'); return; }
//       let finishing = false;
//       const finish = () => {
//         if (finishing || token !== tokenRef.current) return;
//         finishing = true;
//         cancelAnimationFrame(audioRafRef.current);
//         audio.removeEventListener('ended', finish);
//         const fadeAt = output.context.currentTime;
//         output.gain.gain.cancelScheduledValues(fadeAt);
//         output.gain.gain.setValueAtTime(output.gain.gain.value, fadeAt);
//         output.gain.gain.linearRampToValueAtTime(0, fadeAt + 0.012);
//         fadeTimerRef.current = window.setTimeout(() => {
//           if (token !== tokenRef.current) return;
//           audio.pause();
//           output.gain.gain.setValueAtTime(0, output.context.currentTime);
//           if (count < repeat) playOnce();
//           else { setStatus('listening'); beginMic(token); }
//         }, 18);
//       };
//       audio.addEventListener('ended', finish, { once: true });
//       const monitor = () => {
//         if (token !== tokenRef.current) return;
//         if (audio.currentTime >= cutoff - 0.012) { finish(); return; }
//         audioRafRef.current = requestAnimationFrame(monitor);
//       };
//       audioRafRef.current = requestAnimationFrame(monitor);
//     };
//     await playOnce();
//   }, [active, beginMic, getAudioOutput, repeat, sourceUrl, speed, stopMic]);
//   playRef.current = playSegment;

//   const pause = useCallback(() => {
//     tokenRef.current++;
//     cancelAnimationFrame(audioRafRef.current);
//     window.clearTimeout(fadeTimerRef.current);
//     const audio = audioRef.current;
//     const gain = audioGainRef.current;
//     const context = audioContextRef.current;
//     if (audio && !audio.paused && gain && context) {
//       const now = context.currentTime;
//       gain.gain.cancelScheduledValues(now);
//       gain.gain.setValueAtTime(gain.gain.value, now);
//       gain.gain.linearRampToValueAtTime(0, now + 0.01);
//       fadeTimerRef.current = window.setTimeout(() => audio.pause(), 15);
//     } else audio?.pause();
//     stopMic(); setStatus('paused'); setMicMessage('Paused. Press play when you’re ready.');
//   }, [stopMic]);
//   const goTo = useCallback((index, start = true) => {
//     const end = lessonRef.current?.segments?.length || 0;
//     if (!end) return;
//     const next = Math.max(0, Math.min(end - 1, index));
//     stopMic(); tokenRef.current++;
//     activeRef.current = next; setActive(next); setTime(lessonRef.current.segments[next].start);
//     if (start) playRef.current(next); else { pause(); setTime(lessonRef.current.segments[next].start); }
//   }, [pause, stopMic]);

//   useEffect(() => {
//     function keydown(event) {
//       if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName) || document.activeElement?.isContentEditable) return;
//       if (event.code === 'Space') { event.preventDefault(); status === 'playing' ? pause() : playSegment(); }
//       if (event.key === 'ArrowLeft') { event.preventDefault(); goTo(active - 1); }
//       if (event.key === 'ArrowRight') { event.preventDefault(); goTo(active + 1); }
//       if (event.key.toLowerCase() === 'r') playSegment();
//     }
//     window.addEventListener('keydown', keydown);
//     return () => window.removeEventListener('keydown', keydown);
//   }, [active, goTo, pause, playSegment, status]);

//   useEffect(() => {
//     const canvas = canvasRef.current;
//     if (!canvas || !ready) return;
//     const draw = () => {
//       const rect = canvas.getBoundingClientRect();
//       const dpr = window.devicePixelRatio || 1;
//       canvas.width = rect.width * dpr; canvas.height = rect.height * dpr;
//       const ctx = canvas.getContext('2d'); ctx.scale(dpr, dpr);
//       const w = rect.width, h = rect.height;
//       ctx.clearRect(0, 0, w, h);
//       const bars = Math.max(120, Math.floor(w / 4));
//       const wavePeaks = peaks;
//       for (let i = 0; i < bars; i++) {
//         const fraction = i / bars;
//         const amp = wavePeaks?.length ? Math.max(.1, wavePeaks[Math.floor(fraction * wavePeaks.length)] || .1) : .1 + Math.abs(Math.sin(i * .21) * .19) + Math.abs(Math.sin(i * .067) * .18) + (Math.sin(i * .016) ** 10) * .25;
//         const height = Math.max(4, amp * h * .85);
//         const second = fraction * duration;
//         const selected = current && second >= current.start && second <= current.end;
//         ctx.fillStyle = selected ? '#a9cfb4' : '#dfe7ef';
//         ctx.beginPath(); ctx.roundRect(i * w / bars + 1, (h - height) / 2, Math.max(1, w / bars - 1), height, 2); ctx.fill();
//       }
//     };
//     draw(); window.addEventListener('resize', draw);
//     return () => window.removeEventListener('resize', draw);
//   }, [current, duration, peaks, ready]);

//   useEffect(() => {
//     const audio = audioRef.current;
//     if (!audio || !sourceUrl) return;
//     const metadata = () => { setDuration(audio.duration || lesson?.duration || 0); };
//     const update = () => { setTime(audio.currentTime); };
//     audio.addEventListener('loadedmetadata', metadata); audio.addEventListener('timeupdate', update);
//     return () => { audio.removeEventListener('loadedmetadata', metadata); audio.removeEventListener('timeupdate', update); };
//   }, [sourceUrl, lesson]);

//   function seek(e) {
//     if (!duration || !audioRef.current) return;
//     const rect = e.currentTarget.getBoundingClientRect();
//     const point = (e.clientX - rect.left) / rect.width * duration;
//     const found = lesson?.segments.findIndex(item => point >= item.start && point <= item.end) ?? -1;
//     if (found >= 0) { goTo(found, false); audioRef.current.currentTime = point; setTime(point); }
//   }
//   async function refreshTranscription() {
//     const saved = lessonRef.current;
//     if (!saved?.blob || retranscribing) return;
//     const approved = window.confirm('This will send the saved audio to the transcription service again to rebuild its sentence breaks. Continue?');
//     if (!approved) return;
//     setRetranscribing(true); setError(''); pause(); setStatus('processing');
//     try {
//       const body = new FormData();
//       body.append('file', saved.blob, saved.fileName || 'lesson-audio.mp3');
//       body.append('language', saved.language || 'auto');
//       const response = await fetch('/api/transcribe', { method: 'POST', body });
//       const result = await response.json();
//       if (!response.ok) throw new Error(result.error || 'Could not refresh this transcript.');
//       if (!result.segments?.length) throw new Error('No speech was found in this file.');
//       activeRef.current = 0; setActive(0); setDone(new Set()); setTime(0);
//       setDuration(result.duration || saved.duration || 0);
//       await persist({ transcript: result.text, words: result.words, segments: result.segments, duration: result.duration, done: [] });
//       setStatus('paused'); setMicMessage('Updated sentence breaks are ready. Press play to practice.');
//     } catch (e) {
//       setError(e.message || 'Could not refresh this transcript.'); setStatus('paused');
//     } finally { setRetranscribing(false); }
//   }
//   function updateTitle(value) { persist({ title: value }); }
//   if (!ready || !lesson) return <main className="loading-screen"><span className="spinner"/> Opening your lesson…</main>;

//   const rows = lesson.segments;
//   return <main className={dark ? 'practice-page dark' : 'practice-page'}>
//     <header className="app-header practice-header"><div className="brand"><span className="brand-mark">↗</span>shadow</div><nav className="breadcrumbs"><button onClick={() => router.push('/')}>Learning Dashboard</button><i>›</i><span>Lessons</span><i>›</i><b>{lesson.title}</b></nav><div className="header-actions"><button className="header-icon" onClick={() => setDark(!dark)} title="Toggle theme">{dark ? '☀' : '☾'}</button><button className="header-icon" onClick={() => router.push('/lessons')} title="My lessons">▤</button><span className="header-avatar">J</span></div></header>
//     <div className="practice-shell">
//       <div className="practice-title-row"><h1 contentEditable suppressContentEditableWarning onBlur={e => updateTitle(e.currentTarget.textContent)}>{lesson.title}</h1><span className={`status-pill ${status} ${showStatus ? '' : 'status-off'}`}><i/>{status === 'complete' ? 'Lesson complete' : status[0].toUpperCase() + status.slice(1)}</span></div>
//       {error && <div className="inline-error">{error}</div>}
//       <section className="player-card"><div className="wave-row"><button className="big-play" onClick={() => status === 'playing' ? pause() : playSegment()} aria-label={status === 'playing' ? 'Pause' : 'Play'}>{status === 'playing' ? 'Ⅱ' : '▶'}</button><button className="wave-wrap" onClick={seek} aria-label="Seek to a point in the audio"><canvas ref={canvasRef}/><i className="playhead" style={{ left: `${duration ? time / duration * 100 : 0}%` }}/><span className="wave-time">{formatTime(time)} / {formatTime(duration)}</span></button></div>
//         <div className="player-bar"><div className="control-pill"><span>↻</span><select value={repeat} onChange={e => setRepeat(+e.target.value)} aria-label="Repeat count"><option value="1">1×</option><option value="2">2×</option><option value="3">3×</option></select></div><div className="control-pill"><span>»</span><select value={speed} onChange={e => setSpeed(+e.target.value)} aria-label="Playback speed"><option value="0.5">0.50x</option><option value="0.75">0.75x</option><option value="0.9">0.90x</option><option value="1">1.00x</option><option value="1.1">1.10x</option><option value="1.25">1.25x</option><option value="1.5">1.50x</option></select></div><span className="bar-spacer"/><button className="bar-button" onClick={() => setShowText(!showText)}>{showText ? 'Hide text' : 'Show text'}</button><button className="bar-button green-button" onClick={() => { const next = !automatic; automaticRef.current = next; setAutomatic(next); }}>{automatic ? 'Auto' : 'Manual'}</button><button className="bar-button green-button" onClick={() => setShowStatus(!showStatus)}>{showStatus ? 'Hide Status' : 'Show Status'}</button></div>
//       </section>
//       <section className={`practice-content ${showText ? '' : 'text-hidden'}`}><div className="transcript-card"><div className="transcript-header"><h2>Transcript <span>·</span> <small>{rows.length} sentences</small></h2><span>Click a sentence to practice it</span></div><div className="sentence-list">{rows.map((segment, i) => <button key={`${segment.start}-${i}`} className={`sentence-row ${i === active ? 'active' : ''} ${done.has(i) ? 'done' : ''}`} onClick={() => goTo(i)}><i className="sentence-dot"/><span>{segment.text}</span></button>)}</div></div>
//         <aside className="practice-sidebar"><section className="side-card"><h2>Practice controls</h2><div className="manual-controls"><button onClick={() => goTo(active - 1)}>← Previous</button><button onClick={() => playSegment()}>↻ Replay</button><button onClick={() => { if (active < rows.length - 1) { markComplete(active); goTo(active + 1); } else { markComplete(active); setStatus('complete'); } }}>Next →</button></div><div className="setting"><label htmlFor="silence-range">Silence to finish <span>{silence.toFixed(1)}s</span></label><input id="silence-range" type="range" min="0.8" max="2.5" step="0.1" value={silence} onChange={e => setSilence(+e.target.value)}/></div><div className={`mic-note ${micHot ? 'mic-hot' : ''}`}><i/><div><b>{status === 'playing' ? 'Microphone is off' : status === 'listening' ? 'Your turn to speak' : status === 'complete' ? 'Lesson complete' : 'Microphone ready'}</b><span>{micMessage}</span></div></div><div className="keyboard-hint">SPACE play/pause <span>← → navigate</span> <span>R replay</span></div></section>
//         <section className="side-card lesson-info"><h2>Lesson audio</h2><p>{lesson.fileName}</p><button onClick={refreshTranscription} className="refresh-transcript" disabled={retranscribing}>{retranscribing ? 'Refreshing phrase breaks…' : '↻ Refresh transcript & phrase breaks'}</button><small>This sends the saved audio for transcription again.</small><button onClick={() => router.push('/')} className="replace-audio">＋ Upload another lesson</button></section></aside>
//       </section>
//       <audio ref={audioRef} src={sourceUrl} preload="metadata" onError={() => setError('This browser could not play the selected audio format.')}/>
//     </div>
//   </main>;
// }

// function formatTime(seconds) { if (!Number.isFinite(seconds)) seconds = 0; return `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`; }

// 'use client';

// import { useCallback, useEffect, useRef, useState } from 'react';
// import { useRouter } from 'next/navigation';
// import { getLesson, saveLesson } from '../../lib/lesson-store';

// export default function PracticePage() {
//   const router = useRouter();
//   const canvasRef = useRef(null);
//   const rafRef = useRef(0);
//   const audioRafRef = useRef(0);
//   const fadeTimerRef = useRef(0);
//   const endTimerRef = useRef(0);
//   const tokenRef = useRef(0);
//   const activeRef = useRef(0);
//   const automaticRef = useRef(true);
//   const micRef = useRef(null);
//   const analyserRef = useRef(null);
//   const audioContextRef = useRef(null);
//   const audioGainRef = useRef(null);
//   const audioBufferRef = useRef(null);
//   const sourceRef = useRef(null);
//   const lessonRef = useRef(null);
//   const [lesson, setLesson] = useState(null);
//   const [active, setActive] = useState(0);
//   const [done, setDone] = useState(new Set());
//   const [status, setStatus] = useState('paused');
//   const [time, setTime] = useState(0);
//   const [duration, setDuration] = useState(0);
//   const [repeat, setRepeat] = useState(1);
//   const [speed, setSpeed] = useState(1);
//   const [automatic, setAutomatic] = useState(true);
//   const [showText, setShowText] = useState(true);
//   const [showStatus, setShowStatus] = useState(true);
//   const [dark, setDark] = useState(false);
//   const [silence, setSilence] = useState(1.2);
//   const [micMessage, setMicMessage] = useState('Microphone turns on after each phrase.');
//   const [micHot, setMicHot] = useState(false);
//   const [error, setError] = useState('');
//   const [ready, setReady] = useState(false);
//   const [peaks, setPeaks] = useState([]);
//   const [retranscribing, setRetranscribing] = useState(false);
//   const current = lesson?.segments?.[active];

//   useEffect(() => {
//     (async () => {
//       const id = sessionStorage.getItem('shadow-active-lesson');
//       if (!id) { router.replace('/'); return; }
//       const saved = await getLesson(id);
//       if (!saved) { router.replace('/'); return; }
//       lessonRef.current = saved;
//       setLesson(saved);
//       setDone(new Set(saved.done || []));

//       // Decode the whole file once into a raw AudioBuffer. This is what we
//       // play segments from — no seeking a compressed stream, so no
//       // decode-recovery gaps and no quality dip after a jump.
//       let decodeContext;
//       try {
//         decodeContext = new (window.AudioContext || window.webkitAudioContext)();
//         const decoded = await decodeContext.decodeAudioData(await saved.blob.arrayBuffer());
//         audioBufferRef.current = decoded;
//         setDuration(decoded.duration || saved.duration || 0);

//         const channel = decoded.getChannelData(0);
//         const count = 900; const chunk = Math.max(1, Math.floor(channel.length / count));
//         const values = Array.from({ length: count }, (_, i) => { let peak = 0; for (let j = i * chunk; j < Math.min(channel.length, (i + 1) * chunk); j++) peak = Math.max(peak, Math.abs(channel[j])); return peak; });
//         setPeaks(values);
//         setReady(true);
//       } catch {
//         setError('This browser could not decode this audio file. Try a different format.');
//         setReady(true);
//       } finally {
//         try { await decodeContext?.close(); } catch { /* already closed */ }
//       }
//     })().catch(() => setError('Could not open this saved lesson. Please upload the file again.'));
//     return () => {
//       cancelAnimationFrame(audioRafRef.current);
//       window.clearTimeout(fadeTimerRef.current);
//       window.clearTimeout(endTimerRef.current);
//       stopMic(); tokenRef.current++;
//       try { sourceRef.current?.stop(); } catch { /* already stopped */ }
//       sourceRef.current = null;
//       audioContextRef.current?.close();
//     };
//   }, [router]);

//   const persist = useCallback(async (patch = {}) => {
//     const base = lessonRef.current;
//     if (!base) return;
//     const next = { ...base, ...patch };
//     lessonRef.current = next;
//     setLesson(next);
//     try { await saveLesson(next); } catch { /* Keep the active session usable if storage is full. */ }
//   }, []);

//   const stopMic = useCallback(() => {
//     cancelAnimationFrame(rafRef.current);
//     if (micRef.current) micRef.current.getTracks().forEach(track => track.stop());
//     micRef.current = null;
//     analyserRef.current = null;
//     setMicHot(false);
//   }, []);

//   // One persistent AudioContext + master gain, created (or re-created to
//   // match the file's native sample rate) the first time we need it.
//   const ensureAudioContext = useCallback(() => {
//     if (audioContextRef.current) return audioContextRef.current;
//     const AudioContextClass = window.AudioContext || window.webkitAudioContext;
//     if (!AudioContextClass) throw new Error('Audio playback is not supported in this browser.');
//     const preferredRate = audioBufferRef.current?.sampleRate;
//     let context;
//     try { context = preferredRate ? new AudioContextClass({ sampleRate: preferredRate }) : new AudioContextClass(); }
//     catch { context = new AudioContextClass(); }
//     const gain = context.createGain();
//     gain.gain.value = 0;
//     gain.connect(context.destination);
//     audioContextRef.current = context;
//     audioGainRef.current = gain;
//     return context;
//   }, []);

//   const markComplete = useCallback((index) => {
//     setDone(previous => {
//       const next = new Set(previous); next.add(index);
//       persist({ done: [...next] });
//       return next;
//     });
//   }, [persist]);

//   const beginMic = useCallback(async (token) => {
//     setStatus('listening');
//     setMicMessage('Listening for your voice…');
//     if (!navigator.mediaDevices?.getUserMedia) {
//       setMicMessage('Microphone access needs a secure browser connection.'); return;
//     }
//     try {
//       const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
//       if (token !== tokenRef.current) { stream.getTracks().forEach(track => track.stop()); return; }
//       micRef.current = stream;
//       const context = ensureAudioContext();
//       await context.resume();
//       const source = context.createMediaStreamSource(stream);
//       const analyser = context.createAnalyser();
//       analyser.fftSize = 512;
//       source.connect(analyser);
//       analyserRef.current = analyser;
//       const values = new Uint8Array(analyser.fftSize);
//       let heardSpeech = false;
//       let lastVoice = Date.now();
//       const startedAt = Date.now();
//       const scan = () => {
//         if (token !== tokenRef.current || !analyserRef.current) return;
//         analyser.getByteTimeDomainData(values);
//         let sum = 0;
//         for (const sample of values) { const normalized = (sample - 128) / 128; sum += normalized * normalized; }
//         const rms = Math.sqrt(sum / values.length);
//         if (rms > 0.027) {
//           heardSpeech = true; lastVoice = Date.now(); setMicHot(true); setMicMessage('I hear you. Keep going…');
//         } else if (heardSpeech && Date.now() - lastVoice > silence * 1000) {
//           const completedIndex = activeRef.current;
//           stopMic(); markComplete(completedIndex);
//           setStatus('processing'); setMicMessage('Nice work — moving to the next phrase.');
//           window.setTimeout(() => {
//             if (token !== tokenRef.current) return;
//             if (completedIndex >= (lessonRef.current?.segments?.length || 1) - 1) {
//               setStatus('complete'); setMicMessage('Lesson complete. You did it!'); return;
//             }
//             const next = completedIndex + 1; activeRef.current = next; setActive(next);
//             if (automaticRef.current) playRef.current(next); else setStatus('paused');
//           }, 650);
//           return;
//         } else if (!heardSpeech && Date.now() - startedAt > 10_000) {
//           stopMic(); setMicMessage('No speech detected. Replay or skip when you’re ready.'); return;
//         }
//         rafRef.current = requestAnimationFrame(scan);
//       };
//       rafRef.current = requestAnimationFrame(scan);
//     } catch {
//       setMicMessage('Microphone permission was denied. Allow it in your browser settings, then replay.');
//     }
//   }, [ensureAudioContext, markComplete, silence, stopMic]);

//   const playRef = useRef(null);
//   const FADE = 0.012;
//   const playSegment = useCallback(async (index = active) => {
//     const buffer = audioBufferRef.current;
//     const segment = lessonRef.current?.segments?.[index];
//     if (!buffer || !segment) return;
//     const token = ++tokenRef.current;
//     cancelAnimationFrame(audioRafRef.current);
//     window.clearTimeout(fadeTimerRef.current);
//     window.clearTimeout(endTimerRef.current);
//     stopMic(); setError(''); activeRef.current = index; setActive(index); setStatus('playing'); setMicMessage('Microphone off while the clip plays.');

//     let context, gain;
//     try {
//       context = ensureAudioContext();
//       await context.resume();
//       gain = audioGainRef.current;
//     } catch (e) {
//       setStatus('paused'); setError(e.message || 'Could not prepare audio playback.'); return;
//     }
//     if (token !== tokenRef.current) return;

//     // If something is still playing (e.g. user tapped a new sentence mid-clip),
//     // fade it out quickly before starting the next one.
//     if (sourceRef.current) {
//       const now = context.currentTime;
//       gain.gain.cancelScheduledValues(now);
//       gain.gain.setValueAtTime(gain.gain.value, now);
//       gain.gain.linearRampToValueAtTime(0, now + 0.01);
//       const stale = sourceRef.current;
//       sourceRef.current = null;
//       window.setTimeout(() => { try { stale.stop(); } catch { /* already stopped */ } }, 15);
//       await new Promise(resolve => window.setTimeout(resolve, 15));
//       if (token !== tokenRef.current) return;
//     }

//     let count = 0;
//     const playOnce = () => {
//       if (token !== tokenRef.current) return;
//       count++;
//       const rate = speed;
//       const clipStart = Math.max(0, segment.start);
//       const clipDuration = Math.max(0.05, Math.min(buffer.duration - clipStart, segment.end - segment.start));
//       const realDuration = clipDuration / rate;

//       const source = context.createBufferSource();
//       source.buffer = buffer;
//       source.playbackRate.value = rate;
//       source.connect(gain);
//       sourceRef.current = source;

//       const now = context.currentTime;
//       gain.gain.cancelScheduledValues(now);
//       gain.gain.setValueAtTime(0, now);
//       gain.gain.linearRampToValueAtTime(1, now + FADE);
//       const fadeOutStart = Math.max(now + FADE, now + realDuration - FADE);
//       gain.gain.setValueAtTime(1, fadeOutStart);
//       gain.gain.linearRampToValueAtTime(0, fadeOutStart + FADE);

//       let finished = false;
//       const finish = () => {
//         if (finished || token !== tokenRef.current) return;
//         finished = true;
//         cancelAnimationFrame(audioRafRef.current);
//         window.clearTimeout(endTimerRef.current);
//         if (sourceRef.current === source) sourceRef.current = null;
//         if (count < repeat) window.setTimeout(playOnce, 30);
//         else { setStatus('listening'); beginMic(token); }
//       };
//       source.onended = finish;
//       // Safety net in case onended is ever delayed by the browser.
//       endTimerRef.current = window.setTimeout(finish, Math.max(50, realDuration * 1000 + 60));

//       try { source.start(now, clipStart, clipDuration); }
//       catch { setStatus('paused'); setError('Could not play this media in your browser.'); return; }

//       const tick = () => {
//         if (token !== tokenRef.current) return;
//         const elapsed = (context.currentTime - now) * rate;
//         setTime(Math.min(segment.end, clipStart + elapsed));
//         audioRafRef.current = requestAnimationFrame(tick);
//       };
//       audioRafRef.current = requestAnimationFrame(tick);
//     };
//     playOnce();
//   }, [active, beginMic, ensureAudioContext, repeat, speed, stopMic]);
//   playRef.current = playSegment;

//   const pause = useCallback(() => {
//     tokenRef.current++;
//     cancelAnimationFrame(audioRafRef.current);
//     window.clearTimeout(fadeTimerRef.current);
//     window.clearTimeout(endTimerRef.current);
//     const context = audioContextRef.current;
//     const gain = audioGainRef.current;
//     const source = sourceRef.current;
//     if (source && gain && context) {
//       const now = context.currentTime;
//       gain.gain.cancelScheduledValues(now);
//       gain.gain.setValueAtTime(gain.gain.value, now);
//       gain.gain.linearRampToValueAtTime(0, now + 0.01);
//       fadeTimerRef.current = window.setTimeout(() => { try { source.stop(); } catch { /* already stopped */ } }, 15);
//     }
//     sourceRef.current = null;
//     stopMic(); setStatus('paused'); setMicMessage('Paused. Press play when you’re ready.');
//   }, [stopMic]);
//   const goTo = useCallback((index, start = true) => {
//     const end = lessonRef.current?.segments?.length || 0;
//     if (!end) return;
//     const next = Math.max(0, Math.min(end - 1, index));
//     stopMic(); tokenRef.current++;
//     activeRef.current = next; setActive(next); setTime(lessonRef.current.segments[next].start);
//     if (start) playRef.current(next); else pause();
//   }, [pause, stopMic]);

//   useEffect(() => {
//     function keydown(event) {
//       if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName) || document.activeElement?.isContentEditable) return;
//       if (event.code === 'Space') { event.preventDefault(); status === 'playing' ? pause() : playSegment(); }
//       if (event.key === 'ArrowLeft') { event.preventDefault(); goTo(active - 1); }
//       if (event.key === 'ArrowRight') { event.preventDefault(); goTo(active + 1); }
//       if (event.key.toLowerCase() === 'r') playSegment();
//     }
//     window.addEventListener('keydown', keydown);
//     return () => window.removeEventListener('keydown', keydown);
//   }, [active, goTo, pause, playSegment, status]);

//   useEffect(() => {
//     const canvas = canvasRef.current;
//     if (!canvas || !ready) return;
//     const draw = () => {
//       const rect = canvas.getBoundingClientRect();
//       const dpr = window.devicePixelRatio || 1;
//       canvas.width = rect.width * dpr; canvas.height = rect.height * dpr;
//       const ctx = canvas.getContext('2d'); ctx.scale(dpr, dpr);
//       const w = rect.width, h = rect.height;
//       ctx.clearRect(0, 0, w, h);
//       const bars = Math.max(120, Math.floor(w / 4));
//       const wavePeaks = peaks;
//       for (let i = 0; i < bars; i++) {
//         const fraction = i / bars;
//         const amp = wavePeaks?.length ? Math.max(.1, wavePeaks[Math.floor(fraction * wavePeaks.length)] || .1) : .1 + Math.abs(Math.sin(i * .21) * .19) + Math.abs(Math.sin(i * .067) * .18) + (Math.sin(i * .016) ** 10) * .25;
//         const height = Math.max(4, amp * h * .85);
//         const second = fraction * duration;
//         const selected = current && second >= current.start && second <= current.end;
//         ctx.fillStyle = selected ? '#a9cfb4' : '#dfe7ef';
//         ctx.beginPath(); ctx.roundRect(i * w / bars + 1, (h - height) / 2, Math.max(1, w / bars - 1), height, 2); ctx.fill();
//       }
//     };
//     draw(); window.addEventListener('resize', draw);
//     return () => window.removeEventListener('resize', draw);
//   }, [current, duration, peaks, ready]);

//   function seek(e) {
//     if (!duration) return;
//     const rect = e.currentTarget.getBoundingClientRect();
//     const point = (e.clientX - rect.left) / rect.width * duration;
//     const found = lesson?.segments.findIndex(item => point >= item.start && point <= item.end) ?? -1;
//     if (found >= 0) { goTo(found, false); setTime(point); }
//   }
//   async function refreshTranscription() {
//     const saved = lessonRef.current;
//     if (!saved?.blob || retranscribing) return;
//     const approved = window.confirm('This will send the saved audio to the transcription service again to rebuild its sentence breaks. Continue?');
//     if (!approved) return;
//     setRetranscribing(true); setError(''); pause(); setStatus('processing');
//     try {
//       const body = new FormData();
//       body.append('file', saved.blob, saved.fileName || 'lesson-audio.mp3');
//       body.append('language', saved.language || 'auto');
//       const response = await fetch('/api/transcribe', { method: 'POST', body });
//       const result = await response.json();
//       if (!response.ok) throw new Error(result.error || 'Could not refresh this transcript.');
//       if (!result.segments?.length) throw new Error('No speech was found in this file.');
//       activeRef.current = 0; setActive(0); setDone(new Set()); setTime(0);
//       await persist({ transcript: result.text, words: result.words, segments: result.segments, duration: result.duration, done: [] });
//       setStatus('paused'); setMicMessage('Updated sentence breaks are ready. Press play to practice.');
//     } catch (e) {
//       setError(e.message || 'Could not refresh this transcript.'); setStatus('paused');
//     } finally { setRetranscribing(false); }
//   }
//   function updateTitle(value) { persist({ title: value }); }
//   if (!ready || !lesson) return <main className="loading-screen"><span className="spinner"/> Opening your lesson…</main>;

//   const rows = lesson.segments;
//   return <main className={dark ? 'practice-page dark' : 'practice-page'}>
//     <header className="app-header practice-header"><div className="brand"><span className="brand-mark">↗</span>shadow</div><nav className="breadcrumbs"><button onClick={() => router.push('/')}>Learning Dashboard</button><i>›</i><span>Lessons</span><i>›</i><b>{lesson.title}</b></nav><div className="header-actions"><button className="header-icon" onClick={() => setDark(!dark)} title="Toggle theme">{dark ? '☀' : '☾'}</button><button className="header-icon" onClick={() => router.push('/lessons')} title="My lessons">▤</button><span className="header-avatar">J</span></div></header>
//     <div className="practice-shell">
//       <div className="practice-title-row"><h1 contentEditable suppressContentEditableWarning onBlur={e => updateTitle(e.currentTarget.textContent)}>{lesson.title}</h1><span className={`status-pill ${status} ${showStatus ? '' : 'status-off'}`}><i/>{status === 'complete' ? 'Lesson complete' : status[0].toUpperCase() + status.slice(1)}</span></div>
//       {error && <div className="inline-error">{error}</div>}
//       <section className="player-card"><div className="wave-row"><button className="big-play" onClick={() => status === 'playing' ? pause() : playSegment()} aria-label={status === 'playing' ? 'Pause' : 'Play'}>{status === 'playing' ? 'Ⅱ' : '▶'}</button><button className="wave-wrap" onClick={seek} aria-label="Seek to a point in the audio"><canvas ref={canvasRef}/><i className="playhead" style={{ left: `${duration ? time / duration * 100 : 0}%` }}/><span className="wave-time">{formatTime(time)} / {formatTime(duration)}</span></button></div>
//         <div className="player-bar"><div className="control-pill"><span>↻</span><select value={repeat} onChange={e => setRepeat(+e.target.value)} aria-label="Repeat count"><option value="1">1×</option><option value="2">2×</option><option value="3">3×</option></select></div><div className="control-pill"><span>»</span><select value={speed} onChange={e => setSpeed(+e.target.value)} aria-label="Playback speed"><option value="0.5">0.50x</option><option value="0.75">0.75x</option><option value="0.9">0.90x</option><option value="1">1.00x</option><option value="1.1">1.10x</option><option value="1.25">1.25x</option><option value="1.5">1.50x</option></select></div><span className="bar-spacer"/><button className="bar-button" onClick={() => setShowText(!showText)}>{showText ? 'Hide text' : 'Show text'}</button><button className="bar-button green-button" onClick={() => { const next = !automatic; automaticRef.current = next; setAutomatic(next); }}>{automatic ? 'Auto' : 'Manual'}</button><button className="bar-button green-button" onClick={() => setShowStatus(!showStatus)}>{showStatus ? 'Hide Status' : 'Show Status'}</button></div>
//       </section>
//       <section className={`practice-content ${showText ? '' : 'text-hidden'}`}><div className="transcript-card"><div className="transcript-header"><h2>Transcript <span>·</span> <small>{rows.length} sentences</small></h2><span>Click a sentence to practice it</span></div><div className="sentence-list">{rows.map((segment, i) => <button key={`${segment.start}-${i}`} className={`sentence-row ${i === active ? 'active' : ''} ${done.has(i) ? 'done' : ''}`} onClick={() => goTo(i)}><i className="sentence-dot"/><span>{segment.text}</span></button>)}</div></div>
//         <aside className="practice-sidebar"><section className="side-card"><h2>Practice controls</h2><div className="manual-controls"><button onClick={() => goTo(active - 1)}>← Previous</button><button onClick={() => playSegment()}>↻ Replay</button><button onClick={() => { if (active < rows.length - 1) { markComplete(active); goTo(active + 1); } else { markComplete(active); setStatus('complete'); } }}>Next →</button></div><div className="setting"><label htmlFor="silence-range">Silence to finish <span>{silence.toFixed(1)}s</span></label><input id="silence-range" type="range" min="0.8" max="2.5" step="0.1" value={silence} onChange={e => setSilence(+e.target.value)}/></div><div className={`mic-note ${micHot ? 'mic-hot' : ''}`}><i/><div><b>{status === 'playing' ? 'Microphone is off' : status === 'listening' ? 'Your turn to speak' : status === 'complete' ? 'Lesson complete' : 'Microphone ready'}</b><span>{micMessage}</span></div></div><div className="keyboard-hint">SPACE play/pause <span>← → navigate</span> <span>R replay</span></div></section>
//         <section className="side-card lesson-info"><h2>Lesson audio</h2><p>{lesson.fileName}</p><button onClick={refreshTranscription} className="refresh-transcript" disabled={retranscribing}>{retranscribing ? 'Refreshing phrase breaks…' : '↻ Refresh transcript & phrase breaks'}</button><small>This sends the saved audio for transcription again.</small><button onClick={() => router.push('/')} className="replace-audio">＋ Upload another lesson</button></section></aside>
//       </section>
//     </div>
//   </main>;
// }

// function formatTime(seconds) { if (!Number.isFinite(seconds)) seconds = 0; return `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`; }

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getLesson, saveLesson } from '../../lib/lesson-store';

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
  const lessonRef = useRef(null);
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
  const current = lesson?.segments?.[active];

  useEffect(() => {
    (async () => {
      const id = sessionStorage.getItem('shadow-active-lesson');
      if (!id) { router.replace('/'); return; }
      const saved = await getLesson(id);
      if (!saved) { router.replace('/'); return; }
      lessonRef.current = saved;
      setLesson(saved);
      setDone(new Set(saved.done || []));

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
      cancelAnimationFrame(audioRafRef.current);
      window.clearTimeout(fadeTimerRef.current);
      window.clearTimeout(endTimerRef.current);
      stopMic(); tokenRef.current++;
      try { sourceRef.current?.stop(); } catch { /* already stopped */ }
      sourceRef.current = null;
      audioContextRef.current?.close();
    };
  }, [router]);

  const persist = useCallback(async (patch = {}) => {
    const base = lessonRef.current;
    if (!base) return;
    const next = { ...base, ...patch };
    lessonRef.current = next;
    setLesson(next);
    try { await saveLesson(next); } catch { /* Keep the active session usable if storage is full. */ }
  }, []);

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
        if (count < repeat) window.setTimeout(playOnce, 30);
        else { setStatus('listening'); beginMic(token); }
      };
      source.onended = finish;
      // Safety net in case onended is ever delayed by the browser.
      endTimerRef.current = window.setTimeout(finish, Math.max(50, realDuration * 1000 + 60));

      try { source.start(now, clipStart, clipDuration); }
      catch { setStatus('paused'); setError('Could not play this media in your browser.'); return; }

      const tick = () => {
        if (token !== tokenRef.current) return;
        const elapsed = (context.currentTime - now) * rate;
        setTime(Math.min(segment.end, clipStart + elapsed));
        audioRafRef.current = requestAnimationFrame(tick);
      };
      audioRafRef.current = requestAnimationFrame(tick);
    };
    playOnce();
  }, [active, beginMic, ensureAudioContext, repeat, speed, stopMic]);
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
    stopMic(); setStatus('paused'); setMicMessage('Paused. Press play when you’re ready.');
  }, [stopMic]);
  const goTo = useCallback((index, start = true) => {
    const end = lessonRef.current?.segments?.length || 0;
    if (!end) return;
    const next = Math.max(0, Math.min(end - 1, index));
    stopMic(); tokenRef.current++;
    activeRef.current = next; setActive(next); setTime(lessonRef.current.segments[next].start);
    if (start) playRef.current(next); else pause();
  }, [pause, stopMic]);

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
    if (found >= 0) { goTo(found, false); setTime(point); }
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
    <header className="app-header practice-header"><div className="brand"><span className="brand-mark">↗</span>shadow</div><nav className="breadcrumbs"><button onClick={() => router.push('/')}>Learning Dashboard</button><i>›</i><span>Lessons</span><i>›</i><b>{lesson.title}</b></nav><div className="header-actions"><button className="header-icon" onClick={() => setDark(!dark)} title="Toggle theme">{dark ? '☀' : '☾'}</button><button className="header-icon" onClick={() => router.push('/lessons')} title="My lessons">▤</button><span className="header-avatar">J</span></div></header>
    <div className="practice-shell">
      <div className="practice-title-row"><h1 contentEditable suppressContentEditableWarning onBlur={e => updateTitle(e.currentTarget.textContent)}>{lesson.title}</h1><span className={`status-pill ${status} ${showStatus ? '' : 'status-off'}`}><i/>{status === 'complete' ? 'Lesson complete' : status[0].toUpperCase() + status.slice(1)}</span></div>
      {error && <div className="inline-error">{error}</div>}
      <section className="player-card"><div className="wave-row"><button className="big-play" onClick={() => status === 'playing' ? pause() : playSegment()} aria-label={status === 'playing' ? 'Pause' : 'Play'}>{status === 'playing' ? 'Ⅱ' : '▶'}</button><button className="wave-wrap" onClick={seek} aria-label="Seek to a point in the audio"><canvas ref={canvasRef}/><i className="playhead" style={{ left: `${duration ? time / duration * 100 : 0}%` }}/><span className="wave-time">{formatTime(time)} / {formatTime(duration)}</span></button></div>
        <div className="player-bar"><div className="control-pill"><span>↻</span><select value={repeat} onChange={e => setRepeat(+e.target.value)} aria-label="Repeat count"><option value="1">1×</option><option value="2">2×</option><option value="3">3×</option></select></div><div className="control-pill"><span>»</span><select value={speed} onChange={e => setSpeed(+e.target.value)} aria-label="Playback speed"><option value="0.5">0.50x</option><option value="0.75">0.75x</option><option value="0.9">0.90x</option><option value="1">1.00x</option><option value="1.1">1.10x</option><option value="1.25">1.25x</option><option value="1.5">1.50x</option></select></div><span className="bar-spacer"/><button className="bar-button" onClick={() => setShowText(!showText)}>{showText ? 'Hide text' : 'Show text'}</button><button className="bar-button green-button" onClick={() => { const next = !automatic; automaticRef.current = next; setAutomatic(next); }}>{automatic ? 'Auto' : 'Manual'}</button><button className="bar-button green-button" onClick={() => setShowStatus(!showStatus)}>{showStatus ? 'Hide Status' : 'Show Status'}</button></div>
      </section>
      <section className={`practice-content ${showText ? '' : 'text-hidden'}`}><div className="transcript-card"><div className="transcript-header"><h2>Transcript <span>·</span> <small>{rows.length} sentences</small></h2><span>Click a sentence to practice it</span></div><div className="sentence-list">{rows.map((segment, i) => <button key={`${segment.start}-${i}`} className={`sentence-row ${i === active ? 'active' : ''} ${done.has(i) ? 'done' : ''}`} onClick={() => goTo(i)}><i className="sentence-dot"/><span>{segment.text}</span></button>)}</div></div>
        <aside className="practice-sidebar"><section className="side-card"><h2>Practice controls</h2><div className="manual-controls"><button onClick={() => goTo(active - 1)}>← Previous</button><button onClick={() => playSegment()}>↻ Replay</button><button onClick={() => { if (active < rows.length - 1) { markComplete(active); goTo(active + 1); } else { markComplete(active); setStatus('complete'); } }}>Next →</button></div><div className="setting"><label htmlFor="silence-range">Silence to finish <span>{silence.toFixed(1)}s</span></label><input id="silence-range" type="range" min="0.8" max="2.5" step="0.1" value={silence} onChange={e => setSilence(+e.target.value)}/></div><div className={`mic-note ${micHot ? 'mic-hot' : ''}`}><i/><div><b>{status === 'playing' ? 'Microphone is off' : status === 'listening' ? 'Your turn to speak' : status === 'complete' ? 'Lesson complete' : 'Microphone ready'}</b><span>{micMessage}</span></div></div><div className="keyboard-hint">SPACE play/pause <span>← → navigate</span> <span>R replay</span></div></section>
        <section className="side-card lesson-info"><h2>Lesson audio</h2><p>{lesson.fileName}</p><button onClick={refreshTranscription} className="refresh-transcript" disabled={retranscribing}>{retranscribing ? 'Refreshing phrase breaks…' : '↻ Refresh transcript & phrase breaks'}</button><small>This sends the saved audio for transcription again.</small><button onClick={() => router.push('/')} className="replace-audio">＋ Upload another lesson</button></section></aside>
      </section>
    </div>
  </main>;
}

function formatTime(seconds) { if (!Number.isFinite(seconds)) seconds = 0; return `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`; }