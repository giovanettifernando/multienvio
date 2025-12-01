'use client';

import { Suspense } from 'react';
import dynamic from 'next/dynamic';

const RastreamentoDetailClient = dynamic(() => import('./RastreamentoDetailClient'), { ssr: false });

export default function ClientWrapper() {
  return (
    <Suspense fallback={null}>
      <RastreamentoDetailClient />
    </Suspense>
  );
}
