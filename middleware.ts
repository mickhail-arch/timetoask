import { NextRequest, NextResponse } from 'next/server';

export default function middleware(request: NextRequest) {
  const ua = request.headers.get('user-agent') ?? '';
  const isMobile = /mobile|android|iphone|ipad/i.test(ua);
  const { pathname } = request.nextUrl;

  if (isMobile && pathname !== '/mobile') {
    return NextResponse.redirect(new URL('/mobile', request.url));
  }

  const token = request.cookies.get('next-auth.session-token');

  if (pathname === '/') {
    return NextResponse.redirect(
      new URL(token ? '/tools' : '/login', request.url),
    );
  }

  const isAuthPage =
    pathname === '/login' ||
    pathname.startsWith('/register');

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
  matcher: ['/((?!_next|favicon.ico|api).*)'],
};
