import { parseJobText } from '@/lib/company-job-import';
import { isDocx, isOdt, isTxt, maxCvBytes } from '@/lib/cv-upload';
import { apiError, ApiError, checkOrigin } from '@/lib/server/auth';
import { requireCompanyRole } from '@/lib/server/company-auth';
import { extractCv } from '@/lib/server/cv-text';
import { clientKey, rateLimit } from '@/lib/server/rate-limit';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
const headers = { 'Cache-Control': 'private, no-store' };
export async function POST(req: Request) {
  try {
    checkOrigin(req);
    await requireCompanyRole(['owner', 'recruiter']);
    if (
      !rateLimit('company-job-import:' + clientKey(req), {
        limit: 10,
        windowMs: 60000,
      }).allowed
    )
      throw new ApiError('სცადეთ მოგვიანებით.', 429);
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
    const { text } = await extractCv(bytes, file.name, { preserveListMarkers: true });
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
    return Response.json({ fields, found: Object.keys(fields) }, { headers });
  } catch (e) {
    const response = apiError(e);
    response.headers.set('Cache-Control', headers['Cache-Control']);
    return response;
  }
}
