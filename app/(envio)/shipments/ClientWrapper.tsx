'use client';

import { Suspense } from 'react';
import dynamic from 'next/dynamic';

const ShipmentsClient = dynamic(() => import('./ShipmentsClient'), { ssr: false });

export default function ClientWrapper() {
  return (
    <Suspense fallback={null}>
      <ShipmentsClient />
    </Suspense>
  );
}
