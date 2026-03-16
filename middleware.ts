import { NextRequest, NextResponse } from 'next/server';

export default function middleware(request: NextRequest) {
  const ua = request.headers.get('user-agent') ?? '';
  const isMobile = /mobile|android|iphone|ipad/i.test(ua);
  const { pathname } = request.nextUrl;

  if (isMobile && pathname !== '/mobile') {
    return NextResponse.redirect(new URL('/mobile', request.url));
  }

  const token = request.cookies.get('next-auth.session-token');

  const isAuthPage =
    pathname === '/login' ||
    pathname.startsWith('/register');

  if (isAuthPage && token) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  if (pathname.startsWith('/dashboard') && !token) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next|favicon.ico|api).*)'],
};
