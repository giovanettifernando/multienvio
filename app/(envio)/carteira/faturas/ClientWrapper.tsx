'use client';

import { Suspense } from 'react';
import dynamic from 'next/dynamic';

const FaturasClient = dynamic(() => import('./FaturasClient'), {
  ssr: false,
});

export default function ClientWrapper() {
  return (
    <Suspense fallback={null}>
      <FaturasClient />
    </Suspense>
  );
}
