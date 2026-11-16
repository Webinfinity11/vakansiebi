'use client';
import './billing.css';
import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { companyRequest, type CompanyJob } from './company-api';
import { PlacementChoice } from './placement-choice';
export function PlacementUpgrade({
  job,
  onRefresh,
}: {
  job: CompanyJob;
  onRefresh?: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [placement, setPlacement] = useState<'vip' | 'premium'>('vip');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [invoiceUrl, setInvoiceUrl] = useState('');
  return (
    <>
      <button
        type="button"
        className="cp-btn cp-btn--ghost cp-btn--sm"
        onClick={() => {
          setError('');
          setOpen(true);
        }}
      >
        VIP-ად აწევა
      </button>
      <Dialog
        open={open}
        onOpenChange={(value) => {
          if (!busy) {
            setOpen(value);
            if (!value && invoiceUrl) void onRefresh?.();
          }
        }}
      >
        <DialogContent className="cp-dialog">
          <DialogTitle>ფასიანი განთავსება</DialogTitle>
          <DialogDescription>{job.title}</DialogDescription>
          {invoiceUrl ? (
            <a
              className="cp-btn cp-btn--primary"
              href={invoiceUrl}
              target="_blank"
              rel="noreferrer"
            >
              ინვოისის ნახვა / PDF
            </a>
          ) : (
            <>
              <PlacementChoice
                value={placement}
                includeStandard={false}
                disabled={busy}
                onChange={(value) => {
                  if (value !== 'standard') setPlacement(value);
                }}
              />
              {error && (
                <p className="cp-alert" role="alert">
                  {error}
                </p>
              )}
              <div className="cp-dialog-actions">
                <button
                  type="button"
                  className="cp-btn cp-btn--ghost"
                  disabled={busy}
                  onClick={() => setOpen(false)}
                >
                  გაუქმება
                </button>
                <button
                  type="button"
                  className="cp-btn cp-btn--primary"
                  disabled={busy}
                  onClick={async () => {
                    setBusy(true);
                    setError('');
                    try {
                      const result = await companyRequest('billing', {
                        id: job.id,
                        version: job.version,
                        placement,
                      });
                      setInvoiceUrl(result.invoiceUrl);
                    } catch (e) {
                      setError(
                        e instanceof Error ? e.message : 'ინვოისი ვერ შეიქმნა.',
                      );
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  {busy ? 'მზადდება…' : 'ინვოისის მიღება'}
                </button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
