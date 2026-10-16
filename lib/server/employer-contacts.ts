import { z } from 'zod';
import { companyKey } from '../company-key';
import { safeEmail } from '../application-contact';
import { telephoneNumber } from '../vacancy-details';
import type { EmployerContact } from '../employer-contacts';
import { db, transaction } from './db';
import { ApiError } from './auth';

export async function employerContacts(): Promise<EmployerContact[]> {
  // Native submissions only: the imported public catalogue is not a client list.
  const [submissions, notes] = await Promise.all([
    db()
      .query(`SELECT j.id,j.draft->>'title' AS title,j.draft->>'company' AS company,
      j.draft->'facts' AS facts,j.status,s.created_at,s.notification_email,
      (j.status='published' AND j.published IS NOT NULL AND
        (COALESCE(j.published->>'deadline','')='' OR j.published->>'deadline'>=(now() AT TIME ZONE 'Asia/Tbilisi')::date::text)) AS active,
      e.status AS email_status,e.sent_at AS email_sent_at,i.payload->'to'->>0 AS billing_email
      FROM job_submissions s JOIN jobs j ON j.id=s.job_id
      LEFT JOIN publication_email_delivery e ON e.job_id=j.id
      LEFT JOIN job_invoices inv ON inv.job_id=j.id
      LEFT JOIN invoice_email_delivery i ON i.invoice_id=inv.id
      WHERE NOT s.is_test ORDER BY s.created_at DESC,j.id`),
    db().query('SELECT * FROM employer_contact_notes'),
  ]);
  const records = new Map<string, EmployerContact>();
  const saved = new Map(notes.rows.map((r) => [r.company_key, r]));
  for (const row of submissions.rows) {
    const key = companyKey(row.company || '');
    if (!key) continue;
    const note = saved.get(key);
    const record: EmployerContact = records.get(key) || {
      key,
      company: row.company,
      emails: [],
      phones: [],
      notes: note?.notes || '',
      lastContactedAt: note?.last_contacted_at?.toISOString() || null,
      version: note?.version || 0,
      jobs: [],
    };
    const emails = [row.notification_email, row.billing_email];
    for (const fact of row.facts || []) {
      if (fact.label === 'ელფოსტა CV-სთვის') emails.push(fact.value);
      if (fact.label === 'ტელეფონი') {
        const phone = telephoneNumber(fact.value);
        if (phone && !record.phones.includes(phone)) record.phones.push(phone);
      }
    }
    for (const value of emails) {
      const email = safeEmail(value || '')?.toLowerCase();
      if (email && !record.emails.includes(email)) record.emails.push(email);
    }
    record.jobs.push({
      id: row.id,
      title: row.title,
      status: row.status,
      active: row.active,
      createdAt: row.created_at.toISOString(),
      notificationEmail: row.notification_email,
      emailStatus: row.email_status,
      emailSentAt: row.email_sent_at?.toISOString() || null,
    });
    records.set(key, record);
  }
  return [...records.values()];
}

export async function saveEmployerContact(input: unknown) {
  const data = z
    .object({
      key: z.string().min(1).max(300),
      version: z.number().int().min(0),
      notes: z.string().trim().max(4000),
      contacted: z.boolean().default(false),
    })
    .parse(input);
  return transaction(async (c) => {
    // Do not create arbitrary marketing contacts through this endpoint.
    const companies = await c.query(
      "SELECT DISTINCT j.draft->>'company' AS company FROM job_submissions s JOIN jobs j ON j.id=s.job_id WHERE NOT s.is_test",
    );
    if (!companies.rows.some((r) => companyKey(r.company || '') === data.key))
      throw new ApiError('დამსაქმებელი ვერ მოიძებნა', 404);
    await c.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [
      `employer-contact:${data.key}`,
    ]);
    const existing = (
      await c.query(
        'SELECT * FROM employer_contact_notes WHERE company_key=$1 FOR UPDATE',
        [data.key],
      )
    ).rows[0];
    if ((existing?.version || 0) !== data.version)
      throw new ApiError(
        'ჩანაწერი შეიცვალა. განაახლე სია და სცადე ხელახლა.',
        409,
      );
    const row = (
      await c.query(
        `INSERT INTO employer_contact_notes(company_key,notes,last_contacted_at)
      VALUES($1,$2,CASE WHEN $3 THEN now() ELSE NULL END)
      ON CONFLICT(company_key) DO UPDATE SET notes=EXCLUDED.notes,
        last_contacted_at=CASE WHEN $3 THEN now() ELSE employer_contact_notes.last_contacted_at END,
        version=employer_contact_notes.version+1,updated_at=now()
      RETURNING notes,last_contacted_at,version`,
        [data.key, data.notes, data.contacted],
      )
    ).rows[0];
    return {
      notes: row.notes as string,
      version: row.version as number,
      lastContactedAt: row.last_contacted_at?.toISOString() || null,
    };
  });
}
