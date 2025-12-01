'use client';

import { Suspense } from 'react';
import dynamic from 'next/dynamic';

const ShipmentDetailClient = dynamic(() => import('./ShipmentDetailClient'), { ssr: false });

export default function ClientWrapper() {
  return (
    <Suspense fallback={null}>
      <ShipmentDetailClient />
    </Suspense>
  );
}
