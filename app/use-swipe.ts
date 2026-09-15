'use client';
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent,
} from 'react';
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
  const latestMoveX = useRef(0);
  const frame = useRef<number | null>(null);
  const suppressUntil = useRef(0);
  const cancelFrame = useCallback(() => {
    if (frame.current === null) return;
    cancelAnimationFrame(frame.current);
    frame.current = null;
  }, []);
  useEffect(() => cancelFrame, [cancelFrame]);
  const suppressClick = useCallback(
    () => Date.now() < suppressUntil.current,
    [],
  );
  const reset = useCallback(() => {
    cancelFrame();
    start.current = null;
    locked.current = null;
    setDragging(false);
    setDx(0);
  }, [cancelFrame]);
  const onPointerDown = useCallback((event: PointerEvent<HTMLElement>) => {
    suppressUntil.current = 0;
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
    latestMoveX.current = moveX;
    if (frame.current === null)
      frame.current = requestAnimationFrame(() => {
        frame.current = null;
        setDx(Math.max(-120, Math.min(120, latestMoveX.current)));
      });
  }, []);
  const onPointerUp = useCallback(
    (event: PointerEvent<HTMLElement>) => {
      const origin = start.current;
      if (!origin || event.pointerId !== origin.id) return;
      const moveX = event.clientX - origin.x;
      const horizontal = locked.current === 'horizontal';
      if (horizontal) suppressUntil.current = Date.now() + 500;
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
    suppressClick,
    handlers: { onPointerDown, onPointerMove, onPointerUp, onPointerCancel },
  };
}
