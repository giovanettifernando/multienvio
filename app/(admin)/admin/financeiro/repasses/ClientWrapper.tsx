'use client';

import { Suspense } from 'react';
import dynamic from 'next/dynamic';

const RepassesClient = dynamic(() => import('./RepassesClient'), {
  ssr: false,
});

export default function ClientWrapper() {
  return (
    <Suspense fallback={null}>
      <RepassesClient />
    </Suspense>
  );
}
