'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import SpeakHeader, { formatDate } from '../_components/SpeakHeader';
import { listSessions, deleteSession } from '../../../lib/speak/session-store';

export default function SpeakHistoryPage() {
  const router = useRouter();
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    loadSessions();
  }, []);

  function loadSessions() {
    setLoading(true);
    listSessions()
      .then(items => {
        setSessions(items || []);
      })
      .catch(() => {
        setSessions([]);
      })
      .finally(() => setLoading(false));
  }

  function openSession(id) {
    router.push(`/speak/analysis/${id}`);
  }

  async function handleDelete() {
    if (!confirmDelete || deleting) return;
    setDeleting(true);
    try {
      await deleteSession(confirmDelete.id);
      setSessions(prev => prev.filter(s => s.id !== confirmDelete.id));
      setConfirmDelete(null);
    } catch {
      setConfirmDelete(null);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <main className="upload-page si-page">
      <SpeakHeader />

      <div className="lessons-shell si-history-shell">
        <Link href="/speak" className="back-link">← New speaking analysis</Link>

        <div className="lessons-heading">
          <div>
            <div className="eyebrow"><span className="eyebrow-dot" /> SPEAK &amp; IMPROVE</div>
            <h1>Saved analyses</h1>
            <p>Review past speaking sessions, grammar corrections, and saved vocabulary.</p>
          </div>
          <button type="button" className="new-lesson" onClick={() => router.push('/speak')}>
            ＋ New analysis
          </button>
        </div>

        {loading ? (
          <div className="library-empty si-empty"><span className="spinner" /> Loading your analyses…</div>
        ) : sessions.length > 0 ? (
          <div className="lesson-grid si-history-grid">
            {sessions.map(sess => {
              const correctionCount = sess.corrections?.length || 0;
              const vocabCount = sess.vocabulary?.length || 0;
              const previewText = sess.originalText
                ? sess.originalText.slice(0, 120) + (sess.originalText.length > 120 ? '…' : '')
                : 'Portuguese speaking practice';

              return (
                <div className="lesson-tile si-history-tile" key={sess.id}>
                  <button type="button" className="tile-body" onClick={() => openSession(sess.id)}>
                    <div className="si-tile-top">
                      <span className="tile-icon si-tile-icon">✦</span>
                      <div className="si-tile-meta-tags">
                        {sess.hasAudio && <span className="si-badge-tag">🎙 Audio</span>}
                        {sess.overallFeedback?.estimated_level && (
                          <span className="si-badge-tag level">{sess.overallFeedback.estimated_level}</span>
                        )}
                      </div>
                    </div>

                    <h2>{sess.title || 'Untitled analysis'}</h2>
                    <p className="si-tile-preview">&ldquo;{previewText}&rdquo;</p>

                    <div className="si-tile-footer">
                      <small className="si-tile-date">{formatDate(sess.createdAt)}</small>
                      <small className="si-tile-counts">
                        <span>{correctionCount} {correctionCount === 1 ? 'correction' : 'corrections'}</span>
                        {vocabCount > 0 && <span> · {vocabCount} words</span>}
                      </small>
                    </div>

                    <div className="si-tile-open-link">
                      Open analysis →
                    </div>
                  </button>

                  <button
                    type="button"
                    className="tile-delete"
                    onClick={e => {
                      e.stopPropagation();
                      setConfirmDelete(sess);
                    }}
                    title="Delete this analysis"
                    aria-label="Delete analysis"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M3 6h18" /><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
                      <line x1="10" y1="11" x2="10" y2="17" /><line x1="14" y1="11" x2="14" y2="17" />
                    </svg>
                  </button>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="library-empty si-empty">
            <div className="empty-icon si-empty-icon">✦</div>
            <h2>No speaking analyses yet</h2>
            <p>Record your spoken Portuguese or paste a transcription to receive tutor feedback, corrections, and vocabulary.</p>
            <button type="button" className="new-lesson" onClick={() => router.push('/speak')}>
              ＋ Start your first analysis
            </button>
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {confirmDelete && (
        <div className="modal-overlay" onClick={() => !deleting && setConfirmDelete(null)}>
          <div className="modal-card" onClick={e => e.stopPropagation()}>
            <div className="modal-icon">⚠</div>
            <h2>Delete this analysis?</h2>
            <p>
              <strong>{confirmDelete.title || 'This session'}</strong> will be permanently removed, including all corrections and notes. This cannot be undone.
            </p>
            <div className="modal-actions">
              <button
                type="button"
                className="modal-cancel"
                onClick={() => setConfirmDelete(null)}
                disabled={deleting}
              >
                Cancel
              </button>
              <button
                type="button"
                className="modal-confirm"
                onClick={handleDelete}
                disabled={deleting}
              >
                {deleting ? <><span className="spinner" /> Deleting…</> : 'Delete permanently'}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
