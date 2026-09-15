import { createHash } from 'node:crypto';
import sharp from 'sharp';
import type { PoolClient } from 'pg';
import { ApiError } from './auth';
import { companyKey } from '../company-key';
import { isLocalLogoUrl } from '../vacancy-media';
import {
  logoDataPattern,
  logoFormatMessage,
  logoSizeMessage,
  maxLogoBytes,
  maxLogoSide,
  submissionLogoSchema,
} from '../submission-logo';

export class SubmissionLogoError extends ApiError {}
export type SubmissionLogo = {
  hash: string;
  contentType: string;
  bytes: Buffer;
};

export async function readSubmissionLogo(
  value: unknown,
): Promise<SubmissionLogo | null> {
  const parsed = submissionLogoSchema.safeParse(value);
  if (!parsed.success)
    throw new SubmissionLogoError(parsed.error.issues[0].message);
  if (!parsed.data) return null;
  const match = logoDataPattern.exec(parsed.data)!;
  const bytes = Buffer.from(match[2], 'base64');
  if (!bytes.length || bytes.toString('base64') !== match[2])
    throw new SubmissionLogoError(logoFormatMessage);
  if (bytes.length > maxLogoBytes)
    throw new SubmissionLogoError(logoSizeMessage);
  const format = bytes
    .subarray(0, 8)
    .equals(Buffer.from('89504e470d0a1a0a', 'hex'))
    ? 'png'
    : bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
      ? 'jpeg'
      : bytes.toString('ascii', 0, 4) === 'RIFF' &&
          bytes.toString('ascii', 8, 12) === 'WEBP'
        ? 'webp'
        : null;
  if (!format || format !== match[1])
    throw new SubmissionLogoError(logoFormatMessage);
  try {
    // Decode and re-encode with bounded raster inputs
    // to reject corrupt pixels and strip metadata; never pass SVG to the decoder.
    const decoder = sharp(bytes, {
      failOn: 'warning',
      limitInputPixels: maxLogoSide ** 2,
    });
    const metadata = await decoder.metadata();
    if (
      metadata.format !== format ||
      !metadata.width ||
      !metadata.height ||
      metadata.width > maxLogoSide ||
      metadata.height > maxLogoSide ||
      (metadata.pages || 1) !== 1
    )
      throw new SubmissionLogoError(logoSizeMessage);
    const clean = await decoder.rotate().toFormat(format).toBuffer();
    if (clean.length > maxLogoBytes)
      throw new SubmissionLogoError(logoSizeMessage);
    return {
      hash: createHash('sha256').update(clean).digest('hex'),
      contentType: `image/${format}`,
      bytes: clean,
    };
  } catch (error) {
    if (error instanceof SubmissionLogoError) throw error;
    throw new SubmissionLogoError(
      'ლოგოს წაკითხვა ვერ მოხერხდა. აირჩიე სწორი PNG, JPEG ან WebP გამოსახულება.',
    );
  }
}

export async function storeSubmissionLogo(
  c: PoolClient,
  logo: SubmissionLogo | null,
) {
  if (!logo) return '';
  await c.query(
    'INSERT INTO submission_logos(hash,content_type,data) VALUES($1,$2,$3) ON CONFLICT(hash) DO NOTHING',
    [logo.hash, logo.contentType, logo.bytes],
  );
  return `/api/logos/${logo.hash}`;
}

// Called only by moderation, in the same transaction as publication.
export async function approveSubmissionLogo(
  c: PoolClient,
  company: string,
  logoUrl: string,
  previousLogoUrl: string,
) {
  const local = isLocalLogoUrl(logoUrl);
  if (!local && !isLocalLogoUrl(previousLogoUrl)) return;
  const key = companyKey(company);
  await c.query('SELECT pg_advisory_xact_lock(hashtext($1))', [
    'company:' + key,
  ]);
  if (local) {
    const approved = await c.query(
      'UPDATE submission_logos SET approved_at=COALESCE(approved_at,now()) WHERE hash=$1 RETURNING hash',
      [logoUrl.slice('/api/logos/'.length)],
    );
    if (!approved.rowCount)
      throw new ApiError('ლოგო ვერ მოიძებნა. მოაცილე ლოგო ან სცადე ხელახლა.');
    await c.query(
      `INSERT INTO company_profiles(company_key,name,logo_url) VALUES($1,$2,$3)
      ON CONFLICT(company_key) DO UPDATE SET logo_url=excluded.logo_url,version=company_profiles.version+1,updated_at=now()`,
      [key, company, logoUrl],
    );
  } else {
    // Removing this upload must not erase a different logo selected by another review.
    await c.query(
      'UPDATE company_profiles SET logo_url=$3,version=version+1,updated_at=now() WHERE company_key=$1 AND logo_url=$2',
      [key, previousLogoUrl, logoUrl],
    );
  }
}
