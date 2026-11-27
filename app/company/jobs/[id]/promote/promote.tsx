'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import type { CompanyInvoiceDetails } from '@/lib/billing';
import { formatUntilDate, type CompanyJob } from '../../../company-api';
import { canPromoteJob, placementDeadlinePassed, PLACEMENT_REVIEW_NOTE } from '../../placement-eligibility';
import { PaymentDetails } from '../../../payment-details';
import { PlacementChoice } from '../../../placement-choice';
import '../../../portal.css';
import './promote.css';

export function usePlacementOrder(job: Pick<CompanyJob, 'id' | 'version'>) {
  const router = useRouter();
  const [ordered, setOrdered] = useState<CompanyInvoiceDetails | null>(null);
  const [busy, setBusy] = useState(false);
  const submitting = useRef(false);
  const [error, setError] = useState('');
  async function order(placement: 'vip' | 'premium') {
    if (submitting.current) return;
    submitting.current = true;
    setBusy(true);
    setError('');
    try {
      const response = await fetch('/api/company/billing', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: job.id, version: job.version, placement }),
      });
      if (response.status === 401) { window.location.assign('/company'); return; }
      if (response.status === 409) router.refresh();
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'ინვოისი ვერ შეიქმნა.');
      if (!result.invoice) throw new Error('ინვოისი ვერ ჩაიტვირთა. განაახლეთ გვერდი.');
      setOrdered(result.invoice);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'ინვოისი ვერ შეიქმნა.');
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }

  return { ordered, busy, error, order };
}

export function Promote({ job, owner, approved }: { job: CompanyJob; owner: boolean; approved: boolean }) {
  const [placement, setPlacement] = useState<'vip' | 'premium'>('vip');
  const { ordered, busy, error, order } = usePlacementOrder(job);
  const choiceKey = `jobx.promote.${job.id}`;
  useEffect(() => {
    try {
      const choice = sessionStorage.getItem(choiceKey);
      if (choice === 'vip' || choice === 'premium') setPlacement(choice);
    } catch { /* Selection still works when browser storage is unavailable. */ }
  }, [choiceKey]);
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
  const active = job.placement !== 'standard' && job.placementExpiresAt && new Date(job.placementExpiresAt).getTime() > Date.now();
  const now = new Date();
  const canOrder = canPromoteJob(job, owner, approved, now);
  const closed = job.status === 'archived';
  const rejected = job.status === 'rejected';
  const reason = closed ? 'ვაკანსია დახურულია.'
    : rejected ? 'ვაკანსია უარყოფილია — გაასწორეთ და ხელახლა გაგზავნეთ.'
    : !owner ? 'წინ წამოწევა მხოლოდ ანგარიშის მფლობელს შეუძლია.'
    : job.imported ? 'წინ წამოწევა მხოლოდ JOBX-ზე დამატებული ვაკანსიისთვისაა ხელმისაწვდომი.'
    : placementDeadlinePassed(job, now) ? 'ვაკანსიის ვადა გასულია — ჯერ ვადა გააგრძელეთ.'
    : !approved ? 'წინ წამოწევისთვის საჭიროა კომპანიისა და ელფოსტის დადასტურება.'
    : !job.canOrderPlacement && active ? 'ამ ვაკანსიის ფასიანი განთავსება უკვე გაცემულია.'
    : !canOrder ? 'ამ ვაკანსიის წინ წამოწევა მიუწვდომელია.' : '';


  return <main className="cp-promote">
    <header><Link href="/company">ვაკანსიების სია</Link><h1>წინ წამოწევა</h1><p>{job.title}</p></header>
    <div className="cp-promote-content">
      {closed || rejected ? <><p>{reason}</p>
        {rejected && <Link className="cp-btn cp-btn--secondary" href={`/company/jobs/${job.id}/edit`}>რედაქტირება</Link>}
      </> : !owner ? <p>{reason}</p> : invoice?.status === 'pending' ? <>
        {active && <p>{job.placement === 'vip' ? 'VIP' : 'სუპერ VIP'} აქტიურია {formatUntilDate(job.placementExpiresAt ?? null)}.</p>}
        <h2 role="status">{renewal ? 'გასაგრძელებლად გადასახდელია' : 'გადასახდელია'} — {invoice.amountGel} ₾</h2>
        {renewal && <p>თუ ვადა ჯერ არ დასრულებულა, ახალი {invoice.serviceDays} დღე მიმდინარე ვადის დასრულებიდან დაითვლება; სხვა შემთხვევაში — ჩარიცხვის დადასტურებიდან.</p>}
        <PaymentDetails invoice={invoice} nextNote={job.status === 'pending' ? PLACEMENT_REVIEW_NOTE : undefined} />
      </> : active ? <p>{job.placement === 'vip' ? 'VIP' : 'სუპერ VIP'} განთავსება აქტიურია {formatUntilDate(job.placementExpiresAt ?? null)}.</p>
        : invoice?.status === 'paid' && !invoice.activatedAt ? <p>გადახდილია — განთავსება გააქტიურებას ელოდება.</p>
        : !canOrder ? <p>{reason}</p> : <form onSubmit={e => { e.preventDefault(); void order(placement); }}>
          <PlacementChoice value={placement} includeStandard={false} disabled={busy} onChange={value => {
            if (value === 'standard') return;
            setPlacement(value);
            try { sessionStorage.setItem(choiceKey, value); } catch { /* Optional persistence. */ }
          }} />
          <button type="submit" className="cp-btn cp-btn--primary" disabled={busy}>{busy ? 'მზადდება…' : 'შეკვეთა და ინვოისის მიღება'}</button>
        </form>}
      {error && <p className="cp-alert" role="alert">{error}</p>}
    </div>
  </main>;
}
