'use client';

import { useUi } from './ui-language';
import './vacancy-application-form.css';

/* A JOBX resume that is still empty is not sent: the employer would get a blank page. */
export function CvDraftNote({ missing }: { missing: string[] }) {
  const { ui } = useUi();
  return (
    <p className="quick-apply-note cv-draft-note" role="status">
      {ui('შენი JOBX რეზიუმე ჯერ შევსებული არ არის. დაამატე:')}{' '}
      {missing.map((item) => ui(item)).join('; ')}.{' '}
      <a href="/cv" target="_blank" rel="noopener">
        {ui('რეზიუმეს შევსება')}
      </a>{' '}
      {ui('ან ატვირთე PDF.')}
    </p>
  );
}

/** Uploaded CVs also appear in the JOBX CV base; the consent says so. */
export const baseUploadNote =
  ' ატვირთული CV დამსაქმებლებს CV ბაზაშიც გამოუჩნდებათ.';
