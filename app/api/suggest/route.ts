import { suggestTerms } from '@/lib/server/suggest';
import { apiError } from '@/lib/server/auth';
export const dynamic = 'force-dynamic';
export async function GET(request: Request) {
  try {
    const q = new URL(request.url).searchParams.get('q');
    if (q === null)
      return Response.json(
        { error: 'q პარამეტრი აუცილებელია' },
        { status: 400 },
      );
    const suggestions = await suggestTerms(q);
    return Response.json(
      { suggestions },
      { headers: { 'Cache-Control': 'public, max-age=60' } },
    );
  } catch (e) {
    return apiError(e);
  }
}
