'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import SpeakHeader, { copyText, formatDate } from '../../_components/SpeakHeader';
import Markdown from '../../_components/Markdown';
import VocabularyCards from '../../_components/VocabularyCards';
import OverallFeedback from '../../_components/OverallFeedback';
import { getSession } from '../../../../lib/speak/session-store';
import { FILTERS, TONE_LABELS, TYPE_LABELS, toneFor } from '../../../../lib/speak/categories';

export default function AnalysisPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id;

  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [audioUrl, setAudioUrl] = useState('');

  // Active view tab: 'comparison' | 'breakdown' | 'vocabulary' | 'feedback'
  const [activeTab, setActiveTab] = useState('comparison');

  // Mobile column view: 'original' | 'corrected' | 'explanation'
  const [mobileColumn, setMobileColumn] = useState('original');

  // Annotation state
  const [selectedCorrectionId, setSelectedCorrectionId] = useState(null);
  const [activeFilterId, setActiveFilterId] = useState('all');
  const [showHighlights, setShowHighlights] = useState(true);
  const [copied, setCopied] = useState(false);

  // Tooltip hover state: { x, y, correction }
  const [tooltip, setTooltip] = useState(null);
  const hoverTimeoutRef = useRef(null);
  const explanationPanelRef = useRef(null);

  // Load session from IndexedDB
  useEffect(() => {
    if (!id) return;
    setLoading(true);
    setLoadError('');
    getSession(id)
      .then(sess => {
        if (!sess) {
          setLoadError('Analysis not found. It may have been deleted or created in a different browser.');
          return;
        }
        setSession(sess);
        if (sess.corrections?.length) {
          setSelectedCorrectionId(sess.corrections[0].id);
        }
        if (sess.audio) {
          const url = URL.createObjectURL(sess.audio);
          setAudioUrl(url);
        }
      })
      .catch(err => {
        setLoadError(`Failed to load analysis: ${err.message || 'IndexedDB error'}`);
      })
      .finally(() => setLoading(false));

    return () => {
      if (audioUrl) URL.revokeObjectURL(audioUrl);
    };
  }, [id]);

  // Clean up audio object URL on unmount
  useEffect(() => {
    return () => {
      if (audioUrl) URL.revokeObjectURL(audioUrl);
    };
  }, [audioUrl]);

  // Filter corrections
  const activeFilter = useMemo(() => {
    return FILTERS.find(f => f.id === activeFilterId) || FILTERS[0];
  }, [activeFilterId]);

  const filteredCorrections = useMemo(() => {
    if (!session?.corrections) return [];
    return session.corrections.filter(activeFilter.match);
  }, [session, activeFilter]);

  const correctionMap = useMemo(() => {
    const map = new Map();
    if (!session?.corrections) return map;
    for (const c of session.corrections) {
      map.set(c.id, c);
    }
    return map;
  }, [session]);

  const filteredIdsSet = useMemo(() => {
    return new Set(filteredCorrections.map(c => c.id));
  }, [filteredCorrections]);

  const selectedCorrection = useMemo(() => {
    if (!selectedCorrectionId) return null;
    return correctionMap.get(selectedCorrectionId) || null;
  }, [selectedCorrectionId, correctionMap]);

  // Selected correction index within filtered list
  const selectedFilteredIndex = useMemo(() => {
    if (!selectedCorrectionId || !filteredCorrections.length) return -1;
    return filteredCorrections.findIndex(c => c.id === selectedCorrectionId);
  }, [selectedCorrectionId, filteredCorrections]);

  function handleSelectCorrection(corrId, fromUserClick = false) {
    setSelectedCorrectionId(corrId);
    if (fromUserClick && window.innerWidth <= 768) {
      // On mobile, switch view to explanation when user taps an annotation
      setMobileColumn('explanation');
    }
  }

  function handlePrevCorrection() {
    if (!filteredCorrections.length) return;
    const currentIdx = selectedFilteredIndex;
    const prevIdx = currentIdx <= 0 ? filteredCorrections.length - 1 : currentIdx - 1;
    setSelectedCorrectionId(filteredCorrections[prevIdx].id);
  }

  function handleNextCorrection() {
    if (!filteredCorrections.length) return;
    const currentIdx = selectedFilteredIndex;
    const nextIdx = currentIdx === -1 || currentIdx >= filteredCorrections.length - 1 ? 0 : currentIdx + 1;
    setSelectedCorrectionId(filteredCorrections[nextIdx].id);
  }

  async function handleCopyCorrected() {
    if (!session?.correctedText) return;
    const ok = await copyText(session.correctedText);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  function handleMouseEnterAnnotation(e, corr) {
    if (window.innerWidth <= 768) return; // Disable hover tooltips on touch screens
    clearTimeout(hoverTimeoutRef.current);
    const rect = e.currentTarget.getBoundingClientRect();
    setTooltip({
      x: rect.left + rect.width / 2,
      y: rect.top - 8,
      correction: corr,
    });
  }

  function handleMouseLeaveAnnotation() {
    clearTimeout(hoverTimeoutRef.current);
    hoverTimeoutRef.current = setTimeout(() => {
      setTooltip(null);
    }, 150);
  }

  if (loading) {
    return (
      <main className="upload-page si-page">
        <SpeakHeader />
        <div className="si-loading-container" aria-live="polite">
          <span className="spinner" />
          <p>Loading your speaking analysis…</p>
        </div>
      </main>
    );
  }

  if (loadError || !session) {
    return (
      <main className="upload-page si-page">
        <SpeakHeader />
        <div className="si-shell">
          <Link href="/speak/history" className="back-link">← Back to history</Link>
          <div className="error-box si-error-card" role="alert">
            <span>!</span>
            <div>
              <h3>Analysis not found</h3>
              <p>{loadError || 'This session could not be retrieved from your browser storage.'}</p>
              <div className="si-error-actions">
                <button type="button" className="si-btn" onClick={() => router.push('/speak')}>
                  Start a new analysis
                </button>
                <button type="button" className="si-btn si-btn-ghost" onClick={() => router.push('/speak/history')}>
                  View all saved analyses
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="upload-page si-page">
      <SpeakHeader />

      <div className="si-analysis-header">
        <div className="si-analysis-header-inner">
          <div className="si-analysis-title-group">
            <Link href="/speak/history" className="back-link">← Saved analyses</Link>
            <h1>{session.title || 'Speaking Analysis'}</h1>
            <div className="si-analysis-meta">
              <span>{formatDate(session.createdAt)}</span>
              {session.model && <span className="si-badge-tag">{session.model}</span>}
              {session.source && (
                <span className="si-badge-tag">
                  {session.source === 'record' ? '🎙 Voice recording' : session.source === 'upload' ? '♫ Uploaded audio' : '✎ Pasted text'}
                </span>
              )}
            </div>
          </div>

          <div className="si-analysis-header-actions">
            <button
              type="button"
              className="si-btn si-btn-ghost si-btn-sm"
              onClick={handleCopyCorrected}
              title="Copy the complete corrected Portuguese transcription"
            >
              {copied ? '✓ Copied' : '⧉ Copy corrected text'}
            </button>
            <button
              type="button"
              className="si-btn si-btn-primary si-btn-sm"
              onClick={() => router.push('/speak')}
            >
              ＋ New analysis
            </button>
          </div>
        </div>

        {/* Audio player if audio exists */}
        {audioUrl && (
          <div className="si-analysis-audio-bar">
            <div className="si-audio-bar-inner">
              <span className="si-audio-bar-label">Original audio:</span>
              <audio controls src={audioUrl} className="si-audio-player si-audio-bar-player" preload="metadata" />
            </div>
          </div>
        )}

        {/* Top-level Navigation Tabs */}
        <div className="si-view-tabs" role="tablist" aria-label="Analysis sections">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'comparison'}
            className={`si-view-tab${activeTab === 'comparison' ? ' active' : ''}`}
            onClick={() => setActiveTab('comparison')}
          >
            Side-by-Side Comparison
            <span className="si-tab-badge">{session.corrections?.length || 0}</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'breakdown'}
            className={`si-view-tab${activeTab === 'breakdown' ? ' active' : ''}`}
            onClick={() => setActiveTab('breakdown')}
          >
            Detailed Breakdown
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'vocabulary'}
            className={`si-view-tab${activeTab === 'vocabulary' ? ' active' : ''}`}
            onClick={() => setActiveTab('vocabulary')}
          >
            Vocabulary Suggestions
            <span className="si-tab-badge">{session.vocabulary?.length || 0}</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'feedback'}
            className={`si-view-tab${activeTab === 'feedback' ? ' active' : ''}`}
            onClick={() => setActiveTab('feedback')}
          >
            Overall Feedback
          </button>
        </div>
      </div>

      <div className="si-analysis-body">
        {/* ── TAB 1: COMPARISON ────────────────────────────────────── */}
        {activeTab === 'comparison' && (
          <div className="si-comparison-container">
            {/* Control Bar: Filters, Highlight toggle, Prev/Next Navigation */}
            <div className="si-controls-bar">
              <div className="si-filters-group" role="group" aria-label="Filter corrections by type">
                <span className="si-control-label">Filter:</span>
                {FILTERS.map(f => {
                  const count = session.corrections?.filter(f.match).length || 0;
                  return (
                    <button
                      key={f.id}
                      type="button"
                      className={`si-filter-pill${activeFilterId === f.id ? ' active' : ''}`}
                      onClick={() => setActiveFilterId(f.id)}
                    >
                      {f.label} <small>({count})</small>
                    </button>
                  );
                })}
              </div>

              <div className="si-controls-right">
                <label className="si-toggle-label">
                  <input
                    type="checkbox"
                    checked={showHighlights}
                    onChange={e => setShowHighlights(e.target.checked)}
                  />
                  <span>Show highlights</span>
                </label>

                {filteredCorrections.length > 0 && (
                  <div className="si-nav-counter">
                    <button
                      type="button"
                      className="si-icon-nav-btn"
                      onClick={handlePrevCorrection}
                      title="Previous correction"
                      aria-label="Previous correction"
                    >
                      ‹
                    </button>
                    <span className="si-counter-text">
                      {selectedFilteredIndex >= 0 ? selectedFilteredIndex + 1 : 1} of {filteredCorrections.length}
                    </span>
                    <button
                      type="button"
                      className="si-icon-nav-btn"
                      onClick={handleNextCorrection}
                      title="Next correction"
                      aria-label="Next correction"
                    >
                      ›
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Mobile Column Switcher (visible on mobile screens <= 768px) */}
            <div className="si-mobile-col-switcher" role="tablist" aria-label="Mobile column selection">
              <button
                type="button"
                role="tab"
                aria-selected={mobileColumn === 'original'}
                className={`si-mobile-col-btn${mobileColumn === 'original' ? ' active' : ''}`}
                onClick={() => setMobileColumn('original')}
              >
                What You Said
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={mobileColumn === 'corrected'}
                className={`si-mobile-col-btn${mobileColumn === 'corrected' ? ' active' : ''}`}
                onClick={() => setMobileColumn('corrected')}
              >
                How to Say It
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={mobileColumn === 'explanation'}
                className={`si-mobile-col-btn${mobileColumn === 'explanation' ? ' active' : ''}`}
                onClick={() => setMobileColumn('explanation')}
              >
                Explanation
                {selectedCorrection && <span className="si-active-indicator" />}
              </button>
            </div>

            {/* Three-Panel Comparison Grid */}
            <div className="si-three-panel-grid">
              {/* PANEL 1: Original Portuguese */}
              <section
                className={`si-panel si-panel-original${mobileColumn === 'original' ? ' mobile-show' : ''}`}
                aria-labelledby="panel-orig-heading"
              >
                <div className="si-panel-header">
                  <h2 id="panel-orig-heading">What You Said</h2>
                  <span className="si-panel-badge">Original transcription</span>
                </div>
                <div className="si-panel-content">
                  {session.segments?.map(seg => (
                    <SegmentRowOriginal
                      key={seg.id}
                      segment={seg}
                      corrections={session.corrections.filter(c => c.segment_id === seg.id)}
                      selectedCorrectionId={selectedCorrectionId}
                      filteredIdsSet={filteredIdsSet}
                      showHighlights={showHighlights}
                      onSelectCorrection={handleSelectCorrection}
                      onMouseEnter={handleMouseEnterAnnotation}
                      onMouseLeave={handleMouseLeaveAnnotation}
                    />
                  ))}
                </div>
              </section>

              {/* PANEL 2: Corrected Portuguese */}
              <section
                className={`si-panel si-panel-corrected${mobileColumn === 'corrected' ? ' mobile-show' : ''}`}
                aria-labelledby="panel-corr-heading"
              >
                <div className="si-panel-header">
                  <h2 id="panel-corr-heading">How to Say It Naturally</h2>
                  <span className="si-panel-badge success">Native phrasing</span>
                </div>
                <div className="si-panel-content">
                  {session.segments?.map(seg => (
                    <SegmentRowCorrected
                      key={seg.id}
                      segment={seg}
                      corrections={session.corrections.filter(c => c.segment_id === seg.id)}
                      selectedCorrectionId={selectedCorrectionId}
                      filteredIdsSet={filteredIdsSet}
                      showHighlights={showHighlights}
                      onSelectCorrection={handleSelectCorrection}
                      onMouseEnter={handleMouseEnterAnnotation}
                      onMouseLeave={handleMouseLeaveAnnotation}
                    />
                  ))}
                </div>
              </section>

              {/* PANEL 3: Detailed Explanation */}
              <section
                ref={explanationPanelRef}
                className={`si-panel si-panel-explanation${mobileColumn === 'explanation' ? ' mobile-show' : ''}`}
                aria-labelledby="panel-exp-heading"
              >
                <div className="si-panel-header">
                  <h2 id="panel-exp-heading">Why This Is Better</h2>
                  <span className="si-panel-badge info">Tutor notes</span>
                </div>
                <div className="si-panel-content">
                  {selectedCorrection ? (
                    <CorrectionExplanationCard
                      correction={selectedCorrection}
                      onNext={handleNextCorrection}
                      onPrev={handlePrevCorrection}
                      counterText={selectedFilteredIndex >= 0 ? `${selectedFilteredIndex + 1} of ${filteredCorrections.length}` : null}
                    />
                  ) : (
                    <div className="si-empty-explanation">
                      <div className="si-tutor-avatar">✦</div>
                      <h3>Click any highlighted phrase</h3>
                      <p>
                        Select a correction in the transcript to see what changed, the grammar rule behind it, and how native Brazilian speakers express it.
                      </p>
                      {filteredCorrections.length > 0 && (
                        <button
                          type="button"
                          className="si-btn si-btn-ghost si-btn-sm"
                          onClick={() => setSelectedCorrectionId(filteredCorrections[0].id)}
                        >
                          View first correction →
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </section>
            </div>
          </div>
        )}

        {/* ── TAB 2: DETAILED MARKDOWN BREAKDOWN ────────────────────── */}
        {activeTab === 'breakdown' && (
          <div className="si-tab-pane">
            <div className="si-pane-card">
              <div className="si-pane-header">
                <h2>Comprehensive Written Analysis</h2>
                <p>Structured educational notes breaking down the grammar, verb tenses, and expressions in your speech.</p>
              </div>
              <Markdown className="si-detailed-breakdown">
                {session.detailedAnalysisMarkdown || 'No detailed written analysis available.'}
              </Markdown>
            </div>
          </div>
        )}

        {/* ── TAB 3: VOCABULARY SUGGESTIONS ─────────────────────────── */}
        {activeTab === 'vocabulary' && (
          <div className="si-tab-pane">
            <div className="si-pane-card">
              <div className="si-pane-header">
                <h2>Vocabulary &amp; Idiomatic Phrasing</h2>
                <p>Natural connectors, phrases, and idiomatic Portuguese relevant to what you were talking about.</p>
              </div>
              <VocabularyCards items={session.vocabulary || []} sessionId={session.id} />
            </div>
          </div>
        )}

        {/* ── TAB 4: OVERALL FEEDBACK ───────────────────────────────── */}
        {activeTab === 'feedback' && (
          <div className="si-tab-pane">
            <div className="si-pane-card">
              <div className="si-pane-header">
                <h2>Language Evaluation &amp; Next Steps</h2>
                <p>Summary of strengths, recurring error patterns, priority areas, and targeted practice exercises.</p>
              </div>
              <OverallFeedback feedback={session.overallFeedback} />
            </div>
          </div>
        )}
      </div>

      {/* Hover Tooltip Portal */}
      {tooltip && (
        <div
          className="si-tooltip"
          style={{ left: `${tooltip.x}px`, top: `${tooltip.y}px` }}
          role="tooltip"
        >
          <div className="si-tooltip-header">
            <span className={`si-pill tone-${toneFor(tooltip.correction)}`}>
              {TONE_LABELS[toneFor(tooltip.correction)] || tooltip.correction.category}
            </span>
            <span className="si-tooltip-type">
              {TYPE_LABELS[tooltip.correction.type] || tooltip.correction.type}
            </span>
          </div>
          <div className="si-tooltip-diff">
            <span className="si-orig-diff">{tooltip.correction.original}</span>
            <span className="si-diff-arrow">→</span>
            <span className="si-corr-diff">{tooltip.correction.replacement || '(rephrased)'}</span>
          </div>
          <p className="si-tooltip-body">{tooltip.correction.short_explanation}</p>
          <div className="si-tooltip-hint">Click for full tutor explanation</div>
        </div>
      )}
    </main>
  );
}

// ── SUBCOMPONENTS: ORIGINAL ROW & CORRECTED ROW ──────────────────────────────

function SegmentRowOriginal({
  segment,
  corrections,
  selectedCorrectionId,
  filteredIdsSet,
  showHighlights,
  onSelectCorrection,
  onMouseEnter,
  onMouseLeave,
}) {
  const text = segment.original;
  // Gather aligned spans for this segment
  const spans = useMemo(() => {
    return corrections
      .filter(c => c.original_span && Number.isInteger(c.original_span.start) && Number.isInteger(c.original_span.end))
      .map(c => ({
        id: c.id,
        start: c.original_span.start,
        end: c.original_span.end,
        correction: c,
      }))
      .sort((a, b) => a.start - b.start);
  }, [corrections]);

  // Build rendered slice list with interactive highlights
  const elements = useMemo(() => {
    const res = [];
    let cursor = 0;

    for (const span of spans) {
      if (span.start > cursor) {
        res.push(<span key={`txt-${cursor}`}>{text.slice(cursor, span.start)}</span>);
      }
      if (span.start >= cursor) {
        const corr = span.correction;
        const tone = toneFor(corr);
        const isSelected = selectedCorrectionId === corr.id;
        const isFiltered = filteredIdsSet.has(corr.id);
        const showActiveHighlight = showHighlights && isFiltered;

        res.push(
          <mark
            key={corr.id}
            id={`orig-${corr.id}`}
            className={`si-highlight tone-${tone}${isSelected ? ' is-selected' : ''}${!showActiveHighlight ? ' is-dimmed' : ''}`}
            onClick={() => onSelectCorrection(corr.id, true)}
            onMouseEnter={e => onMouseEnter(e, corr)}
            onMouseLeave={onMouseLeave}
            title={corr.short_explanation}
            tabIndex={0}
            role="button"
            aria-pressed={isSelected}
            onKeyDown={e => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onSelectCorrection(corr.id, true);
              }
            }}
          >
            {text.slice(span.start, span.end)}
          </mark>
        );
        cursor = span.end;
      }
    }
    if (cursor < text.length) {
      res.push(<span key={`txt-${cursor}`}>{text.slice(cursor)}</span>);
    }
    return res;
  }, [text, spans, selectedCorrectionId, filteredIdsSet, showHighlights, onSelectCorrection, onMouseEnter, onMouseLeave]);

  return (
    <p className={`si-segment-row${segment.paragraph_break ? ' para-break' : ''}`}>
      {elements}
    </p>
  );
}

function SegmentRowCorrected({
  segment,
  corrections,
  selectedCorrectionId,
  filteredIdsSet,
  showHighlights,
  onSelectCorrection,
  onMouseEnter,
  onMouseLeave,
}) {
  const text = segment.corrected;
  // Gather aligned replacement spans
  const spans = useMemo(() => {
    return corrections
      .filter(c => c.corrected_span && Number.isInteger(c.corrected_span.start) && Number.isInteger(c.corrected_span.end))
      .map(c => ({
        id: c.id,
        start: c.corrected_span.start,
        end: c.corrected_span.end,
        correction: c,
      }))
      .sort((a, b) => a.start - b.start);
  }, [corrections]);

  const elements = useMemo(() => {
    const res = [];
    let cursor = 0;

    for (const span of spans) {
      if (span.start > cursor) {
        res.push(<span key={`txt-${cursor}`}>{text.slice(cursor, span.start)}</span>);
      }
      if (span.start >= cursor) {
        const corr = span.correction;
        const tone = toneFor(corr);
        const isSelected = selectedCorrectionId === corr.id;
        const isFiltered = filteredIdsSet.has(corr.id);
        const showActiveHighlight = showHighlights && isFiltered;

        res.push(
          <mark
            key={corr.id}
            id={`corr-${corr.id}`}
            className={`si-highlight corr-highlight tone-${tone}${isSelected ? ' is-selected' : ''}${!showActiveHighlight ? ' is-dimmed' : ''}`}
            onClick={() => onSelectCorrection(corr.id, true)}
            onMouseEnter={e => onMouseEnter(e, corr)}
            onMouseLeave={onMouseLeave}
            title={corr.short_explanation}
            tabIndex={0}
            role="button"
            aria-pressed={isSelected}
            onKeyDown={e => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onSelectCorrection(corr.id, true);
              }
            }}
          >
            {text.slice(span.start, span.end)}
          </mark>
        );
        cursor = span.end;
      }
    }
    if (cursor < text.length) {
      res.push(<span key={`txt-${cursor}`}>{text.slice(cursor)}</span>);
    }
    return res;
  }, [text, spans, selectedCorrectionId, filteredIdsSet, showHighlights, onSelectCorrection, onMouseEnter, onMouseLeave]);

  return (
    <p className={`si-segment-row${segment.paragraph_break ? ' para-break' : ''}`}>
      {elements}
    </p>
  );
}

// ── CORRECTION EXPLANATION CARD ──────────────────────────────────────────────

function CorrectionExplanationCard({ correction, onNext, onPrev, counterText }) {
  const tone = toneFor(correction);

  return (
    <article className="si-explanation-card">
      <header className="si-exp-header">
        <div className="si-exp-tags">
          <span className={`si-pill tone-${tone}`}>{TONE_LABELS[tone] || correction.category}</span>
          <span className="si-type-badge">{TYPE_LABELS[correction.type] || correction.type}</span>
          {correction.severity && <span className="si-severity-badge">{correction.severity} impact</span>}
        </div>
        {counterText && (
          <div className="si-exp-nav">
            <button type="button" className="si-icon-btn" onClick={onPrev} title="Previous correction" aria-label="Previous">‹</button>
            <small>{counterText}</small>
            <button type="button" className="si-icon-btn" onClick={onNext} title="Next correction" aria-label="Next">›</button>
          </div>
        )}
      </header>

      {/* Comparison block */}
      <div className="si-exp-compare">
        <div className="si-exp-item orig">
          <span className="si-exp-label">You said</span>
          <p className="si-exp-text" lang="pt-BR">{correction.original}</p>
        </div>
        <div className="si-exp-arrow">→</div>
        <div className="si-exp-item corr">
          <span className="si-exp-label">Better</span>
          <p className="si-exp-text" lang="pt-BR">{correction.replacement || '(rephrased)'}</p>
        </div>
      </div>

      {/* Explanations */}
      <div className="si-exp-body">
        {correction.short_explanation && (
          <p className="si-exp-short">{correction.short_explanation}</p>
        )}

        {correction.detailed_explanation && (
          <div className="si-exp-detailed">
            <h4>Detailed explanation</h4>
            <p>{correction.detailed_explanation}</p>
          </div>
        )}

        {correction.rule && (
          <div className="si-exp-rule">
            <h4>Grammar Rule</h4>
            <p>{correction.rule}</p>
          </div>
        )}

        {/* Examples */}
        {correction.examples && correction.examples.length > 0 && (
          <div className="si-exp-examples">
            <h4>Examples</h4>
            <div className="si-example-list">
              {correction.examples.map((ex, i) => (
                <div key={i} className="si-example-row">
                  {ex.incorrect && (
                    <div className="si-ex-item incorrect" lang="pt-BR">
                      <span aria-hidden="true">✕</span> {ex.incorrect}
                    </div>
                  )}
                  {ex.correct && (
                    <div className="si-ex-item correct" lang="pt-BR">
                      <span aria-hidden="true">✓</span> {ex.correct}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Natural Alternatives */}
        {correction.alternatives && correction.alternatives.length > 0 && (
          <div className="si-exp-alts">
            <h4>Other natural ways to say it</h4>
            <ul>
              {correction.alternatives.map((alt, i) => (
                <li key={i} lang="pt-BR">{alt}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </article>
  );
}
