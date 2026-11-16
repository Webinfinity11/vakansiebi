import { safeEmail } from './application-contact';
import { invoiceContact } from './billing';
import { emailButton, emailLayout, emailOrigin, escapeEmailHtml as esc } from './email-layout';
import type { InvoiceEmail } from './invoice-email';
import type { MessageTemplate } from './company-message-templates';

function message(recipient: string, appUrl: string, title: string, text: string, body: string): InvoiceEmail {
  const email = safeEmail(recipient);
  if (!email) throw new Error('Invalid notification recipient');
  return {
    from: `JOBX <${invoiceContact.email}>`, to: [email], reply_to: invoiceContact.email,
    subject: `JOBX — ${title}`, text,
    html: emailLayout(appUrl, title, title, body, 'კითხვებისთვის მოგვწერეთ:'),
  };
}
export function applicationsEmail(jobs: { title: string; count: number }[], recipient: string, appUrl: string): InvoiceEmail {
  const url = `${emailOrigin(appUrl)}/company?tab=candidates`;
  const title = 'ახალი განაცხადები';
  const lines = jobs.map(j => `${j.title || 'კომპანიის რეზიუმეების ყუთი'} — ${j.count} განაცხადი`);
  return message(recipient, appUrl, title, `${lines.join('\n')}\n\nკანდიდატების ნახვა: ${url}`,
    `<p>თქვენს კომპანიაში ახალი განაცხადები შემოვიდა:</p><ul>${lines.map(line => `<li style="margin:12px 0;line-height:1.7;overflow-wrap:anywhere">${esc(line)}</li>`).join('')}</ul>${emailButton(url, 'კანდიდატების ნახვა')}`);
}
export function formatDeadlineDate(deadline: string, withYear = false): string {
  const months = ['იანვარი', 'თებერვალი', 'მარტი', 'აპრილი', 'მაისი', 'ივნისი', 'ივლისი', 'აგვისტო', 'სექტემბერი', 'ოქტომბერი', 'ნოემბერი', 'დეკემბერი'];
  const [year, month, day] = deadline.split('-').map(Number);
  return `${day} ${months[month - 1]}${withYear ? `, ${year}` : ''}`;
}
export function deadlineEmail(job: { id: string; title: string; deadline: string }, recipient: string, appUrl: string, today?: string): InvoiceEmail {
  const url = `${emailOrigin(appUrl)}/company/jobs/${encodeURIComponent(job.id)}/extend`;
  const date = formatDeadlineDate(job.deadline);
  const days = today === undefined ? null : Math.round((Date.parse(job.deadline) - Date.parse(today)) / 86400000);
  const when = days === null ? date : `${days === 0 ? 'დღეს' : `${days} დღეში`} (${date})`;
  const title = `ვაკანსიის ვადა იწურება — ${when}`;
  const text = `ვაკანსიის „${job.title}“ ვადა იწურება ${when}.`;
  return message(recipient, appUrl, title, `${text}\n\nვადის გაგრძელება: ${url}`,
    `<p style="line-height:1.7;overflow-wrap:anywhere">${esc(text)}</p>${emailButton(url, 'ვადის გაგრძელება')}`);
}
export function candidateAckEmail(template: MessageTemplate, recipient: string, appUrl: string, companyName?: string): InvoiceEmail {
  const note = companyName ? `ეს ავტომატური შეტყობინებაა კომპანია „${companyName}“-ის სახელით, JOBX-ის მეშვეობით.` : 'ეს ავტომატური შეტყობინებაა კომპანიის სახელით, JOBX-ის მეშვეობით.';
  return message(recipient, appUrl, template.subject, `${template.body}\n\n${note}`,
    `<p style="line-height:1.8;white-space:pre-wrap;overflow-wrap:anywhere">${esc(template.body)}</p><p style="font-size:12px;line-height:1.7">${esc(note)}</p>`);
}
