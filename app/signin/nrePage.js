'use client';
import { Suspense } from 'react';
import SignInClient from './testPage';

export default function SignInPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <SignInPage />
    </Suspense>
  );
}