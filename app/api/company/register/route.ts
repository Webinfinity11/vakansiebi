import { apiError, checkOrigin, readBody } from '@/lib/server/auth';
import {
  registerCompany,
  verifyCompanyEmail,
  resendCompanyVerification,
} from '@/lib/server/company-accounts';
import {
  setCompanySession,
  requireCompanyRole,
} from '@/lib/server/company-auth';
import { clientKey } from '@/lib/server/rate-limit';
import {
  clearGoogleSignup,
  pendingGoogleSignup,
} from '@/lib/server/company-google';
export const dynamic = 'force-dynamic';
export async function POST(req: Request) {
  try {
    checkOrigin(req);
    const google = await pendingGoogleSignup();
    const result = await registerCompany(
      await readBody(req),
      clientKey(req),
      google,
    );
    if (google) await clearGoogleSignup();
    await setCompanySession(result.token);
    return Response.json(
      { ok: true, deliveryPending: result.deliveryPending },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (e) {
    return apiError(e);
  }
}
export async function PATCH(req: Request) {
  try {
    checkOrigin(req);
    await resendCompanyVerification(await requireCompanyRole(), clientKey(req));
    return Response.json({ ok: true });
  } catch (e) {
    return apiError(e);
  }
}
export async function GET(req: Request) {
  try {
    await verifyCompanyEmail(new URL(req.url).searchParams.get('token') || '');
    return Response.redirect(
      `${process.env.APP_URL || 'https://jobx.ge'}/company`,
      303,
    );
  } catch (e) {
    return apiError(e);
  }
}
