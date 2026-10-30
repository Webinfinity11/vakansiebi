import type { Metadata } from 'next';
import { siteName } from '@/lib/site-brand';
import { Suspense } from 'react';
import { PublicHeader } from '../public-header';
import { SwipeDeck, SwipeLoading } from './swipe-deck';
import './swipe.css';

// A personal way through the same list; the list itself is what search engines index.
export const metadata: Metadata = {
  title: `ვაკანსიების არჩევა Swipe-ით — ${siteName}`,
  robots: { index: false, follow: true },
};

export default function SwipePage() {
  return (
    <div className="board-shell swipe-page">
      <PublicHeader />
      <Suspense fallback={<SwipeLoading />}>
        <SwipeDeck />
      </Suspense>
    </div>
  );
}
