'use client';

import { Suspense } from 'react';
import dynamic from 'next/dynamic';

const VerificarEmailClient = dynamic(() => import('./VerificarEmailClient'), {
  ssr: false,
});

export default function ClientWrapper() {
  return (
    <Suspense fallback={null}>
      <VerificarEmailClient />
    </Suspense>
  );
}
