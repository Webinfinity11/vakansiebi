import { z } from 'zod';
import { safeEmail } from './application-contact';
import { invoiceContact } from './billing';
import {
  emailButton,
  emailLayout,
  emailOrigin,
  escapeEmailHtml,
} from './email-layout';
import type { InvoiceEmail } from './invoice-email';
import { vacancyPath } from './vacancy-navigation';
import { removalLink, removalHeaders } from './employer-opt-out';

export function publicationEmail(
  job: { id: string; title: string; company: string },
  recipient: string,
  appUrl: string,
): InvoiceEmail {
  const email = safeEmail(recipient);
  if (!email || !z.uuid().safeParse(job.id).success)
    throw new Error('Invalid publication email');
  const origin = emailOrigin(appUrl);
  const url = new URL(vacancyPath(job), origin).href;
  const heading = 'თქვენი ვაკანსია გამოქვეყნდა';
  const remove = removalLink(job.id, email, origin);
  return {
    from: `JOBX <${invoiceContact.email}>`,
    to: [email],
    reply_to: invoiceContact.email,
    subject: 'JOBX — თქვენი ვაკანსია გამოქვეყნდა',
    ...(remove ? { headers: removalHeaders(remove) } : {}),
    text: `გამარჯობა!\n\nთქვენი ვაკანსია „${job.title}“ (${job.company}) უკვე გამოქვეყნებულია JOBX-ზე.\n\nვაკანსიის ნახვა: ${url}\n\nგმადლობთ, რომ JOBX აირჩიეთ.${remove ? `\n\nკომპანიის ვაკანსიების ამოღება: ${remove}` : ''}`,
    html: emailLayout(
      origin,
      heading,
      `${job.title} — ვაკანსია უკვე ხელმისაწვდომია JOBX-ზე`,
      `<p style="margin:0 0 16px;line-height:1.7">გამარჯობა!</p><p style="margin:0;line-height:1.7">თქვენი ვაკანსია <strong>„${escapeEmailHtml(job.title)}“</strong> (${escapeEmailHtml(job.company)}) უკვე გამოქვეყნებულია JOBX-ზე.</p>${emailButton(url, 'ვაკანსიის ნახვა')}<p style="margin:0;line-height:1.7">გმადლობთ, რომ JOBX აირჩიეთ.</p>${remove ? `<p style="font-size:12px"><a href="${escapeEmailHtml(remove)}">კომპანიის ვაკანსიების ამოღება და მომავალი განთავსების შეჩერება</a></p>` : ''}`,
      'ვაკანსიასთან დაკავშირებით დაგვიკავშირდით:',
    ),
  };
}
