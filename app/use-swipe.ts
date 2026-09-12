'use client';
import { useCallback, useRef, useState, type PointerEvent } from 'react';
/* Horizontal swipe on a touch pointer only. The gesture locks to horizontal after the finger
   has moved 10px more sideways than vertically, so ordinary scrolling is never captured, and
   it releases the offset back to zero after firing. */
export function useSwipe({
  onLeft,
  onRight,
  threshold = 72,
}: {
  onLeft?: () => void;
  onRight?: () => void;
  threshold?: number;
}) {
  const [dx, setDx] = useState(0);
  const [dragging, setDragging] = useState(false);
  const start = useRef<{ x: number; y: number; id: number } | null>(null);
  const locked = useRef<'horizontal' | 'vertical' | null>(null);
  const reset = useCallback(() => {
    start.current = null;
    locked.current = null;
    setDragging(false);
    setDx(0);
  }, []);
  const onPointerDown = useCallback((event: PointerEvent<HTMLElement>) => {
    if (event.pointerType !== 'touch') return;
    start.current = { x: event.clientX, y: event.clientY, id: event.pointerId };
    locked.current = null;
  }, []);
  const onPointerMove = useCallback((event: PointerEvent<HTMLElement>) => {
    const origin = start.current;
    if (!origin || event.pointerId !== origin.id) return;
    const moveX = event.clientX - origin.x;
    const moveY = event.clientY - origin.y;
    if (!locked.current) {
      if (Math.abs(moveX) < 10 && Math.abs(moveY) < 10) return;
      locked.current =
        Math.abs(moveX) > Math.abs(moveY) ? 'horizontal' : 'vertical';
      if (locked.current === 'horizontal') {
        try {
          event.currentTarget.setPointerCapture(event.pointerId);
        } catch {}
        setDragging(true);
      }
    }
    if (locked.current !== 'horizontal') return;
    setDx(Math.max(-120, Math.min(120, moveX)));
  }, []);
  const onPointerUp = useCallback(
    (event: PointerEvent<HTMLElement>) => {
      const origin = start.current;
      if (!origin || event.pointerId !== origin.id) return;
      const moveX = event.clientX - origin.x;
      const horizontal = locked.current === 'horizontal';
      reset();
      if (!horizontal) return;
      if (moveX >= threshold) onRight?.();
      else if (moveX <= -threshold) onLeft?.();
    },
    [onLeft, onRight, reset, threshold],
  );
  const onPointerCancel = useCallback(() => reset(), [reset]);
  return {
    dx,
    dragging,
    handlers: { onPointerDown, onPointerMove, onPointerUp, onPointerCancel },
  };
}
