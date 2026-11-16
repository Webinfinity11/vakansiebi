'use client';
import { useId, useRef, useState } from 'react';
import { rejectionGuidance, rejectionLabels, rejectionReasons, rejectionSchema, type RejectionReason } from '@/lib/job-rejection';

export function RejectMenu({ disabled, onReject }: {
  disabled?: boolean;
  onReject: (value: { reason: RejectionReason; note: string }) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<RejectionReason>('incomplete');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const id = useId();
  function close() { setOpen(false); trigger.current?.focus(); }
  return <div className="admin-reject" onKeyDown={event => {
    if (event.key === 'Escape' && open) { event.preventDefault(); event.stopPropagation(); close(); }
  }}>
    <button ref={trigger} type="button" className="ds-btn ds-btn--danger ds-btn--sm" disabled={disabled || busy} aria-expanded={open} aria-controls={id} onClick={() => { setOpen(!open); setError(''); }}>უარყოფა</button>
    {open && <div id={id} className="admin-reject-menu" role="group" aria-label="უარყოფის მიზეზი">
      <fieldset className="admin-reject-reasons" disabled={busy}>
        <legend>მიზეზი</legend>
        <div>{rejectionReasons.map((value, index) => <label key={value} className="admin-reject-reason">
          <input type="radio" name={`${id}-reason`} value={value} checked={reason === value} autoFocus={index === 0} onChange={() => setReason(value)} />
          <span>{rejectionLabels[value]}</span>
        </label>)}</div>
        <p className="admin-reject-guidance">კომპანია მიიღებს: {rejectionGuidance[reason]}</p>
      </fieldset>
      <label>შენიშვნა{reason === 'other' ? ' (სავალდებულო)' : ' (არასავალდებულო)'}<textarea value={note} maxLength={500} required={reason === 'other'} disabled={busy} onChange={event => setNote(event.target.value)} /></label>
      {error && <p role="alert">{error}</p>}
      <div className="admin-quick-buttons"><button type="button" className="ds-btn ds-btn--danger ds-btn--sm" disabled={disabled || busy} onClick={async () => {
        const parsed = rejectionSchema.safeParse({ reason, note });
        if (!parsed.success) { setError(parsed.error.issues[0].message); return; }
        setBusy(true); setError('');
        try { await onReject(parsed.data); close(); } catch (e) { setError(e instanceof Error ? e.message : 'უარყოფა ვერ მოხერხდა.'); } finally { setBusy(false); }
      }}>უარყოფა</button><button type="button" className="ds-btn ds-btn--ghost ds-btn--sm" disabled={busy} onClick={close}>გაუქმება</button></div>
    </div>}
  </div>;
}

export function QuickModeration({ onPublish, onReject, disabled }: {
  onPublish: () => Promise<void>;
  onReject: (value: { reason: RejectionReason; note: string }) => Promise<void>;
  disabled?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  return <div className="admin-quick-moderation">
    <div className="admin-quick-buttons"><button type="button" className="ds-btn ds-btn--primary ds-btn--sm" disabled={disabled || busy} onClick={async () => {
      setBusy(true); setError('');
      try { await onPublish(); } catch (e) { setError(e instanceof Error ? e.message : 'დამტკიცება ვერ მოხერხდა.'); } finally { setBusy(false); }
    }}>დამტკიცება</button><RejectMenu disabled={disabled || busy} onReject={onReject} /></div>
    {error && <p role="alert">{error}</p>}
  </div>;
}
