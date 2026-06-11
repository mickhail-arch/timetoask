import { NextResponse, type NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';

const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  "connect-src 'self' https:",
  "frame-ancestors 'none'",
  "object-src 'none'",
  "base-uri 'self'",
].join('; ');

const MUTATING = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

function applySecurityHeaders(res: NextResponse): NextResponse {
  res.headers.set('Content-Security-Policy', CSP);
  res.headers.set('Strict-Transport-Security', 'max-age=63072000; includeSubDomains');
  res.headers.set('X-Frame-Options', 'DENY');
  res.headers.set('X-Content-Type-Options', 'nosniff');
  res.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  return res;
}

export async function proxy(req: NextRequest) {
  const path = req.nextUrl.pathname;

  if (path.startsWith('/api/')) {
    // Режим просмотра (view-impersonation): любые изменения запрещены.
    // Исключение — выход из импер­сонации, иначе агент не сможет выйти.
    if (MUTATING.has(req.method) && !path.startsWith('/api/admin/impersonate')) {
      const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
      if (token?.impersonationLevel === 'view') {
        return applySecurityHeaders(
          NextResponse.json(
            { error: { code: 'FORBIDDEN', message: 'Режим просмотра: изменения запрещены', statusCode: 403 } },
            { status: 403 },
          ),
        );
      }
    }
    return applySecurityHeaders(NextResponse.next());
  }

  const res = NextResponse.next();

  const ref = req.nextUrl.searchParams.get('r');
  if (ref && !req.cookies.get('ref')) {
    res.cookies.set('ref', ref, {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 30, // 30 дней — окно атрибуции
    });
  }
  return applySecurityHeaders(res);
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
