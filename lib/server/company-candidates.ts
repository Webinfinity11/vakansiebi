import { isDocx, isOdt, isRtf, isTxt } from '../cv-upload';
import { requirementsMatch, type ApplicationAnswer } from '../job-questions';
import { parseCvText, normalizeProfile } from '../cv-parse';
import { extractCv, maxCvBytes } from './cv-text';
import { createHash } from 'node:crypto';
import { z } from 'zod';
import { del, get, put } from '@vercel/blob';
import { db, transaction } from './db';
import { ApiError } from './auth';
import { resumeDetail } from './resumes';
import { renderCvPdf } from './cv-pdf';
import type { CompanyIdentity } from '../company-portal';
import type { Cv } from '../cv';
import {
  candidateStages,
  educationLevels,
  languageLevels,
  type Candidate,
  type CandidateNote,
  type CandidateProfile,
} from '../company-candidates';

/* Every application a company may see, from all three sources, joined to its own state.
   Ownership is the only gate: a vacancy the company owns (company_job_ownership) or an upload
   in its own name. Failed or unsent swipe deliveries never reached the company and stay out. */
const candidatesSql = `
WITH owned AS (
  SELECT j.id, COALESCE(j.published->>'title', j.draft->>'title', 'ვაკანსია') AS title
  FROM jobs j JOIN company_job_ownership o ON o.job_id=j.id WHERE o.company_key=$1
), entries AS (
  SELECT 'swipe:'||a.id AS entry, 'swipe' AS source, a.job_id, o.title AS job_title,
    a.candidate_name AS name, a.candidate_email AS email, a.candidate_phone AS phone,
    COALESCE(r.cv->>'title','') AS title, COALESCE(r.cv->>'city','') AS city,
    COALESCE(a.sent_at, a.created_at) AS applied_at,
    (a.cv_file IS NOT NULL OR (a.cv_kind='jobx' AND r.id IS NOT NULL)) AS has_cv,
    CASE WHEN r.photo IS NOT NULL THEN r.id END AS photo_of,
    CASE WHEN a.cv_kind='jobx' THEN r.cv - 'photo' END AS cv, a.question_answers
  FROM swipe_applications a JOIN owned o ON o.id=a.job_id
  LEFT JOIN resumes r ON r.id=a.resume_id AND r.expires_at>now()
  WHERE a.status='sent'
  UNION ALL
  SELECT 'resume:'||c.job_id||':'||c.resume_id, 'resume', c.job_id, o.title,
    COALESCE(NULLIF(r.cv->>'fullName',''),'კანდიდატი'), COALESCE(r.cv->>'email',''),
    COALESCE(r.cv->>'phone',''), COALESCE(r.cv->>'title',''), COALESCE(r.cv->>'city',''),
    c.first_at, true, CASE WHEN r.photo IS NOT NULL THEN r.id END, r.cv - 'photo', '[]'::jsonb
  FROM resume_contacts c JOIN owned o ON o.id=c.job_id
  JOIN resumes r ON r.id=c.resume_id AND r.expires_at>now()
  WHERE c.kind='cv'
  UNION ALL
  SELECT 'upload:'||u.id, u.source, u.job_id, COALESCE(o.title,''), u.name, u.email, u.phone,
    u.title, '', u.created_at, true, NULL::uuid, NULL::jsonb, '[]'::jsonb
  FROM company_cv_uploads u LEFT JOIN owned o ON o.id=u.job_id
  WHERE u.company_key=$1
)
SELECT e.*, COALESCE(s.stage,'new') AS stage, s.rating, s.seen_at IS NOT NULL AS seen,
  s.interview_at, s.interview_note, s.hired_at, p.parsed, p.edited,
  (SELECT count(*)::int FROM company_candidate_notes n WHERE n.company_key=$1 AND n.entry=e.entry) AS notes
FROM entries e LEFT JOIN company_candidate_states s ON s.company_key=$1 AND s.entry=e.entry
LEFT JOIN company_cv_profiles p ON p.company_key=$1 AND p.entry=e.entry`;

type Row = {
  entry: string;
  source: Candidate['source'];
  job_id: string | null;
  job_title: string;
  name: string;
  email: string;
  phone: string;
  title: string;
  city: string;
  applied_at: Date;
  interview_at: Date | null;
  hired_at: Date | null;
  interview_note: string | null;
  has_cv: boolean;
  photo_of: string | null;
  cv: Partial<Cv> | null;
  stage: Candidate['stage'];
  rating: number | null;
  seen: boolean;
  notes: number;
  parsed: Omit<CandidateProfile, 'origin'> | null;
  edited: Record<string, unknown> | null;
  question_answers: ApplicationAnswer[];
};
function candidate(row: Row): Candidate {
  let profile: CandidateProfile | null = row.cv
    ? candidateProfile(row.cv)
    : row.parsed
      ? { ...row.parsed, origin: 'parsed' }
      : null;
  const edited = Object.fromEntries(
    Object.entries(row.edited ?? {}).filter(([, v]) => v !== null),
  );
  if (Object.keys(edited).length)
    profile = {
      ...(profile ?? { ...parseCvText(''), origin: 'parsed' }),
      ...edited,
      origin: 'edited',
    } as CandidateProfile;
  return {
    entry: row.entry,
    source: row.source,
    jobId: row.job_id,
    jobTitle: row.job_title,
    name: row.name,
    email: row.email,
    phone: row.phone,
    title: row.title,
    city: row.city,
    appliedAt: row.applied_at.toISOString(),
    hiredAt: row.hired_at?.toISOString() ?? null,
    interviewAt: row.interview_at?.toISOString() ?? null,
    interviewNote: row.interview_note ?? '',
    stage: row.stage,
    rating: row.rating,
    seen: row.seen,
    notes: row.notes,
    hasCv: row.has_cv,
    photo: !!row.photo_of,
    profile,
    answers: row.question_answers ?? [],
    requirementsMatch: requirementsMatch(row.question_answers ?? []),
  };
}

const monthIndex = (value: string | undefined) => {
  const m = /^(\d{4})-(\d{2})$/.exec(value ?? '');
  return m ? Number(m[1]) * 12 + Number(m[2]) - 1 : null;
};
/* Years of experience from the job dates, merging overlaps so two parallel jobs count once. */
function experienceYears(items: NonNullable<Cv['experience']>) {
  const now = new Date();
  const today = now.getUTCFullYear() * 12 + now.getUTCMonth();
  const spans = items
    .map((e) => {
      const from = monthIndex(e.from);
      const to = e.current ? today : (monthIndex(e.to) ?? from);
      return from == null || to == null ? null : [from, Math.max(from, to) + 1];
    })
    .filter((s): s is number[] => !!s)
    .sort((a, b) => a[0] - b[0]);
  if (!spans.length) return null;
  let months = 0;
  let [start, end] = spans[0];
  for (const [s, e] of spans.slice(1)) {
    if (s <= end) end = Math.max(end, e);
    else {
      months += end - start;
      [start, end] = [s, e];
    }
  }
  months += end - start;
  return Math.floor(months / 12);
}
function candidateProfile(cv: Partial<Cv>): CandidateProfile {
  const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
  const experience = Array.isArray(cv.experience) ? cv.experience : [];
  const ordered = [...experience].sort(
    (a, b) =>
      Number(!!b.current) - Number(!!a.current) ||
      (monthIndex(b.to) ?? monthIndex(b.from) ?? 0) -
        (monthIndex(a.to) ?? monthIndex(a.from) ?? 0),
  );
  const skills = (Array.isArray(cv.skills) ? cv.skills : [])
    .map(str)
    .filter(Boolean);
  const languages = (Array.isArray(cv.languages) ? cv.languages : [])
    .map((l) => ({
      name: str(l?.name),
      level: (languageLevels as readonly string[]).includes(str(l?.level))
        ? (str(l?.level) as CandidateProfile['languages'][number]['level'])
        : null,
    }))
    .filter((l) => l.name);
  const education = (Array.isArray(cv.education) ? cv.education : [])
    .map((e) => [str(e?.degree), str(e?.school)].filter(Boolean).join(' — '))
    .filter(Boolean);
  const roles = ordered
    .map((e) => [str(e.role), str(e.company)].filter(Boolean).join(' — '))
    .filter(Boolean);
  const text = [
    cv.title,
    cv.city,
    cv.summary,
    ...skills,
    ...languages.map((l) => l.name),
    ...education,
    ...experience.flatMap((e) => [e.role, e.company, e.description]),
  ]
    .map(str)
    .filter(Boolean)
    .join(' \n ')
    .slice(0, 6000);
  return normalizeProfile({
    origin: 'jobx',
    educationLevel: null,
    city: str(cv.city),
    years: experienceYears(experience),
    roles: roles.slice(0, 4),
    skills: skills.slice(0, 30),
    languages: languages.slice(0, 8),
    education: education.slice(0, 3),
    text,
  });
}

export async function companyCandidates(company: CompanyIdentity) {
  await ensureCvProfiles(company);
  const { rows } = await db().query<Row>(
    candidatesSql + ' ORDER BY e.applied_at DESC LIMIT 2000',
    [company.companyKey],
  );
  return rows.map(candidate);
}

const entrySchema = z
  .string()
  .regex(
    /^(swipe|upload):[0-9a-f-]{36}$|^resume:[0-9a-f-]{36}:[0-9a-f-]{36}$/,
    'კანდიდატი ვერ მოიძებნა.',
  );
/** The entry, if this company may see it; otherwise a 404 that reveals nothing. */
async function ownedRow(company: CompanyIdentity, entry: string) {
  const { rows } = await db().query<Row>(candidatesSql + ' WHERE e.entry=$2', [
    company.companyKey,
    entrySchema.parse(entry),
  ]);
  if (!rows[0]) throw new ApiError('კანდიდატი ვერ მოიძებნა.', 404);
  return rows[0];
}
async function ownedEntry(company: CompanyIdentity, entry: string) {
  return candidate(await ownedRow(company, entry));
}

/* The photo from the candidate's JOBX resume, already reduced to a small WebP when saved.
   Uploaded files carry no photo; a deleted or expired resume takes its photo with it. */
export async function candidatePhoto(
  company: CompanyIdentity,
  entry: string,
): Promise<Uint8Array | null> {
  const row = await ownedRow(company, entry);
  if (!row.photo_of) return null;
  const { rows } = await db().query<{ photo: Buffer | null }>(
    'SELECT photo FROM resumes WHERE id=$1 AND expires_at>now()',
    [row.photo_of],
  );
  return rows[0]?.photo ? new Uint8Array(rows[0].photo) : null;
}

export async function candidateNotes(
  company: CompanyIdentity,
  entry: string,
): Promise<CandidateNote[]> {
  await ownedEntry(company, entry);
  const { rows } = await db().query(
    'SELECT id,author,body,created_at FROM company_candidate_notes WHERE company_key=$1 AND entry=$2 ORDER BY created_at',
    [company.companyKey, entry],
  );
  return rows.map((r) => ({
    id: r.id,
    author: r.author,
    body: r.body,
    createdAt: r.created_at.toISOString(),
  }));
}

const profileEditSchema = z
  .object({
    years: z.number().int().min(0).max(80).nullable().optional(),
    skills: z
      .array(z.string().trim().min(1).max(100))
      .max(60)
      .nullable()
      .optional(),
    roles: z
      .array(z.string().trim().min(1).max(200))
      .max(20)
      .nullable()
      .optional(),
    languages: z
      .array(
        z.object({
          name: z.string().trim().min(1).max(60),
          level: z.enum(languageLevels).nullable(),
        }),
      )
      .max(20)
      .nullable()
      .optional(),
    educationLevel: z.enum(educationLevels).nullable().optional(),
    city: z.string().trim().max(100).nullable().optional(),
  })
  .strict();
const changeSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('profile'),
    entry: z.string(),
    edit: profileEditSchema,
  }),
  z.object({
    action: z.literal('stage'),
    entries: z.array(z.string()).min(1).max(200),
    stage: z.enum(candidateStages),
  }),
  z.object({
    action: z.literal('rate'),
    entry: z.string(),
    rating: z.number().int().min(1).max(5).nullable(),
  }),
  z.object({ action: z.literal('seen'), entry: z.string() }),
  z.object({ action: z.literal('deleteUpload'), entry: z.string() }),
  z.object({
    action: z.literal('interview'),
    entry: z.string(),
    interviewAt: z.iso.datetime({ offset: true }).nullable(),
    interviewNote: z.string().trim().max(1000).default(''),
    moveToInterview: z.boolean().default(false),
  }),
  z.object({
    action: z.literal('note'),
    entry: z.string(),
    body: z.string().trim().min(1, 'შენიშვნა ცარიელია.').max(4000),
  }),
]);

const upsert = `INSERT INTO company_candidate_states(company_key,entry,%COLS%) VALUES($1,$2,%VALS%)
  ON CONFLICT (company_key,entry) DO UPDATE SET %SET%,updated_at=now()`;
function upsertSql(column: string, value: string) {
  return upsert
    .replace('%COLS%', column)
    .replace('%VALS%', value)
    .replace('%SET%', `${column}=EXCLUDED.${column}`);
}

export async function changeCandidate(
  company: CompanyIdentity,
  input: unknown,
) {
  if (!['owner', 'recruiter'].includes(company.role))
    throw new ApiError('ამ მოქმედების უფლება არ გაქვთ.', 403);
  const data = changeSchema.parse(input);
  if (data.action === 'stage') {
    const entries = [...new Set(data.entries.map((entry) => entrySchema.parse(entry)))];
    return transaction(async (client) => {
      const { rows: owned } = await client.query<Row>(
        candidatesSql + ' WHERE e.entry=ANY($2::text[])',
        [company.companyKey, entries],
      );
      if (owned.length !== entries.length)
        throw new ApiError('კანდიდატი ვერ მოიძებნა.', 404);
      const { rows } = await client.query<{ entry: string; hired_at: Date | null }>(
        `INSERT INTO company_candidate_states(company_key,entry,stage,seen_at,hired_at)
         SELECT $1, entry, $3, now(), CASE WHEN $3='hired' THEN now() END
         FROM unnest($2::text[]) AS entry
         ON CONFLICT(company_key,entry) DO UPDATE SET
           stage=EXCLUDED.stage,
           seen_at=COALESCE(company_candidate_states.seen_at,now()),
           hired_at=CASE WHEN EXCLUDED.stage<>'hired' THEN NULL
             WHEN company_candidate_states.stage='hired' THEN company_candidate_states.hired_at
             ELSE now() END,
           updated_at=now()
         RETURNING entry,hired_at`,
        [company.companyKey, entries, data.stage],
      );
      return { ok: true, candidates: rows.map((row) => ({
        entry: row.entry, hiredAt: row.hired_at?.toISOString() ?? null,
      })) };
    });
  }
  const owned = await ownedEntry(company, data.entry);
  if (data.action === 'profile') {
    await db().query(
      `INSERT INTO company_cv_profiles(company_key,entry,edited) VALUES($1,$2,jsonb_strip_nulls($3::jsonb))
       ON CONFLICT(company_key,entry) DO UPDATE SET
       edited=jsonb_strip_nulls(company_cv_profiles.edited || $3::jsonb),updated_at=now()`,
      [company.companyKey, data.entry, JSON.stringify(data.edit)],
    );
  } else if (data.action === 'deleteUpload') {
    if (!['upload', 'cv_box'].includes(owned.source))
      throw new ApiError('მხოლოდ ატვირთული CV-ის წაშლაა შესაძლებელი.', 400);
    // Lock the owned upload while removing its private file and associated state.
    // A blob failure keeps the row so the user can retry the same deletion.
    await transaction(async (client) => {
      const { rows } = await client.query<{ blob_path: string | null }>(
        'SELECT blob_path FROM company_cv_uploads WHERE id=$1 AND company_key=$2 FOR UPDATE',
        [data.entry.split(':')[1], company.companyKey],
      );
      if (!rows[0]) throw new ApiError('კანდიდატი ვერ მოიძებნა.', 404);
      if (rows[0].blob_path) await del(rows[0].blob_path);
      await client.query(
        'DELETE FROM company_candidate_notes WHERE company_key=$1 AND entry=$2',
        [company.companyKey, data.entry],
      );
      await client.query(
        'DELETE FROM company_cv_profiles WHERE company_key=$1 AND entry=$2',
        [company.companyKey, data.entry],
      );
      await client.query(
        'DELETE FROM company_candidate_states WHERE company_key=$1 AND entry=$2',
        [company.companyKey, data.entry],
      );
      await client.query(
        'DELETE FROM company_cv_uploads WHERE id=$1 AND company_key=$2',
        [data.entry.split(':')[1], company.companyKey],
      );
    });
  } else if (data.action === 'interview') {
    await db().query(
      `INSERT INTO company_candidate_states(company_key,entry,interview_at,interview_note,stage)
       VALUES($1,$2,$3,$4,$5)
       ON CONFLICT(company_key,entry) DO UPDATE SET
       interview_at=EXCLUDED.interview_at,interview_note=EXCLUDED.interview_note,
       stage=CASE WHEN $6 THEN 'interview' ELSE company_candidate_states.stage END,
       hired_at=CASE WHEN $6 THEN NULL ELSE company_candidate_states.hired_at END,updated_at=now()`,
      [
        company.companyKey,
        data.entry,
        data.interviewAt,
        data.interviewNote || null,
        data.moveToInterview && data.interviewAt ? 'interview' : owned.stage,
        data.moveToInterview && !!data.interviewAt,
      ],
    );
  } else if (data.action === 'rate')
    await db().query(upsertSql('rating', '$3'), [
      company.companyKey,
      data.entry,
      data.rating,
    ]);
  else if (data.action === 'seen')
    await db().query(
      upsert
        .replace('%COLS%', 'seen_at')
        .replace('%VALS%', 'now()')
        .replace(
          '%SET%',
          'seen_at=COALESCE(company_candidate_states.seen_at,now())',
        ),
      [company.companyKey, data.entry],
    );
  else {
    await db().query(
      'INSERT INTO company_candidate_notes(company_key,entry,author,body) VALUES($1,$2,$3,$4)',
      [company.companyKey, data.entry, company.representativeName || company.username, data.body],
    );
    return candidateNotes(company, data.entry);
  }
  return { ok: true };
}

/* The CV as a PDF, for the inline viewer and download. */
export async function candidateCv(
  company: CompanyIdentity,
  entry: string,
): Promise<{ body: BodyInit; type: string; name: string } | null> {
  const c = await ownedEntry(company, entry);
  const fileName = (c.name || 'CV').replace(/[^\p{L}\p{N} ._-]/gu, '').trim();
  if (c.source === 'resume') {
    const [, , resumeId] = entry.split(':');
    const cv = await resumeDetail(resumeId);
    if (!cv) return null;
    return {
      body: Buffer.from(await renderCvPdf(cv)),
      type: 'application/pdf',
      name: `${fileName}.pdf`,
    };
  }
  const id = entry.split(':')[1];
  if (c.source === 'swipe') {
    const row = (
      await db().query<{
        cv_file: string | null;
        cv_kind: string;
        resume_id: string | null;
      }>(
        'SELECT cv_file,cv_kind,resume_id FROM swipe_applications WHERE id=$1',
        [id],
      )
    ).rows[0];
    if (row?.cv_kind === 'jobx' && row.resume_id && !row.cv_file) {
      const cv = await resumeDetail(row.resume_id);
      if (!cv) return null;
      return {
        body: Buffer.from(await renderCvPdf(cv)),
        type: 'application/pdf',
        name: `${fileName}.pdf`,
      };
    }
    if (!row?.cv_file) return null;
    return blobFile(row.cv_file, 'application/pdf', `${fileName}.pdf`);
  }
  const row = (
    await db().query<{
      blob_path: string | null;
      content: Buffer | null;
      file_name: string;
    }>(
      'SELECT blob_path,content,file_name FROM company_cv_uploads WHERE id=$1 AND company_key=$2',
      [id, company.companyKey],
    )
  ).rows[0];
  if (!row) return null;
  const type = uploadType(row.file_name);
  if (row.content)
    return { body: new Uint8Array(row.content), type, name: row.file_name };
  return row.blob_path ? blobFile(row.blob_path, type, row.file_name) : null;
}
async function blobFile(path: string, type: string, name: string) {
  try {
    const blob = await get(path, {
      access: 'private',
      useCache: false,
      abortSignal: AbortSignal.timeout(10000),
    });
    if (!blob || blob.statusCode !== 200) return null;
    return { body: blob.stream as BodyInit, type, name };
  } catch {
    throw new ApiError('CV დროებით მიუწვდომელია.', 503);
  }
}

const maxUpload = maxCvBytes;
const uploadTypes: Record<string, string> = {
  odt: 'application/vnd.oasis.opendocument.text',
  rtf: 'application/rtf',
  txt: 'text/plain',
  pdf: 'application/pdf',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
};
function uploadType(name: string) {
  return (
    uploadTypes[name.split('.').pop()?.toLowerCase() ?? ''] ??
    'application/octet-stream'
  );
}
const uploadSchema = z.object({
  name: z.string().trim().min(1, 'მიუთითეთ კანდიდატის სახელი.').max(120),
  email: z.union([z.literal(''), z.email('ელფოსტა არასწორია.')]).default(''),
  phone: z.string().trim().max(32).default(''),
  title: z.string().trim().max(120).default(''),
  jobId: z.union([z.literal(''), z.uuid()]).default(''),
});
function looksLike(bytes: Buffer, ext: string) {
  if (ext === 'pdf') return bytes.subarray(0, 5).toString() === '%PDF-';
  if (ext === 'docx') return isDocx(bytes);
  if (ext === 'odt') return isOdt(bytes);
  if (ext === 'rtf') return isRtf(bytes);
  if (ext === 'txt') return isTxt(bytes);
  if (ext === 'doc') return bytes[0] === 0xd0 && bytes[1] === 0xcf;
  return false;
}

/* A CV the company brings from elsewhere. Same file twice in one company is one upload. */
export async function uploadCandidate(
  company: Pick<CompanyIdentity, 'companyKey'>,
  form: FormData,
  context?: { source: 'cv_box'; clientHash: string },
) {
  const file = form.get('file');
  if (!(file instanceof File) || !file.size)
    throw new ApiError('აირჩიეთ CV ფაილი.');
  if (file.size > maxUpload)
    throw new ApiError('ფაილი 4 MB-ზე დიდი არ უნდა იყოს.');
  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
  const bytes = Buffer.from(await file.arrayBuffer());
  if (!uploadTypes[ext] || !looksLike(bytes, ext))
    throw new ApiError('ატვირთეთ PDF, Word (DOC, DOCX), ODT, RTF ან TXT ფაილი.');
  const data = uploadSchema.parse({
    name: form.get('name') || file.name.replace(/\.[^.]+$/, ''),
    email: form.get('email') ?? '',
    phone: form.get('phone') ?? '',
    title: form.get('title') ?? '',
    jobId: form.get('jobId') ?? '',
  });
  if (data.jobId) {
    const owned = await db().query(
      'SELECT 1 FROM company_job_ownership WHERE job_id=$1 AND company_key=$2',
      [data.jobId, company.companyKey],
    );
    if (!owned.rowCount) throw new ApiError('ვაკანსია ვერ მოიძებნა.', 404);
  }
  const hash = createHash('sha256').update(bytes).digest('hex');
  const existing = await db().query<{ id: string }>(
    'SELECT id FROM company_cv_uploads WHERE company_key=$1 AND file_hash=$2',
    [company.companyKey, hash],
  );
  if (existing.rows[0])
    return { entry: 'upload:' + existing.rows[0].id, duplicate: true };
  let blobPath: string | null = null;
  if (process.env.BLOB_READ_WRITE_TOKEN && !context) {
    const blob = await put(
      `company-cv/${company.companyKey}/${hash}.${ext}`,
      bytes,
      {
        access: 'private',
        addRandomSuffix: false,
        allowOverwrite: true,
        contentType: uploadTypes[ext],
        abortSignal: AbortSignal.timeout(10000),
      },
    );
    blobPath = blob.pathname;
  }
  const { rows } = await transaction(async (client) => {
    if (context) {
      // Shared quota and consent gate: parallel requests cannot bypass the limit or a disabled box.
      await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [
        'cv-box:' + context.clientHash,
      ]);
      const enabled = await client.query(
        `SELECT 1 FROM company_profiles p WHERE company_key=$1 AND cv_box_enabled
        AND approval_status='approved' AND EXISTS(SELECT 1 FROM company_accounts a WHERE a.company_key=p.company_key
        AND a.enabled AND a.email_verified AND NOT a.must_change_password) FOR SHARE OF p`,
        [company.companyKey],
      );
      if (!enabled.rowCount)
        throw new ApiError('კომპანია რეზიუმეებს ამჟამად არ იღებს.', 404);
      const usage = await client.query(
        `SELECT count(*)::int AS n FROM company_cv_uploads WHERE source='cv_box'
        AND client_hash=$1 AND created_at>now()-interval '24 hours'`,
        [context.clientHash],
      );
      if (usage.rows[0].n >= 10)
        throw new ApiError('დღევანდელი ლიმიტი ამოიწურა. სცადეთ ხვალ.', 429);
    }
    return client.query<{ id: string }>(
      `INSERT INTO company_cv_uploads(company_key,job_id,name,email,phone,title,file_name,file_hash,file_size,blob_path,content,source,client_hash,consent_at)
       VALUES($1,NULLIF($2,'')::uuid,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,CASE WHEN $12='cv_box' THEN now() END)
       ON CONFLICT DO NOTHING RETURNING id`,
      [
        company.companyKey,
        data.jobId,
        data.name,
        data.email,
        data.phone,
        data.title,
        file.name.slice(0, 200),
        hash,
        file.size,
        blobPath,
        blobPath ? null : bytes,
        context?.source ?? 'upload',
        context?.clientHash ?? null,
      ],
    );
  });
  if (!rows[0]) {
    const duplicate = await db().query<{ id: string }>(
      `SELECT id FROM company_cv_uploads WHERE company_key=$1 AND
        (file_hash=$2 OR ($3::boolean AND source='cv_box' AND lower(email)=lower($4))) LIMIT 1`,
      [company.companyKey, hash, !!context, data.email],
    );
    if (!duplicate.rows[0]) throw new ApiError('სცადეთ ხელახლა.', 409);
    return { entry: 'upload:' + duplicate.rows[0].id, duplicate: true };
  }
  const profile = await saveCvProfile(
    company.companyKey,
    'upload:' + rows[0].id,
    bytes,
    file.name,
  ).catch(() => null);
  return { entry: 'upload:' + rows[0].id, duplicate: false, parse: profile?.parse ?? null };
}

async function saveCvProfile(
  companyKey: string,
  entry: string,
  bytes: Uint8Array,
  filename: string,
) {
  const { text, reason } = await extractCv(bytes, filename);
  const parsed = parseCvText(text);
  if (reason) parsed.parse = { confidence: parsed.parse?.confidence ?? 0, reason };
  await db().query(
    `INSERT INTO company_cv_profiles(company_key,entry,text,parsed,method,parsed_at)
     VALUES($1,$2,$3,$4,'rules-v1',now()) ON CONFLICT(company_key,entry) DO UPDATE SET
     text=EXCLUDED.text,parsed=EXCLUDED.parsed,method=EXCLUDED.method,parsed_at=now(),updated_at=now()`,
    [companyKey, entry, text, JSON.stringify(parsed)],
  );
  return parsed;
}

/** The stored file: inline bytes, or the private Blob copy (needs the Blob token). */
async function cvFileBytes(row: {
  content: Uint8Array | null;
  path: string | null;
}): Promise<Uint8Array | null> {
  if (row.content) return row.content;
  if (!row.path) return null;
  const blob = await get(row.path, {
    access: 'private',
    useCache: false,
    abortSignal: AbortSignal.timeout(5000),
  });
  if (!blob || blob.statusCode !== 200) return null;
  const reader = blob.stream.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxCvBytes) break;
      chunks.push(value);
    }
  } finally {
    await reader.cancel();
  }
  return size > maxCvBytes ? new Uint8Array() : Buffer.concat(chunks);
}

export type CvReparseResult = {
  entry: string;
  companyKey: string;
  status: 'updated' | 'unchanged' | 'unavailable' | 'failed';
  before: number;
  after: number;
};
/** Re-reads already parsed CVs with the current extractor and rules. A company's manual
    edits live in `edited` and are kept; only the extracted text and parse are replaced. */
export async function reparseCvProfiles(options: {
  apply: boolean;
  companyKey?: string;
}): Promise<CvReparseResult[]> {
  const { rows } = await db().query<{
    company_key: string;
    entry: string;
    content: Buffer | null;
    path: string | null;
    filename: string;
    text: string;
  }>(
    `SELECT p.company_key,p.entry,f.content,f.path,f.filename,p.text FROM company_cv_profiles p
    JOIN (
      SELECT u.company_key,'upload:'||u.id AS entry,u.content,u.blob_path AS path,u.file_name AS filename
      FROM company_cv_uploads u
      UNION ALL
      SELECT o.company_key,'swipe:'||a.id,NULL::bytea,a.cv_file,'CV.pdf'
      FROM swipe_applications a JOIN company_job_ownership o ON o.job_id=a.job_id
      WHERE a.cv_file IS NOT NULL
    ) f ON f.company_key=p.company_key AND f.entry=p.entry
    WHERE p.parsed_at IS NOT NULL AND ($1::text IS NULL OR p.company_key=$1)
    ORDER BY p.company_key,p.entry`,
    [options.companyKey ?? null],
  );
  const results: CvReparseResult[] = [];
  for (const row of rows) {
    const base = { entry: row.entry, companyKey: row.company_key, before: row.text.length };
    try {
      const bytes = await cvFileBytes(row);
      if (!bytes) {
        results.push({ ...base, status: 'unavailable', after: 0 });
        continue;
      }
      const { text } = await extractCv(bytes, row.filename);
      if (options.apply)
        await saveCvProfile(row.company_key, row.entry, bytes, row.filename);
      results.push({ ...base, status: text === row.text ? 'unchanged' : 'updated', after: text.length });
    } catch {
      results.push({ ...base, status: 'failed', after: 0 });
    }
  }
  return results;
}

// Small lazy batches. No public fetch: files are read only through private Blob storage or
// local upload bytes. Locally swipe PDFs cannot be backfilled without the Blob token.
const activeBackfills = new Map<string, Promise<void>>();
export async function ensureCvProfiles(
  company: CompanyIdentity,
  limit = 2,
): Promise<void> {
  const active = activeBackfills.get(company.companyKey);
  if (active) return active;
  const run = async () => {
    const { rows } = await db().query<{
      entry: string;
      content: Buffer | null;
      path: string | null;
      filename: string;
    }>(
      `WITH files AS (
        SELECT 'upload:'||u.id AS entry,u.content,u.blob_path AS path,u.file_name AS filename
        FROM company_cv_uploads u WHERE u.company_key=$1
        UNION ALL
        SELECT 'swipe:'||a.id,NULL::bytea,a.cv_file,'CV.pdf'
        FROM swipe_applications a JOIN company_job_ownership o ON o.job_id=a.job_id
        WHERE o.company_key=$1 AND a.status='sent' AND a.cv_file IS NOT NULL
      ) SELECT f.* FROM files f LEFT JOIN company_cv_profiles p ON p.company_key=$1 AND p.entry=f.entry
      WHERE p.parsed_at IS NULL AND (f.content IS NOT NULL OR $3::boolean) LIMIT $2`,
      [
        company.companyKey,
        Math.max(1, Math.min(5, limit)),
        !!process.env.BLOB_READ_WRITE_TOKEN,
      ],
    );
    for (const row of rows) {
      try {
        const bytes = await cvFileBytes(row);
        if (bytes)
          await saveCvProfile(
            company.companyKey,
            row.entry,
            bytes,
            row.filename,
          );
      } catch {
        /* A private file temporarily unavailable must not hide the candidate list. */
      }
    }
  };
  const pending = run().finally(() =>
    activeBackfills.delete(company.companyKey),
  );
  activeBackfills.set(company.companyKey, pending);
  return pending;
}
