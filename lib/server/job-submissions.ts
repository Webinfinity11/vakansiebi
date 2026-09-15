import { createInvoice } from './billing';
import { createHash, createHmac, randomUUID } from 'node:crypto';
import type { PoolClient } from 'pg';
import { db, transaction } from './db';
import { ApiError } from './auth';
import { submissionSchema, submissionVacancy } from '../job-submission';
import { vacancySchema } from '../vacancy-schema';
import { fingerprint } from '../../worker/adapters';
import { classify } from '../../worker/categories';
import { readSubmissionLogo, storeSubmissionLogo } from './submission-logos';

export async function priorSubmission(
  requestId: string,
  c?: PoolClient,
): Promise<{
  id: string;
  received: true;
  alreadyReceived: true;
  invoiceUrl?: string;
} | null> {
  const client = c ?? db();
  const prior = (
    await client.query(
      'SELECT job_id,payload_hash FROM job_submissions WHERE request_id=$1',
      [requestId],
    )
  ).rows[0];
  if (!prior) return null;
  const invoice = (
    await client.query('SELECT token FROM job_invoices WHERE job_id=$1', [
      prior.job_id,
    ])
  ).rows[0];
  return {
    id: prior.job_id as string,
    received: true,
    alreadyReceived: true,
    ...(invoice ? { invoiceUrl: `/invoices/${invoice.token}` } : {}),
  };
}

export async function submitJob(
  input: unknown,
  client: string,
): Promise<{
  id: string;
  received: true;
  alreadyReceived?: true;
  invoiceUrl?: string;
}> {
  const data = submissionSchema.parse(input);
  if (data.fax) return { id: randomUUID(), received: true };
  const logo = await readSubmissionLogo(data.logo);
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32)
    throw new Error('Submission protection is not configured');
  // Shared, transactional quota across server instances. Raw network addresses are not stored.
  const clientHash = createHmac('sha256', secret)
    .update(`job-submission:${client}`)
    .digest('hex');
  const payloadHash = createHash('sha256')
    .update(JSON.stringify(data))
    .digest('hex');
  return transaction(async (c) => {
    // Serialize retries first, then the per-client quota. Both locks live only for this transaction.
    await c.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [
      `submission:${data.requestId}`,
    ]);
    const prior = await priorSubmission(data.requestId, c);
    if (prior) {
      // Submitted jobs cannot be edited: keep the first accepted version and silently
      // discard retry changes. The client explains this through alreadyReceived.
      return prior;
    }
    await c.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [
      `submission-client:${clientHash}`,
    ]);
    const count = (
      await c.query(
        "SELECT count(*) FILTER(WHERE created_at>now()-interval '1 hour')::int hourly,count(*)::int daily FROM job_submissions WHERE client_hash=$1 AND created_at>now()-interval '1 day'",
        [clientHash],
      )
    ).rows[0];
    if (count.hourly >= 5 || count.daily >= 20)
      throw new ApiError(
        'ამ დროისთვის განცხადებების ლიმიტი ამოიწურა. სცადე მოგვიანებით.',
        429,
      );
    const id = randomUUID();
    const logoUrl = await storeSubmissionLogo(c, logo);
    const draft = vacancySchema.parse({
      ...submissionVacancy(data, id, logoUrl),
      category: data.category || classify(data.title),
    });
    await c.query(
      `INSERT INTO jobs(id,draft,status,needs_review,fingerprint,automation_managed,automation_paused,automation_reason)
      VALUES($1,$2,'pending',true,$3,false,true,'employer_submission')`,
      [id, draft, fingerprint(draft)],
    );
    await c.query(
      `INSERT INTO source_items(id,source_id,external_id,url,job_id,raw,next_check_at)
      VALUES($1,'jobx',$2::text,$3,$2::text::uuid,$4,'infinity')`,
      [randomUUID(), id, draft.url, draft],
    );
    await c.query(
      'INSERT INTO job_submissions(request_id,job_id,client_hash,payload_hash,requested_placement) VALUES($1,$2,$3,$4,$5)',
      [data.requestId, id, clientHash, payloadHash, data.placement],
    );
    await c.query(
      "INSERT INTO audit_log(job_id,action,actor,after_data) VALUES($1,'submission.received','employer',$2)",
      [id, { consent: true, policy: 'public-contact-v1' }],
    );
    const invoiceUrl =
      data.placement === 'premium'
        ? await createInvoice(c, {
            id,
            company: draft.company,
            title: draft.title,
            billingEmail: data.billingEmail,
          })
        : undefined;
    return { id, received: true, ...(invoiceUrl ? { invoiceUrl } : {}) };
  });
}
