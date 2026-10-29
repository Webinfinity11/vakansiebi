import { ApiError, apiError, checkOrigin, readBody } from '@/lib/server/auth';
import { manageJobAlert } from '@/lib/server/job-alerts';
export const dynamic = 'force-dynamic';
export async function POST(request: Request) {
  try {
    const url = new URL(request.url);
    // RFC 8058: the signed, action-specific unsubscribe token authorizes the mail client's POST.
    const oneClick =
      url.searchParams.get('action') === 'unsubscribe' &&
      request.headers
        .get('content-type')
        ?.startsWith('application/x-www-form-urlencoded');
    if (!oneClick) checkOrigin(request);
    const body = oneClick
      ? { action: 'unsubscribe', token: url.searchParams.get('token') }
      : await readBody(request);
    if (oneClick && (await request.text()) !== 'List-Unsubscribe=One-Click')
      throw new ApiError('არასწორი მოთხოვნა');
    if (
      !['confirm', 'unsubscribe'].includes(body.action) ||
      typeof body.token !== 'string'
    )
      throw new ApiError('არასწორი ბმული');
    const ok = await manageJobAlert(body.token, body.action);
    if (!ok)
      throw new ApiError(
        'ბმული არასწორია ან ვადა გაუვიდა. გამოწერა ხელახლა მოითხოვე.',
        400,
      );
    return Response.json(
      { ok: true },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (e) {
    return apiError(e);
  }
}
