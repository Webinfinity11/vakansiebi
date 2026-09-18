'use client';

import { useEffect, useRef, type RefObject } from 'react';

/* The next page arrives before the reader reaches the end of this one.
   It used to wait for a fresh downward gesture and then for sixteen more pixels
   of scroll, which on a phone meant flicking, coasting to a stop against the
   button, and flicking again — the list stopped exactly where the reader had
   not stopped. Now the end of the list is simply watched: when it comes within
   a screen's reach, the next page is asked for.

   Two things keep that from running away. Nothing loads until the reader has
   scrolled at all, so a tall screen does not fetch a second page it never
   showed; and after `maxPages` in a row the button comes back, because a list
   that never ends is a footer nobody can reach. */
export function useAutoLoad(
  target: RefObject<HTMLElement | null>,
  enabled: boolean,
  onLoad: () => void,
  maxPages = 5,
) {
  const loaded = useRef(0);
  const scrolled = useRef(false);
  useEffect(() => {
    const node = target.current;
    if (!node || !enabled || loaded.current >= maxPages) return;
    const moved = () => {
      if (window.scrollY > 150) scrolled.current = true;
    };
    moved();
    let done = false;
    const observer = new IntersectionObserver(
      (entries) => {
        if (done || !scrolled.current || !entries.some((e) => e.isIntersecting))
          return;
        done = true;
        loaded.current += 1;
        onLoad();
      },
      // A screen's reach: the page is on its way before the end is in sight.
      { rootMargin: '700px 0px 700px 0px' },
    );
    observer.observe(node);
    window.addEventListener('scroll', moved, { passive: true });
    return () => {
      observer.disconnect();
      window.removeEventListener('scroll', moved);
    };
  }, [enabled, onLoad, target, maxPages]);
}
