import { NextResponse, type NextRequest } from 'next/server';

// Retired navigation context is kept in browser history, not public URLs.
export function proxy(request: NextRequest) {
  if (!['GET', 'HEAD'].includes(request.method) || !request.nextUrl.searchParams.has('from')) {
    return NextResponse.next();
  }
  const url = request.nextUrl.clone();
  url.searchParams.delete('from');
  return NextResponse.redirect(url, 308);
}

export const config = {
  matcher: ['/', '/vacancies/:path*', '/companies/:path*', '/cv', '/post-job'],
};
