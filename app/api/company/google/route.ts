import { apiError, checkOrigin } from '@/lib/server/auth';
import {
  clearGoogleSignup,
  pendingGoogleSignup,
} from '@/lib/server/company-google';
export const dynamic = 'force-dynamic';
// The verified Google identity waiting for the company details, if any.
export async function GET() {
  const google = await pendingGoogleSignup();
  return Response.json(
    google ? { email: google.email, name: google.name } : null,
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
export async function DELETE(req: Request) {
  try {
    checkOrigin(req);
    await clearGoogleSignup();
    return Response.json({ ok: true });
  } catch (e) {
    return apiError(e);
  }
}
