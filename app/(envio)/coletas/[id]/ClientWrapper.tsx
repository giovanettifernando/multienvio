'use client';

import { Suspense } from 'react';
import dynamic from 'next/dynamic';

const PickupDetailClient = dynamic(() => import('./PickupDetailClient'), {
  ssr: false,
});

export default function ClientWrapper() {
  return (
    <Suspense fallback={null}>
      <PickupDetailClient />
    </Suspense>
  );
}
