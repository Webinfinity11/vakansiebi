import { trackingUpdateSchema } from '@/lib/tracking';
import { trackingSettings } from '@/lib/server/tracking';
import { transaction } from '@/lib/server/db';
import {
  ApiError,
  apiError,
  requireAdmin,
  checkOrigin,
  readBody,
} from '@/lib/server/auth';
export const dynamic = 'force-dynamic';
export async function GET() {
  try {
    await requireAdmin();
    return Response.json(await trackingSettings(), {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (e) {
    return apiError(e);
  }
}
export async function POST(req: Request) {
  try {
    await requireAdmin();
    checkOrigin(req);
    const value = trackingUpdateSchema.parse(await readBody(req));
    const version = await transaction(async (c) => {
      const before = (
        await c.query(
          'SELECT settings, version FROM tracking_settings WHERE id=true FOR UPDATE',
        )
      ).rows[0];
      if (!before || before.version !== value.version)
        throw new ApiError(
          'პარამეტრები უკვე შეიცვალა. განაახლე გვერდი და სცადე თავიდან.',
          409,
        );
      await c.query(
        'UPDATE tracking_settings SET settings=$1, version=version+1, updated_at=now() WHERE id=true',
        [value.settings],
      );
      await c.query(
        "INSERT INTO audit_log(action,actor,before_data,after_data) VALUES('tracking.settings.updated','admin',$1,$2)",
        [before.settings, value.settings],
      );
      return before.version + 1;
    });
    return Response.json(
      { settings: value.settings, version },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (e) {
    return apiError(e);
  }
}
