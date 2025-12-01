'use client';

import { Suspense } from 'react';
import dynamic from 'next/dynamic';

const DespesasClient = dynamic(() => import('./DespesasClient'), {
  ssr: false,
});

export default function ClientWrapper() {
  return (
    <Suspense fallback={null}>
      <DespesasClient />
    </Suspense>
  );
}
