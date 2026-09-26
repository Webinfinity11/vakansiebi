import { createHash } from 'node:crypto';
import sharp from 'sharp';
import { z } from 'zod';
import { cvSchema, emptyCv, type Cv } from '../cv';
import { maxPhotoBytes } from '../cv-photo';
import { db } from './db';
import { ApiError } from './auth';

export const resumeIdentity = z.object({ id: z.uuid(), token: z.uuid() });
export const resumeInput = resumeIdentity.extend({
  cv: cvSchema.omit({ photo: true }),
  // Oversized/invalid photos are discarded, never rejected with the CV text.
  photo: z.unknown().optional(),
});
export const maxResumeBodyBytes = 600000;

export async function readResumeBody(request: Request) {
  if (Number(request.headers.get('content-length')) > maxResumeBodyBytes)
    throw new ApiError('მონაცემები მეტისმეტად დიდია', 413);
  const reader = request.body?.getReader();
  if (!reader) throw new ApiError('არასწორი მოთხოვნა');
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxResumeBodyBytes) {
        await reader.cancel();
        throw new ApiError('მონაცემები მეტისმეტად დიდია', 413);
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw new ApiError('არასწორი მოთხოვნა');
  }
}

export async function resumePhoto(value: unknown): Promise<Buffer | null> {
  if (typeof value !== 'string' || value.length > 170000) return null;
  const match =
    /^data:image\/(?:jpeg|webp|png);base64,([A-Za-z0-9+/]+={0,2})$/.exec(value);
  if (!match) return null;
  const bytes = Buffer.from(match[1], 'base64');
  if (bytes.length > maxPhotoBytes) return null;
  try {
    const photo = await sharp(bytes, { limitInputPixels: 16000000 })
      .rotate()
      .resize(512, 512, { fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 80 })
      .toBuffer();
    return photo.length <= maxPhotoBytes ? photo : null;
  } catch {
    return null;
  }
}

const tokenHash = (token: string) =>
  createHash('sha256').update(token).digest('hex');

export async function saveResume(input: unknown) {
  const data = resumeInput.parse(input);
  const photo = await resumePhoto(data.photo);
  const result = await db().query(
    `INSERT INTO resumes(id,delete_token_hash,cv,photo) VALUES($1,$2,$3,$4)
     ON CONFLICT(id) DO UPDATE SET cv=EXCLUDED.cv, photo=EXCLUDED.photo,
       updated_at=now(), expires_at=now()+interval '12 months'
     WHERE resumes.delete_token_hash=EXCLUDED.delete_token_hash RETURNING id`,
    [data.id, tokenHash(data.token), data.cv, photo],
  );
  if (!result.rowCount) throw new ApiError('მოთხოვნა დაუშვებელია', 403);
  return data.id;
}

export async function deleteResume(input: unknown) {
  const { id, token } = resumeIdentity.parse(input);
  await db().query('DELETE FROM resumes WHERE id=$1 AND delete_token_hash=$2', [
    id,
    tokenHash(token),
  ]);
}

export const resumeContactInput = resumeIdentity.extend({
  job: z.uuid(),
  kind: z.enum(['cv', 'call', 'apply']),
});
/* Ties a JOBX-built CV to one of our own vacancies when its holder presses send-CV, call or
   apply there. The delete token proves the CV is the reader's; any other vacancy, a test
   submission or an unknown CV records nothing and says nothing, so the answer never tells a
   caller which vacancies or CVs exist. */
export async function recordResumeContact(input: unknown) {
  const { id, token, job, kind } = resumeContactInput.parse(input);
  await db().query(
    `INSERT INTO resume_contacts(job_id,resume_id,kind)
     SELECT s.job_id,r.id,$4 FROM resumes r
     JOIN job_submissions s ON s.job_id=$3 AND NOT s.is_test
     WHERE r.id=$1 AND r.delete_token_hash=$2 AND r.expires_at>now()
     ON CONFLICT (job_id,resume_id,kind)
       DO UPDATE SET presses=resume_contacts.presses+1,last_at=now()`,
    [id, tokenHash(token), job, kind],
  );
}

export async function purgeResumes() {
  return (
    (await db().query('DELETE FROM resumes WHERE expires_at <= now()'))
      .rowCount ?? 0
  );
}

export async function resumeDetail(id: string): Promise<Cv | null> {
  const result = await db().query(
    'SELECT cv, photo FROM resumes WHERE id=$1 AND expires_at>now()',
    [z.uuid().parse(id)],
  );
  const row = result.rows[0];
  // Older or partial records still open: every field the preview reads gets its default.
  return row
    ? {
        ...emptyCv(row.cv?.language === 'en' ? 'en' : 'ka'),
        ...row.cv,
        photo: row.photo
          ? `data:image/webp;base64,${row.photo.toString('base64')}`
          : '',
      }
    : null;
}
