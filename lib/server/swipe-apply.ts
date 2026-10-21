import { createHash } from 'node:crypto';
import { z } from 'zod';
import { db } from './db';
import { ApiError } from './auth';
import { getVacancyPage } from './vacancy-page';
import { renderCvPdf } from './cv-pdf';
import { cvSchema, type Cv } from '../cv';
import { safeEmail } from '../application-contact';
import { vacancyContacts } from '../vacancy-details';
import { swipeApplicationEmail } from '../swipe-apply-email';

/* A CV thrown right on /swipe leaves JOBX's own mailbox for the vacancy's
   application address. The address is read again here from the published
   vacancy, never taken from the client; outside production every letter goes
   to Resend's delivery sink so no company ever hears from a dev server. */

export const maxUploadBytes = 4_000_000;
export const maxCvJsonBytes = 600_000;
export const dailyCandidateLimit = 20;
export const dailyClientLimit = 40;
export const resendSink = 'delivered@resend.dev';

export const swipeApplyEnabled = () => !!process.env.RESEND_API_KEY;

export function swipeRecipient(vacancyEmail: string) {
  const override = safeEmail(process.env.SWIPE_APPLY_TO || '');
  if (override) return override;
  return process.env.NODE_ENV === 'production' ? vacancyEmail : resendSink;
}

const sha256 = (value: string) =>
  createHash('sha256').update(value).digest('hex');

const fields = z.object({
  job: z.uuid(),
  name: z.string().trim().min(1).max(120),
  email: z
    .string()
    .trim()
    .max(254)
    .refine((value) => !!safeEmail(value)),
  phone: z.string().trim().max(32).default(''),
  resume: z.uuid().optional(),
});
export type SwipeForm = z.infer<typeof fields> & {
  cv: { kind: 'upload'; pdf: Uint8Array } | { kind: 'jobx'; cv: Cv };
};

const isPdf = (bytes: Uint8Array) =>
  bytes.length > 5 &&
  bytes[0] === 0x25 &&
  bytes[1] === 0x50 &&
  bytes[2] === 0x44 &&
  bytes[3] === 0x46 &&
  bytes[4] === 0x2d;

export async function readSwipeForm(request: Request): Promise<SwipeForm> {
  if (
    Number(request.headers.get('content-length')) >
    maxUploadBytes + maxCvJsonBytes
  )
    throw new ApiError('ფაილი მეტისმეტად დიდია', 413);
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    throw new ApiError('არასწორი მოთხოვნა');
  }
  const text = (key: string) => {
    const value = form.get(key);
    return typeof value === 'string' ? value : undefined;
  };
  const parsed = fields.parse({
    job: text('job'),
    name: text('name'),
    email: text('email'),
    phone: text('phone') ?? '',
    resume: text('resume') || undefined,
  });
  const file = form.get('file');
  if (file && typeof file !== 'string') {
    if (file.size > maxUploadBytes)
      throw new ApiError('PDF 4 მბ-ზე დიდია — უფრო პატარა ფაილი ატვირთე', 413);
    const pdf = new Uint8Array(await file.arrayBuffer());
    if (!isPdf(pdf)) throw new ApiError('ატვირთული ფაილი PDF არ არის');
    return { ...parsed, cv: { kind: 'upload', pdf } };
  }
  const raw = text('cv');
  if (!raw) throw new ApiError('CV არ არის მიმაგრებული');
  if (raw.length > maxCvJsonBytes)
    throw new ApiError('მონაცემები მეტისმეტად დიდია', 413);
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    throw new ApiError('არასწორი მოთხოვნა');
  }
  return { ...parsed, cv: { kind: 'jobx', cv: cvSchema.parse(json) } };
}

type Sent = { id: string; to: string };

export async function sendSwipeApplication(
  form: SwipeForm,
  clientKey: string,
): Promise<Sent> {
  const job = await getVacancyPage(form.job);
  if (!job) throw new ApiError('ეს ვაკანსია აღარ არის ან ვადა გაუვიდა', 404);
  const vacancyEmail = vacancyContacts(job).emails[0]?.email;
  if (!vacancyEmail)
    throw new ApiError('ამ ვაკანსიას განაცხადის ელფოსტა არ აქვს', 422);
  const recipient = swipeRecipient(vacancyEmail);
  const candidateEmail = safeEmail(form.email)!;
  const candidateKey = sha256(candidateEmail.toLowerCase());
  const clientHash = sha256(clientKey);

  const usage = (
    await db().query<{ mine: number; client: number }>(
      `SELECT
         (SELECT count(*)::int FROM swipe_applications
           WHERE candidate_key=$1 AND status<>'failed' AND created_at>now()-interval '24 hours') AS mine,
         (SELECT count(*)::int FROM swipe_applications
           WHERE client_hash=$2 AND status<>'failed' AND created_at>now()-interval '24 hours') AS client`,
      [candidateKey, clientHash],
    )
  ).rows[0];
  if (usage.mine >= dailyCandidateLimit)
    throw new ApiError(
      `დღეში ${dailyCandidateLimit} CV-ის გაგზავნა შეიძლება — დანარჩენი ხვალ`,
      429,
    );
  if (usage.client >= dailyClientLimit)
    throw new ApiError('დღევანდელი ლიმიტი ამოიწურა — სცადე ხვალ', 429);

  // The row is the lock: a second throw at the same vacancy finds it and stops.
  const row = (
    await db().query<{ id: string }>(
      `INSERT INTO swipe_applications
         (job_id,candidate_key,candidate_name,candidate_email,candidate_phone,client_hash,resume_id,cv_kind,recipient)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)
       ON CONFLICT (job_id,candidate_key) WHERE status<>'failed' DO NOTHING
       RETURNING id`,
      [
        job.id,
        candidateKey,
        form.name,
        candidateEmail,
        form.phone,
        clientHash,
        form.resume ?? null,
        form.cv.kind,
        recipient,
      ],
    )
  ).rows[0];
  if (!row) throw new ApiError('ამ ვაკანსიაზე შენი CV უკვე გაგზავნილია', 409);

  const fail = async (error: string) => {
    await db()
      .query(
        "UPDATE swipe_applications SET status='failed',last_error=$2 WHERE id=$1",
        [row.id, error],
      )
      .catch(() => {});
  };
  let pdf: Uint8Array;
  try {
    pdf =
      form.cv.kind === 'upload' ? form.cv.pdf : await renderCvPdf(form.cv.cv);
  } catch {
    await fail('pdf_failed');
    throw new ApiError('CV-ის PDF ვერ აიწყო — სცადე მზა PDF-ის ატვირთვა', 500);
  }
  const payload = swipeApplicationEmail(
    job,
    { name: form.name, email: candidateEmail, phone: form.phone },
    recipient,
    pdf,
    process.env.APP_URL || 'https://jobx.ge',
  );
  let providerId: string | undefined;
  let error = 'network_error';
  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': `jobx-swipe/${row.id}`,
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(20000),
    });
    const result = await response.json().catch(() => ({}));
    if (response.ok && typeof result.id === 'string') providerId = result.id;
    else error = `provider_${response.status}`;
  } catch {
    // Never log the recipient, the candidate or the provider's body.
  }
  if (!providerId) {
    await fail(error);
    throw new ApiError('წერილი ვერ გაიგზავნა — სცადე ხელახლა', 502);
  }
  await db()
    .query(
      "UPDATE swipe_applications SET status='sent',provider_id=$2,sent_at=now() WHERE id=$1",
      [row.id, providerId],
    )
    .catch(() => {});
  return { id: row.id, to: recipient };
}
