'use client';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Download, X } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { downloadCv, type Cv } from '@/lib/cv';
import { CvSheet } from '../cv/cv-builder';
import { SkeletonRows } from '../skeleton';
import '../cv.css';
import './cv-dialog.css';

export function CvDialog({
  open,
  onClose,
  cv,
  error,
  pdf,
  children,
}: {
  open: boolean;
  onClose: () => void;
  cv?: Cv;
  error?: string;
  pdf?: string;
  children?: ReactNode;
}) {
  const paper = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [file, setFile] = useState<{
    key: string;
    url?: string;
    error?: string;
  } | null>(null);
  useEffect(() => {
    if (!open || !pdf) return;
    const controller = new AbortController();
    let objectUrl = '';
    void fetch(`${pdf}&view=1`, {
      signal: controller.signal,
      cache: 'no-store',
    })
      .then(async (response) => {
        if (
          !response.ok ||
          !response.headers.get('content-type')?.includes('application/pdf')
        )
          throw Error('რეზიუმეს PDF ვერ ჩაიტვირთა. სცადე ხელახლა.');
        const blob = await response.blob();
        if (controller.signal.aborted) return;
        objectUrl = URL.createObjectURL(blob);
        setFile({ key: pdf, url: objectUrl });
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted)
          setFile({
            key: pdf,
            error: error instanceof Error ? error.message : 'PDF ვერ ჩაიტვირთა',
          });
      });
    return () => {
      controller.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [open, pdf]);
  useEffect(() => {
    const el = paper.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) =>
      setScale(Math.min(1, entry.contentRect.width / 794)),
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [open, cv]);
  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (!value) {
          setFile(null);
          onClose();
        }
      }}
    >
      <DialogContent className="admin-cv-dialog" showCloseButton={false}>
        <header className="admin-cv-dialog-head">
          <div>
            <DialogTitle>{cv?.fullName || 'რეზიუმე'}</DialogTitle>
            <DialogDescription>
              {cv?.title || 'რეზიუმეს ნახვა და ჩამოტვირთვა'}
            </DialogDescription>
          </div>
          <div className="admin-cv-dialog-actions">
            {pdf ? (
              <a className="ds-btn ds-btn--secondary ds-btn--sm" href={pdf}>
                <Download size={16} />
                PDF
              </a>
            ) : (
              cv && (
                <button
                  type="button"
                  className="ds-btn ds-btn--secondary ds-btn--sm"
                  onClick={() => downloadCv(cv.fullName)}
                >
                  <Download size={16} />
                  PDF
                </button>
              )
            )}
            <button
              type="button"
              className="ds-btn ds-btn--ghost ds-btn--sm"
              onClick={() => {
                setFile(null);
                onClose();
              }}
              aria-label="რეზიუმეს დახურვა"
            >
              <X size={20} />
            </button>
          </div>
        </header>
        <div className="admin-cv-dialog-body">
          {error ? (
            <p role="alert">{error}</p>
          ) : pdf ? (
            file?.key === pdf && file.error ? (
              <p role="alert">{file.error}</p>
            ) : file?.key === pdf && file.url ? (
              <iframe title="რეზიუმეს PDF" src={file.url} />
            ) : (
              <SkeletonRows rows={4} block label="რეზიუმე იტვირთება" />
            )
          ) : cv ? (
            <>
              <div className="resumes-sheet" ref={paper}>
                <div style={{ zoom: scale }}>
                  <CvSheet cv={cv} />
                </div>
              </div>
              {children && (
                <details className="admin-cv-activity">
                  <summary>ვაკანსიებზე აქტივობა</summary>
                  {children}
                </details>
              )}
            </>
          ) : (
            <SkeletonRows rows={4} block label="რეზიუმე იტვირთება" />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
