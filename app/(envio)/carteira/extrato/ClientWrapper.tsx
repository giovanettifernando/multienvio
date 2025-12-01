'use client';

import { Suspense } from 'react';
import dynamic from 'next/dynamic';

const ExtratoClient = dynamic(() => import('./ExtratoClient'), {
  ssr: false,
});

export default function ClientWrapper() {
  return (
    <Suspense fallback={null}>
      <ExtratoClient />
    </Suspense>
  );
}
