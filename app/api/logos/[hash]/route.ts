import { db } from '@/lib/server/db';
import { apiError, isAdmin } from '@/lib/server/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  context: { params: Promise<{ hash: string }> },
) {
  const notFound = () =>
    new Response(null, {
      status: 404,
      headers: { 'Cache-Control': 'private, no-store' },
    });
  const { hash } = await context.params;
  // Next.js may append its deployment identifier to image requests.
  const query = new URL(request.url).searchParams;
  if (!/^[a-f0-9]{64}$/.test(hash) || [...query.keys()].some((key) => key !== 'dpl'))
    return notFound();
  try {
    const logo = (
      await db().query(
        'SELECT content_type,data,approved_at FROM submission_logos WHERE hash=$1',
        [hash],
      )
    ).rows[0];
    if (!logo || (!logo.approved_at && !(await isAdmin()))) return notFound();
    // An unapproved preview must never enter a shared or browser cache.
    const headers = {
      'Content-Type': logo.content_type,
      'Content-Length': String(logo.data.length),
      'Cache-Control': logo.approved_at
        ? 'public, max-age=31536000, immutable'
        : 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': "default-src 'none'; sandbox",
    };
    return new Response(new Uint8Array(logo.data), { headers });
  } catch (error) {
    const response = apiError(error);
    response.headers.set('Cache-Control', 'private, no-store');
    return response;
  }
}
