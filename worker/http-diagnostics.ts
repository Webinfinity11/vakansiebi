import { load } from 'cheerio';

export function diagnosticStatus(status: number) {
  return status === 403 || status === 429 || (status >= 500 && status <= 599);
}

/** Error-page text only: no scripts, attributes, forms, URLs or credential values. */
function safeBody(body: string) {
  let text = body;
  for (const [key, value] of Object.entries(process.env)) {
    if (
      /TOKEN|SECRET|PASSWORD|PRIVATE_KEY|API_KEY|DATABASE_URL/i.test(key) &&
      value &&
      value.length >= 8
    )
      text = text.replaceAll(value, '[redacted]');
  }
  const $ = load(text);
  $('script,style,noscript,template,input,textarea,select,meta').remove();
  text = $.root().text();
  // HTML entities may have concealed a reflected credential before text extraction.
  for (const [key, value] of Object.entries(process.env)) {
    if (
      /TOKEN|SECRET|PASSWORD|PRIVATE_KEY|API_KEY|DATABASE_URL/i.test(key) &&
      value &&
      value.length >= 8
    )
      text = text.replaceAll(value, '[redacted]');
  }
  text = text
    .replace(
      /\b(?:authorization|set-cookie|cookie)\s*["']?\s*[:=][^\r\n]*/gi,
      '[redacted]',
    )
    .replace(
      /\b(?:[\w-]*(?:token|secret|password|api[_-]?key|private[_-]?key))\s*["']?\s*[:=]\s*(?:"[^"]*"|'[^']*'|[^\s,;}]+)/gi,
      '[redacted]',
    )
    .replace(/\b(?:Bearer|Basic)\s+[^\s<>"']+/gi, '[redacted]')
    .replace(/https?:\/\/[^\s<>"']+/gi, '[url]')
    .replace(/\b[A-Za-z0-9_+./=-]{32,}\b/g, '[redacted]')
    .replace(/[\s\p{Cc}]+/gu, '');
  return Array.from(text).slice(0, 200).join('');
}

/** A bounded suffix fits the existing 500-character run/item error storage. */
export function httpDiagnostic(status: number, headers: Headers, body: string) {
  if (!diagnosticStatus(status)) return '';
  const server = headers.get('server') || '';
  const ray = headers.get('cf-ray') || '';
  const type = (headers.get('content-type') || '').split(';')[0];
  const fields = {
    status,
    server: /^[a-zA-Z0-9 ._/-]{1,24}$/.test(server) ? server : null,
    'cf-mitigated':
      headers.get('cf-mitigated') === 'challenge' ? 'challenge' : null,
    'cf-ray': /^[a-f0-9]{8,24}-[A-Z]{3}$/i.test(ray) ? ray : null,
    'content-type': /^[a-zA-Z0-9!#$&^_.+-]+\/[a-zA-Z0-9!#$&^_.+-]+$/.test(type)
      ? type.slice(0, 48)
      : null,
    body: safeBody(body),
  };
  let encoded = JSON.stringify(fields);
  while (encoded.length > 420) {
    fields.body = Array.from(fields.body).slice(0, -1).join('');
    encoded = JSON.stringify(fields);
  }
  return ' ' + encoded;
}
