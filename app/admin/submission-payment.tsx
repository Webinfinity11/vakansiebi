'use client';
import { ExternalLink, Check, ReceiptText } from 'lucide-react';
import type { AdminJob } from '@/lib/types';
import {
  invoiceNumber,
  invoiceStatuses,
  paidPlacementPrices,
  premiumDays,
} from '@/lib/billing';
import { placementLabels, type PlacementTier } from '@/lib/placement';
import { adminDate } from '@/lib/admin-format';
import { SelectField } from '../select-field';

export function placementIsReady(job: AdminJob, tier: PlacementTier) {
  if (tier === 'standard') return true;
  if (job.invoice)
    return (
      job.invoice.status === 'paid' &&
      (job.invoice.placement_tier ?? 'premium') === tier
    );
  return job.placement_tier === tier && !!job.placement_expires_at;
}

export function SubmissionPayment({
  job,
  tier,
  busy,
  onTier,
  onConfirm,
  onPublish,
}: {
  job: AdminJob;
  tier: PlacementTier;
  busy: boolean;
  onTier: (tier: PlacementTier) => void;
  onConfirm: (action: 'confirm-payment' | 'confirm-refund') => void;
  onPublish: () => void;
}) {
  const invoice = job.invoice;
  const paidTier = invoice?.placement_tier ?? 'premium';
  const ready = placementIsReady(job, tier);
  const options: PlacementTier[] = ['standard'];
  if (invoice) options.push(paidTier);
  if (job.placement_expires_at && !options.includes(job.placement_tier))
    options.push(job.placement_tier);
  return (
    <section className="submission-payment" aria-label="განთავსება და გადახდა">
      <div className="submission-payment-heading">
        <h3>
          <ReceiptText size={18} aria-hidden="true" />
          განთავსება და გადახდა
        </h3>
        <span
          className={`ds-badge${invoice?.status === 'paid' ? ' ds-badge--success' : invoice?.status === 'pending' || invoice?.status === 'refund_required' ? ' ds-badge--warning' : ''}`}
        >
          {invoice ? invoiceStatuses[invoice.status] : 'უფასო განთავსება'}
        </span>
      </div>
      <div className="submission-payment-summary">
        <label htmlFor="submission-placement">
          განთავსების პაკეტი
          <SelectField
            id="submission-placement"
            value={tier}
            onChange={(value) => onTier(value as PlacementTier)}
            disabled={busy || job.status !== 'pending'}
            label="განთავსების პაკეტი"
            options={options.map((value) => ({
              value,
              label: placementLabels[value],
            }))}
          />
        </label>
        <dl>
          <div>
            <dt>თანხა</dt>
            <dd>
              {tier === 'standard' || !invoice
                ? 'უფასო'
                : `${invoice?.amount_gel ?? paidPlacementPrices[tier]} ₾`}
            </dd>
          </div>
          <div>
            <dt>პერიოდი</dt>
            <dd>
              {tier === 'standard'
                ? 'ვაკანსიის ვადამდე'
                : !invoice && job.placement_expires_at
                  ? `${adminDate(job.placement_expires_at)}-მდე`
                  : `${invoice?.service_days ?? premiumDays} დღე`}
            </dd>
          </div>
        </dl>
      </div>
      {invoice && (
        <a
          className="editor-notice-link"
          href={`/invoices/${invoice.token}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          <ExternalLink size={15} aria-hidden="true" />
          ინვოისი {invoiceNumber(invoice.number)} · {invoice.amount_gel} ₾
        </a>
      )}
      {job.status === 'pending' && (
        <p id="submission-payment-help">
          {tier === 'standard'
            ? invoice
              ? 'სტანდარტულად გამოქვეყნებისას გამოუყენებელი ინვოისი გაუქმდება; უკვე ჩარიცხული თანხა დაბრუნებას დაელოდება.'
              : 'გადაამოწმე ვაკანსიის ტექსტი და გამოაქვეყნე.'
            : ready
              ? 'ჩარიცხვა დადასტურებულია. შეგიძლია ვაკანსია გამოაქვეყნო.'
              : invoice?.status === 'pending'
                ? 'ჯერ გადაამოწმე ინვოისის სრული თანხის ჩარიცხვა და დაადასტურე გადახდა.'
                : 'ამ ინვოისით ფასიანი განთავსება ვერ გააქტიურდება. შეგიძლია აირჩიო სტანდარტული განთავსება.'}
        </p>
      )}
      <div className="submission-payment-actions">
        {invoice?.status === 'pending' && tier !== 'standard' && (
          <button
            type="button"
            className="ds-btn ds-btn--primary"
            disabled={busy}
            onClick={() => onConfirm('confirm-payment')}
          >
            {invoice.amount_gel} ₾-ის ჩარიცხვის დადასტურება
          </button>
        )}
        {invoice?.status === 'refund_required' && (
          <button
            type="button"
            className="ds-btn ds-btn--secondary"
            disabled={busy}
            onClick={() => onConfirm('confirm-refund')}
          >
            დაბრუნების დადასტურება
          </button>
        )}
        {job.status === 'pending' && (
          <button
            type="button"
            className={`ds-btn ${ready ? 'ds-btn--primary' : 'ds-btn--secondary'}`}
            disabled={busy || !ready}
            aria-describedby="submission-payment-help"
            onClick={onPublish}
          >
            <Check size={16} aria-hidden="true" />
            ვაკანსიის გამოქვეყნება
          </button>
        )}
      </div>
    </section>
  );
}
