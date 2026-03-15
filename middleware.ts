import { NextRequest, NextResponse } from 'next/server';

export default function middleware(request: NextRequest) {
  const token = request.cookies.get('next-auth.session-token');
  const { pathname } = request.nextUrl;

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
  matcher: ['/dashboard/:path*', '/login', '/register/:path*'],
};
