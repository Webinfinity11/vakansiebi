import { z } from 'zod';
import { safeEmail } from './application-contact';
import {
  emailLayout,
  emailOrigin,
  emailButton,
  escapeEmailHtml,
} from './email-layout';
import { vacancyPath } from './vacancy-navigation';

/* The letter a company receives when a reader throws a vacancy right on /swipe.
   JOBX sends it from its own address, so the reader needs no mailbox of their
   own; the Reply-To is the reader's address, so an answer still goes straight
   to them. The CV is the attachment, never the body. */
export const swipeSender = 'hr@jobx.ge';

export type SwipeCandidate = { name: string; email: string; phone: string };
export type SwipeApplicationEmail = {
  from: string;
  to: string[];
  reply_to: string;
  subject: string;
  text: string;
  html: string;
  attachments: { filename: string; content: string }[];
};

const clean = (value: string) => value.replace(/\p{Cc}+/gu, ' ').trim();

/* Something a mail client and a file system both accept, keeping Georgian and
   Latin letters; everything else becomes a dash. */
export function cvAttachmentName(candidateName: string) {
  const base = clean(candidateName)
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  return `CV-${base || 'JOBX'}.pdf`;
}

export function swipeApplicationEmail(
  job: { id: string; title: string; company: string },
  candidate: SwipeCandidate,
  recipient: string,
  pdf: Buffer | Uint8Array,
  appUrl: string,
): SwipeApplicationEmail {
  const to = safeEmail(recipient);
  const replyTo = safeEmail(candidate.email);
  if (!to || !replyTo || !z.uuid().safeParse(job.id).success)
    throw new Error('Invalid application email');
  const origin = emailOrigin(appUrl);
  const url = new URL(vacancyPath(job), origin).href;
  const name = clean(candidate.name).slice(0, 120) || 'კანდიდატი';
  const phone = clean(candidate.phone).slice(0, 32);
  const title = clean(job.title).slice(0, 200) || 'ვაკანსია';
  const company = clean(job.company).slice(0, 200);
  const heading = `განაცხადი ვაკანსიაზე „${title}“`;
  const rows: [string, string][] = [
    ['ვაკანსია', company ? `${title} — ${company}` : title],
    ['კანდიდატი', name],
    ['ელფოსტა', replyTo],
    ...(phone ? ([['ტელეფონი', phone]] as [string, string][]) : []),
  ];
  const note =
    'CV დანართშია. კანდიდატს პასუხი პირდაპირ მისწერეთ — ამ წერილზე პასუხი (Reply) მის ელფოსტაზე მივა.';
  return {
    from: `JOBX <${swipeSender}>`,
    to: [to],
    reply_to: replyTo,
    subject: `განაცხადი: ${title} — ${name}`,
    text: [
      'გამარჯობა!',
      `${name} განაცხადს აკეთებს თქვენს ვაკანსიაზე „${title}“${company ? ` (${company})` : ''}, რომელიც JOBX-ზეა განთავსებული.`,
      ...rows.map(([label, value]) => `${label}: ${value}`),
      `ვაკანსია JOBX-ზე: ${url}`,
      note,
      'წერილი გაგზავნილია JOBX-ის (jobx.ge) მეშვეობით კანდიდატის თანხმობით.',
    ].join('\n\n'),
    html: emailLayout(
      origin,
      heading,
      `${name} — CV ვაკანსიაზე „${title}“`,
      `<p style="margin:0 0 18px;font-size:14px;line-height:24px;color:#536078">გამარჯობა! <strong>${escapeEmailHtml(name)}</strong> განაცხადს აკეთებს თქვენს ვაკანსიაზე, რომელიც JOBX-ზეა განთავსებული.</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:18px;border:1px solid #dce6fa;border-radius:6px" bgcolor="#f2f6ff">${rows
        .map(
          ([label, value]) =>
            `<tr><td style="padding:10px 16px;font-size:12px;line-height:20px;color:#536078;white-space:nowrap;vertical-align:top">${escapeEmailHtml(label)}</td><td style="padding:10px 16px;font-size:14px;line-height:20px;color:#202b3d;word-break:break-word">${escapeEmailHtml(value)}</td></tr>`,
        )
        .join('')}</table>
<p style="margin:0;font-size:14px;line-height:24px;color:#202b3d">${escapeEmailHtml(note)}</p>${emailButton(url, 'ვაკანსიის ნახვა JOBX-ზე')}<p style="margin:0;font-size:12px;line-height:20px;color:#738095">წერილი გაგზავნილია JOBX-ის მეშვეობით კანდიდატის თანხმობით. თუ ეს ვაკანსია თქვენი არ არის, უბრალოდ უგულებელყავით.</p>`,
      'JOBX-თან დაკავშირებით დაგვიკავშირდით:',
      swipeSender,
    ),
    attachments: [
      {
        filename: cvAttachmentName(name),
        content: Buffer.from(pdf).toString('base64'),
      },
    ],
  };
}
