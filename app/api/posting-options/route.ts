import { billingSettings } from '@/lib/server/billing';
export const dynamic = 'force-dynamic';
export async function GET() {
  try {
    return Response.json(
      { premiumAvailable: !!(await billingSettings()) },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch {
    return Response.json(
      { premiumAvailable: false },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
