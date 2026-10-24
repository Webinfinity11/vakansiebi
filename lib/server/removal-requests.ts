import { randomUUID } from 'node:crypto';
import { load } from 'cheerio';
import { z } from 'zod';
import { safeEmail } from '../application-contact';
import {
  authoredReply,
  explicitRemoval,
  removalSender,
} from '../employer-opt-out';
import { emailLayout } from '../email-layout';
import { db, transaction } from './db';
import { ApiError } from './auth';
import { suppressEmployer } from './employer-removals';
import { clearPublicJobsCache } from './jobs';

export async function employerNamesForEmail(email: string) {
  const rows = (
    await db().query(
      `SELECT DISTINCT j.draft->>'company' name FROM jobs j WHERE
      $1 IN (SELECT lower(m[1]) FROM regexp_matches(j.draft::text,
        '[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+[.][A-Za-z]{2,}','g') m)
      OR EXISTS(SELECT 1 FROM swipe_applications a WHERE a.job_id=j.id AND lower(a.recipient)=$1)
      OR EXISTS(SELECT 1 FROM job_submissions s WHERE s.job_id=j.id AND lower(s.notification_email)=$1)
      UNION SELECT unnest(company_names) FROM employer_suppressions WHERE email=$1`,
      [email],
    )
  ).rows;
  return [
    ...new Set(rows.map((r: { name: string }) => r.name).filter(Boolean)),
  ].slice(0, 20);
}

function confirmationEmail(email: string, messageId: string | null) {
  const text =
    'გამარჯობა,\n\nთქვენი მოთხოვნა შესრულებულია: თქვენი კომპანიის ვაკანსიები JOBX-დან ამოღებულია. ისინი აღარ გამოჩნდება ძიებაში და მათზე განაცხადების გაგზავნა შეჩერებულია.\n\nთქვენი კომპანიის ახალი ვაკანსიებიც აღარ განთავსდება ჩვენს პლატფორმაზე. ბლოკირებას მხოლოდ თქვენი თანხმობის შემდეგ მოვხსნით.\n\nპატივისცემით,\nJOBX-ის გუნდი';
  return {
    from: 'JOBX <hr@jobx.ge>',
    to: [email],
    reply_to: 'hr@jobx.ge',
    subject: 'JOBX — თქვენი ვაკანსიები ამოღებულია',
    text,
    html: emailLayout(
      process.env.APP_URL || 'https://jobx.ge',
      'თქვენი მოთხოვნა შესრულებულია',
      'თქვენი კომპანიის ვაკანსიები ამოღებულია',
      `<p style="line-height:1.8">თქვენი კომპანიის ვაკანსიები JOBX-დან ამოღებულია. ისინი აღარ გამოჩნდება ძიებაში და მათზე განაცხადების გაგზავნა შეჩერებულია.</p><p style="line-height:1.8">თქვენი კომპანიის ახალი ვაკანსიებიც აღარ განთავსდება ჩვენს პლატფორმაზე. ბლოკირებას მხოლოდ თქვენი თანხმობის შემდეგ მოვხსნით.</p>`,
    ),
    ...(messageId
      ? { headers: { 'In-Reply-To': messageId, References: messageId } }
      : {}),
  };
}

export async function approveRemovalRequest(id: string, actor = 'admin') {
  const result = await transaction(async (c) => {
    const row = (
      await c.query(
        'SELECT * FROM employer_removal_requests WHERE id=$1 FOR UPDATE',
        [z.uuid().parse(id)],
      )
    ).rows[0];
    if (!row) throw new ApiError('მოთხოვნა ვერ მოიძებნა', 404);
    if (row.status === 'removed') return { id: row.id, removed: true };
    if (row.status !== 'review')
      throw new ApiError('მოთხოვნა უკვე დამუშავებულია');
    if (!row.company_names.length)
      throw new ApiError(
        'გამგზავნი ვაკანსიას ვერ დაუკავშირდა — კომპანია ხელით გადაამოწმე და დაბლოკე',
      );
    const suppression = await suppressEmployer(
      {
        email: row.sender,
        companyNames: row.company_names,
        reason: 'დამსაქმებლის მოთხოვნით',
        evidence: row.excerpt,
      },
      actor,
      c,
    );
    await c.query(
      `UPDATE employer_removal_requests SET status='removed',suppression_id=$2,processed_at=now(),
      confirmation=$3,confirmation_status='pending',note='ვაკანსიები ამოღებულია; მომავალი იმპორტი დაბლოკილია' WHERE id=$1`,
      [row.id, suppression.id, confirmationEmail(row.sender, row.message_id)],
    );
    return { id: row.id as string, removed: true };
  });
  clearPublicJobsCache();
  return result;
}

export async function recordRemovalRequest(input: {
  sourceId: string;
  messageId?: string;
  sender: string;
  source: 'email' | 'link' | 'admin';
  subject?: string;
  text: string;
  authenticated: boolean;
  companyNames?: string[];
}) {
  const sender = safeEmail(input.sender)?.toLowerCase();
  if (!sender) throw new ApiError('გამგზავნის მისამართი არასწორია');
  const excerpt = authoredReply(input.text || input.subject || '');
  const unsubscribeSubject = /^(?:re:\s*)?unsubscribe(?:\s+jobx)?\s*$/i.test(
    input.subject || '',
  );
  const explicit =
    input.source !== 'email' ||
    explicitRemoval(input.text) ||
    (unsubscribeSubject && !authoredReply(input.text));
  const review =
    explicit ||
    unsubscribeSubject ||
    /წაშ|ამოიღ|თანხმობ|unsubscribe|remove|delete|permission|consent/iu.test(
      excerpt,
    );
  const names = review
    ? input.companyNames || (await employerNamesForEmail(sender))
    : [];
  const created = (
    await db().query(
      `INSERT INTO employer_removal_requests(id,source_id,message_id,sender,source,subject,excerpt,company_names,status,note)
     VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) ON CONFLICT DO NOTHING RETURNING id`,
      [
        randomUUID(),
        input.sourceId,
        input.messageId || null,
        sender,
        input.source,
        (input.subject || '').slice(0, 500),
        excerpt,
        names,
        review ? 'review' : 'ignored',
        !review
          ? 'ამოღების მოთხოვნა არ არის'
          : !explicit
            ? 'მოთხოვნის მნიშვნელობა შესამოწმებელია'
            : !input.authenticated
              ? 'გამგზავნის ავთენტურობა შესამოწმებელია'
              : !names.length
                ? 'გამგზავნი ცნობილ დამსაქმებელს ვერ დაუკავშირდა'
                : 'მოთხოვნა მიღებულია',
      ],
    )
  ).rows[0];
  const row =
    created ||
    (
      await db().query(
        'SELECT id FROM employer_removal_requests WHERE source_id=$1 OR message_id=$2',
        [input.sourceId, input.messageId || null],
      )
    ).rows[0];
  if (!row) throw new ApiError('მოთხოვნა ვერ შეინახა', 503);
  if (explicit && input.authenticated && names.length)
    await approveRemovalRequest(
      row.id,
      input.source === 'email'
        ? 'email-automation'
        : input.source === 'link'
          ? 'employer-link'
          : 'admin',
    );
  return { id: row.id as string };
}

export async function processReceivedRemoval(
  emailId: string,
  envelopeTo: string[] = [],
) {
  const key = process.env.RESEND_REMOVALS_API_KEY;
  if (!key)
    throw new ApiError('შემომავალი ფოსტის კავშირი არ არის გამართული', 503);
  const response = await fetch(
    `https://api.resend.com/emails/receiving/${z.uuid().parse(emailId)}?html_format=cid`,
    {
      headers: { Authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(10000),
    },
  );
  if (!response.ok)
    throw new ApiError('შემომავალი წერილი დროებით მიუწვდომელია', 503);
  const mail = await response.json();
  const mailbox = process.env.REMOVALS_INBOUND_ADDRESS?.toLowerCase();
  if (
    !mailbox ||
    ![...(mail.to || []), ...(mail.received_for || []), ...envelopeTo].some(
      (to: string) => to.toLowerCase() === mailbox,
    )
  )
    return { ignored: true };
  const sender = removalSender(String(mail.from || ''));
  if (!sender) return { ignored: true };
  // Authentication comes from the provider's receiving server, not a forgeable message header.
  const authenticated =
    mail.authentication?.dmarc === 'pass' ||
    mail.authentication?.dkim === 'pass';
  const text =
    typeof mail.text === 'string'
      ? mail.text
      : load(String(mail.html || '').slice(0, 200000)).text();
  return recordRemovalRequest({
    sourceId: `resend:${emailId}`,
    messageId: mail.message_id,
    sender,
    source: 'email',
    subject: mail.subject,
    text,
    authenticated,
  });
}

export async function deliverRemovalConfirmations(id?: string, limit = 3) {
  const key = process.env.RESEND_API_KEY || process.env.RESEND_REMOVALS_API_KEY;
  if (!key) return { sent: 0, failed: 0, disabled: true };
  let sent = 0,
    failed = 0;
  for (let i = 0; i < Math.min(limit, 5); i++) {
    const row = (
      await db().query(
        `WITH candidate AS (
      SELECT id FROM employer_removal_requests WHERE status='removed' AND confirmation IS NOT NULL
        AND confirmation_status IN ('pending','sending') AND next_attempt_at<=now()
        AND (locked_until IS NULL OR locked_until<now()) AND ($1::uuid IS NULL OR id=$1)
      ORDER BY created_at LIMIT 1 FOR UPDATE SKIP LOCKED
    ) UPDATE employer_removal_requests r SET confirmation_status='sending',attempts=attempts+1,
      first_attempt_at=coalesce(first_attempt_at,now()),locked_until=now()+interval '1 minute'
      FROM candidate c WHERE r.id=c.id RETURNING r.id,r.confirmation,r.attempts,
        r.first_attempt_at<now()-interval '23 hours' AS expired`,
        [id || null],
      )
    ).rows[0];
    if (!row) break;
    if (row.expired) {
      await db().query(
        "UPDATE employer_removal_requests SET confirmation_status='failed',locked_until=NULL,last_error='idempotency_window_expired' WHERE id=$1",
        [row.id],
      );
      failed++;
      continue;
    }
    try {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${key}`,
          'Content-Type': 'application/json',
          'Idempotency-Key': `jobx-removal/${row.id}`,
        },
        body: JSON.stringify(row.confirmation),
        signal: AbortSignal.timeout(10000),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || typeof result.id !== 'string')
        throw new Error(`provider_${response.status}`);
      await db().query(
        "UPDATE employer_removal_requests SET confirmation_status='sent',provider_id=$2,confirmed_at=now(),locked_until=NULL,last_error=NULL WHERE id=$1",
        [row.id, result.id],
      );
      sent++;
    } catch (error) {
      await db().query(
        `UPDATE employer_removal_requests SET confirmation_status='pending',locked_until=NULL,
        last_error=$2,next_attempt_at=now()+interval '1 minute' WHERE id=$1`,
        [row.id, error instanceof Error ? error.message : 'network_error'],
      );
      failed++;
    }
  }
  return { sent, failed, disabled: false };
}
