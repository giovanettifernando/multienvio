'use client';

import { Suspense } from 'react';
import dynamic from 'next/dynamic';

const ColetasColetorClient = dynamic(() => import('./ColetasColetorClient'), {
  ssr: false,
});

export default function ClientWrapper() {
  return (
    <Suspense fallback={null}>
      <ColetasColetorClient />
    </Suspense>
  );
}
