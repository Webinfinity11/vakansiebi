import { startGoogleSignIn } from '@/lib/server/company-google';
export const dynamic = 'force-dynamic';
export async function GET() {
  const base = process.env.APP_URL || 'https://jobx.ge';
  try {
    return Response.redirect(await startGoogleSignIn(), 303);
  } catch {
    return Response.redirect(`${base}/company?google=unavailable`, 303);
  }
}
