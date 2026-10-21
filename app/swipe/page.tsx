import type { Metadata } from 'next';
import { Suspense } from 'react';
import { PublicHeader } from '../public-header';
import { SwipeDeck } from './swipe-deck';
import './swipe.css';

// A personal way through the same list; the list itself is what search engines index.
export const metadata: Metadata = {
  title: 'სწრაფი არჩევა — JOBX',
  robots: { index: false, follow: true },
};

export default function SwipePage() {
  return (
    <div className="board-shell swipe-page">
      <PublicHeader />
      <Suspense fallback={<output className="swipe-hint">იტვირთება…</output>}>
        <SwipeDeck />
      </Suspense>
    </div>
  );
}
