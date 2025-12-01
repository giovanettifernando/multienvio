'use client';

import { Suspense } from 'react';
import dynamic from 'next/dynamic';

const OperacoesClient = dynamic(() => import('./OperacoesClient'), {
  ssr: false,
});

export default function ClientWrapper() {
  return (
    <Suspense fallback={null}>
      <OperacoesClient />
    </Suspense>
  );
}
