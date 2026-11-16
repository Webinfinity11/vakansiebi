import { apiError } from '@/lib/server/auth';
import { requireCompanyRole } from '@/lib/server/company-auth';
import { candidatePhoto } from '@/lib/server/company-candidates';
export const dynamic = 'force-dynamic';
export async function GET(req: Request) {
  try {
    const company = await requireCompanyRole(
      ['owner', 'recruiter', 'viewer'],
      true,
    );
    const entry = new URL(req.url).searchParams.get('entry') ?? '';
    const photo = await candidatePhoto(company, entry);
    if (!photo) return new Response(null, { status: 404 });
    return new Response(photo as BodyInit, {
      headers: {
        'Content-Type': 'image/webp',
        // Private to the signed-in company; a short cache keeps lists from refetching.
        'Cache-Control': 'private, max-age=600',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (e) {
    return apiError(e);
  }
}
