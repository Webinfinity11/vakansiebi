import { safeEmail } from './application-contact';
import { invoiceContact } from './billing';
import { emailButton, emailLayout, emailOrigin, escapeEmailHtml } from './email-layout';
import type { InvoiceEmail } from './invoice-email';

export type AdminReviewSummary = { jobs: string[]; companies: string[]; autoPublished: string[] };
export function adminReviewEmail(summary: AdminReviewSummary, recipient: string, appUrl: string): InvoiceEmail {
  const email = safeEmail(recipient);
  if (!email) throw new Error('Invalid admin notification email');
  const origin = emailOrigin(appUrl);
  const url = `${origin}/admin`;
  const heading = 'შესამოწმებელი განცხადებები და კომპანიები';
  const counts = `შემოწმებას ელოდება ${summary.jobs.length} ახალი ვაკანსია და ${summary.companies.length} კომპანიის ანგარიში. გადასახედია ${summary.autoPublished.length} ავტომატურად გამოქვეყნებული ვაკანსია.`;
  const groups = [
    { title: 'შემოწმებას ელოდება', names: [...summary.jobs, ...summary.companies] },
    { title: 'ავტომატურად გამოქვეყნდა — გადახედეთ', names: summary.autoPublished },
  ];
  const groupText = groups.map(({ title, names }) => `${title}\n${names.slice(0, 5).join('\n')}${names.length > 5 ? `\nდა კიდევ ${names.length - 5}` : ''}`).join('\n\n');
  const groupHtml = groups.map(({ title, names }) => `<h2 style="font-size:18px;line-height:1.7">${title}</h2><ul>${names.slice(0, 5).map(name => `<li style="line-height:1.7">${escapeEmailHtml(name)}</li>`).join('')}</ul>${names.length > 5 ? `<p style="line-height:1.7">და კიდევ ${names.length - 5}</p>` : ''}`).join('');
  return {
    from: `JOBX <${invoiceContact.email}>`, to: [email], reply_to: invoiceContact.email,
    subject: `JOBX — ${heading}`,
    text: `${counts}\n\n${groupText}\n\nადმინის პანელის გახსნა: ${url}`,
    html: emailLayout(origin, heading, counts,
      `<p style="line-height:1.7">${escapeEmailHtml(counts)}</p>${groupHtml}${emailButton(url, 'ადმინის პანელის გახსნა')}`,
      'შეკითხვებისთვის მოგვწერეთ:'),
  };
}
