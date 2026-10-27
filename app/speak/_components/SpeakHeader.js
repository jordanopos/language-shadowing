'use client';

import Link from 'next/link';

export default function SpeakHeader() {
  return (
    <header className="app-header upload-header">
      <Link href="/" className="brand si-brand-link"><span className="brand-mark">↗</span>shadow</Link>
      <nav className="si-header-nav" aria-label="Speak & Improve">
        <Link href="/speak" className="library-button si-header-btn" id="nav-speak-new">New analysis</Link>
        <Link href="/speak/history" className="library-button si-header-btn" id="nav-speak-history">My Analyses</Link>
      </nav>
    </header>
  );
}

export function formatSize(n) {
  return n < 1024 * 1024 ? `${Math.max(1, Math.round(n / 1024))} KB` : `${(n / 1024 / 1024).toFixed(1)} MB`;
}

export function formatDuration(sec) {
  if (!Number.isFinite(sec) || sec < 0) return '—';
  const s = Math.floor(sec);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export function formatDate(ts) {
  try {
    return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(ts));
  } catch {
    return new Date(ts).toLocaleString();
  }
}

export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Fallback for non-secure contexts.
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    ta.remove();
    return ok;
  }
}
