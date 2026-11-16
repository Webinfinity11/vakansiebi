'use client';

import { useEffect, useRef, type ReactNode } from 'react';

/** Keep the illustration server rendered; only its playback needs the browser. */
export function WorkspacePreviewScene({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    let visible = false;
    const sync = () => {
      element.dataset.playing = String(visible && !document.hidden);
    };
    const observer = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      sync();
    });
    observer.observe(element);
    document.addEventListener('visibilitychange', sync);
    return () => {
      observer.disconnect();
      document.removeEventListener('visibilitychange', sync);
    };
  }, []);

  return (
    <div ref={ref} className="bw-preview" aria-hidden="true" data-playing="false">
      {children}
    </div>
  );
}
