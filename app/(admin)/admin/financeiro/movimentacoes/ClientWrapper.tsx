'use client';

import { Suspense } from 'react';
import dynamic from 'next/dynamic';

const MovimentacoesClient = dynamic(() => import('./MovimentacoesClient'), {
  ssr: false,
});

export default function ClientWrapper() {
  return (
    <Suspense fallback={null}>
      <MovimentacoesClient />
    </Suspense>
  );
}
