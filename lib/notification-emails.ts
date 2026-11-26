import { onDate } from './date-on';
import { safeEmail } from './application-contact';
import { invoiceContact } from './billing';
import { emailButton, emailLayout, emailOrigin, escapeEmailHtml as esc } from './email-layout';
import type { InvoiceEmail } from './invoice-email';

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
export function placementRenewalEmail(invoice: {
  placementTier: 'vip' | 'premium'; amountGel: number; token: string;
}, vacancyTitle: string, expiresAt: Date, recipient: string, appUrl: string): InvoiceEmail {
  const url = `${emailOrigin(appUrl)}/invoices/${encodeURIComponent(invoice.token)}`;
  const tier = invoice.placementTier === 'vip' ? 'VIP' : 'პრემიუმ';
  const title = `„${vacancyTitle}“ — ${tier} განთავსების გაგრძელება`;
  const text = `„${vacancyTitle}“ — ${tier} განთავსება მთავრდება ${onDate(expiresAt)}. გასაგრძელებლად გადაიხადეთ.`;
  const amount = `გადასახდელია — ${invoice.amountGel} ₾`;
  const after = 'ფასიანი განთავსების დასრულების შემდეგ ვაკანსია ჩვეულებრივ განთავსებად დარჩება, ვაკანსიის ბოლო ვადამდე.';
  return message(recipient, appUrl, title, `${text}\n${amount}\n${after}\n\nინვოისის გახსნა: ${url}`,
    `<p style="line-height:1.7">${esc(text)}</p><p>${esc(amount)}</p>${emailButton(url, 'ინვოისის გახსნა')}<p>${esc(after)}</p>`);
}

// Shared with the existing manual vacancy-deadline screen.
export function formatDeadlineDate(deadline: string, withYear = false): string {
  const months = ['იანვარი', 'თებერვალი', 'მარტი', 'აპრილი', 'მაისი', 'ივნისი', 'ივლისი', 'აგვისტო', 'სექტემბერი', 'ოქტომბერი', 'ნოემბერი', 'დეკემბერი'];
  const [year, month, day] = deadline.split('-').map(Number);
  return `${day} ${months[month - 1]}${withYear ? `, ${year}` : ''}`;
}
