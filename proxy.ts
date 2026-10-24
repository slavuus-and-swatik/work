import { NextResponse, type NextRequest } from 'next/server';

// The repository still contains the original shop prototype. Only the detailing
// product is exposed by this deployment, including its own authenticated API.
export function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;
  if (path === '/') return NextResponse.redirect(new URL('/studio', request.url));

  if (
    path === '/studio' ||
    path.startsWith('/studio/') ||
    path.startsWith('/review/') ||
    path.startsWith('/client/') ||
    path === '/api/client' ||
    path === '/api/health' ||
    path === '/api/operations' ||
    path.startsWith('/s/') ||
    path.startsWith('/api/detailing/') ||
    path === '/api/platform-admin/session' ||
    path.startsWith('/_next/static/') ||
    path === '/detailing-hero.png' ||
    path.startsWith('/detailing-services/') ||
    path === '/favicon.svg' ||
    path === '/apple-touch-icon.png'
  ) {
    const response = NextResponse.next();
    response.headers.set('X-Content-Type-Options', 'nosniff');
    response.headers.set('Referrer-Policy', 'no-referrer');
    response.headers.set('X-Frame-Options', 'SAMEORIGIN');
    response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    response.headers.set('Content-Security-Policy', "frame-ancestors 'self'; object-src 'none'; base-uri 'self'; form-action 'self'");
    if (request.nextUrl.protocol === 'https:') response.headers.set('Strict-Transport-Security', 'max-age=31536000');
    return response;
  }

  return new NextResponse('Not found', { status: 404 });
}
