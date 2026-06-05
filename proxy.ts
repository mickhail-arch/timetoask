import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';

const MUTATING = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

export default async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 1) Read-only barrier: блокируем мутации в режиме поддержки "только просмотр"
  if (pathname.startsWith('/api/')) {
    if (
      MUTATING.has(request.method) &&
      pathname !== '/api/admin/impersonate/stop'
    ) {
      const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
      if (token?.impersonationLevel === 'view') {
        return NextResponse.json(
          { error: { code: 'READ_ONLY_IMPERSONATION', message: 'Режим поддержки: только просмотр', statusCode: 403 } },
          { status: 403 },
        );
      }
    }
    // прочие /api запросы пропускаем без редирект-логики ниже
    return NextResponse.next();
  }

  // 2) Существующая логика редиректов (страницы)
  const token = request.cookies.get('next-auth.session-token');

  if (pathname === '/') {
    return NextResponse.redirect(new URL(token ? '/tools' : '/login', request.url));
  }

  const isAuthPage = pathname === '/login' || pathname.startsWith('/register');
  if (isAuthPage && token) {
    return NextResponse.redirect(new URL('/tools', request.url));
  }

  const isProtected =
    pathname.startsWith('/tools') ||
    pathname.startsWith('/billing') ||
    pathname.startsWith('/profile') ||
    pathname.startsWith('/admin') ||
    pathname.startsWith('/settings');

  if (isProtected && !token) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next|favicon.ico).*)'],
};
