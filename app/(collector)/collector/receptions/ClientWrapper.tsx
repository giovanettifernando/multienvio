'use client';

import { Suspense } from 'react';
import dynamic from 'next/dynamic';

const ReceptionsClient = dynamic(() => import('./ReceptionsClient'), {
  ssr: false,
});

export default function ClientWrapper() {
  return (
    <Suspense fallback={null}>
      <ReceptionsClient />
    </Suspense>
  );
}
