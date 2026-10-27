'use client';

import { useEffect, useState } from 'react';
import { copyText } from './SpeakHeader';
import { listVocab, saveVocab, deleteVocab, vocabId } from '../../../lib/speak/session-store';

export default function VocabularyCards({ items = [], sessionId, emptyText = 'No vocabulary suggestions for this sample.' }) {
  const [saved, setSaved] = useState(() => new Set());
  const [copied, setCopied] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    listVocab().then(list => setSaved(new Set(list.map(v => v.id)))).catch(() => {});
  }, []);

  async function toggleSave(item) {
    const id = vocabId(item.expression);
    setError('');
    try {
      if (saved.has(id)) {
        await deleteVocab(id);
        setSaved(prev => { const next = new Set(prev); next.delete(id); return next; });
      } else {
        await saveVocab(item, sessionId);
        setSaved(prev => new Set(prev).add(id));
      }
    } catch (e) {
      setError(`Couldn’t update your saved vocabulary: ${e?.message || 'storage error'}.`);
    }
  }

  async function copy(item) {
    if (await copyText(item.expression)) {
      setCopied(item.expression);
      setTimeout(() => setCopied(c => (c === item.expression ? '' : c)), 1600);
    }
  }

  if (!items.length) return <div className="library-empty si-empty"><p>{emptyText}</p></div>;

  return (
    <>
      {error && <div className="error-box" role="alert"><span>!</span><div>{error}</div></div>}
      <div className="si-vocab-grid">
        {items.map((item, i) => {
          const isSaved = saved.has(vocabId(item.expression));
          return (
            <article className="si-vocab-card" key={`${item.expression}-${i}`} style={{ '--i': i }}>
              <header>
                {item.category && <span className="si-chip">{item.category}</span>}
                <div className="si-vocab-actions">
                  <button type="button" className="si-icon-btn" onClick={() => copy(item)} aria-label={`Copy “${item.expression}”`} title="Copy expression">
                    {copied === item.expression ? '✓' : '⧉'}
                  </button>
                  <button type="button" className={`si-icon-btn${isSaved ? ' is-on' : ''}`} onClick={() => toggleSave(item)}
                    aria-pressed={isSaved} aria-label={isSaved ? 'Remove from saved vocabulary' : 'Save for review'} title={isSaved ? 'Saved — click to remove' : 'Save for review'}>
                    {isSaved ? '★' : '☆'}
                  </button>
                </div>
              </header>
              <h3 lang="pt-BR">{item.expression}</h3>
              <p className="si-vocab-meaning">{item.english_meaning}</p>
              {item.example && <blockquote lang="pt-BR">{item.example}</blockquote>}
              {item.usage_note && <p className="si-vocab-note"><b>When to use it:</b> {item.usage_note}</p>}
            </article>
          );
        })}
      </div>
    </>
  );
}
