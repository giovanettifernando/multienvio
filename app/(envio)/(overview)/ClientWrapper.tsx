'use client';

import { Suspense } from 'react';
import dynamic from 'next/dynamic';

const OverviewClient = dynamic(() => import('./OverviewClient'), {
  ssr: false,
});

export default function ClientWrapper() {
  return (
    <Suspense fallback={null}>
      <OverviewClient />
    </Suspense>
  );
}
