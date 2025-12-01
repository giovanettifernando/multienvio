'use client';

import { Suspense } from 'react';
import dynamic from 'next/dynamic';

const CollectorDashClient = dynamic(() => import('./CollectorDashClient'), {
  ssr: false,
});

export default function ClientWrapper() {
  return (
    <Suspense fallback={null}>
      <CollectorDashClient />
    </Suspense>
  );
}
