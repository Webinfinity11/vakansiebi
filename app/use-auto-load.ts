'use client';

import { useEffect, useRef, type RefObject } from 'react';

/** Layout changes and a reattached observer are not requests for another page.
 * Only a new downward user scroll may load one page, with a pause between loads.
 */
export function useAutoLoad(
  target: RefObject<HTMLDivElement | null>,
  enabled: boolean,
  onLoad: () => void,
) {
  const lastLoad = useRef(-Infinity);
  useEffect(() => {
    if (!enabled) return;
    let armedAt: number | null = null;
    let consumed = false;
    let frame = 0;
    const arm = () => {
      if (!consumed && performance.now() - lastLoad.current >= 1200)
        armedAt ??= window.scrollY;
    };
    const wheel = (event: WheelEvent) => {
      if (event.deltaY > 0) arm();
    };
    const key = (event: KeyboardEvent) => {
      if (
        event.target instanceof HTMLElement &&
        (event.target.isContentEditable ||
          event.target.closest(
            'input, textarea, select, button, [role="combobox"]',
          ))
      )
        return;
      if (['ArrowDown', 'PageDown', 'End', ' '].includes(event.key)) arm();
    };
    const check = () => {
      frame = 0;
      if (consumed || armedAt === null || window.scrollY - armedAt < 16) return;
      const bounds = target.current?.getBoundingClientRect();
      if (!bounds || bounds.top > window.innerHeight + 400 || bounds.bottom < 0)
        return;
      consumed = true;
      armedAt = null;
      lastLoad.current = performance.now();
      onLoad();
    };
    const scroll = () => {
      if (!frame && armedAt !== null) frame = requestAnimationFrame(check);
    };
    window.addEventListener('wheel', wheel, { passive: true });
    window.addEventListener('touchmove', arm, { passive: true });
    window.addEventListener('keydown', key);
    window.addEventListener('scroll', scroll, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('wheel', wheel);
      window.removeEventListener('touchmove', arm);
      window.removeEventListener('keydown', key);
      window.removeEventListener('scroll', scroll);
    };
  }, [enabled, onLoad, target]);
}
