import { parseJobText, type JobImportFields } from '../company-job-import';
import { isDocx, isOdt, isTxt, maxCvBytes } from '../cv-upload';
import { ApiError } from './auth';
import { extractCv } from './cv-text';

export async function readJobImportFile(
  req: Request,
): Promise<{ fields: JobImportFields; found: string[] }> {
  if (Number(req.headers.get('content-length')) > maxCvBytes + 100000)
    throw new ApiError('ფაილი მეტისმეტად დიდია. მაქსიმუმ 4 მბ.', 413);
  let data: FormData;
  try {
    data = await req.formData();
  } catch {
    throw new ApiError('აირჩიეთ ასატვირთი ფაილი.', 400);
  }
  const file = data.get('file');
  if (!(file instanceof File))
    throw new ApiError('აირჩიეთ ასატვირთი ფაილი.', 400);
  if (file.size > maxCvBytes)
    throw new ApiError('ფაილი მეტისმეტად დიდია. მაქსიმუმ 4 მბ.', 413);
  const ext = file.name.split('.').pop()?.toLowerCase();
  if (!ext || !['pdf', 'docx', 'odt', 'txt'].includes(ext))
    throw new ApiError('ატვირთეთ PDF, DOCX, ODT ან TXT ფაილი.', 415);
  const bytes = Buffer.from(await file.arrayBuffer());
  const valid =
    ext === 'pdf'
      ? bytes.subarray(0, 5).toString('ascii') === '%PDF-'
      : ext === 'docx'
        ? isDocx(bytes)
        : ext === 'odt'
          ? isOdt(bytes)
          : isTxt(bytes) && !bytes.subarray(0, 2).equals(Buffer.from('MZ'));
  if (!valid)
    throw new ApiError(
      'ფაილის ფორმატი ვერ ამოვიცანით. ატვირთეთ PDF, DOCX, ODT ან TXT.',
      415,
    );
  const { text } = await extractCv(bytes, file.name, {
    preserveListMarkers: true,
  });
  if (!text.trim())
    throw new ApiError(
      'ფაილიდან ტექსტი ვერ ამოვიკითხეთ. ატვირთეთ ტექსტიანი დოკუმენტი.',
      422,
    );
  const fields = parseJobText(text);
  if (!Object.keys(fields).length)
    throw new ApiError(
      'ვაკანსიის მონაცემები ვერ ამოვიცანით. შეავსეთ ფორმა ხელით.',
      422,
    );
  return { fields, found: Object.keys(fields) };
}
