'use client';

import { Suspense } from 'react';
import dynamic from 'next/dynamic';

const CorreiosAgenciesClient = dynamic(() => import('./CorreiosAgenciesClient'), {
  ssr: false,
});

export default function ClientWrapper() {
  return (
    <Suspense fallback={null}>
      <CorreiosAgenciesClient />
    </Suspense>
  );
}
