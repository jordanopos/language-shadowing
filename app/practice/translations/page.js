'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { getLesson, saveLesson } from '../../../lib/lesson-store';

function formatTime(seconds) {
  if (!Number.isFinite(seconds)) seconds = 0;
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 10);
  return `${m}:${String(s).padStart(2, '0')}.${ms}`;
}

export default function TranslationsPage() {
  const router = useRouter();
  const [lesson, setLesson] = useState(null);
  const [translations, setTranslations] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [playingIndex, setPlayingIndex] = useState(null);
  const [search, setSearch] = useState('');
  const [copiedIndex, setCopiedIndex] = useState(null);

  const audioContextRef = useRef(null);
  const audioBufferRef = useRef(null);
  const currentSourceRef = useRef(null);
  const gainNodeRef = useRef(null);
  const lessonRef = useRef(null);

  // Load lesson from sessionStorage or URL query
  useEffect(() => {
    (async () => {
      let id = null;
      if (typeof window !== 'undefined') {
        const params = new URLSearchParams(window.location.search);
        id = params.get('id') || sessionStorage.getItem('shadow-active-lesson');
      }
      if (!id) {
        router.replace('/lessons');
        return;
      }

      const saved = await getLesson(id);
      if (!saved) {
        router.replace('/lessons');
        return;
      }

      lessonRef.current = saved;
      setLesson(saved);
      setTranslations(saved.translations || {});

      // Decode audio once for exact segment cuts
      try {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (AudioCtx && saved.blob) {
          const ctx = new AudioCtx();
          audioContextRef.current = ctx;
          const arrayBuf = await saved.blob.arrayBuffer();
          const decoded = await ctx.decodeAudioData(arrayBuf);
          audioBufferRef.current = decoded;
        }
      } catch (err) {
        console.warn('Audio decoding failed in spreadsheet view', err);
      }
      setLoading(false);
    })().catch(err => {
      setError(err.message || 'Could not load lesson translations.');
      setLoading(false);
    });

    return () => {
      try {
        currentSourceRef.current?.stop();
      } catch {}
      audioContextRef.current?.close();
    };
  }, [router]);

  // Stop current audio playback
  const stopAudio = useCallback(() => {
    if (currentSourceRef.current) {
      try {
        currentSourceRef.current.stop();
      } catch {}
      currentSourceRef.current = null;
    }
    setPlayingIndex(null);
  }, []);

  // Play exact cut for a segment
  const playCut = useCallback(async (index) => {
    if (playingIndex === index) {
      stopAudio();
      return;
    }

    const buffer = audioBufferRef.current;
    const segment = lesson?.segments?.[index];
    if (!buffer || !segment) return;

    let ctx = audioContextRef.current;
    if (!ctx || ctx.state === 'closed') {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      ctx = new AudioCtx();
      audioContextRef.current = ctx;
    }
    if (ctx.state === 'suspended') {
      await ctx.resume();
    }

    // Stop any existing audio
    stopAudio();

    const clipStart = Math.max(0, segment.start);
    const clipDuration = Math.max(0.05, Math.min(buffer.duration - clipStart, segment.end - segment.start));

    const source = ctx.createBufferSource();
    source.buffer = buffer;

    const gain = ctx.createGain();
    source.connect(gain);
    gain.connect(ctx.destination);
    gainNodeRef.current = gain;

    const now = ctx.currentTime;
    const FADE = 0.01;
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(1, now + FADE);
    const fadeOutStart = Math.max(now + FADE, now + clipDuration - FADE);
    gain.gain.setValueAtTime(1, fadeOutStart);
    gain.gain.linearRampToValueAtTime(0, fadeOutStart + FADE);

    source.start(now, clipStart, clipDuration);
    currentSourceRef.current = source;
    setPlayingIndex(index);

    source.onended = () => {
      if (currentSourceRef.current === source) {
        currentSourceRef.current = null;
        setPlayingIndex(null);
      }
    };
  }, [lesson, playingIndex, stopAudio]);

  // Copy text to clipboard
  const copyTranslation = useCallback((index, text) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 1800);
  }, []);

  // Filter: ONLY include segments with saved translations
  const allSegments = lesson?.segments || [];
  const translatedRows = useMemo(() => {
    return allSegments
      .map((segment, index) => ({ segment, index }))
      .filter(({ index }) => !!translations[index]?.text);
  }, [allSegments, translations]);

  // Search filter applied over saved translations only
  const filteredRows = useMemo(() => {
    if (!search.trim()) return translatedRows;
    const query = search.toLowerCase();
    return translatedRows.filter(({ segment, index }) => {
      const orig = segment.text || '';
      const t = translations[index]?.text || '';
      return orig.toLowerCase().includes(query) || t.toLowerCase().includes(query);
    });
  }, [translatedRows, search, translations]);

  // Export spreadsheet as CSV (only saved translations)
  const exportCsv = useCallback(() => {
    if (!translatedRows.length) return;
    const header = ['#', 'Original_Sentence_Number', 'Start_Sec', 'End_Sec', 'Original_Text', 'English_Translation'];
    const rowsData = translatedRows.map(({ segment: s, index: i }, rowIdx) => {
      const t = translations[i]?.text || '';
      const cleanOriginal = `"${(s.text || '').replace(/"/g, '""')}"`;
      const cleanTrans = `"${t.replace(/"/g, '""')}"`;
      return [rowIdx + 1, i + 1, s.start.toFixed(2), s.end.toFixed(2), cleanOriginal, cleanTrans].join(',');
    });
    const csvContent = 'data:text/csv;charset=utf-8,' + [header.join(','), ...rowsData].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `${(lesson.title || 'lesson').replace(/\s+/g, '_')}_saved_translations.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, [lesson, translatedRows, translations]);

  if (loading) {
    return (
      <main className="upload-page">
        <header className="app-header upload-header">
          <button className="brand brand-button" onClick={() => router.push('/')}>
            <span className="brand-mark">↗</span>shadow
          </button>
          <button className="library-button" onClick={() => router.push('/lessons')}>My Lessons</button>
        </header>
        <div className="library-empty">
          <span className="spinner" /> Loading saved translations…
        </div>
      </main>
    );
  }

  if (error || !lesson) {
    return (
      <main className="upload-page">
        <header className="app-header upload-header">
          <button className="brand brand-button" onClick={() => router.push('/')}>
            <span className="brand-mark">↗</span>shadow
          </button>
          <button className="library-button" onClick={() => router.push('/lessons')}>My Lessons</button>
        </header>
        <div className="library-empty">
          <div className="empty-icon">!</div>
          <h2>Could not open translations</h2>
          <p>{error || 'Lesson data was not found.'}</p>
          <button className="new-lesson" onClick={() => router.push('/lessons')}>← Back to My Lessons</button>
        </div>
      </main>
    );
  }

  return (
    <main className="upload-page sheet-page-wrapper">
      {/* Universal standard header */}
      <header className="app-header upload-header">
        <button className="brand brand-button" onClick={() => router.push('/')}>
          <span className="brand-mark">↗</span>shadow
        </button>
        <button className="library-button" onClick={() => router.push('/lessons')}>My Lessons</button>
      </header>

      <div className="sheet-shell">
        {/* Navigation & Header Info */}
        <div className="sheet-hero">
          <button className="back-link" onClick={() => router.push('/practice')}>
            ← Back to practice lesson
          </button>

          <div className="sheet-heading-row">
            <div>
              <div className="eyebrow">
                <span className="eyebrow-dot" /> SAVED TRANSLATIONS
              </div>
              <h1 className="sheet-lesson-title">{lesson.title}</h1>
              <p className="sheet-subtitle">
                Spreadsheet of your saved phrase translations and exact audio cuts.
              </p>
            </div>
          </div>
        </div>

        {/* Spreadsheet Toolbar: Search bar on the left, Export on the right */}
        <div className="sheet-toolbar">
          <div className="sheet-search-wrap">
            <span className="search-icon">🔍</span>
            <input
              type="text"
              placeholder="Search saved translations…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="sheet-search-input"
            />
            {search && (
              <button className="search-clear-btn" onClick={() => setSearch('')}>✕</button>
            )}
          </div>

          <div className="sheet-actions">
            <button
              className="sheet-action-btn secondary"
              onClick={exportCsv}
              disabled={!translatedRows.length}
              title={translatedRows.length ? 'Export spreadsheet to CSV file' : 'No saved translations to export'}
            >
              📥 Export CSV
            </button>
          </div>
        </div>

        {/* Spreadsheet Table View */}
        <div className="spreadsheet-card">
          <div className="sheet-table-scroll">
            <table className="sheet-table">
              <thead>
                <tr>
                  <th className="th-num">#</th>
                  <th className="th-audio">Audio</th>
                  <th className="th-original">
                    Original Speech ({lesson.language === 'auto' ? 'Source' : lesson.language})
                  </th>
                  <th className="th-english">English Translation</th>
                  <th className="th-action">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="sheet-no-results">
                      {search ? (
                        <span>No saved translations match "{search}"</span>
                      ) : (
                        <div className="empty-translations-box">
                          <div className="empty-trans-icon">文A</div>
                          <h3>No translations saved yet</h3>
                          <p>
                            Click the <strong>translate icon</strong> on any sentence in the practice view, and it will be permanently saved and displayed here.
                          </p>
                          <button className="sheet-btn-back-practice" onClick={() => router.push('/practice')}>
                            ← Return to Practice
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ) : (
                  filteredRows.map(({ segment, index }, rowIdx) => {
                    const t = translations[index];
                    const isPlaying = playingIndex === index;

                    return (
                      <tr
                        key={index}
                        className={`sheet-row ${isPlaying ? 'row-playing' : ''} row-has-translation`}
                      >
                        {/* Column 1: Row # */}
                        <td className="td-num">
                          <span className="row-index-pill" title={`Original sentence #${index + 1}`}>
                            {rowIdx + 1}
                          </span>
                        </td>

                        {/* Column 2: Audio */}
                        <td className="td-audio">
                          <div className="cut-cell">
                            <button
                              className={`sheet-play-btn ${isPlaying ? 'playing' : ''}`}
                              onClick={() => playCut(index)}
                              title={isPlaying ? 'Pause audio' : 'Play audio'}
                              aria-label={isPlaying ? 'Stop audio' : 'Play audio'}
                            >
                              {isPlaying ? (
                                <span className="cut-stop-icon">■</span>
                              ) : (
                                <span className="cut-play-icon">▶</span>
                              )}
                            </button>
                          </div>
                        </td>

                        {/* Column 3: Original Sentence */}
                        <td className="td-original">
                          <div className="original-text-content">
                            {segment.text}
                          </div>
                        </td>

                        {/* Column 4: English Translation */}
                        <td className="td-english">
                          <div className="translation-result">
                            <span className="translation-text">{t.text}</span>
                            <span className="translation-badge-saved">Saved</span>
                          </div>
                        </td>

                        {/* Column 5: Actions */}
                        <td className="td-action">
                          <div className="row-actions-wrap">
                            <button
                              className="sheet-icon-btn"
                              onClick={() => copyTranslation(index, t.text)}
                              title="Copy English translation"
                            >
                              {copiedIndex === index ? '✓ Copied' : '📋 Copy'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <div className="sheet-footer-bar">
            <span>
              Showing {filteredRows.length} {filteredRows.length === 1 ? 'saved translation' : 'saved translations'}
            </span>
            <span>All translations are saved locally in your browser database</span>
          </div>
        </div>
      </div>
    </main>
  );
}
