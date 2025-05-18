'use client';

import { SessionProvider } from 'next-auth/react';
import { Suspense } from 'react';

export default function ClientLayout({ children }) {
  return (
    <SessionProvider refetchInterval={0} refetchOnWindowFocus={false}>
      <Suspense fallback={
        <div className="min-h-screen flex items-center justify-center">
          <div className="animate-spin rounded-full h-32 w-32 border-t-2 border-b-2 border-blue-500"></div>
        </div>
      }>
        {children}
      </Suspense>
    </SessionProvider>
  );
}