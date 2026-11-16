import { db } from '@/lib/server/db';
export const runtime = 'nodejs';
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ hash: string }> },
) {
  const { hash } = await params;
  if (!/^[a-f0-9]{64}$/.test(hash)) return new Response(null, { status: 404 });
  // Unsaved uploads cannot be read through the public endpoint.
  const { rows } = await db().query(
    `SELECT i.data FROM company_cover_images i JOIN company_profiles p ON p.company_key=i.company_key
    WHERE i.hash=$1 AND p.cover_url=$2`,
    [hash, '/api/company-covers/' + hash],
  );
  if (!rows[0]) return new Response(null, { status: 404 });
  return new Response(new Uint8Array(rows[0].data), {
    headers: {
      'Content-Type': 'image/webp',
      'Cache-Control': 'public, max-age=3600',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
