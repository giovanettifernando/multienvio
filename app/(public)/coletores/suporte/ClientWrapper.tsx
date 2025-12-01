'use client';

import { Suspense } from 'react';
import dynamic from 'next/dynamic';

const SuporteClient = dynamic(() => import('./SuporteClient'), {
  ssr: false,
});

export default function ClientWrapper() {
  return (
    <Suspense fallback={null}>
      <SuporteClient />
    </Suspense>
  );
}
