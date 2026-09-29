import { publicTracking } from '@/lib/tracking';
import { trackingSettings } from '@/lib/server/tracking';
export const dynamic = 'force-dynamic';
export async function GET() {
  try {
    const { settings } = await trackingSettings();
    return Response.json(publicTracking(settings), {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch {
    // A configuration failure must not break pages or re-enable disabled tags.
    return Response.json(
      { error: 'Tracking unavailable' },
      { status: 503, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
