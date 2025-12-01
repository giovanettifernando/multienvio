'use client';

import { Suspense } from 'react';
import dynamic from 'next/dynamic';

const FinalizarClient = dynamic(() => import('./FinalizarClient'), {
  ssr: false,
});

export default function ClientWrapper() {
  return (
    <Suspense fallback={null}>
      <FinalizarClient />
    </Suspense>
  );
}
