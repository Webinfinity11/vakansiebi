import { z } from 'zod';

export const maxLogoBytes = 50000;
export const maxLogoSide = 256;
export const maxSubmissionBytes = 100000;
export const logoDataPattern =
  /^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/]+={0,2})$/;
export const logoFormatMessage = 'აირჩიე PNG, JPEG ან WebP გამოსახულება.';
export const logoSizeMessage =
  'ლოგო უნდა იყოს მაქსიმუმ 50 KB და 256 × 256 პიქსელი.';

export const submissionLogoSchema = z
  .string()
  .max(4 * Math.ceil(maxLogoBytes / 3) + 32, logoSizeMessage)
  .refine((v) => !v || logoDataPattern.exec(v)?.[0] === v, logoFormatMessage)
  .default('');

// The browser sends pixels only; the original file and its metadata stay local.
export async function prepareSubmissionLogo(file: File): Promise<string> {
  if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type))
    throw new Error(logoFormatMessage);
  if (file.size > 10 * 1024 * 1024)
    throw new Error('აირჩიე 10 MB-ზე მცირე გამოსახულება.');
  const url = URL.createObjectURL(file);
  try {
    const source = new Image();
    source.src = url;
    await source.decode().catch(() => {
      throw new Error('ლოგოს წაკითხვა ვერ მოხერხდა. აირჩიე სხვა გამოსახულება.');
    });
    const scale = Math.min(
      1,
      maxLogoSide / Math.max(source.naturalWidth, source.naturalHeight),
    );
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(source.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(source.naturalHeight * scale));
    const context = canvas.getContext('2d');
    if (!context)
      throw new Error(
        'ლოგოს დამუშავება ვერ მოხერხდა. სცადე სხვა გამოსახულება.',
      );
    context.drawImage(source, 0, 0, canvas.width, canvas.height);
    for (const quality of [0.9, 0.75, 0.6]) {
      const data = canvas.toDataURL('image/webp', quality);
      const encoded = data.split(',')[1] || '';
      const bytes =
        (encoded.length * 3) / 4 -
        (encoded.endsWith('==') ? 2 : encoded.endsWith('=') ? 1 : 0);
      // Browsers without a WebP encoder fall back to PNG.
      if (logoDataPattern.test(data) && bytes <= maxLogoBytes) return data;
    }
    throw new Error(
      'ლოგო მეტისმეტად დიდია. აირჩიე უფრო მარტივი ან პატარა გამოსახულება.',
    );
  } finally {
    URL.revokeObjectURL(url);
  }
}
