'use client';
import { useState } from 'react';
import { CvDialog } from './cv-dialog';
import { Download, Eye } from 'lucide-react';
import './swipe-applications.css';

export function ApplicationCvLinks({
  application,
}: {
  application: {
    id: string;
    hasFile: boolean;
    cvKind: 'upload' | 'jobx';
    resumeId: string | null;
  };
}) {
  const [open, setOpen] = useState(false);
  if (
    !application.hasFile &&
    !(application.cvKind === 'jobx' && application.resumeId)
  )
    return (
      <span className="application-cv-missing">CV-ის ასლი მიუწვდომელია</span>
    );
  const href = `/api/admin/swipe/download?id=${application.id}`;
  return (
    <div className="application-cv-links">
      <button
        type="button"
        className="ds-btn ds-btn--primary ds-btn--sm"
        onClick={() => setOpen(true)}
      >
        <Eye size={16} aria-hidden="true" />
        CV-ის ნახვა
      </button>
      <CvDialog open={open} onClose={() => setOpen(false)} pdf={href} />
      <a className="ds-btn ds-btn--secondary ds-btn--sm" href={href}>
        <Download size={16} aria-hidden="true" />
        PDF-ის ჩამოტვირთვა
      </a>
    </div>
  );
}
