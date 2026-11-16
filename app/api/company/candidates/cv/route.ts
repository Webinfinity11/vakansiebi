import { apiError, ApiError } from '@/lib/server/auth';
import { requireCompanyRole } from '@/lib/server/company-auth';
import { candidateCv } from '@/lib/server/company-candidates';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET(req: Request) {
  try {
    const params = new URL(req.url).searchParams;
    const file = await candidateCv(
      await requireCompanyRole(['owner', 'recruiter', 'viewer'], true),
      params.get('entry') ?? '',
    );
    if (!file) throw new ApiError('CV ფაილი არ შენახულა.', 404);
    const disposition =
      params.get('download') === '1' ? 'attachment' : 'inline';
    return new Response(file.body, {
      headers: {
        'Content-Type': file.type,
        'Content-Disposition': `${disposition}; filename*=UTF-8''${encodeURIComponent(file.name)}`,
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (e) {
    const response = apiError(e);
    response.headers.set('Cache-Control', 'private, no-store');
    return response;
  }
}
