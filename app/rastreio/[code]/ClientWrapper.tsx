'use client';

import { Suspense } from 'react';
import dynamic from 'next/dynamic';

const PublicTrackingClient = dynamic(() => import('./PublicTrackingClient'), { ssr: false });

export default function ClientWrapper() {
  return (
    <Suspense fallback={null}>
      <PublicTrackingClient />
    </Suspense>
  );
}
