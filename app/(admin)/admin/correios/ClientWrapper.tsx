'use client';

import { Suspense } from 'react';
import dynamic from 'next/dynamic';

const CorreiosClient = dynamic(() => import('./CorreiosClient'), {
  ssr: false,
});

export default function ClientWrapper() {
  return (
    <Suspense fallback={null}>
      <CorreiosClient />
    </Suspense>
  );
}
