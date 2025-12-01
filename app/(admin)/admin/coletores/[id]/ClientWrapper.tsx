'use client';

import { Suspense } from 'react';
import dynamic from 'next/dynamic';

const CollectorDetailClient = dynamic(() => import('./CollectorDetailClient'), {
  ssr: false,
});

export default function ClientWrapper() {
  return (
    <Suspense fallback={null}>
      <CollectorDetailClient />
    </Suspense>
  );
}
