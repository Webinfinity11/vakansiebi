import { invoiceContact, invoiceNumber, type JobInvoice } from './billing';
import { safeEmail } from './application-contact';
import {
  emailOrigin,
  emailLayout,
  emailButton,
  escapeEmailHtml as escapeHtml,
} from './email-layout';

export type InvoiceEmail = {
  from: string;
  to: string[];
  bcc?: string[];
  reply_to: string;
  subject: string;
  html: string;
  text: string;
};
export function invoiceEmail(
  invoice: JobInvoice,
  recipient: string,
  appUrl: string,
  copyTo = invoiceContact.email as string,
  testCopy = false,
): InvoiceEmail {
  const email = safeEmail(recipient);
  const copy = safeEmail(copyTo);
  const origin = emailOrigin(appUrl);
  if (!email || !copy) throw new Error('Invalid invoice email configuration');
  if (!/^[a-f0-9]{64}$/.test(invoice.token))
    throw new Error('Invalid invoice token');
  const url = new URL(`/invoices/${invoice.token}`, origin).href;
  const number = invoiceNumber(invoice.number);
  const title = testCopy ? 'ინვოისის სატესტო ასლი' : 'თქვენი ინვოისი მზად არის';
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
    subject: `${testCopy ? '[ტესტი] ' : ''}JOBX — ინვოისი ${number}`,
    text: [
      `${title}.`,
      ...rows.map(([label, value]) => `${label}: ${value}`),
      `ინვოისის ნახვა და მიმდინარე სტატუსი: ${url}`,
      'გადახდამდე გადაამოწმეთ ინვოისის მიმდინარე სტატუსი. პრემიუმი გააქტიურდება განცხადებისა და ჩარიცხვის დადასტურების შემდეგ.',
      contactText,
      invoiceContact.email,
    ].join('\n\n'),
    html: emailLayout(
      origin,
      title,
      `ინვოისი ${number} · ${invoice.amount_gel} ₾ · პრემიუმ განთავსება JOBX-ზე`,
      `
<p style="margin:0 0 22px;font-size:14px;line-height:24px;color:#536078">${testCopy ? 'არჩეული ინვოისის ასლი. დეტალებისა და მიმდინარე სტატუსის სანახავად გახსენით ინვოისი ქვემოთ მოცემული ღილაკით.' : 'გმადლობთ, რომ JOBX აირჩიეთ. თქვენი პრემიუმ განთავსების დეტალები:'}</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="#f2f6ff" style="margin-bottom:24px;border:1px solid #dce6fa;border-radius:6px"><tr>
<td width="58%" style="padding:18px 16px;vertical-align:top"><p style="margin:0 0 6px;font-size:12px;line-height:20px;color:#536078">ინვოისის კოდი</p><strong style="font-size:${number.length > 6 ? 17 : 25}px;line-height:32px;color:#202b3d;word-break:break-word">${escapeHtml(number)}</strong></td>
<td width="42%" style="padding:18px 16px;vertical-align:top;text-align:right"><p style="margin:0 0 6px;font-size:12px;line-height:20px;color:#536078">გადასახდელი</p><strong style="font-size:25px;line-height:32px;white-space:nowrap;color:#202b3d">${escapeHtml(invoice.amount_gel)} ₾</strong></td></tr></table>
<table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;table-layout:fixed;font-size:13px;line-height:22px">${rows
        .filter(
          ([label]) =>
            !['ინვოისი', 'თანხა', 'გადარიცხვის დანიშნულება'].includes(label),
        )
        .map(
          ([label, value]) =>
            `<tr><th scope="row" width="40%" style="text-align:left;font-weight:normal;padding:11px 12px 11px 0;border-bottom:1px solid #e9edf3;color:#667287;vertical-align:top;overflow-wrap:anywhere">${escapeHtml(label)}</th><td style="padding:11px 0;border-bottom:1px solid #e9edf3;vertical-align:top;color:#202b3d;overflow-wrap:anywhere;word-break:break-word">${escapeHtml(value)}</td></tr>`,
        )
        .join('')}</table>
<p style="margin:20px 0 0;font-size:13px;line-height:23px;color:#536078">გადარიცხვის დანიშნულებაში მიუთითეთ კოდი: <strong style="color:#202b3d">${escapeHtml(number)}</strong>.</p>
${emailButton(url, 'ინვოისის ნახვა')}
<p style="margin:0;font-size:12px;line-height:22px;color:#667287">გადახდამდე გადაამოწმეთ ინვოისის მიმდინარე სტატუსი. პრემიუმი გააქტიურდება განცხადებისა და ჩარიცხვის დადასტურების შემდეგ.</p>`,
    ),
  };
}
