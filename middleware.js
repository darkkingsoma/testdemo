import { withAuth } from 'next-auth/middleware';

export default withAuth({
  callbacks: {
    authorized: ({ token }) => !!token,
  },
});

export const config = {
  matcher: [
    '/',
    '/movie/:path*',
    '/api/movies/:path*',
    '/api/user/:path*',
    '/((?!api/auth|signin|signup|_next/static|_next/image|favicon.ico).*)',
  ],
}; 