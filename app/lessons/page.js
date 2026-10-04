'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { listLessons, deleteLesson } from '../../lib/lesson-store';

export default function LessonsPage() {
  const router = useRouter();
  const [lessons, setLessons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    listLessons().then(setLessons).finally(() => setLoading(false));
  }, []);

  function open(lesson) {
    sessionStorage.setItem('shadow-active-lesson', lesson.id);
    router.push('/practice');
  }

  async function handleDelete() {
    if (!confirmDelete || deleting) return;
    setDeleting(true);
    try {
      await deleteLesson(confirmDelete.id);
      setLessons(prev => prev.filter(l => l.id !== confirmDelete.id));
      setConfirmDelete(null);
    } catch {
      // If deletion fails, just close the modal — the lesson stays
      setConfirmDelete(null);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <main className="upload-page">
      <header className="app-header upload-header">
        <button className="brand brand-button" onClick={() => router.push('/')}>
          <span className="brand-mark">↗</span>shadow
        </button>
        <button className="library-button" onClick={() => router.push('/lessons')}>My Lessons</button>
      </header>

      <div className="lessons-shell">
        <button className="back-link" onClick={() => router.push('/')}>← Upload a new lesson</button>
        <div className="lessons-heading">
          <div>
            <div className="eyebrow"><span className="eyebrow-dot" /> YOUR LIBRARY</div>
            <h1>My lessons</h1>
            <p>Pick up right where you left off.</p>
          </div>
          <button className="new-lesson" onClick={() => router.push('/')}>＋ New lesson</button>
        </div>

        {loading ? (
          <div className="library-empty"><span className="spinner" /> Loading your lessons…</div>
        ) : lessons.length ? (
          <div className="lesson-grid">
            {lessons
              .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
              .map(lesson => {
                const percent = lesson.segments?.length
                  ? Math.round((lesson.done?.length || 0) / lesson.segments.length * 100)
                  : 0;
                return (
                  <div className="lesson-tile" key={lesson.id}>
                    <button className="tile-body" onClick={() => open(lesson)}>
                      <div className="tile-icon">♫</div>
                      <h2>{lesson.title}</h2>
                      <p>{lesson.language === 'auto' ? 'Auto-detect' : lesson.language} · {lesson.segments?.length || 0} sentences</p>
                      <div className="tile-progress"><i style={{ width: `${percent}%` }} /></div>
                      <small>{percent}% complete <span>Open lesson →</span></small>
                    </button>
                    <button
                      className="tile-delete"
                      onClick={(e) => { e.stopPropagation(); setConfirmDelete(lesson); }}
                      title="Delete this lesson"
                      aria-label="Delete lesson"
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
          <div className="library-empty">
            <div className="empty-icon">♫</div>
            <h2>No lessons yet</h2>
            <p>Upload a clip and we'll turn it into a phrase-by-phrase practice session.</p>
            <button className="new-lesson" onClick={() => router.push('/')}>＋ Upload your first clip</button>
          </div>
        )}
      </div>

      {/* Delete confirmation modal */}
      {confirmDelete && (
        <div className="modal-overlay" onClick={() => !deleting && setConfirmDelete(null)}>
          <div className="modal-card" onClick={e => e.stopPropagation()}>
            <div className="modal-icon">⚠</div>
            <h2>Delete this lesson?</h2>
            <p>
              <strong>{confirmDelete.title}</strong> will be permanently removed, including all audio data and progress. This cannot be undone.
            </p>
            <div className="modal-actions">
              <button
                className="modal-cancel"
                onClick={() => setConfirmDelete(null)}
                disabled={deleting}
              >
                Cancel
              </button>
              <button
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
