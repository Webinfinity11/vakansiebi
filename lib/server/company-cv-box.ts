import { createHash } from 'node:crypto';
import { z } from 'zod';
import { cvMissingForSending, cvNotReadyMessage, cvSchema } from '../cv';
import { ApiError } from './auth';
import { db } from './db';
import { renderCvPdf } from './cv-pdf';
import { uploadCandidate } from './company-candidates';

export async function cvBoxCompany(keys: string[]) {
  if (process.env.COMPANY_PORTAL_ENABLED !== 'true') return null;
  const { rows } = await db().query(
    `SELECT p.company_key,p.name FROM company_profiles p
    WHERE p.company_key=ANY($1) AND p.cv_box_enabled AND p.approval_status='approved'
    AND EXISTS(SELECT 1 FROM company_accounts a WHERE a.company_key=p.company_key AND a.enabled AND a.email_verified AND NOT a.must_change_password)
    ORDER BY p.updated_at DESC LIMIT 1`,
    [keys],
  );
  return (rows[0] as { company_key: string; name: string } | undefined) ?? null;
}
export async function submitCvBox(form: FormData, client: string) {
  const key = z.string().min(1).max(300).parse(form.get('company'));
  if (form.get('consent') !== 'on')
    throw new ApiError('რეზიუმეს გასაგზავნად თანხმობა აუცილებელია.');
  const company = await cvBoxCompany([key]);
  if (!company)
    throw new ApiError('კომპანია რეზიუმეებს ამჟამად არ იღებს.', 404);
  const identity = z
    .object({
      name: z.string().trim().min(1).max(120),
      email: z.email().max(254),
      phone: z.string().trim().max(32),
    })
    .parse(
      Object.fromEntries(
        ['name', 'email', 'phone'].map((k) => [k, form.get(k) ?? '']),
      ),
    );
  let file = form.get('file');
  if (!(file instanceof File) || !file.size) {
    const raw = form.get('cv');
    if (typeof raw !== 'string' || raw.length > 600000)
      throw new ApiError('მიუთითეთ რეზიუმე.');
    let cv;
    try {
      cv = cvSchema.parse(JSON.parse(raw));
    } catch {
      throw new ApiError('რეზიუმეს მონაცემები არასწორია.');
    }
    const missing = cvMissingForSending(cv);
    if (missing.length) throw new ApiError(cvNotReadyMessage(missing, true));
    file = new File(
      [Uint8Array.from(await renderCvPdf(cv)).buffer],
      'JOBX-CV.pdf',
      { type: 'application/pdf' },
    );
  }
  if (!(file instanceof File) || !/\.(pdf|docx)$/i.test(file.name))
    throw new ApiError('ატვირთეთ PDF ან DOCX.');
  const upload = new FormData();
  upload.set('file', file);
  for (const [k, v] of Object.entries(identity)) upload.set(k, v);
  return uploadCandidate({ companyKey: key }, upload, {
    source: 'cv_box',
    clientHash: createHash('sha256')
      .update('cv-box:' + client)
      .digest('hex'),
  });
}
