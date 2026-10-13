import { NextResponse, type NextRequest } from 'next/server';
import { limitPublicRead } from './lib/server/public-read-limit';

// Retired navigation context is kept in browser history, not public URLs.
export async function proxy(request: NextRequest) {
  const limited = await limitPublicRead(request);
  if (limited) return limited;
  if (
    request.nextUrl.pathname.startsWith('/api/') ||
    !['GET', 'HEAD'].includes(request.method) ||
    !request.nextUrl.searchParams.has('from')
  ) {
    return NextResponse.next();
  }
  const url = request.nextUrl.clone();
  url.searchParams.delete('from');
  return NextResponse.redirect(url, 308);
}

export const config = {
  matcher: [
    '/',
    '/vacancies/:path*',
    '/companies/:path*',
    '/cv',
    '/post-job',
    '/api/:path*',
  ],
};
