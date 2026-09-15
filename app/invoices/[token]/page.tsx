import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { getInvoice } from '@/lib/server/billing';
import { invoiceContact, invoiceNumber, invoiceStatuses } from '@/lib/billing';
import { InvoiceActions } from './print-actions';
import '../../invoices.css';
import '../../invoices-print.css';
export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  title: 'ინვოისი — JOBX',
  robots: { index: false, follow: false },
  referrer: 'no-referrer',
};
export default async function InvoicePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const invoice = await getInvoice(token);
  if (!invoice) notFound();
  const number = invoiceNumber(invoice.number);
  return (
    <main className="invoice-page">
      <div className="invoice-toolbar">
        <Link href="/">← JOBX-ზე დაბრუნება</Link>
        <InvoiceActions />
      </div>
      <article className="invoice-paper">
        {process.env.NODE_ENV === 'development' && (
          <p className="invoice-test-notice">
            სატესტო ინვოისი — არ გამოიყენო თანხის გადასარიცხად.
          </p>
        )}
        <header className="invoice-heading">
          <Image src="/brand/jobx.png" alt="JOBX" width={120} height={40} />
          <div>
            <h1>ინვოისი</h1>
            <p>{number}</p>
          </div>
        </header>
        <div className="invoice-meta">
          <span>
            თარიღი:{' '}
            {new Date(invoice.created_at).toLocaleDateString('ka-GE', {
              timeZone: 'Asia/Tbilisi',
            })}
          </span>
          <strong className={`invoice-status invoice-status-${invoice.status}`}>
            {invoiceStatuses[invoice.status as keyof typeof invoiceStatuses]}
          </strong>
        </div>
        <div className="invoice-parties">
          <section>
            <h2>მიმღები</h2>
            <p>{invoice.payee_name}</p>
            <p>{invoice.bank_name}</p>
            <p className="invoice-iban">{invoice.iban}</p>
          </section>
          <section>
            <h2>გადამხდელი</h2>
            <p>{invoice.payer_name}</p>
            <h2>ვაკანსია</h2>
            <p>{invoice.vacancy_title}</p>
          </section>
        </div>
        <table>
          <thead>
            <tr>
              <th>მომსახურება</th>
              <th>პერიოდი</th>
              <th>ღირებულება</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>პრემიუმ განთავსება JOBX-ზე</td>
              <td>{invoice.service_days} დღე</td>
              <td>{invoice.amount_gel} ₾</td>
            </tr>
          </tbody>
        </table>
        <p className="invoice-total">
          <span>
            {invoice.status === 'pending'
              ? 'სულ გადასახდელი'
              : 'ინვოისის თანხა'}
          </span>
          <strong>{invoice.amount_gel} ₾</strong>
        </p>
        {invoice.status === 'pending' && (
          <section className="invoice-payment">
            <h2>საბანკო გადარიცხვა</h2>
            <p>
              გადარიცხვის დანიშნულებაში მიუთითე: <strong>{number}</strong>
            </p>
            <p>
              პრემიუმი გააქტიურდება განცხადებისა და ჩარიცხვის დადასტურების
              შემდეგ. {invoice.service_days} დღის ათვლა დაიწყება გააქტიურებიდან.
            </p>
          </section>
        )}
        {invoice.status === 'paid' && (
          <p className="invoice-payment">
            {invoice.activated_at
              ? 'პრემიუმ განთავსება გააქტიურებულია.'
              : 'გადახდა დადასტურებულია. განცხადება ელოდება გამოქვეყნებას.'}
          </p>
        )}
        {invoice.status === 'cancelled' && (
          <p className="invoice-payment">
            ინვოისი გაუქმებულია. თანხა არ გადარიცხო.
          </p>
        )}
        {invoice.status === 'refund_required' && (
          <p className="invoice-payment">
            განთავსება არ გააქტიურებულა. თანხის დაბრუნებას ადმინისტრატორი
            დაამუშავებს.
          </p>
        )}
        {invoice.status === 'refunded' && (
          <p className="invoice-payment">თანხის დაბრუნება დადასტურებულია.</p>
        )}
        <footer>
          <p>ინვოისთან ან გადახდასთან დაკავშირებით დაგვიკავშირდით:</p>
          <a href={`tel:${invoiceContact.telephone}`}>{invoiceContact.phone}</a>
          <p>JOBX · jobx.ge</p>
        </footer>
      </article>
    </main>
  );
}
