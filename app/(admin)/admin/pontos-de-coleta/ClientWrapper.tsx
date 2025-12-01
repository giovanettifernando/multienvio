'use client';

import { Suspense } from 'react';
import dynamic from 'next/dynamic';

const PickupPointsClient = dynamic(() => import('./PickupPointsClient'), {
  ssr: false,
});

export default function ClientWrapper() {
  return (
    <Suspense fallback={null}>
      <PickupPointsClient />
    </Suspense>
  );
}
