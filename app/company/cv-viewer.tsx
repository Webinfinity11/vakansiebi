'use client';
/* The candidate's CV drawn as plain white pages with pdf.js, instead of the browser's own PDF
   viewer: that one is dark, adds its own toolbar, shows only the first page on iPhone and does
   not render at all inside a frame on Android. */
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Download,
  ExternalLink,
  Maximize2,
  Minus,
  Plus,
  X,
} from 'lucide-react';
import type { PDFDocumentProxy } from 'pdfjs-dist';

type Doc = PDFDocumentProxy;

async function loadPdf(url: string): Promise<Doc> {
  const pdfjs = await import('pdfjs-dist');
  if (!pdfjs.GlobalWorkerOptions.workerSrc) {
    pdfjs.GlobalWorkerOptions.workerSrc = new URL(
      'pdfjs-dist/build/pdf.worker.min.mjs',
      import.meta.url,
    ).toString();
  }
  return pdfjs.getDocument({
    url,
    withCredentials: true,
    // CVs saved from Word often reference fonts without embedding them, and some use CMaps.
    cMapUrl: '/pdfjs/cmaps/',
    cMapPacked: true,
    standardFontDataUrl: '/pdfjs/standard_fonts/',
    useSystemFonts: true,
  }).promise;
}

const zoomSteps = [0.75, 1, 1.25, 1.5, 2];

export function CvViewer({ url, name }: { url: string; name: string }) {
  const [doc, setDoc] = useState<Doc | null>(null);
  const [failed, setFailed] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [reader, setReader] = useState(false);

  useEffect(() => {
    let alive = true;
    let loaded: Doc | null = null;
    setDoc(null);
    setFailed(false);
    setZoom(1);
    loadPdf(url).then(
      (d) => {
        loaded = d;
        if (alive) setDoc(d);
        else void d.destroy();
      },
      () => alive && setFailed(true),
    );
    return () => {
      alive = false;
      void loaded?.destroy();
    };
  }, [url]);

  if (failed) {
    return (
      <div className="cv-view cv-view--failed">
        <p>CV აქ ვერ გაიხსნა.</p>
        <a className="cp-btn" href={url} target="_blank" rel="noopener">
          <ExternalLink size={15} />
          ახალ ფანჯარაში გახსნა
        </a>
      </div>
    );
  }

  const tools = (inReader: boolean) => (
    <div className="cv-tools">
      <span className="cv-pages">
        {doc ? `${doc.numPages} გვერდი` : 'იტვირთება…'}
      </span>
      {inReader && <span className="cv-zoom">
        <button
          type="button"
          className="cp-icon-btn"
          aria-label="დაპატარავება"
          disabled={zoom <= zoomSteps[0]}
          onClick={() =>
            setZoom((z) => zoomSteps[Math.max(0, zoomSteps.indexOf(z) - 1)])
          }
        >
          <Minus size={15} /><span>დაპატარავება</span>
        </button>
        <button
          type="button"
          className="cv-zoom-value"
          title="სიგანეზე მორგება"
          onClick={() => setZoom(1)}
        >
          {Math.round(zoom * 100)}%
        </button>
        <button
          type="button"
          className="cp-icon-btn"
          aria-label="გადიდება"
          disabled={zoom >= zoomSteps[zoomSteps.length - 1]}
          onClick={() =>
            setZoom(
              (z) =>
                zoomSteps[
                  Math.min(zoomSteps.length - 1, zoomSteps.indexOf(z) + 1)
                ],
            )
          }
        >
          <Plus size={15} /><span>გადიდება</span>
        </button>
      </span>}
      <a
        className="cp-icon-btn"
        href={url + '&download=1'}
        aria-label="ჩამოტვირთვა"
        title="ჩამოტვირთვა"
      >
        <Download size={15} /><span>ჩამოტვირთვა</span>
      </a>
      {inReader ? (
        <button
          type="button"
          className="cp-btn"
          onClick={() => setReader(false)}
        >
          <X size={15} />
          დახურვა
        </button>
      ) : (
        <button
          type="button"
          className="cp-btn"
          aria-label="დიდად ნახვა"
          onClick={() => setReader(true)}
        >
          <Maximize2 size={15} />
          <span className="cv-label">დიდად ნახვა</span>
        </button>
      )}
    </div>
  );

  return (
    <>
      <div className="cv-view">
        {tools(false)}
        <Pages doc={doc} zoom={reader ? 1 : zoom} name={name} />
      </div>
      {reader &&
        createPortal(
          <Reader name={name} onClose={() => setReader(false)}>
            {tools(true)}
            <Pages doc={doc} zoom={zoom} name={name} wide />
          </Reader>,
          document.body,
        )}
    </>
  );
}

function Reader({
  name,
  onClose,
  children,
}: {
  name: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  useEffect(() => {
    // Capture on window so the candidate shortcuts (arrows, X, Z) do not act behind the reader.
    function onKey(event: KeyboardEvent) {
      event.stopImmediatePropagation();
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
      }
    }
    window.addEventListener('keydown', onKey, true);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey, true);
      document.body.style.overflow = overflow;
    };
  }, [onClose]);
  return (
    <div
      className="cv-reader"
      role="dialog"
      aria-modal="true"
      aria-label={`CV — ${name}`}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="cv-reader-inner">{children}</div>
    </div>
  );
}

/* Every page fitted to the column width (times the zoom), redrawn when the column resizes. */
function Pages({
  doc,
  zoom,
  name,
  wide,
}: {
  doc: Doc | null;
  zoom: number;
  name: string;
  wide?: boolean;
}) {
  const box = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) =>
      setWidth(Math.floor(e.contentRect.width)),
    );
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div
      ref={box}
      className="cv-pages-scroll"
      data-wide={wide ? '' : undefined}
      aria-label={`CV — ${name}`}
    >
      {doc && width > 0 ? (
        Array.from({ length: doc.numPages }, (_, i) => (
          <Page
            key={i}
            doc={doc}
            index={i + 1}
            width={Math.max(240, (wide ? Math.min(width, 900) : width) * zoom)}
          />
        ))
      ) : (
        <div className="cv-page cv-page--loading" />
      )}
    </div>
  );
}

function Page({
  doc,
  index,
  width,
}: {
  doc: Doc;
  index: number;
  width: number;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [ratio, setRatio] = useState(1.414);

  useEffect(() => {
    let task: { cancel: () => void; promise: Promise<void> } | null = null;
    let alive = true;
    void doc.getPage(index).then((page) => {
      if (!alive || !canvas.current) return;
      const base = page.getViewport({ scale: 1 });
      setRatio(base.height / base.width);
      const dpr = Math.min(window.devicePixelRatio || 1, 3);
      const viewport = page.getViewport({ scale: (width / base.width) * dpr });
      const c = canvas.current;
      c.width = Math.floor(viewport.width);
      c.height = Math.floor(viewport.height);
      task = page.render({ canvas: c, viewport });
      task.promise.catch(() => {});
    }).catch(() => {
      // Closing the reader destroys the document while a page may still be queued.
    });
    return () => {
      alive = false;
      task?.cancel();
    };
  }, [doc, index, width]);

  return (
    <canvas
      ref={canvas}
      className="cv-page"
      style={{ width, height: Math.round(width * ratio) }}
    />
  );
}
