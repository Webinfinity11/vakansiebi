import { ApiError } from './auth';
import { maxLogoBytes, logoFormatMessage, logoSizeMessage } from '../submission-logo';
import { readSubmissionLogo } from './submission-logos';

// Inspect bytes before decoding; the filename and declared MIME type are untrusted.
export async function readCompanyLogo(file: FormDataEntryValue | null) {
  if (!(file instanceof File) || !file.size)
    throw new ApiError(logoFormatMessage);
  if (file.size > maxLogoBytes) throw new ApiError(logoSizeMessage, 413);
  const bytes = Buffer.from(await file.arrayBuffer());
  const format = bytes.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex'))
    ? 'png'
    : bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
      ? 'jpeg'
      : bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP'
        ? 'webp' : null;
  if (!format) throw new ApiError(logoFormatMessage);
  return (await readSubmissionLogo(`data:image/${format};base64,${bytes.toString('base64')}`))!;
}
