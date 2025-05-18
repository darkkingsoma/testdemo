import { withAuth } from 'next-auth/middleware';
import { NextResponse } from 'next/server';

export default withAuth(
  function middleware(req) {
    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: ({ token }) => !!token,
    },
  }
);

export const config = {
  matcher: [
    '/',
    '/movie/:path*',
    '/api/movies/:path*',
    '/api/user/:path*',
    '/((?!api/auth|signin|signup|_next/static|_next/image|favicon.ico).*)',
  ],
}; 