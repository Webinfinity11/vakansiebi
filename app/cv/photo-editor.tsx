'use client';

import { useEffect, useId, useRef, useState, type PointerEvent } from 'react';
import { createPortal } from 'react-dom';
import type { CvText, PhotoShape } from '../../lib/cv';
import {
  centerCrop,
  loadCvPhoto,
  renderCvPhoto,
  type PhotoCrop,
} from '../../lib/cv-photo';

type Offset = { dx: number; dy: number };
const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

export function PhotoEditor({
  source,
  shape,
  text,
  onCancel,
  onDone,
}: {
  source: File | string;
  shape: PhotoShape;
  text: CvText;
  onCancel: () => void;
  onDone: (dataUrl: string) => void;
}) {
  const [mounted, setMounted] = useState(false);
  const [loaded, setLoaded] = useState<{
    source: File | string;
    image: HTMLImageElement;
  } | null>(null);
  const [error, setError] = useState('');
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState<Offset>({ dx: 0, dy: 0 });
  const [side, setSide] = useState(280);
  const dialog = useRef<HTMLDialogElement>(null);
  const viewport = useRef<HTMLDivElement>(null);
  const drag = useRef<{
    id: number;
    x: number;
    y: number;
    offset: Offset;
  } | null>(null);
  const cancel = useRef(onCancel);
  const titleId = useId();
  const hintId = useId();
  const image = loaded?.source === source ? loaded.image : null;
  const initialCrop = image
    ? centerCrop(image.naturalWidth, image.naturalHeight)
    : null;
  const scale = initialCrop ? (side / initialCrop.size) * zoom : 1;

  function bounded(value: Offset, nextScale = scale): Offset {
    if (!image) return { dx: 0, dy: 0 };
    const maxX = Math.max(0, (image.naturalWidth * nextScale - side) / 2);
    const maxY = Math.max(0, (image.naturalHeight * nextScale - side) / 2);
    return {
      dx: clamp(value.dx, -maxX, maxX),
      dy: clamp(value.dy, -maxY, maxY),
    };
  }
  const position = bounded(offset);

  useEffect(() => {
    cancel.current = onCancel;
  }, [onCancel]);
  useEffect(() => {
    const timer = window.setTimeout(() => setMounted(true), 0);
    return () => window.clearTimeout(timer);
  }, []);
  useEffect(() => {
    let disposed = false;
    let release: (() => void) | undefined;
    loadCvPhoto(source)
      .then((result) => {
        if (disposed) {
          result.release();
          return;
        }
        release = () => result.release();
        setError('');
        setZoom(1);
        setOffset({ dx: 0, dy: 0 });
        setLoaded({ source, image: result.image });
      })
      .catch((cause: unknown) => {
        if (!disposed)
          setError(cause instanceof Error ? cause.message : text.photoError);
      });
    return () => {
      disposed = true;
      release?.();
    };
  }, [source, text.photoError]);

  useEffect(() => {
    if (!mounted) return;
    const previousFocus =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialog.current?.focus();
    const keydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        cancel.current();
      }
      if (event.key !== 'Tab') return;
      const controls = dialog.current?.querySelectorAll<HTMLElement>(
        'button:not(:disabled), input:not(:disabled), [tabindex="0"]',
      );
      if (!controls?.length) {
        event.preventDefault();
        return;
      }
      const first = controls[0];
      const last = controls[controls.length - 1];
      if (
        event.shiftKey &&
        (document.activeElement === first ||
          document.activeElement === dialog.current)
      ) {
        event.preventDefault();
        last.focus();
      } else if (
        !event.shiftKey &&
        (document.activeElement === last ||
          document.activeElement === dialog.current)
      ) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', keydown);
    const element = viewport.current;
    const measure = () => {
      const width = element?.getBoundingClientRect().width;
      if (width) setSide(width);
    };
    measure();
    const observer = new ResizeObserver(measure);
    if (element) observer.observe(element);
    return () => {
      observer.disconnect();
      document.removeEventListener('keydown', keydown);
      document.body.style.overflow = overflow;
      previousFocus?.focus();
    };
  }, [mounted]);

  function startDrag(event: PointerEvent<HTMLDivElement>) {
    if (!image || drag.current || event.button !== 0) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = {
      id: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      offset: position,
    };
  }
  function moveDrag(event: PointerEvent<HTMLDivElement>) {
    const current = drag.current;
    if (!current || current.id !== event.pointerId) return;
    setOffset(
      bounded({
        dx: current.offset.dx + event.clientX - current.x,
        dy: current.offset.dy + event.clientY - current.y,
      }),
    );
  }
  function stopDrag(event: PointerEvent<HTMLDivElement>) {
    if (drag.current?.id !== event.pointerId) return;
    drag.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId))
      event.currentTarget.releasePointerCapture(event.pointerId);
  }
  function apply() {
    if (!image) return;
    const size = Math.min(
      image.naturalWidth,
      image.naturalHeight,
      side / scale,
    );
    const crop: PhotoCrop = {
      size,
      x: clamp(
        (image.naturalWidth - size) / 2 - position.dx / scale,
        0,
        image.naturalWidth - size,
      ),
      y: clamp(
        (image.naturalHeight - size) / 2 - position.dy / scale,
        0,
        image.naturalHeight - size,
      ),
    };
    try {
      onDone(renderCvPhoto(image, crop));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : text.photoError);
    }
  }

  if (!mounted) return null;
  return createPortal(
    <div
      className="cv-photo-editor"
      role="presentation"
      onPointerDown={(event) => {
        if (event.target === event.currentTarget) onCancel();
      }}
    >
      <dialog
        open
        ref={dialog}
        className="cv-photo-editor__dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={hintId}
        tabIndex={-1}
      >
        <h2 id={titleId}>{text.editPhoto}</h2>
        <p id={hintId}>{text.dragHint}</p>
        <div
          ref={viewport}
          className="cv-photo-editor__viewport"
          onPointerDown={startDrag}
          onPointerMove={moveDrag}
          onPointerUp={stopDrag}
          onPointerCancel={stopDrag}
          onLostPointerCapture={() => {
            drag.current = null;
          }}
        >
          {image && (
            // A local decoded photo needs its natural dimensions for crop positioning.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              className="cv-photo-editor__image"
              src={image.src}
              alt=""
              draggable={false}
              style={{
                width: image.naturalWidth,
                height: image.naturalHeight,
                transform: `translate(-50%, -50%) translate(${position.dx}px, ${position.dy}px) scale(${scale})`,
              }}
            />
          )}
          <div className="cv-photo-editor__mask" data-shape={shape} />
        </div>
        <label className="cv-photo-editor__zoom">
          <span>{text.zoom}</span>
          <input
            type="range"
            min={1}
            max={4}
            step={0.01}
            value={zoom}
            disabled={!image}
            onChange={(event) => {
              const next = Number(event.target.value);
              setOffset(bounded(position, (scale / zoom) * next));
              setZoom(next);
            }}
          />
        </label>
        {error && (
          <p className="cv-photo-editor__error" role="alert">
            {error}
          </p>
        )}
        <div className="cv-photo-editor__actions">
          <button
            type="button"
            className="ds-btn ds-btn--secondary"
            onClick={onCancel}
          >
            {text.cancel}
          </button>
          <button
            type="button"
            className="ds-btn ds-btn--primary"
            onClick={apply}
            disabled={!image}
          >
            {text.apply}
          </button>
        </div>
      </dialog>
    </div>,
    document.body,
  );
}
