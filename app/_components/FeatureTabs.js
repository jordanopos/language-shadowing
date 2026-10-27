'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import './feature-tabs.css';

// Top-level switch between the two independent features.
export default function FeatureTabs() {
  const pathname = usePathname() || '/';
  const onSpeak = pathname.startsWith('/speak');
  return (
    <nav className="feature-tabs" aria-label="Choose a practice mode">
      <Link href="/" id="tab-shadowing" className={`feature-tab${onSpeak ? '' : ' active'}`} aria-current={onSpeak ? undefined : 'page'}>
        <span aria-hidden="true">↗</span> Shadowing
      </Link>
      <Link href="/speak" id="tab-speak" className={`feature-tab${onSpeak ? ' active' : ''}`} aria-current={onSpeak ? 'page' : undefined}>
        <span aria-hidden="true">✦</span> Speak &amp; Improve
      </Link>
    </nav>
  );
}
