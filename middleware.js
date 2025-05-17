import { withAuth } from 'next-auth/middleware';

export default withAuth({
  callbacks: {
    authorized: ({ token }) => !!token,
  },
});

export const config = {
  matcher: [
    '/api/movies/:path*',
    '/api/lists/:path*',
    '/api/comments/:path*',
  ],
}; 