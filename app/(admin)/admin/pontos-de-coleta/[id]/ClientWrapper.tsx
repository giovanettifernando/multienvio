'use client';

import { Suspense } from 'react';
import dynamic from 'next/dynamic';

const AdminPickupPointDetailsClient = dynamic(() => import('./AdminPickupPointDetailsClient'), {
  ssr: false,
});

export default function ClientWrapper() {
  return (
    <Suspense fallback={null}>
      <AdminPickupPointDetailsClient />
    </Suspense>
  );
}
