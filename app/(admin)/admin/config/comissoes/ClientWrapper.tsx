'use client';

import { Suspense } from 'react';
import dynamic from 'next/dynamic';

const ComissoesClient = dynamic(() => import('./ComissoesClient'), {
  ssr: false,
});

export default function ClientWrapper() {
  return (
    <Suspense fallback={null}>
      <ComissoesClient />
    </Suspense>
  );
}
