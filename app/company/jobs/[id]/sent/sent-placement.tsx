'use client';

import { paidPlacementPrices, vipDays, premiumDays, type CompanyInvoiceDetails } from '@/lib/billing';
import { formatUntilDate, type CompanyJob } from '../../../company-api';
import { PLACEMENT_REVIEW_NOTE, canPromoteJob } from '../../placement-eligibility';
import { PaymentDetails } from '../../../payment-details';
import { usePlacementOrder } from '../promote/promote';

export function SentPlacement({ job, reviewing, owner, approved }: { job: CompanyJob; reviewing: boolean; owner: boolean; approved: boolean }) {
  const { ordered, busy, error, order } = usePlacementOrder(job);
  const saved = job.invoice;
  const invoice: CompanyInvoiceDetails | null = ordered && ordered.token !== saved?.token ? ordered : saved ? {
    url: `/invoices/${saved.token}`, token: saved.token, number: saved.number,
    amountGel: saved.amount_gel, serviceDays: saved.service_days,
    placementTier: saved.placement_tier, payeeName: saved.payee_name,
    bankName: saved.bank_name, iban: saved.iban,
    status: saved.status as CompanyInvoiceDetails['status'], createdAt: saved.created_at,
    paidAt: null, activatedAt: saved.activated_at ?? null,
  } : null;

  const renewal = invoice?.token === saved?.token && !!saved?.renewal_for_expires_at;
  if (!owner || job.imported) return null;
  if (invoice?.status === 'pending') return <section className="cp-sent-payment">
    {job.placement !== 'standard' && job.placementExpiresAt && new Date(job.placementExpiresAt).getTime() > Date.now() && <p>{job.placement === 'vip' ? 'VIP' : 'პრემიუმი'} აქტიურია {formatUntilDate(job.placementExpiresAt)}.</p>}
    <h2 role="status">{renewal ? 'გასაგრძელებლად გადასახდელია' : 'გადასახდელია'} — {invoice.amountGel} ₾</h2>
    {renewal && <p>თუ ვადა ჯერ არ დასრულებულა, ახალი {invoice.serviceDays} დღე მიმდინარე ვადის დასრულებიდან დაითვლება; სხვა შემთხვევაში — ჩარიცხვის დადასტურებიდან.</p>}
    <PaymentDetails invoice={invoice} nextNote={reviewing ? PLACEMENT_REVIEW_NOTE : undefined} />
  </section>;
  if (job.placement && job.placement !== 'standard' && job.placementExpiresAt && new Date(job.placementExpiresAt).getTime() > Date.now()) {
    return <p className="cp-sent-state">{job.placement === 'vip' ? 'VIP' : 'პრემიუმ'} განთავსება აქტიურია {formatUntilDate(job.placementExpiresAt)}.</p>;
  }
  if (invoice?.status === 'paid' && !invoice.activatedAt) return <p className="cp-sent-state">გადახდილია — განთავსება გააქტიურებას ელოდება.</p>;
  if (!canPromoteJob(job, owner, approved, new Date())) return null;

  const choices = [
    { tier: 'vip' as const, title: 'VIP', days: vipDays, detail: 'საერთო სიაში სტანდარტულ ვაკანსიებზე წინ გამოჩნდება.' },
    { tier: 'premium' as const, title: 'პრემიუმი', days: premiumDays, detail: 'საერთო სიაში VIP და სტანდარტულ ვაკანსიებზე წინ გამოჩნდება.' },
  ];
  return <section className="cp-sent-placement" aria-label="განთავსება" aria-busy={busy}>
    <div className="cp-sent-options">{choices.map(choice => <div className="cp-sent-option" key={choice.tier}>
      <h2>{choice.title} · {paidPlacementPrices[choice.tier]} ₾ · {choice.days} დღე</h2>
      <p>{choice.detail}</p>
      <button type="button" className="cp-btn cp-btn--primary" disabled={busy} aria-label={`${choice.title} — არჩევა`} onClick={() => void order(choice.tier)}>არჩევა</button>
    </div>)}</div>
    {error && <p className="cp-alert" role="alert">{error}</p>}
  </section>;
}
