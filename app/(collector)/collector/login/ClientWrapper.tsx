'use client';

import { Suspense } from 'react';
import dynamic from 'next/dynamic';

const LoginCollectorClient = dynamic(() => import('./LoginCollectorClient'), {
  ssr: false,
});

export default function ClientWrapper() {
  return (
    <Suspense fallback={null}>
      <LoginCollectorClient />
    </Suspense>
  );
}
