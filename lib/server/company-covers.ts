import sharp from 'sharp';
import { createHash } from 'node:crypto';
import { ApiError } from './auth';
import { db } from './db';
import type { CompanyIdentity } from '../company-portal';
export const isCompanyCover = (url: string) =>
  /^\/api\/company-covers\/[a-f0-9]{64}$/.test(url);
export async function uploadCompanyCover(
  company: CompanyIdentity,
  file: FormDataEntryValue | null,
) {
  if (!(file instanceof File) || !file.size || file.size > 4 * 1024 * 1024)
    throw new ApiError('აირჩიეთ JPG, PNG ან WebP სურათი, მაქსიმუმ 4 მბ.');
  let clean: Buffer;
  try {
    const image = sharp(Buffer.from(await file.arrayBuffer()), {
      limitInputPixels: 24000000,
      failOn: 'warning',
    });
    const meta = await image.metadata();
    if (
      !['jpeg', 'png', 'webp'].includes(meta.format ?? '') ||
      (meta.pages ?? 1) !== 1
    )
      throw Error();
    clean = await image
      .rotate()
      .resize({
        width: 1600,
        height: 600,
        fit: 'cover',
        withoutEnlargement: true,
      })
      .webp({ quality: 82 })
      .toBuffer();
    if (clean.length > 2 * 1024 * 1024) throw Error();
  } catch {
    throw new ApiError(
      'სურათის წაკითხვა ვერ მოხერხდა. აირჩიეთ JPG, PNG ან WebP.',
    );
  }
  const hash = createHash('sha256')
    .update(company.companyKey)
    .update(clean)
    .digest('hex');
  await db().query(
    'INSERT INTO company_cover_images(hash,company_key,data) VALUES($1,$2,$3) ON CONFLICT(hash) DO NOTHING',
    [hash, company.companyKey, clean],
  );
  return { coverUrl: '/api/company-covers/' + hash };
}
