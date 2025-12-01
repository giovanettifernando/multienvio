'use client';

import { Suspense } from 'react';
import dynamic from 'next/dynamic';

const LoginClient = dynamic(() => import('./LoginClient'), {
  ssr: false,
});

export default function ClientWrapper() {
  return (
    <Suspense fallback={null}>
      <LoginClient />
    </Suspense>
  );
}
