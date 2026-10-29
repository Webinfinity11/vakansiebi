import { createHmac, timingSafeEqual } from 'node:crypto';
import {
  emailButton,
  emailLayout,
  emailOrigin,
  escapeEmailHtml,
} from './email-layout';
import { invoiceContact } from './billing';
import { vacancyPath } from './vacancy-navigation';
import type { InvoiceEmail } from './invoice-email';

export type AlertAction = 'confirm' | 'unsubscribe';
export type AlertJob = {
  id: string;
  title: string;
  company: string;
  salary: string;
  city: string;
  group_key: string;
};
export type AlertEmail = InvoiceEmail & { headers?: Record<string, string> };
const uuid = '[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}';

export function alertToken(
  id: string,
  nonce: string,
  action: AlertAction,
  secret: string,
  expires = 0,
) {
  if (secret.length < 32) throw new Error('Alert signing is not configured');
  const value = `${id}.${nonce}.${expires}`;
  return (
    value +
    '.' +
    createHmac('sha256', secret).update(`${action}:${value}`).digest('hex')
  );
}
export function readAlertToken(
  token: string,
  action: AlertAction,
  secret: string,
  now = Date.now(),
) {
  if (
    secret.length < 32 ||
    !new RegExp(`^${uuid}\\.${uuid}\\.\\d{1,13}\\.[a-f0-9]{64}$`).test(token)
  )
    return null;
  const [id, nonce, expiry, signature] = token.split('.');
  const expires = Number(expiry);
  if (action === 'confirm' && (!expires || expires <= now)) return null;
  const expected = alertToken(id, nonce, action, secret, expires)
    .split('.')
    .at(-1)!;
  return timingSafeEqual(
    Buffer.from(signature, 'hex'),
    Buffer.from(expected, 'hex'),
  )
    ? { id, nonce }
    : null;
}
export function alertLink(origin: string, token: string, action: AlertAction) {
  return `${emailOrigin(origin)}/job-alerts?${new URLSearchParams({ action, token })}`;
}
export function confirmationEmail(
  email: string,
  label: string,
  link: string,
  origin: string,
): AlertEmail {
  return {
    from: `ჯობიქსი <${invoiceContact.email}>`,
    to: [email],
    reply_to: invoiceContact.email,
    subject: 'ჯობიქსი — დაადასტურე ვაკანსიების გამოწერა',
    text: `გამოწერის პირობები: ${label}\n\nყოველდღე მიიღებ მხოლოდ ახალ ვაკანსიებს, რომლებიც ამ პირობებს შეესაბამება.\n\nგამოწერის დადასტურება: ${link}\n\nბმული მოქმედებს 24 საათის განმავლობაში. თუ გამოწერა არ მოგითხოვია, წერილს ყურადღება არ მიაქციო.`,
    html: emailLayout(
      origin,
      'დაადასტურე ვაკანსიების გამოწერა',
      label,
      `<p>${escapeEmailHtml(label)}</p><p>ყოველდღე მიიღებ მხოლოდ ახალ ვაკანსიებს, რომლებიც ამ პირობებს შეესაბამება.</p>${emailButton(link, 'გამოწერის დადასტურება')}<p>ბმული მოქმედებს 24 საათის განმავლობაში. თუ გამოწერა არ მოგითხოვია, წერილს ყურადღება არ მიაქციო.</p>`,
      'გამოწერასთან დაკავშირებით დაგვიკავშირდი:',
    ),
  };
}
export function digestEmail(
  email: string,
  label: string,
  jobs: AlertJob[],
  searchUrl: string,
  unsubscribe: string,
  origin: string,
): AlertEmail {
  const lines = jobs.map(
    (j) =>
      `${j.title} — ${j.company}${j.salary ? ' · ' + j.salary : ''}${j.city ? ' · ' + j.city : ''}\n${emailOrigin(origin) + vacancyPath(j)}`,
  );
  const cancel = new URL('/api/job-alerts/manage', emailOrigin(origin));
  cancel.search = new URL(unsubscribe).search;
  return {
    from: `ჯობიქსი <${invoiceContact.email}>`,
    to: [email],
    reply_to: invoiceContact.email,
    subject: `ჯობიქსი — ${jobs.length} ახალი ვაკანსია`,
    headers: {
      'List-Unsubscribe': `<${cancel.href}>`,
      'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
    },
    text: `${label}\n\n${lines.join('\n\n')}\n\nყველა ვაკანსია: ${searchUrl}\n\nგამოწერის გაუქმება: ${unsubscribe}`,
    html: emailLayout(
      origin,
      'ახალი ვაკანსიები',
      label,
      `<p>${escapeEmailHtml(label)}</p>${jobs.map((j) => `<p style="line-height:1.7"><a href="${escapeEmailHtml(emailOrigin(origin) + vacancyPath(j))}"><strong>${escapeEmailHtml(j.title)}</strong></a><br>${escapeEmailHtml([j.company, j.salary, j.city].filter(Boolean).join(' · '))}</p>`).join('')}${emailButton(searchUrl, 'ყველა ვაკანსიის ნახვა')}<p><a href="${escapeEmailHtml(unsubscribe)}">გამოწერის გაუქმება</a></p>`,
      'გამოწერასთან დაკავშირებით დაგვიკავშირდი:',
    ),
  };
}
