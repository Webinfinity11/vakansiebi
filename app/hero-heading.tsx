'use client';

/* oxlint-disable jsx-a11y/no-noninteractive-tabindex -- Keyboard users need to
   focus the overflowing heading to scroll the reduced-motion view. */

import { useEffect, useRef, useState, type CSSProperties } from 'react';

export function HeroHeading({ text }: { text: string }) {
  const heading = useRef<HTMLHeadingElement>(null);
  const content = useRef<HTMLSpanElement>(null);
  const [metrics, setMetrics] = useState({ distance: 0, width: 0 });

  useEffect(() => {
    const title = heading.current;
    const label = content.current;
    if (!title || !label) return;
    let active = true;
    const measure = () => {
      if (!active) return;
      const width = label.scrollWidth;
      const distance = Math.max(0, Math.ceil(width - title.clientWidth));
      setMetrics((previous) =>
        previous.distance === distance && previous.width === width
          ? previous
          : { distance, width },
      );
    };
    const frame = requestAnimationFrame(measure);
    const observer = new ResizeObserver(measure);
    observer.observe(title);
    observer.observe(label);
    void document.fonts.ready.then(measure);
    return () => {
      active = false;
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [text]);

  return (
    <h1
      id="search-heading"
      ref={heading}
      className="hero-heading"
      data-overflow={metrics.distance > 1 || undefined}
      tabIndex={metrics.distance > 1 ? 0 : undefined}
      style={
        {
          '--heading-duration': `${Math.max(20, (metrics.width + 48) / 35)}s`,
        } as CSSProperties
      }
    >
      <span className="hero-heading-track">
        <span ref={content} className="hero-heading-text">
          {text}
        </span>
        {metrics.distance > 1 && (
          <span
            className="hero-heading-text hero-heading-copy"
            aria-hidden="true"
          >
            {text}
          </span>
        )}
      </span>
    </h1>
  );
}
