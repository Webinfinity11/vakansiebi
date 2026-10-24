import { createHmac, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import { safeEmail } from './application-contact';

export function removalSender(from: string) {
  const address = from.match(/<([^<>]+)>\s*$/)?.[1] || from;
  return safeEmail(address)?.toLowerCase() || null;
}
export function removalHeaders(url: string) {
  const inbox = safeEmail(process.env.REMOVALS_INBOUND_ADDRESS || '');
  return {
    'List-Unsubscribe': `${inbox ? `<mailto:${inbox}?subject=unsubscribe>, ` : ''}<${url}>`,
  };
}

const claimSchema = z.object({
  job: z.uuid(),
  email: z.email(),
  expires: z.number().int(),
});
const secret = () =>
  process.env.REMOVAL_LINK_SECRET || process.env.SESSION_SECRET || '';
export function removalToken(job: string, email: string, now = Date.now()) {
  if (secret().length < 32) return null;
  const claim = claimSchema.parse({
    job,
    email: email.toLowerCase(),
    expires: Math.floor(now / 1000) + 180 * 86400,
  });
  const encoded = Buffer.from(JSON.stringify(claim)).toString('base64url');
  return `${encoded}.${createHmac('sha256', secret()).update(`employer-removal:${encoded}`).digest('base64url')}`;
}
export function readRemovalToken(token: string, now = Date.now()) {
  if (secret().length < 32 || token.length > 2000) return null;
  const [encoded, sig, extra] = token.split('.');
  if (!encoded || !sig || extra) return null;
  const expected = createHmac('sha256', secret())
    .update(`employer-removal:${encoded}`)
    .digest();
  const provided = Buffer.from(sig, 'base64url');
  if (
    provided.length !== expected.length ||
    !timingSafeEqual(provided, expected)
  )
    return null;
  try {
    const claim = claimSchema.parse(
      JSON.parse(Buffer.from(encoded, 'base64url').toString()),
    );
    return claim.expires >= now / 1000 ? claim : null;
  } catch {
    return null;
  }
}
export function removalLink(job: string, email: string, origin: string) {
  const token = removalToken(job, email);
  return token
    ? new URL(`/employer-removal?token=${encodeURIComponent(token)}`, origin)
        .href
    : null;
}

// Only the employer's newly written words count, never our quoted footer.
export function authoredReply(text: string) {
  return text
    .slice(0, 20000)
    .split('\n')
    .reduce<string[]>((lines, line) => {
      if (lines.at(-1) === '\u0000') return lines;
      if (
        /^\s*(?:On .{0,300}wrote:|[-_]{3,}\s*(?:Forwarded|Original)|From:|Begin forwarded message:)/i.test(
          line,
        )
      )
        return [...lines, '\u0000'];
      if (!/^\s*>/.test(line)) lines.push(line);
      return lines;
    }, [])
    .filter((line) => line !== '\u0000')
    .join('\n')
    .trim()
    .slice(0, 4000);
}
export function explicitRemoval(text: string) {
  const own = authoredReply(text).normalize('NFKC').toLowerCase();
  if (
    /\b(?:do not|don't)\s+(?:remove|delete|unsubscribe)|არ\s+(?:წაშალოთ|ამოიღოთ|გააუქმოთ)/u.test(
      own,
    )
  )
    return false;
  return (
    /(?:^|\s)(?:წაშალეთ|ამოიღეთ|გამოგვიწერეთ\s+სიიდან)(?:\s|[,.!?]|$)/u.test(
      own,
    ) ||
    /აღარ\s+(?:განათავსოთ|გამოაქვეყნოთ|გამოიყენოთ)|არ\s+(?:მსურს|გვსურს|მინდა|გვინდა).{0,120}(?:ვაკანსი|განთავს|გამოქვეყნ)/u.test(
      own,
    ) ||
    /^(?:please\s+)?unsubscribe(?:\s+(?:me|us|our company)(?:\s+from\b[^\n]{0,200})?)?[.!\t ]*$/mu.test(
      own,
    ) ||
    /გთხოვთ.{0,120}(?:წაშალოთ|ამოიღოთ)/u.test(own) ||
    /\b(?:remove|delete|take down|stop publishing)\b.{0,100}\b(?:vacanc\w*|jobs?|listings?|advert\w*|posting\w*)\b/iu.test(
      own,
    )
  );
}
export function verifyRemovalWebhook(
  body: string,
  headers: Headers,
  key: string,
  now = Date.now(),
) {
  const id = headers.get('svix-id');
  const stamp = headers.get('svix-timestamp');
  if (
    !id ||
    !stamp ||
    !/^\d+$/.test(stamp) ||
    Math.abs(now / 1000 - Number(stamp)) > 300 ||
    !key.startsWith('whsec_')
  )
    return false;
  const expected = createHmac('sha256', Buffer.from(key.slice(6), 'base64'))
    .update(`${id}.${stamp}.${body}`)
    .digest();
  return (headers.get('svix-signature') || '').split(' ').some((signature) => {
    const [version, value] = signature.split(',');
    if (version !== 'v1' || !value) return false;
    const supplied = Buffer.from(value, 'base64');
    return (
      supplied.length === expected.length && timingSafeEqual(supplied, expected)
    );
  });
}
