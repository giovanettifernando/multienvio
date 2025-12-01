'use client';

import { Suspense } from 'react';
import dynamic from 'next/dynamic';

const RastreamentoClient = dynamic(() => import('./RastreamentoClient'), { ssr: false });

export default function ClientWrapper() {
  return (
    <Suspense fallback={null}>
      <RastreamentoClient />
    </Suspense>
  );
}
