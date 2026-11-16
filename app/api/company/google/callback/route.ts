import { ApiError } from '@/lib/server/auth';
import { setCompanySession } from '@/lib/server/company-auth';
import { finishGoogleSignIn } from '@/lib/server/company-google';
export const dynamic = 'force-dynamic';

/* The session cookie is SameSite=Strict, so it is not sent on a redirect chain
   that started at Google. A same-site page hop makes the next request carry it. */
function continueTo(path: string) {
  const target = path.replace(/[^a-zA-Z0-9/?=&_-]/g, '');
  return new Response(
    `<!doctype html><meta charset="utf-8"><meta http-equiv="refresh" content="0;url=${target}"><title>ჯობიქსი</title><a href="${target}">გაგრძელება</a>`,
    {
      headers: {
        'content-type': 'text/html; charset=utf-8',
        'cache-control': 'no-store',
        'referrer-policy': 'no-referrer',
      },
    },
  );
}
export async function GET(req: Request) {
  try {
    const outcome = await finishGoogleSignIn(new URL(req.url).searchParams);
    if (outcome.result === 'signed-in') {
      await setCompanySession(outcome.token);
      return continueTo('/company');
    }
    if (outcome.result === 'register')
      return continueTo('/company?register=1&google=1');
    return continueTo('/company');
  } catch (e) {
    const reason =
      e instanceof ApiError && e.status === 409
        ? 'conflict'
        : e instanceof ApiError && e.status === 403
          ? 'disabled'
          : 'failed';
    return continueTo(`/company?google=${reason}`);
  }
}
