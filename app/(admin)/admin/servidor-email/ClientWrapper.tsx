'use client';

import { Suspense } from 'react';
import dynamic from 'next/dynamic';

const EmailServerClient = dynamic(() => import('./EmailServerClient'), {
  ssr: false,
});

export default function ClientWrapper() {
  return (
    <Suspense fallback={null}>
      <EmailServerClient />
    </Suspense>
  );
}
