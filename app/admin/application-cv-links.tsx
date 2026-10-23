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
      <a
        className="ds-btn ds-btn--primary ds-btn--sm"
        href={`${href}&view=1`}
        target="_blank"
        rel="noopener noreferrer"
      >
        <Eye size={16} aria-hidden="true" />
        CV-ის ნახვა
      </a>
      <a className="ds-btn ds-btn--secondary ds-btn--sm" href={href}>
        <Download size={16} aria-hidden="true" />
        PDF-ის ჩამოტვირთვა
      </a>
    </div>
  );
}
