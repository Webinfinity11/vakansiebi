'use client';

import { useEffect, useRef, useState, type RefObject } from 'react';

/* The next page arrives before the reader reaches the end of this one.
   It used to wait for a fresh downward gesture and then for sixteen more pixels
   of scroll, which on a phone meant flicking, coasting to a stop against the
   button, and flicking again — the list stopped exactly where the reader had
   not stopped. Now the end of the list is simply watched: when it comes within
   a screen's reach, the next page is asked for.

   Two things keep that from running away. Nothing loads until the reader has
   scrolled at all, so a tall screen does not fetch a second page it never
   showed; and after `maxPages` in a row the button comes back, because a list
   that never ends is a footer nobody can reach. Pressing it resumes the run. */
export function useAutoLoad(
  target: RefObject<HTMLElement | null>,
  enabled: boolean,
  onLoad: () => void,
  maxPages = 10,
) {
  const loaded = useRef(0);
  const scrolled = useRef(false);
  /* A press of the button is the reader asking for more: the automatic run starts again rather
     than making them press after every page. */
  const [round, setRound] = useState(0);
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
      /* Two screens' reach: the page is fetched well before the end is in sight, so a reader
         scrolling at an ordinary pace never meets the loader and waits at it. */
      { rootMargin: '1400px 0px 1400px 0px' },
    );
    observer.observe(node);
    window.addEventListener('scroll', moved, { passive: true });
    return () => {
      observer.disconnect();
      window.removeEventListener('scroll', moved);
    };
  }, [enabled, onLoad, target, maxPages, round]);
  return () => {
    loaded.current = 0;
    setRound((n) => n + 1);
  };
}
