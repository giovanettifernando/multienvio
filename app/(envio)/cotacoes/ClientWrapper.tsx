'use client';

import { Suspense } from 'react';
import dynamic from 'next/dynamic';

const CotacoesClient = dynamic(() => import('./CotacoesClient'), {
  ssr: false,
});

export default function ClientWrapper() {
  return (
    <Suspense fallback={null}>
      <CotacoesClient />
    </Suspense>
  );
}
