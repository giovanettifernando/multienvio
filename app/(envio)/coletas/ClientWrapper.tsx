'use client';

import { Suspense } from 'react';
import dynamic from 'next/dynamic';

const ColetasClient = dynamic(() => import('./ColetasClient'), { ssr: false });

export default function ClientWrapper() {
  return (
    <Suspense fallback={null}>
      <ColetasClient />
    </Suspense>
  );
}
