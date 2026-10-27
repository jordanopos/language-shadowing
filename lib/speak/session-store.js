// IndexedDB persistence for Speak & Improve.
// Uses its own database so the shadowing DB ('shadow-practice-v2') and its
// schema/migrations are never touched.

const DB_NAME = 'shadow-speak-improve';
const DB_VERSION = 1;
const SESSIONS = 'sessions';
const VOCAB = 'vocabulary';
export const SESSION_SCHEMA_VERSION = 1;

let dbPromise = null;

function openDb() {
  if (typeof indexedDB === 'undefined') return Promise.reject(new Error('This browser does not support local storage (IndexedDB).'));
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(SESSIONS)) {
        db.createObjectStore(SESSIONS, { keyPath: 'id' }).createIndex('createdAt', 'createdAt');
      }
      if (!db.objectStoreNames.contains(VOCAB)) {
        db.createObjectStore(VOCAB, { keyPath: 'id' }).createIndex('savedAt', 'savedAt');
      }
    };
    request.onsuccess = () => {
      const db = request.result;
      db.onversionchange = () => { db.close(); dbPromise = null; };
      resolve(db);
    };
    request.onerror = () => { dbPromise = null; reject(request.error || new Error('Could not open local storage.')); };
    request.onblocked = () => { dbPromise = null; reject(new Error('Local storage is blocked by another open tab. Close other tabs of this app and retry.')); };
  });
  return dbPromise;
}

function run(store, mode, fn) {
  return openDb().then(db => new Promise((resolve, reject) => {
    const tx = db.transaction(store, mode);
    const result = fn(tx.objectStore(store));
    tx.oncomplete = () => resolve(result?.result ?? result);
    tx.onerror = () => reject(tx.error || new Error('Local storage operation failed.'));
    tx.onabort = () => reject(tx.error || new Error('Local storage operation was aborted (the device may be out of space).'));
  }));
}

// ── Sessions ────────────────────────────────────────────────────────────────

export function saveSession(session) {
  return run(SESSIONS, 'readwrite', s => { s.put(session); return session; });
}

export function getSession(id) {
  return run(SESSIONS, 'readonly', s => s.get(id)).then(r => r || null);
}

/** Lightweight list for the history page (audio blobs are stripped). */
export function listSessions() {
  return openDb().then(db => new Promise((resolve, reject) => {
    const out = [];
    const req = db.transaction(SESSIONS).objectStore(SESSIONS).index('createdAt').openCursor(null, 'prev');
    req.onsuccess = () => {
      const cursor = req.result;
      if (!cursor) return resolve(out);
      const { audio, ...rest } = cursor.value;
      out.push({ ...rest, hasAudio: Boolean(audio) });
      cursor.continue();
    };
    req.onerror = () => reject(req.error);
  }));
}

export function deleteSession(id) {
  return run(SESSIONS, 'readwrite', s => { s.delete(id); });
}

// ── Saved vocabulary ────────────────────────────────────────────────────────

export function vocabId(expression) {
  return expression.trim().toLocaleLowerCase('pt-BR');
}

export function saveVocab(item, sessionId) {
  const record = { ...item, id: vocabId(item.expression), sessionId, savedAt: Date.now() };
  return run(VOCAB, 'readwrite', s => { s.put(record); return record; });
}

export function deleteVocab(id) {
  return run(VOCAB, 'readwrite', s => { s.delete(id); });
}

export function listVocab() {
  return run(VOCAB, 'readonly', s => s.getAll()).then(items => (items || []).sort((a, b) => b.savedAt - a.savedAt));
}
