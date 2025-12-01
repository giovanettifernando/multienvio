'use client';

import { Suspense } from 'react';
import dynamic from 'next/dynamic';

const LoginColetorClient = dynamic(() => import('./LoginColetorClient'), {
  ssr: false,
});

export default function ClientWrapper() {
  return (
    <Suspense fallback={null}>
      <LoginColetorClient />
    </Suspense>
  );
}
