import { z } from 'zod';
import { safeEmail } from './application-contact';
import { invoiceContact } from './billing';
import { emailButton, emailLayout, emailOrigin, escapeEmailHtml } from './email-layout';
import type { InvoiceEmail } from './invoice-email';
import { rejectionGuidance, rejectionSchema, rejectionText } from './job-rejection';

export function jobRejectionEmail(
  job: { id: string; title: string; owned: boolean },
  rejection: { reason: string; note?: string },
  recipient: string,
  appUrl: string,
): InvoiceEmail {
  const email = safeEmail(recipient);
  if (!email || !z.uuid().safeParse(job.id).success) throw new Error('Invalid rejection email');
  const { reason, note } = rejectionSchema.parse(rejection);
  const origin = emailOrigin(appUrl);
  const url = `${origin}/company/jobs/${job.id}/edit`;
  const heading = 'ვაკანსია ვერ გამოქვეყნდა';
  const explanation = rejectionText(reason, note);
  const guidance = rejectionGuidance[reason];
  const label = 'გასწორება და ხელახლა გაგზავნა';
  return {
    from: `JOBX <${invoiceContact.email}>`, to: [email], reply_to: invoiceContact.email,
    subject: heading,
    text: `გამარჯობა!\n\nთქვენი ვაკანსია „${job.title}“ ვერ გამოქვეყნდა.\n\nმიზეზი: ${explanation}\n\n${guidance}${job.owned ? `\n\n${label}: ${url}` : ''}`,
    html: emailLayout(origin, heading, `${job.title} — ${explanation}`,
      `<p style="line-height:1.7">გამარჯობა!</p><p style="line-height:1.7">თქვენი ვაკანსია <strong>„${escapeEmailHtml(job.title)}“</strong> ვერ გამოქვეყნდა.</p><p style="line-height:1.7;overflow-wrap:anywhere"><strong>მიზეზი:</strong> ${escapeEmailHtml(explanation)}</p><p style="line-height:1.7">${escapeEmailHtml(guidance)}</p>${job.owned ? emailButton(url, label) : ''}`,
      'ვაკანსიასთან დაკავშირებით მოგვწერეთ:'),
  };
}
