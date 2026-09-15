import { invoiceContact, invoiceNumber, type JobInvoice } from './billing';
import { safeEmail } from './application-contact';

export type InvoiceEmail = {
  from: string;
  to: string[];
  bcc?: string[];
  reply_to: string;
  subject: string;
  html: string;
  text: string;
};
const escapeHtml = (value: string | number) =>
  String(value).replace(
    /[&<>"']/g,
    (c) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[
        c
      ]!,
  );

export function invoiceEmail(
  invoice: JobInvoice,
  recipient: string,
  appUrl: string,
  copyTo = invoiceContact.email as string,
): InvoiceEmail {
  const email = safeEmail(recipient);
  const copy = safeEmail(copyTo);
  const origin = new URL(appUrl);
  if (
    !email ||
    !copy ||
    (origin.protocol !== 'https:' &&
      !(
        origin.protocol === 'http:' &&
        ['localhost', '127.0.0.1'].includes(origin.hostname)
      )) ||
    origin.username ||
    origin.password
  )
    throw new Error('Invalid invoice email configuration');
  if (!/^[a-f0-9]{64}$/.test(invoice.token))
    throw new Error('Invalid invoice token');
  const url = new URL(`/invoices/${invoice.token}`, origin.origin).href;
  const number = invoiceNumber(invoice.number, invoice.created_at);
  const rows: [string, string | number][] = [
    ['ინვოისი', number],
    ['კომპანია', invoice.payer_name],
    ['ვაკანსია', invoice.vacancy_title],
    ['მომსახურება', `პრემიუმ განთავსება · ${invoice.service_days} დღე`],
    ['თანხა', `${invoice.amount_gel} ₾`],
    ['მიმღები', invoice.payee_name],
    ['ბანკი', invoice.bank_name],
    ['ანგარიში', invoice.iban],
    ['გადარიცხვის დანიშნულება', number],
  ];
  const contactText = `ინვოისთან ან გადახდასთან დაკავშირებით დაგვიკავშირდით: ${invoiceContact.phone}.`;
  return {
    from: `JOBX <${invoiceContact.email}>`,
    to: [email],
    ...(copy.toLowerCase() !== email.toLowerCase() ? { bcc: [copy] } : {}),
    reply_to: invoiceContact.email,
    subject: `JOBX — ინვოისი ${number}`,
    text: [
      'თქვენი ინვოისი მზად არის.',
      ...rows.map(([label, value]) => `${label}: ${value}`),
      `ინვოისის ნახვა და მიმდინარე სტატუსი: ${url}`,
      'გადახდამდე გადაამოწმეთ ინვოისის მიმდინარე სტატუსი. პრემიუმი გააქტიურდება განცხადებისა და ჩარიცხვის დადასტურების შემდეგ.',
      contactText,
      invoiceContact.email,
    ].join('\n\n'),
    html: `<!doctype html><html lang="ka"><body style="margin:0;background:#f5f6f8;color:#202b3d;font-family:Arial,sans-serif"><div style="max-width:600px;margin:24px auto;padding:28px;background:white"><p style="font-size:24px;font-weight:bold;margin-top:0">JOBX</p><h1 style="font-size:21px">თქვენი ინვოისი მზად არის</h1><table role="presentation" style="width:100%;border-collapse:collapse;font-size:14px">${rows.map(([label, value]) => `<tr><td style="padding:10px 8px;border-bottom:1px solid #e1e5ed;color:#536078;vertical-align:top">${escapeHtml(label)}</td><td style="padding:10px 8px;border-bottom:1px solid #e1e5ed;overflow-wrap:anywhere">${escapeHtml(value)}</td></tr>`).join('')}</table><p style="margin:28px 0"><a href="${escapeHtml(url)}" style="display:inline-block;background:#2457e6;color:white;padding:13px 20px;text-decoration:none;border-radius:6px">ინვოისის ნახვა</a></p><p style="font-size:13px;line-height:1.8">გადახდამდე გადაამოწმეთ ინვოისის მიმდინარე სტატუსი. პრემიუმი გააქტიურდება განცხადებისა და ჩარიცხვის დადასტურების შემდეგ.</p><p style="font-size:13px;line-height:1.8;border-top:1px solid #e1e5ed;padding-top:20px">ინვოისთან ან გადახდასთან დაკავშირებით დაგვიკავშირდით:<br><a href="tel:${invoiceContact.telephone}">${invoiceContact.phone}</a><br><a href="mailto:${invoiceContact.email}">${invoiceContact.email}</a></p></div></body></html>`,
  };
}
