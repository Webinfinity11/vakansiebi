import { invoiceContact } from './billing';

export const escapeEmailHtml = (value: string | number) =>
  String(value).replace(
    /[&<>"']/g,
    (c) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[
        c
      ]!,
  );

export function emailOrigin(appUrl: string) {
  const url = new URL(appUrl);
  if (
    url.username ||
    url.password ||
    (url.protocol !== 'https:' &&
      !(
        url.protocol === 'http:' &&
        ['localhost', '127.0.0.1'].includes(url.hostname)
      ))
  )
    throw new Error('Invalid email site URL');
  return url.origin;
}

export function emailButton(url: string, label: string) {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:26px 0 22px"><tr><td bgcolor="#2457e6" style="border-radius:6px"><a href="${escapeEmailHtml(url)}" style="display:inline-block;padding:14px 22px;border:1px solid #2457e6;border-radius:6px;color:#ffffff;text-decoration:none;font-size:14px;font-weight:bold;line-height:22px">${escapeEmailHtml(label)}</a></td></tr></table>`;
}

// Table layout and inline styles keep the message readable in email clients.
// The logo has a public HTTPS URL, fixed dimensions and a readable alt fallback.
export function emailLayout(
  appUrl: string,
  title: string,
  preview: string,
  body: string,
) {
  const origin = emailOrigin(appUrl);
  return `<!doctype html>
<html lang="ka"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>${escapeEmailHtml(title)}</title>
<style>@media only screen and (max-width:480px){.mail-pad{padding-left:22px!important;padding-right:22px!important}.mail-heading{font-size:23px!important}.mail-outer{padding:16px 8px!important}}</style></head>
<body style="margin:0;padding:0;background-color:#f3f5f8;color:#202b3d;font-family:Arial,Helvetica,sans-serif;-webkit-text-size-adjust:100%;">
<div style="display:none;font-size:1px;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;mso-hide:all">${escapeEmailHtml(preview)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="#f3f5f8"><tr><td align="center" class="mail-outer" style="padding:32px 12px">
<!--[if mso]><table role="presentation" width="600"><tr><td><![endif]-->
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="#ffffff" style="max-width:600px;border:1px solid #e2e7ef;border-radius:10px;background-color:#ffffff">
<tr><td class="mail-pad" style="padding:28px 32px 24px;border-bottom:1px solid #e9edf3"><a href="${escapeEmailHtml(origin)}" style="display:inline-block;text-decoration:none"><img src="${escapeEmailHtml(origin)}/brand/jobx.png" alt="JOBX" width="150" height="50" style="display:block;width:150px;height:50px;border:0;color:#202b3d;font-size:28px;font-weight:bold"></a><p style="margin:8px 0 0;font-size:12px;line-height:20px;color:#667287">ვაკანსიები ერთ სივრცეში</p></td></tr>
<tr><td class="mail-pad" style="padding:28px 32px 30px"><h1 class="mail-heading" style="margin:0 0 20px;font-size:25px;line-height:1.5;font-weight:700;color:#202b3d">${escapeEmailHtml(title)}</h1>${body}</td></tr>
<tr><td class="mail-pad" bgcolor="#fafbfd" style="padding:24px 32px;border-top:1px solid #e9edf3;border-radius:0 0 10px 10px"><p style="margin:0 0 10px;font-size:13px;line-height:22px;color:#536078">ინვოისთან ან გადახდასთან დაკავშირებით დაგვირეკეთ:</p><a href="tel:${invoiceContact.telephone}" style="font-size:19px;line-height:28px;font-weight:bold;color:#2457e6;text-decoration:none">${invoiceContact.phone}</a><p style="margin:10px 0 0;font-size:13px;line-height:22px"><a href="mailto:${invoiceContact.email}" style="color:#536078;text-decoration:underline">${invoiceContact.email}</a></p></td></tr>
</table>
<!--[if mso]></td></tr></table><![endif]-->
<p style="margin:18px 0 0;font-size:12px;line-height:20px;color:#738095">JOBX · <a href="${escapeEmailHtml(origin)}" style="color:#536078;text-decoration:none">jobx.ge</a></p>
</td></tr></table></body></html>`;
}
