import { db } from '@/lib/server/db';
export const dynamic = 'force-dynamic';
export async function GET() {
  try {
    await db().query('SELECT 1 FROM sources LIMIT 1');
    return Response.json(
      { status: 'ok', revision: process.env.VERCEL_GIT_COMMIT_SHA ?? null },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch {
    return Response.json({ status: 'unavailable' }, { status: 503 });
  }
}
